import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
let recebiveisService;
let api;

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '/src/theme/theme.ts';
import Recebiveis from '/src/pages/Financeiro/Recebiveis.tsx';
createRoot(document.getElementById('root')).render(
    React.createElement(ThemeProvider, { theme }, React.createElement(React.Fragment, null,
        React.createElement(CssBaseline), React.createElement(Recebiveis)))
);
`;

const recebiveisBase = [
    { id: 1, vendaId: 123, pagamentoId: 501, tipo: "CREDITO", numeroParcela: 1, totalParcelas: 1,
        valorBruto: 100, valorLiquidoPrevisto: 96.5, taxaPercentualSnapshot: 3, taxaFixaSnapshot: 0.5,
        valorTaxasPrevisto: 3.5, prazoRecebimentoDiasSnapshot: 30,
        dataVenda: "2026-09-30T12:00:00", dataPrevistaRecebimento: "2026-10-30",
        status: "PENDENTE", configuracaoNomeExibicao: "Crédito Loja", valorLiquidoRecebido: null,
        dataLiquidacao: null, usuarioLiquidacaoId: null, dataCancelamento: null, usuarioCancelamentoId: null,
        movimentacaoFinanceiraId: null },
    { id: 2, vendaId: 124, pagamentoId: 502, tipo: "DEBITO", numeroParcela: 1, totalParcelas: 1,
        valorBruto: 75.5, valorLiquidoPrevisto: 75.5, dataVenda: "2026-09-30T12:00:00", dataPrevistaRecebimento: "2026-10-02",
        taxaPercentualSnapshot: null, taxaFixaSnapshot: null, valorTaxasPrevisto: null, prazoRecebimentoDiasSnapshot: null,
        status: "LIQUIDADO", configuracaoNomeExibicao: "Débito Loja", valorLiquidoRecebido: 75.5,
        dataLiquidacao: "2026-10-01T13:00:00", usuarioLiquidacaoId: 8, dataCancelamento: null,
        usuarioCancelamentoId: null, movimentacaoFinanceiraId: 901 },
    { id: 3, vendaId: 125, pagamentoId: 503, tipo: "CREDITO", numeroParcela: 1, totalParcelas: 1,
        valorBruto: 30, valorLiquidoPrevisto: 30, dataVenda: "2026-09-29T12:00:00", dataPrevistaRecebimento: null,
        taxaPercentualSnapshot: null, taxaFixaSnapshot: null, valorTaxasPrevisto: null, prazoRecebimentoDiasSnapshot: null,
        status: "CANCELADO", configuracaoNomeExibicao: null, valorLiquidoRecebido: null,
        dataLiquidacao: null, usuarioLiquidacaoId: null, dataCancelamento: "2026-09-30T13:00:00",
        usuarioCancelamentoId: 8, movimentacaoFinanceiraId: null },
];

const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "*",
};

function criarBackendMock({ rows = recebiveisBase, postStatus = 200, bloquearPost = false } = {}) {
    const estado = {
        rows: structuredClone(rows),
        requests: [],
        postStatus,
        bloquearPost,
        postStarted: null,
        liberarPost: null,
    };
    estado.postStarted = new Promise((resolve) => { estado.marcarPostIniciado = resolve; });
    const postGate = new Promise((resolve) => { estado.liberarPost = resolve; });

    estado.interceptar = async (route) => {
        const request = route.request();
        const method = request.method();
        const url = new URL(request.url());
        if (method === "OPTIONS") {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }

        const registro = { method, url, body: request.postData() };
        estado.requests.push(registro);
        if (method === "GET") {
            const filtrados = estado.rows.filter((item) =>
                (!url.searchParams.has("status") || item.status === url.searchParams.get("status")) &&
                (!url.searchParams.has("tipo") || item.tipo === url.searchParams.get("tipo")) &&
                (!url.searchParams.has("vendaId") || item.vendaId === Number(url.searchParams.get("vendaId"))) &&
                (!url.searchParams.has("dataInicial") || item.dataVenda.slice(0, 10) >= url.searchParams.get("dataInicial")) &&
                (!url.searchParams.has("dataFinal") || item.dataVenda.slice(0, 10) <= url.searchParams.get("dataFinal"))
            );
            const page = Number(url.searchParams.get("page") ?? 0);
            const size = Number(url.searchParams.get("size") ?? 25);
            await route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders,
                body: JSON.stringify({ items: filtrados.slice(page * size, (page + 1) * size), page, size,
                    totalItems: filtrados.length, totalPages: Math.ceil(filtrados.length / size) }) });
            return;
        }

        if (method === "POST") {
            estado.marcarPostIniciado();
            if (estado.bloquearPost) await postGate;
            if (estado.postStatus !== 200) {
                const detail = estado.postStatus === 409
                    ? "Pagamento sem destino financeiro historico."
                    : "Acesso negado.";
                await route.fulfill({ status: estado.postStatus, contentType: "application/json", headers: corsHeaders,
                    body: JSON.stringify({ detail }) });
                return;
            }
            const id = Number(url.pathname.split("/").at(-2));
            const item = estado.rows.find((recebivel) => recebivel.id === id);
            Object.assign(item, { status: "LIQUIDADO", valorLiquidoRecebido: item.valorLiquidoPrevisto,
                dataLiquidacao: "2026-10-01T14:00:00", usuarioLiquidacaoId: 8, movimentacaoFinanceiraId: 990 });
            await route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders,
                body: JSON.stringify(item) });
        }
    };
    return estado;
}

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-recebiveis-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "recebiveis-test-fixture",
            resolveId(id) { if (id === "/recebiveis-fixture.js") return "\0recebiveis-fixture.js"; },
            load(id) { if (id === "\0recebiveis-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use("/__recebiveis", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml("/__recebiveis", '<div id="root"></div><script type="module" src="/recebiveis-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/__recebiveis`;
    browser = await chromium.launch({ headless: true });
    const [serviceModule, apiModule] = await Promise.all([
        server.ssrLoadModule("/src/services/recebivelService.ts"),
        server.ssrLoadModule("/src/services/api.ts"),
    ]);
    recebiveisService = serviceModule;
    api = apiModule.default;
});

after(async () => {
    await browser?.close();
    await server?.close();
});

async function comTela(callback, options = {}) {
    const estado = criarBackendMock(options);
    const page = await browser.newPage();
    await page.route("**/financeiro/recebiveis**", estado.interceptar);
    try {
        await page.addInitScript((perfil) => localStorage.setItem("novexa-auth", JSON.stringify({
            token: "token-e2e", perfil, empresa: { id: 1 },
        })), options.perfil ?? "ADMIN");
        await page.goto(url);
        await page.getByRole("table").waitFor();
        await callback(page, estado);
    } finally {
        await page.close();
    }
}

test("service envia paginação, filtros suportados e POST de liquidação sem body", async () => {
    const adapterAnterior = api.defaults.adapter;
    const localStorageAnterior = globalThis.localStorage;
    const chamadas = [];
    globalThis.localStorage = { getItem: () => null };
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        return { data: { items: [], page: 2, size: 10, totalItems: 31, totalPages: 4 },
            status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        await recebiveisService.listarRecebiveis({ page: 2, size: 10, sort: "valorBruto,asc", status: "PENDENTE",
            tipo: "CREDITO", dataInicial: "2026-10-01", dataFinal: "2026-10-31", vendaId: 123 });
        await recebiveisService.liquidarRecebivel(77);
        assert.equal(chamadas[0].url, "/financeiro/recebiveis");
        assert.deepEqual(chamadas[0].params, { page: 2, size: 10, sort: "valorBruto,asc", status: "PENDENTE",
            tipo: "CREDITO", dataInicial: "2026-10-01", dataFinal: "2026-10-31", vendaId: 123 });
        assert.equal(chamadas[1].method, "post");
        assert.equal(chamadas[1].url, "/financeiro/recebiveis/77/liquidar");
        assert.equal(chamadas[1].data, undefined);
    } finally {
        api.defaults.adapter = adapterAnterior;
        if (localStorageAnterior === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = localStorageAnterior;
    }
});

test("rota de Recebíveis está registrada em AppRoutes e no grupo Financeiro", async () => {
    const navigation = await readFile(new URL("../src/routes/navigation.tsx", import.meta.url), "utf8");
    const routes = await readFile(new URL("../src/routes/AppRoutes.tsx", import.meta.url), "utf8");

    assert.match(navigation, /caminho: "financeiro\/recebiveis"/);
    assert.match(navigation, /id: "recebiveis", titulo: "Recebíveis", rota: rotaRecebiveis/);
    assert.match(routes, /rotasInternas\.map\(\(rota\)/);
});

test("a listagem consome paginação remota e carrega page, size e sort do backend", () => comTela(async (page, estado) => {
    const rows = Array.from({ length: 31 }, (_, index) => ({ ...recebiveisBase[0], id: index + 1,
        vendaId: index + 100, dataVenda: `2026-10-${String(31 - index).padStart(2, "0")}T12:00:00` }));
    estado.rows = structuredClone(rows);
    await page.reload();
    await page.getByText("1–25 de 31", { exact: true }).waitFor();
    let get = estado.requests.find((request) => request.method === "GET");
    assert.equal(get.url.searchParams.get("page"), "0");
    assert.equal(get.url.searchParams.get("size"), "25");
    assert.equal(get.url.searchParams.get("sort"), "dataVenda,desc");
    assert.equal(get.url.searchParams.has("busca"), false);

    const next = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return responseUrl.pathname.endsWith("/financeiro/recebiveis") && responseUrl.searchParams.get("page") === "1";
    });
    await page.getByRole("button", { name: "Próxima página" }).click();
    await next;
    get = estado.requests.filter((request) => request.method === "GET").at(-1);
    assert.equal(get.url.searchParams.get("page"), "1");
    assert.equal(get.url.searchParams.get("size"), "25");

    const source = await readFile(new URL("../src/pages/Financeiro/Recebiveis.tsx", import.meta.url), "utf8");
    assert.match(source, /ordenacaoRemota/);
    assert.doesNotMatch(source, /\.slice\(|\.filter\(|\.sort\(/);
}, { rows: Array.from({ length: 31 }, (_, index) => ({ ...recebiveisBase[0], id: index + 1,
    vendaId: index + 100, dataVenda: `2026-10-${String(31 - index).padStart(2, "0")}T12:00:00` })) }));

test("filtros de status, tipo, datas e venda são enviados ao backend", () => comTela(async (page) => {
    const aguardarFiltro = (params) => page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return responseUrl.pathname.endsWith("/financeiro/recebiveis") &&
            Object.entries(params).every(([key, value]) => responseUrl.searchParams.get(key) === value);
    });

    let response = aguardarFiltro({ status: "PENDENTE" });
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Pendente", exact: true }).click();
    await response;

    response = aguardarFiltro({ status: "PENDENTE", tipo: "CREDITO" });
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "Crédito", exact: true }).click();
    await response;

    response = aguardarFiltro({ status: "PENDENTE", tipo: "CREDITO", dataInicial: "2026-10-01" });
    await page.getByLabel("Data inicial").fill("2026-10-01");
    await response;

    response = aguardarFiltro({ status: "PENDENTE", tipo: "CREDITO", dataInicial: "2026-10-01", dataFinal: "2026-10-31" });
    await page.getByLabel("Data final").fill("2026-10-31");
    await response;

    response = aguardarFiltro({ status: "PENDENTE", tipo: "CREDITO", dataInicial: "2026-10-01",
        dataFinal: "2026-10-31", vendaId: "123" });
    await page.getByLabel("Venda").fill("123");
    await response;
}, { rows: recebiveisBase }));

test("ADMIN vê Liquidar em PENDENTE e não vê a ação em LIQUIDADO/CANCELADO", () => comTela(async (page) => {
    await page.getByText("Pendente", { exact: true }).waitFor();
    await page.getByText("Liquidado", { exact: true }).waitFor();
    await page.getByText("Cancelado", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar recebível #1" }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Liquidar recebível #2" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Liquidar recebível #3" }).count(), 0);
}, { rows: recebiveisBase, perfil: "ADMIN" }));

test("Recebíveis exibem valores previstos do backend e mantêm legado sem snapshots", () => comTela(async (page) => {
    const venda = page.getByRole("row").filter({ hasText: "#123" });
    const textoVenda = (await venda.innerText()).replace(/\u00a0/g, " ").replace(/\s+/g, " ");
    assert.match(textoVenda, /R\$ 100,00/);
    assert.match(textoVenda, /R\$ 3,50/);
    assert.match(textoVenda, /R\$ 96,50/);
    assert.match(textoVenda, /30\/10\/2026/);

    const legado = page.getByRole("row").filter({ hasText: "#125" });
    assert.ok(await legado.getByText("—", { exact: true }).count() >= 3);
    const fonte = await readFile(new URL("../src/pages/Financeiro/Recebiveis.tsx", import.meta.url), "utf8");
    assert.match(fonte, /moeda\.format\(item\.valorTaxasPrevisto\)/);
    assert.match(fonte, /moeda\.format\(item\.valorLiquidoPrevisto\)/);
    assert.doesNotMatch(fonte, /valorBruto\s*-\s*(?:item\.)?(?:valorTaxasPrevisto|taxas)/);
}, { rows: recebiveisBase }));

test("GERENTE vê Liquidar para recebível PENDENTE", () => comTela(async (page) => {
    await page.getByText("Pendente", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar recebível #1" }).count(), 1);
}, { rows: recebiveisBase, perfil: "GERENTE" }));

for (const perfil of ["OPERADOR", "USUARIO"]) {
    test(`${perfil} consulta recebíveis sem ação Liquidar`, () => comTela(async (page) => {
        await page.getByText("Pendente", { exact: true }).waitFor();
        assert.equal(await page.getByText("Liquidado", { exact: true }).count(), 1);
        assert.equal(await page.getByRole("button", { name: "Liquidar recebível #1" }).count(), 0);
        assert.equal(await page.getByRole("dialog", { name: "Liquidar recebível?" }).count(), 0);
    }, { rows: recebiveisBase, perfil }));
}

test("confirmação liquida sem payload, recarrega a lista e remove a ação após sucesso", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Liquidar recebível #1" }).click();
    const dialog = page.getByRole("dialog", { name: "Liquidar recebível?" });
    await dialog.getByText("Venda: #123").waitFor();
    const textoConfirmacao = (await dialog.innerText()).replace(/\u00a0/g, " ").replace(/\s+/g, " ");
    assert.match(textoConfirmacao, /Valor bruto: R\$ 100,00/);
    assert.match(textoConfirmacao, /Taxa percentual: 3%/);
    assert.match(textoConfirmacao, /Taxa fixa: R\$ 0,50/);
    assert.match(textoConfirmacao, /Taxas previstas: R\$ 3,50/);
    assert.match(textoConfirmacao, /Prazo de recebimento: 30 dias/);
    assert.match(textoConfirmacao, /Valor a creditar: R\$ 96,50/);
    assert.match(textoConfirmacao, /Data prevista: 30\/10\/2026/);
    await dialog.getByText("Forma: Crédito · Crédito Loja").waitFor();
    await dialog.getByText(/snapshot histórico do Pagamento/).waitFor();

    const getCount = estado.requests.filter((request) => request.method === "GET").length;
    const postResponse = page.waitForResponse((response) => response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Liquidar", exact: true }).click();
    const response = await postResponse;
    assert.equal(response.status(), 200);
    const vendaLiquidada = page.getByRole("row").filter({ hasText: "#123" });
    await vendaLiquidada.getByText("Liquidado", { exact: true }).waitFor();
    await page.getByText("Recebível liquidado.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar recebível #1" }).count(), 0);
    assert.ok(estado.requests.filter((request) => request.method === "GET").length > getCount);
    const post = estado.requests.find((request) => request.method === "POST");
    assert.equal(post.url.pathname, "/financeiro/recebiveis/1/liquidar");
    assert.equal(post.body, null);
    assert.equal(post.url.searchParams.has("contaFinanceiraId"), false);
    assert.equal(post.url.searchParams.has("empresaId"), false);
    assert.equal(post.url.searchParams.has("tenantId"), false);
}, { rows: recebiveisBase }));

test("exibe conflito 409 de recebível legado e mantém a confirmação aberta", () => comTela(async (page) => {
    await page.getByRole("button", { name: "Liquidar recebível #1" }).click();
    const dialog = page.getByRole("dialog", { name: "Liquidar recebível?" });
    await dialog.getByRole("button", { name: "Liquidar", exact: true }).click();
    await dialog.getByRole("alert").getByText("Pagamento sem destino financeiro historico.").waitFor();
    assert.equal(await dialog.isVisible(), true);
}, { rows: recebiveisBase, postStatus: 409 }));

test("apresenta 403 do backend sem ocultar ações segundo perfil frontend", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Liquidar recebível #1" }).click();
    const dialog = page.getByRole("dialog", { name: "Liquidar recebível?" });
    await dialog.getByRole("button", { name: "Liquidar", exact: true }).click();
    await dialog.getByRole("alert").getByText("Acesso negado.").waitFor();
    assert.equal(estado.requests.filter((request) => request.method === "POST").length, 1);
}, { rows: recebiveisBase, postStatus: 403 }));

test("bloqueia submits repetidos durante a liquidação", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Liquidar recebível #1" }).click();
    await page.evaluate(() => {
        const form = document.querySelector('[aria-labelledby="liquidar-recebivel-titulo"] form');
        form?.requestSubmit();
        form?.requestSubmit();
    });
    await estado.postStarted;
    assert.equal(estado.requests.filter((request) => request.method === "POST").length, 1);
    assert.equal(await page.getByRole("button", { name: "Liquidando…" }).isDisabled(), true);
    estado.liberarPost();
    await page.getByText("Liquidado", { exact: true }).waitFor();
}, { rows: recebiveisBase, bloquearPost: true }));
