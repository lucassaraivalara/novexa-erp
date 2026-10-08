import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, api, clienteService;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const cliente = (id, nome, ativo = true) => ({ id, nome, cpfCnpj: "02360684663", ativo });
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-central-cliente-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "central-cliente-fixture",
            resolveId(id) { if (id === "/fixture-cliente.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-cliente.js") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {MemoryRouter} from 'react-router-dom'; import {ThemeProvider} from '@mui/material';
                import theme from '/src/theme/theme.ts'; import Central from '/src/pages/Vendas/CentralVendas.tsx';
                import ClienteAutocomplete from '/src/components/clientes/ClienteAutocomplete.tsx';
                function Operacional() { const [value,onChange] = React.useState(null);
                    return React.createElement(ClienteAutocomplete,{value,onChange}); }
                const Tela = location.pathname === '/__operacional' ? Operacional : Central;
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
                    React.createElement(MemoryRouter,{initialEntries:[location.pathname+location.search]},React.createElement(Tela))));`; },
            configureServer(vite) { for (const caminho of ["/__central", "/__operacional"]) vite.middlewares.use(caminho, async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(caminho, '<div id="root"></div><script type="module" src="/fixture-cliente.js"></script>'));
            }); },
        }],
    });
    ({ default: api } = await server.ssrLoadModule("/src/services/api.ts"));
    clienteService = await server.ssrLoadModule("/src/services/clienteService.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const vendas = e => e.requests.filter(r => r.path === "/vendas");
const buscas = e => e.requests.filter(r => r.path === "/clientes/buscar");
const ultimaVenda = e => vendas(e).at(-1)?.params;
async function esperar(condicao) {
    for (let i = 0; i < 120 && !condicao(); i++) await new Promise(r => setTimeout(r, 25));
    assert.ok(condicao(), "Request esperado nao chegou");
}
async function abrir(operacional = false, opcoes = {}) {
    const estado = { requests: [], ...opcoes };
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "teste", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const params = Object.fromEntries(u.searchParams); estado.requests.push({ path: u.pathname, params, method: req.method() });
        let data, status = 200;
        if (u.pathname === "/vendas") data = { items: estado.listaVazia ? [] : [{ id: 30, dataHora: "2026-10-01T10:00:00", nomeCliente: "Venda retornada", total: 85,
            status: "FATURADA", sessaoCaixaId: 1 }], page: Number(params.page), size: Number(params.size), totalItems: estado.listaVazia ? 0 : 63, totalPages: estado.listaVazia ? 0 : 3 };
        else if (u.pathname === "/vendas/30") {
            if (estado.erroDetalhe) { status = 404; data = { detail: "Venda não encontrada." }; }
            else data = {
            id: 30, dataHora: "2026-10-01T10:00:00", clienteId: 8, status: "FATURADA", total: 200, subtotal: 200, desconto: 0,
            itens: [], formaPagamento: null, valorRecebido: 60, troco: 10, sessaoCaixaId: 1,
            contasReceber: [1, 2].map(numero => ({ id: numero, numeroParcela: numero, totalParcelas: 2, valorOriginal: 75,
                saldo: numero === 1 ? 35 : 75, dataVencimento: `2026-${numero === 1 ? "11" : "12"}-15`, status: numero === 1 ? "PARCIAL" : "PENDENTE" })),
            ...estado.detalhe,
            };
        }
        else if (u.pathname === "/vendas/30/pagamentos") {
            if (estado.erroPagamentos) { status = 503; data = { detail: "Não foi possível carregar os pagamentos." }; }
            else data = estado.pagamentos ?? [{ id: 1, vendaId: 30, formaPagamento: "DINHEIRO", valor: 50,
                status: "REGISTRADO", configuracaoNomeExibicao: "Dinheiro" }];
        }
        else if (u.pathname === "/financeiro/recebiveis") {
            if (estado.atrasoRecebiveis) await new Promise(r => setTimeout(r, estado.atrasoRecebiveis));
            if (estado.erroRecebiveis) { status = estado.erroRecebiveis; data = { detail: "Consulta de recebimentos indisponível." }; }
            else {
                const items = estado.paginasRecebiveis?.[Number(params.page)] ?? estado.recebiveis ?? [];
                data = { items, page: Number(params.page), size: Number(params.size), totalItems: items.length,
                    totalPages: estado.paginasRecebiveis?.length ?? 1 };
            }
        }
        else if (u.pathname === "/clientes/buscar") {
            if (params.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            data = params.termo === "historico" ? [cliente(9, "Cliente historico", false)]
                : [cliente(params.termo === "outro" ? 10 : 8, params.termo === "antiga" ? "Resposta antiga"
                    : params.termo === "outro" ? "Outro cliente" : "Cliente remoto")];
        } else throw new Error(`HTTP inesperado: ${u.pathname}`);
        await route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${url}/__${operacional ? "operacional" : "central"}${estado.query ?? ""}`);
    if (!operacional) await page.getByText(estado.listaVazia ? "Nenhuma venda encontrada" : "Venda retornada", { exact: true }).waitFor();
    return { page, estado, campo: page.getByRole("combobox", { name: operacional ? "Cliente (opcional)" : "Cliente", exact: true }) };
}
async function selecionar(campo, page, termo) {
    await campo.fill(termo); await page.getByRole("listbox").getByRole("option", {
        name: termo === "outro" ? /Outro cliente/ : /Cliente remoto/,
    }).click();
}

test("pesquisarClientes conserva contrato padrao e opt-in historico sem tenant", async () => {
    globalThis.localStorage = { getItem: () => null };
    const requests = []; api.defaults.adapter = async config => {
        requests.push(config); return { config, data: [], status: 200, statusText: "OK", headers: {} };
    };
    const signal = new AbortController().signal;
    await clienteService.pesquisarClientes("abc", signal);
    await clienteService.pesquisarClientes("abc", signal, true);
    assert.deepEqual(requests.map(r => r.params), [{ termo: "abc" }, { termo: "abc", incluirInativos: true }]);
    assert.ok(requests.every(r => r.url === "/clientes/buscar" && r.signal === signal && !r.data));
});
test("detalhe separa alocacao imediata e prazo, exibe vencimentos/status e links para contas", async () => {
    const { page } = await abrir();
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Venda #30" });
        await dialog.getByText("Pago agora", { exact: true }).waitFor();
        const texto = await dialog.innerText();
        assert.match(texto, /Pago agora\s*R\$\s*50,00/);
        assert.match(texto, /A receber\s*R\$\s*110,00/); assert.match(texto, /1\/2.*15\/11\/2026.*75,00.*35,00/);
        assert.match(texto, /Parcial/); assert.match(texto, /Pendente/);
        assert.equal(await dialog.getByText("Recebido:", { exact: false }).count(), 0);
        const links = dialog.getByRole("link", { name: "Ver em Contas a Receber" });
        assert.equal(await links.count(), 2); assert.equal(await links.nth(0).getAttribute("href"), "/financeiro/contas-receber?contaId=1");
        await page.setViewportSize({ width: 390, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    } finally { await page.close(); }
});

test("vendaId abre detalhe mesmo fora da página, preservando resumo e nome do cliente da parcela", async () => {
    const { page, estado } = await abrir(false, { query: "?vendaId=30", listaVazia: true,
        detalhe: { contasReceber: [{ id: 1, cliente: cliente(8, "Maria Oliveira"), numeroParcela: 1, totalParcelas: 1,
            valorOriginal: 150, saldo: 110, dataVencimento: "2026-11-15", status: "PARCIAL" }] } });
    try {
        const dialog = page.getByRole("dialog", { name: "Venda #30", exact: true });
        await dialog.getByRole("region", { name: "Resumo financeiro da venda" }).waitFor();
        assert.match(await dialog.innerText(), /Cliente:\s*Maria Oliveira/);
        assert.equal(await dialog.getByRole("link", { name: "Ver em Contas a Receber" }).getAttribute("href"), "/financeiro/contas-receber?contaId=1");
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30").length, 1);
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30/pagamentos").length, 1);
        await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
        await page.getByRole("combobox", { name: "Status", exact: true }).click();
        await page.getByRole("option", { name: "Faturada", exact: true }).click();
        await esperar(() => ultimaVenda(estado)?.status === "FATURADA");
        assert.equal(await page.getByRole("dialog", { name: "Venda #30", exact: true }).count(), 0);
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30").length, 1);
    } finally { await page.close(); }
});

test("vendaId inválido não consulta detalhe", async () => {
    for (const id of ["", "0", "-1", "abc", "1.5", "9007199254740992"]) {
        const { page, estado } = await abrir(false, { query: `?vendaId=${id}` });
        try {
            await page.waitForTimeout(100);
            assert.equal(estado.requests.some(r => /^\/vendas\//.test(r.path)), false);
            assert.equal(await page.getByRole("dialog").count(), 0);
        } finally { await page.close(); }
    }
});

test("vendaId indisponível respeita erro do backend e permite repetir somente a consulta", async () => {
    const { page, estado } = await abrir(false, { query: "?vendaId=30", erroDetalhe: true });
    try {
        await page.getByRole("alert").getByText("Venda não encontrada.", { exact: true }).waitFor();
        assert.equal(estado.requests.some(r => r.path.endsWith("/pagamentos")), false);
        estado.erroDetalhe = false;
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByRole("region", { name: "Resumo financeiro da venda" }).waitFor();
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30").length, 2);
    } finally { await page.close(); }
});

const pagamentoResumo = (id, formaPagamento, valor, extras = {}) => ({ id, vendaId: 30, formaPagamento, valor,
    status: "REGISTRADO", configuracaoNomeExibicao: formaPagamento, confirmadoFinanceiramente: false, ...extras });
const parcelaResumo = (saldo, extras = {}) => ({ id: 1, numeroParcela: 1, totalParcelas: 1, valorOriginal: saldo,
    saldo, dataVencimento: "2026-11-15", status: "PENDENTE", ...extras });
async function verificarValor(resumo, rotulo, esperado) {
    const valor = resumo.getByText(rotulo, { exact: true }).locator("..").getByRole("definition");
    assert.equal(await valor.innerText(), esperado);
}

for (const cenario of [
    { nome: "somente dinheiro", pagamentos: [pagamentoResumo(1, "DINHEIRO", 100)], pago: "R$ 100,00", formas: ["Dinheiro · R$ 100,00"] },
    { nome: "PIX pendente", pagamentos: [pagamentoResumo(1, "PIX", 100)], pago: "R$ 100,00", formas: ["PIX pendente · R$ 100,00"] },
    { nome: "PIX confirmado", pagamentos: [pagamentoResumo(1, "PIX", 100, { confirmadoFinanceiramente: true })], pago: "R$ 100,00", formas: ["PIX confirmado · R$ 100,00"] },
    { nome: "somente A prazo", pagamentos: [], contas: [parcelaResumo(100)], pago: "R$ 0,00", saldo: "R$ 100,00", formas: ["A prazo"] },
    { nome: "dinheiro + PIX", pagamentos: [pagamentoResumo(1, "DINHEIRO", 40), pagamentoResumo(2, "PIX", 60)], pago: "R$ 100,00", formas: ["Dinheiro · R$ 40,00", "PIX pendente · R$ 60,00"] },
    { nome: "dinheiro + A prazo", pagamentos: [pagamentoResumo(1, "DINHEIRO", 40)], contas: [parcelaResumo(40, { valorOriginal: 60, status: "PARCIAL" })], pago: "R$ 40,00", saldo: "R$ 40,00", formas: ["Dinheiro · R$ 40,00", "A prazo"] },
    { nome: "dinheiro + PIX + A prazo", pagamentos: [pagamentoResumo(1, "DINHEIRO", 20), pagamentoResumo(2, "PIX", 30)], contas: [parcelaResumo(50)], pago: "R$ 50,00", saldo: "R$ 50,00", formas: ["Dinheiro · R$ 20,00", "PIX pendente · R$ 30,00", "A prazo"] },
]) {
    test(`resumo financeiro: ${cenario.nome}, somente com dados do detalhe`, async () => {
        const { page, estado } = await abrir(false, { detalhe: { total: 100, subtotal: 100, contasReceber: cenario.contas ?? [],
            valorRecebido: 120, troco: 20 }, pagamentos: cenario.pagamentos });
        try {
            assert.equal(estado.requests.some(r => r.path !== "/vendas"), false);
            await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Venda #30" });
            const resumo = dialog.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
            await resumo.waitFor();
            await verificarValor(resumo, "Total da venda", "R$ 100,00");
            await verificarValor(resumo, "Pago agora", cenario.pago);
            if (cenario.saldo) await verificarValor(resumo, "A receber", cenario.saldo);
            else assert.equal(await resumo.getByText("A receber", { exact: true }).count(), 0);
            for (const forma of cenario.formas) assert.ok(await resumo.getByText(forma, { exact: true }).isVisible());
            if (!cenario.pagamentos.length) assert.equal(await dialog.getByRole("heading", { name: "Pagamentos", exact: true }).count(), 0);
            if (cenario.contas) assert.equal(await dialog.getByRole("link", { name: "Ver em Contas a Receber" }).count(), cenario.contas.length);
            assert.deepEqual(estado.requests.map(r => r.path), ["/vendas", "/vendas/30", "/vendas/30/pagamentos"]);
        } finally { await page.close(); }
    });
}

test("resumo exclui cancelados e A_PRAZO de pagamentos; saldo usa baixas já realizadas", async () => {
    const { page } = await abrir(false, { pagamentos: [pagamentoResumo(1, "DINHEIRO", 50),
        pagamentoResumo(2, "PIX", 150, { status: "CANCELADO" }), pagamentoResumo(3, "A_PRAZO", 150)] });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        const resumo = page.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
        await resumo.waitFor(); await verificarValor(resumo, "Pago agora", "R$ 50,00");
        await verificarValor(resumo, "A receber", "R$ 110,00");
        assert.equal(await resumo.getByText(/PIX|150,00/).count(), 0);
    } finally { await page.close(); }
});

const recebivelCartao = (pagamentoId, tipo, status, extras = {}) => ({ id: pagamentoId + 100, vendaId: 30, pagamentoId, tipo,
    status, valorBruto: 100, valorLiquidoPrevisto: 97, dataPrevistaRecebimento: "2026-11-15", ...extras });
const consultasRecebiveis = estado => estado.requests.filter(r => r.path === "/financeiro/recebiveis");
for (const [forma, label, tipo] of [["CARTAO_DEBITO", "Cartão de débito", "DEBITO"], ["CARTAO_CREDITO", "Cartão de crédito", "CREDITO"]]) {
    for (const [status, rotulo] of [["PENDENTE", "Aguardando liquidação"], ["LIQUIDADO", "Liquidado"], ["CANCELADO", "Cancelado"]]) {
    test(`${label}: estado real ${status} somente no detalhe, sem alterar resumo nem oferecer liquidação/link inseguro`, async () => {
        const { page, estado } = await abrir(false, { detalhe: { contasReceber: [] },
            pagamentos: [pagamentoResumo(1, forma, 200, { confirmadoFinanceiramente: true })],
            recebiveis: [recebivelCartao(1, tipo, status)] });
        try {
            assert.equal(consultasRecebiveis(estado).length, 0);
            await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
            const resumo = page.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
            await resumo.waitFor(); await verificarValor(resumo, "Pago agora", "R$ 200,00");
            assert.ok(await resumo.getByText(`${label} · R$ 200,00`, { exact: true }).isVisible());
            assert.doesNotMatch(await resumo.innerText(), /confirmado|pendente|liquidado/i);
            assert.equal(await resumo.getByText("A receber", { exact: true }).count(), 0);
            const grupo = page.getByRole("group", { name: `${label} · R$ 200,00`, exact: true });
            await grupo.getByText(rotulo, { exact: true }).waitFor();
            assert.deepEqual(consultasRecebiveis(estado).map(r => r.params), [{ vendaId: "30", page: "0", size: "25", sort: "id,asc" }]);
            assert.equal(await page.getByRole("button", { name: /Liquidar/ }).count(), 0);
            assert.equal(await page.getByRole("link", { name: "Ver recebimento do cartão", exact: true }).count(), 0);
            assert.doesNotMatch(await grupo.innerText(), /taxa|adquirente|snapshot|Conta de destino|Movimento #/i);
            assert.ok(estado.requests.every(r => r.method === "GET"));
        } finally { await page.close(); }
    });
    }
}

test("cartão ausente ou vinculado a outra venda/pagamento/tipo não inventa status", async () => {
    for (const recebiveis of [[], [recebivelCartao(1, "DEBITO", "LIQUIDADO", { vendaId: 99 })],
        [recebivelCartao(9, "DEBITO", "LIQUIDADO")], [recebivelCartao(1, "CREDITO", "LIQUIDADO")]]) {
        const { page } = await abrir(false, { pagamentos: [pagamentoResumo(1, "CARTAO_DEBITO", 100)], recebiveis });
        try {
            await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
            const grupo = page.getByRole("group", { name: "Cartão de débito · R$ 100,00", exact: true });
            await grupo.getByText("Recebível não localizado", { exact: true }).waitFor();
            assert.equal(await grupo.getByText("Liquidado", { exact: true }).count(), 0);
        } finally { await page.close(); }
    }
});

test("consulta paginada de uma venda associa vários cartões por pagamento sem incluir Recebível em A receber", async () => {
    const { page, estado } = await abrir(false, { pagamentos: [pagamentoResumo(1, "CARTAO_CREDITO", 50), pagamentoResumo(2, "CARTAO_DEBITO", 150)],
        paginasRecebiveis: [[recebivelCartao(2, "DEBITO", "LIQUIDADO")], [recebivelCartao(1, "CREDITO", "PENDENTE")]] });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        await page.getByRole("group", { name: "Cartão de crédito · R$ 50,00", exact: true }).getByText("Aguardando liquidação", { exact: true }).waitFor();
        assert.ok(await page.getByRole("group", { name: "Cartão de débito · R$ 150,00", exact: true }).getByText("Liquidado", { exact: true }).isVisible());
        const resumo = page.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
        await verificarValor(resumo, "Pago agora", "R$ 200,00"); await verificarValor(resumo, "A receber", "R$ 110,00");
        assert.deepEqual(consultasRecebiveis(estado).map(r => r.params.page), ["0", "1"]);
        assert.ok(consultasRecebiveis(estado).every(r => r.params.vendaId === "30" && !r.params.pagamentoId));
        await mkdir("node_modules/.cache/central-vendas", { recursive: true });
        for (const width of [1440, 1024, 390]) {
            await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(350);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: `node_modules/.cache/central-vendas/cartao-${width}.png` });
        }
    } finally { await page.close(); }
});

test("falha de consulta não vira recebível ausente nem altera totais; retry não repete venda/pagamentos", async () => {
    const { page, estado } = await abrir(false, { erroRecebiveis: 403, pagamentos: [pagamentoResumo(1, "CARTAO_CREDITO", 200)],
        recebiveis: [recebivelCartao(1, "CREDITO", "PENDENTE")] });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        await page.getByRole("alert").getByText("Recebimentos de cartão: Consulta de recebimentos indisponível.", { exact: true }).waitFor();
        const grupo = page.getByRole("group", { name: "Cartão de crédito · R$ 200,00", exact: true });
        assert.ok(await grupo.getByText("Situação indisponível", { exact: true }).isVisible());
        assert.equal(await grupo.getByText("Recebível não localizado", { exact: true }).count(), 0);
        await verificarValor(page.getByRole("region", { name: "Resumo financeiro da venda" }), "Pago agora", "R$ 200,00");
        estado.erroRecebiveis = 0;
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await grupo.getByText("Aguardando liquidação", { exact: true }).waitFor();
        assert.equal(consultasRecebiveis(estado).length, 2);
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30").length, 1);
        assert.equal(estado.requests.filter(r => r.path === "/vendas/30/pagamentos").length, 1);
    } finally { await page.close(); }
});

test("fechar e abrir venda sem cartão cancela consulta antiga sem contaminar detalhe", async () => {
    const { page, estado } = await abrir(false, { atrasoRecebiveis: 1200, pagamentos: [pagamentoResumo(1, "CARTAO_CREDITO", 200)] });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        await page.getByText("Consultando recebimento do cartão…", { exact: true }).waitFor();
        await esperar(() => consultasRecebiveis(estado).length === 1);
        await page.getByRole("button", { name: "Fechar", exact: true }).click();
        estado.pagamentos = [pagamentoResumo(2, "DINHEIRO", 200)];
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        await page.getByRole("region", { name: "Resumo financeiro da venda" }).waitFor(); await page.waitForTimeout(1500);
        assert.equal(consultasRecebiveis(estado).length, 1);
        assert.equal(await page.getByText(/Recebível não localizado|Situação indisponível|Aguardando liquidação/).count(), 0);
    } finally { await page.close(); }
});

test("falha ao buscar pagamentos não inventa pago zero nem impede mostrar saldo das contas", async () => {
    const { page } = await abrir(false, { erroPagamentos: true });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        const resumo = page.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
        await resumo.waitFor(); await verificarValor(resumo, "Pago agora", "Indisponível");
        await verificarValor(resumo, "A receber", "R$ 110,00");
        assert.ok(await page.getByRole("alert").getByText("Não foi possível carregar os pagamentos.", { exact: true }).isVisible());
    } finally { await page.close(); }
});

test("resumo compacto e parcelas permanecem legíveis em desktop/laptop/mobile", async () => {
    await mkdir("node_modules/.cache/central-vendas", { recursive: true });
    const { page } = await abrir(false, { pagamentos: [pagamentoResumo(1, "DINHEIRO", 20), pagamentoResumo(2, "PIX", 30)] });
    try {
        await page.getByRole("button", { name: "Visualizar detalhes", exact: true }).click();
        const resumo = page.getByRole("region", { name: "Resumo financeiro da venda", exact: true });
        await resumo.waitFor();
        await page.waitForTimeout(350);
        for (const width of [1440, 1024, 390]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await resumo.evaluate(el => el.scrollWidth <= el.clientWidth));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            for (const rotulo of ["Total da venda", "Pago agora", "A receber"]) assert.ok(await resumo.getByText(rotulo, { exact: true }).isVisible());
            await page.screenshot({ path: `node_modules/.cache/central-vendas/resumo-${width}.png` });
        }
    } finally { await page.close(); }
});

test("Central abre sem preload, usa debounce e nao filtra resultado por nome localmente", async () => {
    const { page, estado, campo } = await abrir();
    try {
        await page.waitForTimeout(400); assert.equal(buscas(estado).length, 0);
        assert.equal(estado.requests.some(r => r.path === "/clientes/opcoes"), false);
        await campo.fill("Lo"); await page.waitForTimeout(100); await campo.fill("Loja");
        await page.waitForTimeout(100); assert.equal(buscas(estado).length, 0);
        await page.getByRole("listbox").getByRole("option").waitFor();
        assert.deepEqual(buscas(estado).map(r => r.params), [{ termo: "Loja", incluirInativos: "true" }]);
        assert.match(await page.getByRole("listbox").innerText(), /Cliente remoto/);
    } finally { await page.close(); }
});

test("selecionar/trocar/limpar Cliente envia ID, reseta pagina e preserva periodo/status/sort", async () => {
    const { page, estado, campo } = await abrir();
    try {
        await page.getByLabel("Data inicial", { exact: true }).fill("2026-09-01");
        await page.getByLabel("Data final", { exact: true }).fill("2026-10-10");
        await page.getByRole("button", { name: "Ordenar por Total: crescente", exact: true }).click();
        await esperar(() => ultimaVenda(estado).sort === "total,asc" && ultimaVenda(estado).dataFinal === "2026-10-10");
        await page.getByRole("button", { name: "Próxima página" }).click();
        await esperar(() => ultimaVenda(estado).page === "1");
        await selecionar(campo, page, "Loja");
        await esperar(() => ultimaVenda(estado).clienteId === "8" && ultimaVenda(estado).page === "0");
        const outros = { status: "FATURADA", dataInicial: "2026-09-01", dataFinal: "2026-10-10", sort: "total,asc", size: "25" };
        for (const [nome, valor] of Object.entries(outros)) assert.equal(ultimaVenda(estado)[nome], valor);
        await page.getByText("Venda retornada", { exact: true }).waitFor();
        assert.match(await page.getByRole("contentinfo", { name: "Contagem e paginação da tabela" }).innerText(), /de 63/);
        await page.getByRole("button", { name: "Próxima página" }).click();
        await esperar(() => ultimaVenda(estado).page === "1");
        await selecionar(campo, page, "outro");
        await esperar(() => ultimaVenda(estado).clienteId === "10" && ultimaVenda(estado).page === "0");
        await page.getByText("Venda retornada", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Próxima página" }).click();
        await esperar(() => ultimaVenda(estado).page === "1");
        await campo.hover();
        await page.getByRole("button", { name: "Clear" }).click();
        await esperar(() => ultimaVenda(estado).clienteId === undefined && ultimaVenda(estado).page === "0");
        for (const [nome, valor] of Object.entries(outros)) assert.equal(ultimaVenda(estado)[nome], valor);
        assert.ok(estado.requests.every(r => !r.params.empresaId && !r.params.tenantId));
    } finally { await page.close(); }
});

test("Cliente historico inativo continua selecionavel explicitamente na Central", async () => {
    const { page, estado, campo } = await abrir();
    try {
        await campo.fill("historico");
        await page.getByRole("option", { name: /Cliente historico.*inativo/ }).click();
        await esperar(() => ultimaVenda(estado).clienteId === "9");
        assert.equal(buscas(estado)[0].params.incluirInativos, "true");
    } finally { await page.close(); }
});

test("busca antiga nao substitui nova e limpar invalida resultados pendentes", async () => {
    const { page, estado, campo } = await abrir();
    try {
        await campo.fill("antiga"); await esperar(() => buscas(estado).some(r => r.params.termo === "antiga"));
        await campo.fill("nova"); await page.getByRole("listbox").getByRole("option").waitFor();
        await page.waitForTimeout(1000); assert.doesNotMatch(await page.getByRole("listbox").innerText(), /Resposta antiga/);
        await campo.fill("antiga"); await esperar(() => buscas(estado).filter(r => r.params.termo === "antiga").length === 2);
        await campo.fill(""); await page.waitForTimeout(1200);
        assert.equal(await page.getByRole("listbox").getByRole("option").count(), 0);
        assert.equal(buscas(estado).some(r => r.params.termo === ""), false);
    } finally { await page.close(); }
});

test("ClienteAutocomplete padrao conserva apenas ativos e rotulo operacional sem opt-in", async () => {
    const { page, estado, campo } = await abrir(true);
    try {
        await selecionar(campo, page, "Loja");
        assert.match(await campo.inputValue(), /Cliente remoto/);
        assert.deepEqual(buscas(estado)[0].params, { termo: "Loja" });
        await page.getByRole("button", { name: "Clear" }).click(); assert.equal(await campo.inputValue(), "");
    } finally { await page.close(); }
});

test("Central reutiliza autocomplete sem lista completa ou filtro/paginacao local de clientes", async () => {
    const fonte = await readFile(new URL("../src/pages/Vendas/CentralVendas.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(fonte, /listarClientes\(|\/clientes\/opcoes|\.(filter|sort|slice)\(|size\s*:\s*(100|500)\b/);
    assert.match(fonte, /ClienteAutocomplete/); assert.match(fonte, /alterarFiltro\("clienteId"/);
    assert.match(fonte, /setPagina\(0\)/); assert.match(fonte, /ordenacaoRemota/);
});
