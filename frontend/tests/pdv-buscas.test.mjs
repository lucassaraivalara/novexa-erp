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
                import { ThemeProvider } from '@mui/material'; import theme from '/src/theme/theme.ts';
                import Vendas from '/src/pages/Vendas/Vendas.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider, {theme},
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
        else if (u.pathname === "/financeiro/configuracoes-formas-pagamento") dados = [{ id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true }];
        else if (u.pathname.endsWith("/buscar")) {
            if (estado.atrasar && registro.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            if (estado.atrasarScanner && registro.termo === "7890001") await new Promise(r => setTimeout(r, 700));
            dados = u.pathname === "/produtos/buscar" ? [produto(registro.termo === "antiga" ? "Resposta antiga" : "Produto remoto", registro.termo === "1" ? "1" : "P1")]
                : [cliente(registro.termo === "antiga" ? "Cliente antigo" : "Cliente remoto")];
        } else if (u.pathname === "/vendas" && req.method() === "POST") dados = { id: 20, total: 10, troco: 0 };
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
