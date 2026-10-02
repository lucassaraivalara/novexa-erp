import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
let service;
let api;

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '/src/theme/theme.ts';
import ContasPagar from '/src/pages/Financeiro/ContasPagar.tsx';
createRoot(document.getElementById('root')).render(
    React.createElement(ThemeProvider, { theme }, React.createElement(CssBaseline), React.createElement(ContasPagar)));
`;

const pagina = (items) => ({ items, page: 0, size: items.length || 25, totalItems: items.length, totalPages: items.length ? 1 : 0 });
const fornecedores = [
    { id: 1, razaoSocial: "Aço Sul", nomeFantasia: null, cpfCnpj: null, telefone: null, ativo: true },
    { id: 2, razaoSocial: "Distribuidora Antiga", nomeFantasia: null, cpfCnpj: null, telefone: null, ativo: false },
];
const esperar = async (condicao) => {
    for (let i = 0; i < 100 && !condicao(); i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(condicao(), "condição não atendida a tempo");
};
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-fornecedor-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "fornecedor-fixture",
            resolveId(id) { if (id === "/fornecedor-fixture.js") return "\0fornecedor-fixture.js"; },
            load(id) { if (id === "\0fornecedor-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use("/__fornecedor", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml("/__fornecedor", '<div id="root"></div><script type="module" src="/fornecedor-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/__fornecedor`;
    browser = await chromium.launch({ headless: true });
    service = await server.ssrLoadModule("/src/services/fornecedorService.ts");
    api = (await server.ssrLoadModule("/src/services/api.ts")).default;
});
after(async () => { await browser?.close(); await server?.close(); });

test("service separa listagem paginada e busca rápida de ativos", async () => {
    const anterior = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => null };
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        return { data: config.url === "/fornecedores" ? pagina(fornecedores) : [], status: 200, statusText: "OK", headers: {}, config };
    };
    try {
        const resposta = await service.listarFornecedores({ page: 1, size: 10, termo: "aço", ativo: true });
        await service.buscarFornecedores("aço");
        assert.equal(resposta.items.length, 2);
        assert.equal(resposta.totalItems, 2);
        assert.deepEqual(chamadas[0].params, { page: 1, size: 10, termo: "aço", ativo: true });
        assert.equal(chamadas[1].url, "/fornecedores/buscar");
        assert.deepEqual(chamadas[1].params, { termo: "aço" });
    } finally {
        if (anterior === undefined) delete globalThis.localStorage; else globalThis.localStorage = anterior;
    }
});

test("Contas a Pagar filtra fornecedor no backend por autocomplete remoto, sem carregar lista", async () => {
    const page = await browser.newPage();
    const buscas = [];
    const listagens = [];
    const consultas = [];
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "t", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        let data = [];
        if (u.pathname === "/fornecedores") { listagens.push(u.search); data = pagina(fornecedores); }
        else if (u.pathname === "/fornecedores/buscar") {
            buscas.push(u.searchParams.get("termo"));
            data = fornecedores.filter((f) => f.ativo).map(({ ativo: _ativo, ...f }) => f);
        } else if (u.pathname === "/financeiro/contas-pagar") { consultas.push(u.searchParams); data = pagina([]); }
        else if (u.pathname === "/financeiro/contas-pagar/resumo") data = Object.fromEntries(
            ["vencidas", "seteDias", "trintaDias", "emAberto", "pagasMes"].map((k) => [k, { total: 0, quantidade: 0 }]));
        await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    });
    try {
        await page.goto(url);
        await page.getByRole("combobox", { name: "Fornecedor" }).click();
        await page.getByRole("option", { name: "Aço Sul" }).click();
        await esperar(() => consultas.some((p) => p.get("fornecedor") === "1"));
        assert.deepEqual(listagens, []);
        assert.ok(buscas.includes(""));
        const filtrada = consultas.find((p) => p.get("fornecedor") === "1");
        assert.ok(filtrada, "deve enviar fornecedor=1 ao backend");
        assert.equal(filtrada.get("page"), "0");
        assert.ok(filtrada.get("size"));
        assert.ok(consultas.every((p) => p.get("size") !== "100" || p.get("fornecedor")));
        const antes = consultas.length;
        await page.getByRole("button", { name: "Limpar filtros" }).click();
        await esperar(() => consultas.length > antes && !consultas.at(-1).has("fornecedor"));
    } finally { await page.close(); }
});

test("Contas a Pagar consome fornecedores paginados e seleciona somente ativos na busca rápida", async () => {
    const page = await browser.newPage();
    const buscas = [];
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "t", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        let data = [];
        if (u.pathname === "/fornecedores") data = pagina(fornecedores);
        else if (u.pathname === "/fornecedores/buscar") {
            buscas.push(u.searchParams.get("termo"));
            data = fornecedores.filter((f) => f.ativo).map(({ ativo: _ativo, ...f }) => f);
        } else if (u.pathname === "/financeiro/contas-pagar") data = pagina([]);
        else if (u.pathname === "/financeiro/contas-pagar/resumo") data = Object.fromEntries(
            ["vencidas", "seteDias", "trintaDias", "emAberto", "pagasMes"].map((k) => [k, { total: 0, quantidade: 0 }]));
        await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    });
    try {
        await page.goto(url);
        await page.getByRole("button", { name: "Nova conta" }).click();
        await page.getByRole("combobox", { name: "Fornecedor" }).last().click();
        await page.getByRole("option", { name: "Aço Sul" }).waitFor();
        assert.equal(await page.getByRole("option", { name: "Distribuidora Antiga" }).count(), 0);
        assert.ok(buscas.includes(""));
    } finally { await page.close(); }
});
