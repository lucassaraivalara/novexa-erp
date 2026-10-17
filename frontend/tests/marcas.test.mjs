import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const fixture = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material'; import {BrowserRouter} from 'react-router-dom';
import AppRoutes from '/src/routes/AppRoutes.tsx'; import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-marcas-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "marcas-fixture", resolveId(id) { if (id === "/marcas-fixture.js") return "\0marcas-fixture"; },
            load(id) { if (id === "\0marcas-fixture") return fixture; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!req.url.startsWith("/configuracoes") && !req.url.startsWith("/login")) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/marcas-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const estadoNovo = () => ({ chamadas: [], marcas: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, nome: `Marca ${String(i + 1).padStart(2, "0")}`, ativo: true })), duplicado: false, bloqueio: false, erroLista: false });
async function abrir(estado, { perfil = "ADMIN", sessao = true, width = 1440, height = 900, rota = "/configuracoes/marcas-produtos", relogio = false } = {}) {
    const page = await browser.newPage({ viewport: { width, height } });
    if (relogio) { await page.clock.install({ time: new Date("2026-10-17T12:00:00Z") }); await page.clock.pauseAt(new Date("2026-10-17T12:00:01Z")); }
    if (sessao) await page.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({ token: "token-teste", perfil, nomeUsuario: "Teste", empresa: { id: 1, nomeFantasia: "Loja teste" } })), perfil);
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const corpo = req.postData() ? JSON.parse(req.postData()) : null;
        estado.chamadas.push({ metodo: req.method(), path: u.pathname, params: u.searchParams, corpo, auth: req.headers().authorization });
        const responder = (status, data) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
        const match = u.pathname.match(/^\/produtos\/marcas(?:\/(\d+))?$/);
        if (!match) return responder(200, []);
        const id = Number(match[1]);
        if (req.method() === "GET") {
            if (estado.erroLista) return responder(503, "Consulta indisponível");
            let itens = estado.marcas.filter(item => item.nome.toLowerCase().includes((u.searchParams.get("termo") ?? "").toLowerCase()));
            if (u.searchParams.has("ativo")) itens = itens.filter(item => item.ativo === (u.searchParams.get("ativo") === "true"));
            const [campo, direcao] = (u.searchParams.get("sort") ?? "nome,asc").split(",");
            itens.sort((a, b) => String(a[campo]).localeCompare(String(b[campo])) * (direcao === "desc" ? -1 : 1));
            const pagina = Number(u.searchParams.get("page") ?? 0), size = Number(u.searchParams.get("size") ?? 25);
            return responder(200, { items: itens.slice(pagina * size, (pagina + 1) * size), page: pagina, size, totalItems: itens.length, totalPages: Math.ceil(itens.length / size) });
        }
        if (req.method() === "DELETE") {
            if (estado.bloqueio) return responder(409, "Marca possui produtos vinculados. Inative a marca para preservar os vínculos.");
            estado.marcas.splice(estado.marcas.findIndex(item => item.id === id), 1); return route.fulfill({ status: 204, headers: cors });
        }
        if (estado.duplicado) return responder(409, "Já existe uma marca com este nome nesta empresa.");
        const item = { ...corpo, id: id || 100 };
        if (id) estado.marcas.splice(estado.marcas.findIndex(item => item.id === id), 1, item); else estado.marcas.push(item);
        return responder(id ? 200 : 201, item);
    });
    await page.goto(`${url}${rota}`);
    if (relogio) { await expect(page.getByRole("main").getByRole("heading", { name: "Marcas", exact: true })).toBeVisible(); await page.clock.runFor(20); }
    return page;
}
const chamadas = (e, metodo, path = "/produtos/marcas") => e.chamadas.filter(c => c.metodo === metodo && c.path === path);
const linha = (p, nome) => p.getByRole("row").filter({ has: p.getByRole("cell", { name: nome, exact: true }) });

test("Marcas usa busca, situação, ordenação e paginação remotas com JWT", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        await expect(p.getByRole("cell", { name: "Marca 01", exact: true })).toBeVisible();
        assert.equal(await p.getByRole("cell", { name: "Marca 26", exact: true }).count(), 0);
        await p.getByRole("button", { name: "Próxima página" }).click();
        await expect(p.getByRole("cell", { name: "Marca 26", exact: true })).toBeVisible();
        await p.getByRole("textbox", { name: "Buscar por nome…", exact: true }).fill("Marca 30");
        await expect(p.getByRole("cell", { name: "Marca 30", exact: true })).toBeVisible();
        await expect.poll(() => chamadas(e, "GET").at(-1).params.get("page")).toBe("0");
        await p.getByRole("columnheader", { name: "Nome" }).getByRole("button").click();
        await expect.poll(() => chamadas(e, "GET").at(-1).params.get("sort")).toBe("nome,desc");
        await p.getByRole("combobox", { name: "Situação", exact: true }).click(); await p.getByRole("option", { name: "Todas", exact: true }).click();
        await expect.poll(() => chamadas(e, "GET").at(-1).params.has("ativo")).toBe(false);
        assert.ok(e.chamadas.every(c => c.auth === "Bearer token-teste" && !c.params.has("empresaId")));
    } finally { await p.close(); }
});

test("criação valida nome, preserva entrada no conflito e permite editar, inativar e reativar", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        await p.getByRole("button", { name: "Nova marca", exact: true }).click();
        const d = p.getByRole("dialog"); await d.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("Informe um nome"); assert.equal(chamadas(e, "POST").length, 0);
        await d.getByRole("textbox", { name: "Nome", exact: true }).fill(" Nova marca ");
        e.duplicado = true; await d.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("Já existe");
        await expect(d.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue(" Nova marca ");
        e.duplicado = false; await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.deepEqual(chamadas(e, "POST").at(-1).corpo, { nome: "Nova marca", ativo: true });
        await linha(p, "Marca 01").getByRole("button", { name: "Editar", exact: true }).click();
        await d.getByRole("textbox", { name: "Nome", exact: true }).fill("Marca editada");
        await d.getByRole("checkbox", { name: "Ativa", exact: true }).uncheck();
        await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        await expect(linha(p, "Marca 01")).toHaveCount(0);
        assert.deepEqual(chamadas(e, "PUT", "/produtos/marcas/1")[0].corpo, { nome: "Marca editada", ativo: false });
        await p.getByRole("combobox", { name: "Situação", exact: true }).click(); await p.getByRole("option", { name: "Inativas", exact: true }).click();
        await linha(p, "Marca editada").getByRole("button", { name: "Editar", exact: true }).click();
        await d.getByRole("checkbox", { name: "Ativa", exact: true }).check();
        await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.equal(chamadas(e, "PUT", "/produtos/marcas/1").at(-1).corpo.ativo, true);
    } finally { await p.close(); }
});

test("exclusão pede confirmação, mostra bloqueio por produto e só remove após sucesso", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        await linha(p, "Marca 01").getByRole("button", { name: "Excluir", exact: true }).click();
        assert.equal(chamadas(e, "DELETE", "/produtos/marcas/1").length, 0);
        e.bloqueio = true; const d = p.getByRole("dialog"); await d.getByRole("button", { name: "Excluir", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("produtos vinculados");
        assert.ok(e.marcas.some(m => m.id === 1));
        e.bloqueio = false; await d.getByRole("button", { name: "Excluir", exact: true }).click();
        await expect(d).toHaveCount(0); await expect(linha(p, "Marca 01")).toHaveCount(0);
    } finally { await p.close(); }
});

test("erro de consulta mantém retry sem apresentar resultado vazio", async () => {
    const e = estadoNovo(); e.erroLista = true; const p = await abrir(e);
    try {
        await expect(p.getByRole("alert")).toContainText("Consulta indisponível");
        assert.equal(await p.getByText("Nenhuma marca encontrada", { exact: true }).count(), 0);
        e.erroLista = false; await p.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await expect(p.getByRole("cell", { name: "Marca 01", exact: true })).toBeVisible();
    } finally { await p.close(); }
});

test("central e acesso direto preservam área, retorno, perfis, contexto e layout responsivo", async () => {
    for (const [width, height, perfil] of [[1440,900,"ADMIN"],[1366,768,"GERENTE"],[390,844,"OPERADOR"],[390,320,"USUARIO"]]) {
        const e = estadoNovo(), p = await abrir(e, { perfil, width, height, rota: "/configuracoes" });
        const erros = []; p.on("pageerror", error => erros.push(error.message)); p.on("console", msg => { if (msg.type() === "error") erros.push(msg.text()); });
        try {
            await p.getByRole("main").getByRole("link", { name: /^Marcas/ }).click();
            await expect(p.getByRole("cell", { name: "Marca 01", exact: true })).toBeVisible();
            await expect(p.getByRole("navigation").getByRole("link", { name: width < 600 ? "Configurações (ícone)" : "Configurações", exact: true })).toHaveAttribute("aria-current", "true");
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await p.getByRole("button", { name: "Nova marca", exact: true }).click();
            await expect(p.getByRole("dialog").getByRole("textbox", { name: "Nome", exact: true })).toBeFocused();
            await p.waitForFunction(() => [...document.querySelectorAll(".MuiDialog-container, .MuiBackdrop-root")].every(el => getComputedStyle(el).opacity === "1"));
            if (process.env.NOVEXA_MARCAS_SCREENSHOTS) await p.screenshot({ path: `node_modules/.novexa-marcas-validation/form-${width}-${height}.png` });
            await p.keyboard.press("Escape"); await expect(p.getByRole("dialog")).toHaveCount(0);
            await expect(p.getByRole("button", { name: "Nova marca", exact: true })).toBeFocused();
            if (process.env.NOVEXA_MARCAS_SCREENSHOTS) await p.screenshot({ path: `node_modules/.novexa-marcas-validation/lista-${width}-${height}.png` });
            await p.goto(`${url}/configuracoes/marcas-produtos?origem=atalho`);
            await expect(p.getByRole("cell", { name: "Marca 01", exact: true })).toBeVisible();
            await p.getByRole("textbox", { name: "Buscar por nome…", exact: true }).fill("Marca 01");
            await expect.poll(() => chamadas(e, "GET").at(-1).params.get("termo")).toBe("Marca 01");
            assert.equal(new URL(p.url()).searchParams.get("origem"), "atalho");
            await p.getByRole("link", { name: "Voltar às configurações", exact: true }).click();
            await expect(p.getByRole("main").getByRole("heading", { name: "Configurações", exact: true })).toBeVisible();
            assert.deepEqual(erros, []);
        } finally { await p.close(); }
    }
});

test("sem sessão exige login e não carrega marcas", async () => {
    const e = estadoNovo(), p = await abrir(e, { sessao: false });
    try { await expect(p).toHaveURL(`${url}/login`); assert.equal(e.chamadas.length, 0); }
    finally { await p.close(); }
});

test("paginar antes do debounce inicial mantém a página após o timer pendente", async () => {
    const e = estadoNovo(), p = await abrir(e, { relogio: true });
    try {
        await expect(p.getByRole("cell", { name: "Marca 01", exact: true })).toBeVisible();
        await p.getByRole("button", { name: "Próxima página" }).click();
        await p.clock.runFor(500);
        await expect(p.getByRole("cell", { name: "Marca 26", exact: true })).toBeVisible();
        assert.equal(chamadas(e, "GET").at(-1).params.get("page"), "1");
    } finally { await p.close(); }
});
