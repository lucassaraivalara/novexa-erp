import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, api, produtos, clientes;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const produto = (nome = "Produto remoto", codigoInterno = "P1") => ({ id: 1, nome, codigoInterno,
    codigoBarras: "7890001", precoVenda: 10, unidadeMedida: "UN", ativo: true });
const cliente = nome => ({ id: 8, nome, nomeFantasia: "Loja", cpfCnpj: "02360684663", ativo: true });

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-pdv-buscas-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "pdv-buscas-fixture",
            resolveId(id) { if (id === "/fixture-pdv.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-pdv.js") return `
                import React from 'react'; import { createRoot } from 'react-dom/client';
                import { MemoryRouter } from 'react-router-dom';
                import { CssBaseline, ThemeProvider } from '@mui/material'; import theme from '/src/theme/theme.ts';
                import Vendas from '/src/pages/Vendas/Vendas.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider, {theme},
                    React.createElement(CssBaseline),
                    React.createElement(MemoryRouter, null, React.createElement(Vendas))));`; },
            configureServer(vite) { vite.middlewares.use("/__pdv", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml("/__pdv", '<div id="root"></div><script type="module" src="/fixture-pdv.js"></script>'));
            }); },
        }],
    });
    ({ default: api } = await server.ssrLoadModule("/src/services/api.ts"));
    produtos = await server.ssrLoadModule("/src/services/produtoService.ts");
    clientes = await server.ssrLoadModule("/src/services/clienteService.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const consultas = (estado, dominio) => estado.requests.filter(r => r.path === `/${dominio}/buscar`);
async function esperar(condicao) {
    for (let i = 0; i < 120 && !condicao(); i++) await new Promise(r => setTimeout(r, 25));
    assert.ok(condicao(), "Request esperado nao chegou");
}
async function abrir() {
    const estado = { requests: [], atrasar: false, atrasarScanner: false };
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(7000);
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ id: 1, token: "teste",
        nomeUsuario: "Operador", perfil: "OPERADOR", empresa: { id: 1, razaoSocial: "Empresa" } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const registro = { path: u.pathname, at: Date.now(), termo: u.searchParams.get("termo"), params: Object.fromEntries(u.searchParams),
            method: req.method(), body: req.postData() };
        estado.requests.push(registro);
        let dados;
        if (u.pathname === "/financeiro/caixas/sessoes/abertas") dados = [{ sessaoId: 10 }];
        else if (u.pathname === "/financeiro/configuracoes-formas-pagamento") dados = [
            { id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true },
            { id: 2, tipo: "PIX", nomeExibicao: "PIX Loja", ativo: true, contaFinanceiraDestino: { id: 3, ativo: true, tipo: "BANCO" } },
            { id: 6, tipo: "PIX", nomeExibicao: "PIX sem destino", ativo: true, contaFinanceiraDestino: null },
            { id: 7, tipo: "PIX", nomeExibicao: "PIX destino inativo", ativo: true, contaFinanceiraDestino: { id: 4, ativo: false, tipo: "BANCO" } },
            { id: 8, tipo: "PIX", nomeExibicao: "PIX destino incompatível", ativo: true, contaFinanceiraDestino: { id: 5, ativo: true, tipo: "CAIXA" } },
            { id: 4, tipo: "CREDITO", nomeExibicao: "Crédito Loja", ativo: true },
            { id: 5, tipo: "CREDITO", nomeExibicao: "Cartão inativo", ativo: false },
        ];
        else if (u.pathname.endsWith("/buscar")) {
            if (estado.atrasar && registro.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            if (estado.atrasarScanner && registro.termo === "7890001") await new Promise(r => setTimeout(r, 700));
            dados = u.pathname === "/produtos/buscar" ? (estado.semResultados ? [] : [{ ...produto(registro.termo === "antiga" ? "Resposta antiga" : "Produto remoto", registro.termo === "1" ? "1" : "P1"),
                controlaEstoque: estado.controlaEstoque ?? true, estoqueAtual: estado.estoqueAtual ?? 100 }])
                : [cliente(registro.termo === "antiga" ? "Cliente antigo" : "Cliente remoto")];
        } else if (u.pathname === "/vendas" && req.method() === "POST") {
            if (estado.erroVenda) return route.fulfill({status:estado.erroVenda,headers:cors,contentType:"application/json",body:JSON.stringify({detail:estado.mensagemErro ?? "A soma dos pagamentos deve corresponder ao total da venda."})});
            dados = { id: 20, total: 10, troco: 0 };
        }
        else throw new Error(`HTTP inesperado: ${u.pathname}`);
        await route.fulfill({ status: req.method() === "POST" ? 201 : 200, headers: cors,
            contentType: "application/json", body: JSON.stringify(dados) });
    });
    await page.goto(`${url}/__pdv`);
    const busca = page.getByRole("combobox", { name: "Buscar produto ou ler código de barras" });
    await page.getByRole("combobox", { name: "Forma de pagamento", exact: true }).selectOption("1");
    assert.equal(await busca.isEnabled(), true);
    return { page, estado, busca };
}

test("services usam endpoints limitados, signal e JWT sem tenant no payload; vazio nao faz HTTP", async () => {
    globalThis.localStorage = { getItem: () => null };
    const requests = []; api.defaults.adapter = async config => {
        requests.push(config); return { config, data: [], status: 200, statusText: "OK", headers: {} };
    };
    const signal = new AbortController().signal;
    await produtos.pesquisarProdutos("P1", signal); await clientes.pesquisarClientes("Loja", signal);
    await produtos.pesquisarProdutos(" ", signal); await clientes.pesquisarClientes("", signal);
    assert.deepEqual(requests.map(r => r.url), ["/produtos/buscar", "/clientes/buscar"]);
    assert.deepEqual(requests.map(r => r.params), [{ termo: "P1" }, { termo: "Loja" }]);
    assert.ok(requests.every(r => r.signal === signal && !r.data));
});

test("PDV nao pre-carrega produtos/clientes; digitar usa debounce e selecao adiciona produto", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await page.waitForTimeout(400);
        assert.equal(consultas(estado, "produtos").length, 0);
        assert.equal(estado.requests.some(r => r.path === "/clientes/opcoes"), false);
        await busca.fill("Pr"); await page.waitForTimeout(100); await busca.fill("Prod");
        await page.waitForTimeout(100); assert.equal(consultas(estado, "produtos").length, 0);
        await page.getByRole("listbox").getByRole("option").click();
        assert.deepEqual(consultas(estado, "produtos").map(r => r.termo), ["Prod"]);
        assert.match(await page.getByRole("table").innerText(), /Produto remoto/);
        assert.equal(await busca.inputValue(), "");
    } finally { await page.close(); }
});

test("scanner Enter consulta imediatamente codigo exato, inclusive curto, sem debounce/duplo envio", async () => {
    for (const codigo of ["7890001", "p1", "1"]) {
        const { page, estado, busca } = await abrir();
        try {
            await busca.fill(codigo); const inicio = Date.now(); await busca.press("Enter");
            await esperar(() => consultas(estado, "produtos").length > 0);
            await page.getByLabel("Quantidade de Produto remoto").waitFor();
            assert.equal(consultas(estado, "produtos").length, 1);
            assert.ok(consultas(estado, "produtos")[0].at - inicio < 350, "Leitor nao deve esperar o debounce");
            assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "1");
        } finally { await page.close(); }
    }
});

test("Enter nunca adiciona nome parcial, nem quando resultado remoto ja esta em memoria", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").waitFor();
        await busca.press("Enter"); await esperar(() => consultas(estado, "produtos").length === 2);
        await page.getByText("Código exato não encontrado. Selecione o produto na lista.").waitFor();
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
        await page.getByRole("listbox").getByRole("option").click();
        await page.getByLabel("Quantidade de Produto remoto").waitFor();
    } finally { await page.close(); }
});

test("codigo exato em memoria nao repete request; limpar cancela busca antiga", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("P1"); await page.getByRole("listbox").getByRole("option").waitFor();
        await busca.press("Enter"); await page.getByLabel("Quantidade de Produto remoto").waitFor();
        assert.equal(consultas(estado, "produtos").length, 1);
        estado.atrasar = true;
        await busca.fill("antiga"); await esperar(() => consultas(estado, "produtos").some(r => r.termo === "antiga"));
        await busca.fill(""); await page.waitForTimeout(1200);
        assert.equal(await page.locator('#pdv-resultados [role="option"]').count(), 0);
        assert.equal(consultas(estado, "produtos").some(r => r.termo === ""), false);
    } finally { await page.close(); }
});

test("resposta antiga e scanner cancelado nao sobrescrevem nova busca nem adicionam item", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.atrasar = true;
        await busca.fill("antiga"); await esperar(() => consultas(estado, "produtos").some(r => r.termo === "antiga"));
        await busca.fill("atual"); await page.getByRole("listbox").getByRole("option").waitFor(); await page.waitForTimeout(1000);
        assert.equal(await page.getByText("Resposta antiga", { exact: true }).count(), 0);
        estado.atrasarScanner = true;
        await busca.fill("7890001"); await busca.press("Enter");
        await esperar(() => consultas(estado, "produtos").some(r => r.termo === "7890001"));
        await busca.press("Enter"); await busca.fill("atual"); await page.waitForTimeout(1000);
        assert.equal(consultas(estado, "produtos").filter(r => r.termo === "7890001").length, 1);
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
    } finally { await page.close(); }
});

test("Cliente opcional usa busca remota, preserva matches de documento/fantasia, seleciona e limpa", async () => {
    const { page, estado } = await abrir();
    try {
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
        await campo.fill("Lo"); await page.waitForTimeout(100); await campo.fill("Loja");
        await page.waitForTimeout(100); assert.equal(consultas(estado, "clientes").length, 0);
        await page.getByRole("listbox").getByRole("option").click();
        await page.getByText("Cliente: Cliente remoto").waitFor();
        assert.deepEqual(consultas(estado, "clientes").map(r => r.termo), ["Loja"]);
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        await page.getByRole("button", { name: "Clear" }).click();
        assert.equal(await page.getByText("Cliente: Cliente remoto").count(), 0);
        assert.equal(estado.requests.some(r => r.path === "/clientes/opcoes"), false);
    } finally { await page.close(); }
});

test("Cliente descarta resposta antiga e cancela ao fechar; venda sem cliente continua valida", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.atrasar = true;
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
        await campo.fill("antiga"); await esperar(() => consultas(estado, "clientes").some(r => r.termo === "antiga"));
        await campo.fill("023.606"); await page.getByRole("listbox").getByRole("option").waitFor(); await page.waitForTimeout(1000);
        assert.equal(await page.getByText("Cliente antigo", { exact: true }).count(), 0);
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        await busca.fill("P1"); await busca.press("Enter"); await page.getByLabel("Quantidade de Produto remoto").waitFor();
        await page.getByLabel("Valor recebido (R$)").fill("10"); await page.keyboard.press("F2");
        await esperar(() => estado.requests.some(r => r.path === "/vendas" && r.method === "POST"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.equal(pedido.clienteId, null); assert.equal(pedido.empresaId, undefined); assert.equal(pedido.tenantId, undefined);
    } finally { await page.close(); }
});

test("slice do PDV nao usa catalogo nem filtro/paginacao local como autocomplete", async () => {
    const pagina = await readFile(new URL("../src/pages/Vendas/Vendas.tsx", import.meta.url), "utf8");
    const helper = await readFile(new URL("../src/pages/Vendas/pdv.ts", import.meta.url), "utf8");
    assert.doesNotMatch(pagina + helper, /listarProdutos\(|listarClientes\(|buscarProdutosPDV\(|size\s*:\s*(100|500)\b/);
    assert.doesNotMatch(pagina, /produtos\.filter\(|clientes\.filter\(/);
    assert.match(pagina, /useRemoteSearch/); assert.match(pagina, /AbortController/);
});

async function adicionarCem(page, busca) {
    await busca.fill("7890001"); await busca.press("Enter");
    await page.getByLabel("Quantidade de Produto remoto").fill("10");
}
async function selecionarClientePrazo(page) {
    const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
    if (!await campo.count()) await page.getByRole("button", { name: "F8 Cliente" }).click();
    await campo.fill("Cliente"); await page.getByRole("listbox").getByRole("option", { name: /Cliente remoto/ }).click();
}
test("A prazo abre cliente existente, bloqueia sem cliente e envia somente parcelas; sucesso limpa fluxo", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        await grupoPagamento(page, 1).getByRole("combobox").selectOption("A_PRAZO");
        await page.getByText("Selecione um cliente para vender a prazo.", { exact: true }).waitFor();
        assert.equal(await page.getByRole("combobox", { name: "Cliente (opcional)" }).evaluate(el => el === document.activeElement), true);
        assert.equal(await page.getByLabel("Vencimento 1", { exact: true }).getAttribute("aria-invalid"), "true");
        await page.getByText("Informe o vencimento.", { exact: true }).waitFor();
        await page.screenshot({ path: "node_modules/.vite-pdv-buscas-tests/prazo-validacao.png", fullPage: true });
        await page.getByLabel("Vencimento 1", { exact: true }).fill("2026-11-15");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        assert.equal(await page.getByLabel("Valor recebido (R$)").count(), 0);
        await page.keyboard.press("F2");
        await page.getByText("Selecione um cliente para vender a prazo.", { exact: true }).first().waitFor();
        assert.equal(estado.requests.filter(r => r.path === "/vendas").length, 0);
        await selecionarClientePrazo(page);
        assert.equal(await page.getByLabel("Valor da parcela 1 (R$)").inputValue(), "100.00");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        assert.equal(await page.getByLabel("Valor da parcela 1 (R$)").inputValue(), "100.00");
        await page.getByRole("button", { name: "Remover pagamento 2" }).click();
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        await page.getByRole("button", { name: "Pagar · F2" }).click();
        await esperar(() => estado.requests.some(r => r.path === "/vendas"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.deepEqual(pedido.pagamentos, []); assert.deepEqual(pedido.parcelasPrazo, [{ valor: 100, vencimento: "2026-11-15" }]);
        assert.equal(pedido.clienteId, 8); assert.equal(pedido.formaPagamento, undefined);
        await page.getByRole("heading", { name: "Venda concluída" }).waitFor(); await page.getByRole("dialog").waitFor({ state: "hidden" });
        assert.equal(await page.getByLabel("Vencimento 1").count(), 0); assert.equal(await page.getByText("Cliente: Cliente remoto").count(), 0);
    } finally { await page.close(); }
});
test("dinheiro com duas parcelas a prazo mostra soma e troco distintos e preserva layout", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("40");
        await grupoPagamento(page, 1).getByLabel("Valor recebido (R$)").fill("50");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("A_PRAZO"); await selecionarClientePrazo(page);
        await page.getByLabel("Vencimento 1", { exact: true }).fill("2026-11-15");
        await page.getByLabel("Valor da parcela 1 (R$)").fill("30"); await page.getByRole("button", { name: "Adicionar parcela" }).click();
        await page.getByLabel("Vencimento 2", { exact: true }).fill("2026-12-15");
        assert.equal(await page.getByLabel("Valor da parcela 2 (R$)").inputValue(), "30.00");
        assert.match(await page.getByLabel("Pago agora", { exact: true }).innerText(), /40,00/);
        assert.match(await page.getByLabel("A receber", { exact: true }).innerText(), /60,00/);
        assert.equal(await page.getByLabel("Falta distribuir", { exact: true }).count(), 0);
        assert.match(await grupoPagamento(page, 1).innerText(), /10,00/);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/venda-prazo-${width}.png`, fullPage: true });
        }
        await page.getByRole("button", { name: "Pagar · F2" }).click(); await esperar(() => estado.requests.some(r => r.path === "/vendas"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.deepEqual(pedido.pagamentos, [{ configuracaoFormaPagamentoId: 1, valor: 40, valorRecebido: 50 }]);
        assert.deepEqual(pedido.parcelasPrazo, [{ valor: 30, vencimento: "2026-11-15" }, { valor: 30, vencimento: "2026-12-15" }]);
    } finally { await page.close(); }
});
test("cartao + prazo permite editar/remover parcelas e preserva cliente/vencimento em erro", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await grupoPagamento(page, 1).getByRole("combobox").selectOption("4");
        await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("50");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("A_PRAZO"); await selecionarClientePrazo(page);
        await page.getByLabel("Vencimento 1", { exact: true }).fill("2026-11-15");
        await page.getByRole("button", { name: "Adicionar parcela" }).click();
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        await page.getByRole("button", { name: "Remover parcela a prazo 2" }).click();
        await page.getByLabel("Valor da parcela 1 (R$)").fill("51"); assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        await page.getByLabel("Valor da parcela 1 (R$)").fill("50");
        estado.erroVenda = 409; await page.getByRole("button", { name: "Pagar · F2" }).click();
        await page.getByRole("button", { name: "Voltar à venda" }).click();
        assert.equal(await page.getByLabel("Vencimento 1", { exact: true }).inputValue(), "2026-11-15");
        assert.equal(await page.getByLabel("Valor da parcela 1 (R$)").inputValue(), "50");
        assert.equal(await page.getByText("Cliente: Cliente remoto").count(), 1);
        estado.erroVenda = null; await page.getByRole("button", { name: "Pagar · F2" }).click();
        await esperar(() => estado.requests.filter(r => r.path === "/vendas").length === 2);
        const pedido = JSON.parse(estado.requests.filter(r => r.path === "/vendas").at(-1).body);
        assert.deepEqual(pedido.pagamentos, [{ configuracaoFormaPagamentoId: 4, valor: 50 }]);
        assert.deepEqual(pedido.parcelasPrazo, [{ valor: 50, vencimento: "2026-11-15" }]);
    } finally { await page.close(); }
});
const grupoPagamento = (page, numero) => page.getByRole("group", { name: `Pagamento ${numero}`, exact: true });

test("desktop mantem total e fechamento visiveis; somente pagamentos rolam com varias formas e parcelas", async () => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
        const { page, busca } = await abrir();
        try {
            await page.setViewportSize(viewport);
            const total = page.getByLabel("Total da venda", { exact: true });
            const pagar = page.getByRole("button", { name: "Pagar · F2", exact: true });
            const conferirVisibilidade = async () => {
                const caixas = await Promise.all([total.boundingBox(), pagar.boundingBox()]);
                for (const caixa of caixas) {
                    assert.ok(caixa && caixa.y >= 0 && caixa.y + caixa.height <= viewport.height,
                        `Total e Pagar devem caber em ${viewport.width}x${viewport.height}`);
                }
                return caixas;
            };
            await conferirVisibilidade();
            assert.equal(await pagar.isDisabled(), true);
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/fechamento-vazio-${viewport.width}.png` });
            await busca.fill("7890001"); await busca.press("Enter");
            await page.getByLabel("Quantidade de Produto remoto").waitFor();
            await conferirVisibilidade();
            assert.equal(await pagar.isEnabled(), true);
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/fechamento-produto-${viewport.width}.png` });
            await page.getByLabel("Quantidade de Produto remoto").fill("10");
            await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("30");
            await page.getByRole("button", { name: "Adicionar forma" }).click();
            await grupoPagamento(page, 2).getByRole("combobox").selectOption("2");
            await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").fill("30");
            await page.getByRole("button", { name: "Adicionar forma" }).click();
            await grupoPagamento(page, 3).getByRole("combobox").selectOption("A_PRAZO");
            await selecionarClientePrazo(page);
            for (let numero = 1; numero <= 4; numero++) {
                await page.getByLabel(`Vencimento ${numero}`, { exact: true }).fill("2026-12-15");
                await page.getByLabel(`Valor da parcela ${numero} (R$)`, { exact: true }).fill("10");
                if (numero < 4) await page.getByRole("button", { name: "Adicionar parcela" }).click();
            }
            assert.equal(await pagar.isEnabled(), true);
            const pagamentos = page.getByRole("region", { name: "Pagamentos da venda" });
            assert.equal(await pagamentos.evaluate(el => el.scrollHeight > el.clientHeight), true);
            await pagamentos.evaluate(el => { el.scrollTop = 0; });
            const antes = await conferirVisibilidade();
            await pagamentos.evaluate(el => { el.scrollTop = el.scrollHeight; });
            assert.deepEqual(await conferirVisibilidade(), antes);
            assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/fechamento-parcelas-${viewport.width}.png` });
            await page.getByRole("button", { name: "F9 Observações" }).click();
            await page.getByLabel("Observações", { exact: true }).fill("Observação da venda");
            await conferirVisibilidade();
            await page.getByLabel("Observações", { exact: true }).press("Escape");
            await busca.press("F8");
            await page.getByRole("combobox", { name: "Cliente (opcional)" }).waitFor();
            await conferirVisibilidade();
            assert.equal(await page.getByRole("combobox", { name: "Cliente (opcional)" }).evaluate(el => el === document.activeElement), true);
        } finally { await page.close(); }
    }
});

test("PIX invalido nao e oferecido; valores manuais sobrevivem a terceira forma e remocao", async () => {
    const { page, busca } = await abrir();
    try {
        for (const nome of ["PIX sem destino", "PIX destino inativo", "PIX destino incompatível"])
            assert.equal(await page.getByRole("option", { name: nome, exact: true }).count(), 0);
        assert.equal(await page.getByRole("option", { name: "PIX Loja", exact: true }).count(), 1);
        await adicionarCem(page, busca);
        await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("30");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("2");
        assert.equal(await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").inputValue(), "70.00");
        await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").fill("40");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 3).getByRole("combobox").selectOption("4");
        assert.equal(await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").inputValue(), "30");
        assert.equal(await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").inputValue(), "40");
        assert.equal(await grupoPagamento(page, 3).getByLabel("Valor aplicado (R$)").inputValue(), "30.00");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        assert.equal(await grupoPagamento(page, 4).getByLabel("Valor aplicado (R$)").inputValue(), "0.00");
        await page.getByRole("button", { name: "Remover pagamento 4" }).click();
        await page.getByRole("button", { name: "Remover pagamento 3" }).click();
        assert.equal(await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").inputValue(), "30");
        assert.equal(await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").inputValue(), "40");
        assert.match(await page.getByLabel("Falta distribuir", { exact: true }).innerText(), /30,00/);
    } finally { await page.close(); }
});

test("busca vazia mostra feedback contextual e saldo zero respeita controle de estoque", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.semResultados = true; await busca.fill("Inexistente");
        await page.getByText("Nenhum produto encontrado.", { exact: true }).waitFor();
        await page.screenshot({ path: "node_modules/.vite-pdv-buscas-tests/busca-sem-resultados.png", fullPage: true });
        await busca.fill(""); assert.equal(await page.getByText("Nenhum produto encontrado.", { exact: true }).count(), 0);
        estado.semResultados = false; estado.estoqueAtual = 0;
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").click();
        await page.getByText("Produto sem estoque disponível. Confira o estoque antes de vender.", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").count(), 0);
        estado.controlaEstoque = false;
        await busca.fill("P1"); await busca.press("Enter");
        await page.getByLabel("Quantidade de Produto remoto").waitFor();
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "1");
    } finally { await page.close(); }
});

test("erros reais de PIX e estoque recebem mensagem acionavel sem inventar conflito generico", async () => {
    for (const [detail, mensagem] of [
        ["Pagamento sem destino financeiro historico.", "Esta forma de pagamento PIX não possui uma conta de destino configurada."],
        ["Saldo insuficiente. Estoque atual: 0, quantidade solicitada: 10", "Estoque insuficiente para concluir a venda. Confira as quantidades dos produtos."],
        ["Venda já faturada com outra requisição.", "Venda já faturada com outra requisição."],
    ]) {
        const { page, estado, busca } = await abrir();
        try {
            await adicionarCem(page, busca); estado.erroVenda = 409; estado.mensagemErro = detail;
            await page.getByRole("button", { name: "Pagar · F2" }).click();
            await page.getByRole("dialog").getByText(mensagem, { exact: true }).waitFor();
            await page.getByRole("button", { name: "Voltar à venda" }).click();
            assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "10");
        } finally { await page.close(); }
    }
});

test("PIX com prazo mantém valores e vencimento obrigatório antes de finalizar", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await grupoPagamento(page, 1).getByRole("combobox").selectOption("2");
        await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("40");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("A_PRAZO"); await selecionarClientePrazo(page);
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        assert.equal(await page.getByLabel("Vencimento 1", { exact: true }).getAttribute("aria-invalid"), "true");
        await page.getByLabel("Vencimento 1", { exact: true }).fill("2026-11-15");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        await page.getByRole("button", { name: "Pagar · F2" }).click(); await esperar(() => estado.requests.some(r => r.path === "/vendas"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.deepEqual(pedido.pagamentos, [{ configuracaoFormaPagamentoId: 2, valor: 40 }]);
        assert.deepEqual(pedido.parcelasPrazo, [{ valor: 60, vencimento: "2026-11-15" }]);
    } finally { await page.close(); }
});

test("pagamento unico automatico envia uma parcela e nao apresenta configuracao inativa", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        assert.equal(await page.getByLabel("Valor aplicado (R$)").inputValue(), "100.00");
        assert.equal(await page.getByRole("option", { name: "Cartão inativo" }).count(), 0);
        await page.getByRole("button", { name: "Pagar · F2" }).click();
        await esperar(() => estado.requests.some(r => r.path === "/vendas"));
        assert.deepEqual(JSON.parse(estado.requests.find(r => r.path === "/vendas").body).pagamentos,
            [{ configuracaoFormaPagamentoId: 1, valor: 100, valorRecebido: 100 }]);
        await page.getByRole("heading", { name: "Venda concluída" }).waitFor();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
    } finally { await page.close(); }
});

test("dinheiro PIX credito envia parcelas, mostra troco sem somar recebido e cabe em desktop/mobile", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        await grupoPagamento(page, 1).getByLabel("Valor aplicado (R$)").fill("40");
        await grupoPagamento(page, 1).getByLabel("Valor recebido (R$)").fill("50");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("2");
        assert.equal(await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").inputValue(), "60.00");
        await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").fill("30");
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        await grupoPagamento(page, 3).getByRole("combobox").selectOption("4");
        assert.equal(await grupoPagamento(page, 3).getByLabel("Valor aplicado (R$)").inputValue(), "30.00");
        assert.match(await page.getByLabel("Pago agora", { exact: true }).innerText(), /100,00/);
        assert.equal(await page.getByLabel("Falta distribuir", { exact: true }).count(), 0);
        assert.match(await grupoPagamento(page, 1).innerText(), /10,00/);
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Sem overflow horizontal");
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/pagamento-misto-${width}.png`, fullPage: true });
        }
        await page.getByRole("button", { name: "Pagar · F2" }).click();
        await esperar(() => estado.requests.some(r => r.path === "/vendas"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.deepEqual(pedido.pagamentos, [
            { configuracaoFormaPagamentoId: 1, valor: 40, valorRecebido: 50 },
            { configuracaoFormaPagamentoId: 2, valor: 30 }, { configuracaoFormaPagamentoId: 4, valor: 30 },
        ]);
        assert.equal(pedido.formaPagamento, undefined); assert.equal(pedido.valorRecebido, undefined);
        assert.equal(pedido.empresaId, undefined); assert.equal(pedido.tenantId, undefined);
        await page.getByRole("heading", { name: "Venda concluída" }).waitFor();
    } finally { await page.close(); }
});

test("editar/remover formas bloqueia diferenca no total e evita configuracao repetida", async () => {
    const { page, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        await page.getByLabel("Valor aplicado (R$)").fill("40");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        await page.getByRole("button", { name: "Adicionar forma" }).click();
        assert.equal(await grupoPagamento(page, 2).getByRole("option", { name: "Dinheiro", exact: true }).isDisabled(), true);
        await grupoPagamento(page, 2).getByRole("combobox").selectOption("2");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        await grupoPagamento(page, 2).getByLabel("Valor aplicado (R$)").fill("61");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), false);
        assert.match(await page.getByLabel("Valor excedente", { exact: true }).innerText(), /1,00/);
        await page.getByRole("button", { name: "Remover pagamento 2" }).click();
        assert.equal(await page.getByRole("group", { name: "Pagamento 2", exact: true }).count(), 0);
        assert.match(await page.getByLabel("Falta distribuir", { exact: true }).innerText(), /60,00/);
        await page.getByLabel("Valor aplicado (R$)").fill("100");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
    } finally { await page.close(); }
});

test("erro backend preserva itens e parcelas para corrigir e tentar novamente", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); estado.erroVenda = 409;
        await page.getByRole("button", { name: "Pagar · F2" }).click();
        await page.getByRole("dialog").getByText("A soma dos pagamentos deve corresponder ao total da venda.", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Voltar à venda" }).click();
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "10");
        assert.equal(await page.getByLabel("Valor aplicado (R$)").inputValue(), "100.00");
        assert.equal(await page.getByRole("button", { name: "Pagar · F2" }).isEnabled(), true);
        estado.erroVenda = null;
        await page.getByRole("button", { name: "Pagar · F2" }).click();
        await page.getByRole("heading", { name: "Venda concluída" }).waitFor();
        assert.equal(estado.requests.filter(r => r.path === "/vendas").length, 2);
    } finally { await page.close(); }
});
