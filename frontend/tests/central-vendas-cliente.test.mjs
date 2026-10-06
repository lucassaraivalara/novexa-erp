import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
                    React.createElement(MemoryRouter,null,React.createElement(Tela))));`; },
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
async function abrir(operacional = false) {
    const estado = { requests: [] };
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "teste", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const params = Object.fromEntries(u.searchParams); estado.requests.push({ path: u.pathname, params });
        let data;
        if (u.pathname === "/vendas") data = { items: [{ id: 30, dataHora: "2026-10-01T10:00:00", nomeCliente: "Venda retornada", total: 85,
            status: "FATURADA", sessaoCaixaId: 1 }], page: Number(params.page), size: Number(params.size), totalItems: 63, totalPages: 3 };
        else if (u.pathname === "/clientes/buscar") {
            if (params.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            data = params.termo === "historico" ? [cliente(9, "Cliente historico", false)]
                : [cliente(params.termo === "outro" ? 10 : 8, params.termo === "antiga" ? "Resposta antiga"
                    : params.termo === "outro" ? "Outro cliente" : "Cliente remoto")];
        } else throw new Error(`HTTP inesperado: ${u.pathname}`);
        await route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${url}/__${operacional ? "operacional" : "central"}`);
    if (!operacional) await page.getByText("Venda retornada", { exact: true }).waitFor();
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
