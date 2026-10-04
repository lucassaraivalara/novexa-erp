import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, api, empresaService, contaService;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const conta = (id, nome, extra = {}) => ({ id, nome, tipo: "COFRE", saldoAtual: 10, saldoInicial: 10,
    saldoInicialAuditado: true, ativo: true, contaBancaria: null, ...extra });
const empresa = (id, razaoSocial) => ({ id, razaoSocial, nomeFantasia: null, cnpj: "11222333000181", ativo: true, cadastro: {} });

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-admin-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "admin-fixture",
            resolveId(id) { if (id === "/fixture-admin.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-admin.js") return `
                import React from 'react'; import { createRoot } from 'react-dom/client';
                import { CssBaseline, ThemeProvider } from '@mui/material'; import theme from '/src/theme/theme.ts';
                import Empresa from '/src/pages/Empresa/Empresa.tsx'; import Contas from '/src/pages/Financeiro/ContasFinanceiras.tsx';
                const Tela = location.pathname === '/__empresa' ? Empresa : Contas;
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider, { theme },
                    React.createElement(CssBaseline), React.createElement(Tela)));`; },
            configureServer(vite) { for (const rota of ["/__empresa", "/__contas"]) vite.middlewares.use(rota, async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(rota, '<div id="root"></div><script type="module" src="/fixture-admin.js"></script>'));
            }); },
        }],
    });
    ({ default: api } = await server.ssrLoadModule("/src/services/api.ts"));
    empresaService = await server.ssrLoadModule("/src/services/empresaService.ts");
    contaService = await server.ssrLoadModule("/src/services/contaFinanceiraService.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function esperar(condicao) {
    for (let i = 0; i < 120 && !condicao(); i++) await new Promise(r => setTimeout(r, 50));
    assert.ok(condicao(), "Request esperado nao chegou");
}
const paginas = e => e.requests.filter(r => r.path.endsWith("/pagina"));
const ultima = e => paginas(e).at(-1);
async function abrir(tela, estado = {}, largura = 1440) {
    estado.requests = [];
    const page = await browser.newPage({ viewport: { width: largura, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "token-admin", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const registro = { path: u.pathname, params: Object.fromEntries(u.searchParams), method: req.method(), body: req.postData() };
        estado.requests.push(registro);
        const responder = (status, dados) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(dados) });
        if (u.pathname.endsWith("/pagina")) {
            const page = Number(u.searchParams.get("page")), size = Number(u.searchParams.get("size"));
            if (estado.atrasar && u.searchParams.get("termo") === "antiga") await new Promise(r => setTimeout(r, 800));
            const items = estado.vazia || (estado.ultimaPaginaVazia && page > 0) ? [] : tela === "empresa"
                ? [empresa(1, "Zulu empresa"), empresa(2, "Alfa empresa")]
                : [conta(1, "Zulu conta"), conta(2, "Alfa conta")];
            if (u.searchParams.get("termo") === "antiga") items[0] = tela === "empresa" ? empresa(1, "Resposta antiga") : conta(1, "Resposta antiga");
            return responder(200, { items, page, size, totalItems: estado.ultimaPaginaVazia ? 2 : estado.vazia ? 0 : 63,
                totalPages: estado.ultimaPaginaVazia ? 1 : estado.vazia ? 0 : Math.ceil(63 / size) });
        }
        if (u.pathname.endsWith("/resumo")) return responder(estado.erroResumo ? 500 : 200, estado.erroResumo
            ? { detail: "Resumo indisponivel" } : [{ tipo: "COFRE", quantidade: 60, saldoAtual: 1234.5 }, { tipo: "CAIXA", quantidade: 3, saldoAtual: 100 }]);
        if (u.pathname === "/financeiro/contas-financeiras" && req.method() === "GET")
            return responder(200, [conta(1, "Zulu conta"), conta(99, "Destino fora da pagina")]);
        if (u.pathname.endsWith("/situacao")) return responder(200, conta(1, "Zulu conta", { ativo: false }));
        if (u.pathname === "/financeiro/transferencias" && req.method() === "POST") return responder(201, { id: 50 });
        throw new Error(`HTTP inesperado: ${req.method()} ${u.pathname}`);
    });
    await page.goto(`${url}/__${tela}`);
    await page.getByText(tela === "empresa" ? "Zulu empresa" : "Zulu conta", { exact: true }).waitFor();
    return { page, estado };
}

test("services administrativos preservam envelope, parametros, signal e contratos simples", async () => {
    globalThis.localStorage = { getItem: () => null };
    const requests = [], resposta = { items: [{ id: 1 }], page: 1, size: 10, totalItems: 63, totalPages: 7 };
    api.defaults.adapter = async config => { requests.push(config); return { config, status: 200, statusText: "OK", headers: {}, data: resposta }; };
    const signal = new AbortController().signal;
    const filtros = { page: 1, size: 10, sort: "id,desc", termo: "abc", ativo: false };
    assert.equal(await empresaService.listarEmpresasPaginado(filtros, signal), resposta);
    assert.equal(await contaService.listarContasFinanceirasPaginado({ ...filtros, tipo: "BANCO" }, signal), resposta);
    await contaService.resumirContasFinanceiras(signal);
    await contaService.listarContasFinanceiras(signal); await empresaService.listarEmpresas(signal);
    assert.deepEqual(requests.map(r => r.url), ["/empresas/pagina", "/financeiro/contas-financeiras/pagina",
        "/financeiro/contas-financeiras/resumo", "/financeiro/contas-financeiras", "/empresas"]);
    assert.deepEqual(requests[0].params, filtros);
    assert.deepEqual(requests[1].params, { ...filtros, tipo: "BANCO" });
    assert.ok(requests.every(r => r.signal === signal));
    assert.ok(requests.every(r => !r.params?.empresaId && !r.params?.tenantId && !r.data));
});

for (const tela of ["empresa", "contas"]) {
    test(`${tela}: pagina/total do backend e ordem remota sem resort/slice local`, async () => {
        const { page, estado } = await abrir(tela);
        try {
            assert.equal(ultima(estado).params.page, "0"); assert.equal(ultima(estado).params.size, "10");
            assert.equal(ultima(estado).params.sort, tela === "empresa" ? "razaoSocial,asc" : "nome,asc");
            assert.ok((await page.getByRole("table").innerText()).indexOf("Zulu") < (await page.getByRole("table").innerText()).indexOf("Alfa"));
            assert.match(await page.getByRole("contentinfo", { name: "Contagem e paginação da tabela" }).innerText(), /de 63/);
            await page.getByRole("button", { name: "Próxima página" }).click();
            await esperar(() => ultima(estado).params.page === "1");
            await page.getByText(tela === "empresa" ? "Zulu empresa" : "Zulu conta", { exact: true }).waitFor();
            assert.equal(await page.getByRole("row").count(), 3);
            assert.ok(estado.requests.every(r => !r.params.empresaId && !r.params.tenantId));
            assert.equal(estado.requests.some(r => r.path === (tela === "empresa" ? "/empresas" : "/financeiro/contas-financeiras")), false);
        } finally { await page.close(); }
    });

    test(`${tela}: termo, sort e tamanho enviados ao backend e resetam pagina`, async () => {
        const { page, estado } = await abrir(tela);
        try {
            await page.getByRole("button", { name: "Próxima página" }).click();
            await esperar(() => ultima(estado).params.page === "1");
            await page.getByRole("textbox", { name: tela === "empresa" ? "Buscar por Razão Social ou CNPJ / CPF" : "Buscar por nome ou tipo" }).fill("nao corresponde localmente");
            await esperar(() => ultima(estado).params.termo === "nao corresponde localmente");
            assert.equal(ultima(estado).params.page, "0");
            await page.getByText(tela === "empresa" ? "Zulu empresa" : "Zulu conta", { exact: true }).waitFor();
            await page.getByRole("button", { name: "Próxima página" }).click();
            await esperar(() => ultima(estado).params.page === "1");
            await page.getByRole("button", { name: tela === "empresa" ? "Razão Social" : "Nome", exact: true }).click();
            await esperar(() => ultima(estado).params.sort === (tela === "empresa" ? "razaoSocial,desc" : "nome,desc"));
            assert.equal(ultima(estado).params.page, "0");
            await page.getByRole("button", { name: "Próxima página" }).click();
            await esperar(() => ultima(estado).params.page === "1");
            await page.getByRole("combobox", { name: "Itens por página" }).click();
            await page.getByRole("option", { name: "25", exact: true }).click();
            await esperar(() => ultima(estado).params.size === "25");
            assert.equal(ultima(estado).params.page, "0");
        } finally { await page.close(); }
    });

    test(`${tela}: response atrasada de busca anterior nao substitui consulta atual`, async () => {
        const { page, estado } = await abrir(tela, { atrasar: true });
        try {
            const campo = page.getByRole("textbox", { name: tela === "empresa" ? "Buscar por Razão Social ou CNPJ / CPF" : "Buscar por nome ou tipo" });
            await campo.fill("antiga"); await esperar(() => ultima(estado).params.termo === "antiga");
            await campo.fill("atual"); await esperar(() => ultima(estado).params.termo === "atual");
            await page.waitForTimeout(1000);
            assert.equal(await page.getByText("Resposta antiga", { exact: true }).count(), 0);
            assert.ok(await page.getByText(tela === "empresa" ? "Zulu empresa" : "Zulu conta", { exact: true }).count());
        } finally { await page.close(); }
    });

    test(`${tela}: pagina esvaziada volta a ultima pagina valida consultando backend`, async () => {
        const { page, estado } = await abrir(tela);
        try {
            estado.ultimaPaginaVazia = true;
            const quantidade = paginas(estado).length;
            await page.getByRole("button", { name: "Próxima página" }).click();
            await esperar(() => paginas(estado).length >= quantidade + 2 && ultima(estado).params.page === "0");
            await page.getByText(tela === "empresa" ? "Zulu empresa" : "Zulu conta", { exact: true }).waitFor();
            assert.match(await page.getByRole("contentinfo", { name: "Contagem e paginação da tabela" }).innerText(), /de 2/);
        } finally { await page.close(); }
    });
}

test("Empresa: filtro ativo enviado ao backend sem esconder registros localmente", async () => {
    const { page, estado } = await abrir("empresa");
    try {
        assert.equal(ultima(estado).params.ativo, "true");
        await page.getByRole("button", { name: "Próxima página" }).click(); await esperar(() => ultima(estado).params.page === "1");
        await page.getByRole("combobox", { name: "Situação" }).click();
        await page.getByRole("option", { name: "Inativas", exact: true }).click();
        await esperar(() => ultima(estado).params.ativo === "false"); assert.equal(ultima(estado).params.page, "0");
        await page.getByText("Zulu empresa", { exact: true }).waitFor();
        await page.getByRole("combobox", { name: "Situação" }).click();
        await page.getByRole("option", { name: "Todas", exact: true }).click();
        await esperar(() => ultima(estado).params.ativo === undefined);
    } finally { await page.close(); }
});

test("Contas: resumo global conserva legados e totais fora da pagina/filtro", async () => {
    const { page, estado } = await abrir("contas");
    try {
        const cards = page.getByRole("region", { name: "Saldos por tipo de conta" });
        await cards.getByText(/1\.334,50/).waitFor();
        assert.match(await cards.innerText(), /63 contas/);
        await page.getByRole("button", { name: "Próxima página" }).click(); await esperar(() => ultima(estado).params.page === "1");
        await page.getByRole("textbox", { name: "Buscar por nome ou tipo" }).fill("cofre");
        await esperar(() => ultima(estado).params.termo === "cofre");
        assert.match(await cards.innerText(), /1\.334,50/);
        assert.equal(estado.requests.filter(r => r.path.endsWith("/resumo")).length, 1);
    } finally { await page.close(); }
});

test("Contas: transferencia carrega seletor antigo sob demanda incluindo destino fora da pagina", async () => {
    const { page, estado } = await abrir("contas");
    try {
        await page.getByRole("button", { name: "Transferir", exact: true }).first().click();
        await page.getByRole("heading", { name: "Transferir entre contas" }).waitFor();
        await page.getByRole("combobox", { name: "Conta de destino" }).click();
        await page.getByRole("option", { name: "Destino fora da pagina" }).click();
        await page.getByRole("textbox", { name: "Valor (R$)" }).fill("1");
        await page.getByRole("button", { name: "Confirmar transferência", exact: true }).click();
        await page.getByText("Transferência concluída.").waitFor();
        const post = estado.requests.find(r => r.method === "POST");
        assert.equal(JSON.parse(post.body).contaDestinoId, 99);
        assert.equal(estado.requests.filter(r => r.path === "/financeiro/contas-financeiras" && r.method === "GET").length, 1);
        await esperar(() => estado.requests.filter(r => r.path.endsWith("/resumo")).length === 2);
    } finally { await page.close(); }
});

test("Contas: alterar situacao recarrega pagina e resumo em vez de editar universo local", async () => {
    const { page, estado } = await abrir("contas");
    try {
        await page.getByRole("button", { name: "Ativar ou inativar conta" }).first().click();
        await page.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
        await page.getByText("Conta inativada.").waitFor();
        await esperar(() => paginas(estado).length === 2 && estado.requests.filter(r => r.path.endsWith("/resumo")).length === 2);
        assert.equal(estado.requests.find(r => r.method === "PATCH").body, '{"ativo":false}');
    } finally { await page.close(); }
});

test("Contas: falha no resumo nao apresenta totais da pagina como globais", async () => {
    const { page } = await abrir("contas", { erroResumo: true });
    try {
        await page.getByText("Resumo indisponivel").waitFor();
        const cards = await page.getByRole("region", { name: "Saldos por tipo de conta" }).innerText();
        assert.doesNotMatch(cards, /R\$/); assert.match(cards, /—/);
    } finally { await page.close(); }
});

test("paginas administrativas nao usam filtro/sort/paginacao local nem tamanho de workaround", async () => {
    for (const caminho of ["Empresa/Empresa", "Financeiro/ContasFinanceiras"]) {
        const fonte = await readFile(new URL(`../src/pages/${caminho}.tsx`, import.meta.url), "utf8");
        assert.doesNotMatch(fonte, /\.(slice|filter|sort)\(|size\s*:\s*(100|500)\b/);
        assert.match(fonte, /ordenacaoRemota/); assert.match(fonte, /totalItems/);
        assert.doesNotMatch(fonte, /empresaId\s*:|tenantId\s*:/);
    }
});
