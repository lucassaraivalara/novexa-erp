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
    server = await createServer({ cacheDir: "node_modules/.vite-categorias-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "categorias-fixture", resolveId(id) { if (id === "/categorias-fixture.js") return "\0categorias-fixture"; },
            load(id) { if (id === "\0categorias-fixture") return fixture; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!req.url.startsWith("/configuracoes") && !req.url.startsWith("/login")) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/categorias-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const estadoNovo = () => ({ chamadas: [], categorias: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, nome: `Grupo ${String(i + 1).padStart(2, "0")}`, ativo: true })), subcategorias: [], duplicado: false, bloqueio: false, erroLista: false, erroBusca: false });
async function abrir(estado, { perfil = "ADMIN", sessao = true, width = 1440, height = 900, rota = "/configuracoes/categorias-produtos" } = {}) {
    const page = await browser.newPage({ viewport: { width, height } });
    if (sessao) await page.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({ token: "token-teste", perfil, nomeUsuario: "Teste", empresa: { id: 1, nomeFantasia: "Loja teste" } })), perfil);
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const corpo = req.postData() ? JSON.parse(req.postData()) : null;
        estado.chamadas.push({ metodo: req.method(), path: u.pathname, params: u.searchParams, corpo, auth: req.headers().authorization });
        const responder = (status, data) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
        const match = u.pathname.match(/^\/produtos\/(categorias|subcategorias)(?:\/(\d+))?$/);
        if (!match) return responder(200, []);
        const lista = estado[match[1]], id = Number(match[2]);
        if (req.method() === "GET") {
            if (estado.erroLista || (estado.erroBusca && match[1] === "categorias")) return responder(500, "Falha de consulta");
            let itens = lista.filter(item => item.nome.toLowerCase().includes((u.searchParams.get("termo") ?? "").toLowerCase()));
            if (u.searchParams.has("ativo")) itens = itens.filter(item => item.ativo === (u.searchParams.get("ativo") === "true"));
            if (u.searchParams.has("categoriaId")) itens = itens.filter(item => item.categoria.id === Number(u.searchParams.get("categoriaId")));
            const [campo, direcao] = (u.searchParams.get("sort") ?? "nome,asc").split(",");
            itens.sort((a, b) => String(a[campo]).localeCompare(String(b[campo])) * (direcao === "desc" ? -1 : 1));
            const pagina = Number(u.searchParams.get("page") ?? 0), size = Number(u.searchParams.get("size") ?? 25);
            return responder(200, { items: itens.slice(pagina * size, (pagina + 1) * size), page: pagina, size, totalItems: itens.length, totalPages: Math.ceil(itens.length / size) });
        }
        if (req.method() === "DELETE") {
            if (estado.bloqueio) return responder(409, "Categoria possui subcategorias. Remova ou transfira os vínculos antes de excluir.");
            lista.splice(lista.findIndex(item => item.id === id), 1); return route.fulfill({ status: 204, headers: cors });
        }
        if (estado.duplicado) return responder(409, "Já existe uma categoria com este nome nesta empresa.");
        const item = { ...corpo, id: id || 100, ...(corpo.categoriaId ? { categoria: estado.categorias.find(c => c.id === corpo.categoriaId) } : {}) };
        if (id) lista.splice(lista.findIndex(item => item.id === id), 1, item); else lista.push(item);
        return responder(id ? 200 : 201, item);
    });
    await page.goto(`${url}${rota}`); return page;
}
const chamadas = (e, metodo, path) => e.chamadas.filter(c => c.metodo === metodo && c.path === path);

test("consulta paginada, busca, situação e ordenação são remotas e levam autenticação", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        await expect(p.getByRole("cell", { name: "Grupo 01", exact: true })).toBeVisible();
        assert.equal(await p.getByRole("cell", { name: "Grupo 26", exact: true }).count(), 0);
        await p.getByRole("button", { name: "Próxima página" }).click();
        await expect(p.getByRole("cell", { name: "Grupo 26", exact: true })).toBeVisible();
        await p.getByRole("textbox", { name: "Buscar por nome…", exact: true }).fill("Grupo 30");
        await expect(p.getByRole("cell", { name: "Grupo 30", exact: true })).toBeVisible();
        await expect.poll(() => chamadas(e, "GET", "/produtos/categorias").at(-1).params.get("page")).toBe("0");
        await p.getByRole("columnheader", { name: "Nome" }).getByRole("button").click();
        await expect.poll(() => chamadas(e, "GET", "/produtos/categorias").at(-1).params.get("sort")).toBe("nome,desc");
        await p.getByRole("combobox", { name: "Situação", exact: true }).click(); await p.getByRole("option", { name: "Inativas", exact: true }).click();
        await expect(p.getByText("Nenhum cadastro encontrado", { exact: true })).toBeVisible();
        assert.equal(chamadas(e, "GET", "/produtos/categorias").at(-1).params.get("ativo"), "false");
        assert.ok(e.chamadas.every(c => c.auth === "Bearer token-teste" && !c.params.has("empresaId")));
    } finally { await p.close(); }
});

test("cria, edita e inativa; conflito mantém o formulário digitado", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        await p.getByRole("button", { name: "Nova categoria", exact: true }).click();
        const d = p.getByRole("dialog"); await d.getByRole("textbox", { name: "Nome", exact: true }).fill(" Nova categoria ");
        e.duplicado = true; await d.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("Já existe");
        await expect(d.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue(" Nova categoria ");
        e.duplicado = false; await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.deepEqual(chamadas(e, "POST", "/produtos/categorias").at(-1).corpo, { nome: "Nova categoria", ativo: true });
        const row = p.getByRole("row").filter({ has: p.getByRole("cell", { name: "Grupo 01", exact: true }) });
        await row.getByRole("button", { name: "Editar", exact: true }).click();
        await d.getByRole("textbox", { name: "Nome", exact: true }).fill("Grupo editado");
        await d.getByRole("checkbox", { name: "Ativa", exact: true }).uncheck();
        await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.deepEqual(chamadas(e, "PUT", "/produtos/categorias/1")[0].corpo, { nome: "Grupo editado", ativo: false });
        await expect(row).toHaveCount(0);
    } finally { await p.close(); }
});

test("subcategoria pesquisa pai fora da primeira página, salva vínculo e filtra por categoria", async () => {
    const e = estadoNovo(), p = await abrir(e, { rota: "/configuracoes/categorias-produtos?aba=subcategorias&origem=atalho" });
    try {
        await expect(p.getByRole("tab", { name: "Subcategorias", exact: true })).toHaveAttribute("aria-selected", "true");
        await p.getByRole("button", { name: "Nova subcategoria", exact: true }).click();
        const d = p.getByRole("dialog"); await d.getByRole("textbox", { name: "Nome", exact: true }).fill("Detalhe");
        await d.getByRole("combobox", { name: "Categoria", exact: true }).fill("Grupo 30");
        await p.getByRole("option", { name: "Grupo 30", exact: true }).click();
        await d.getByRole("button", { name: "Salvar", exact: true }).click(); await expect(d).toHaveCount(0);
        await expect(p.getByRole("cell", { name: "Detalhe", exact: true })).toBeVisible();
        assert.deepEqual(chamadas(e, "POST", "/produtos/subcategorias")[0].corpo, { nome: "Detalhe", ativo: true, categoriaId: 30 });
        await p.getByRole("combobox", { name: "Categoria", exact: true }).fill("Grupo 30");
        await p.getByRole("option", { name: "Grupo 30", exact: true }).click();
        await expect.poll(() => chamadas(e, "GET", "/produtos/subcategorias").at(-1).params.get("categoriaId")).toBe("30");
        await p.getByRole("tab", { name: "Categorias", exact: true }).click();
        assert.equal(new URL(p.url()).searchParams.get("origem"), "atalho");
    } finally { await p.close(); }
});

test("exclusão exige confirmação e mostra bloqueio sem remover o cadastro", async () => {
    const e = estadoNovo(), p = await abrir(e);
    try {
        const row = p.getByRole("row").filter({ has: p.getByRole("cell", { name: "Grupo 01", exact: true }) });
        await row.getByRole("button", { name: "Excluir", exact: true }).click();
        assert.equal(chamadas(e, "DELETE", "/produtos/categorias/1").length, 0);
        e.bloqueio = true; const d = p.getByRole("dialog"); await d.getByRole("button", { name: "Excluir", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("possui subcategorias");
        e.bloqueio = false; await d.getByRole("button", { name: "Excluir", exact: true }).click();
        await expect(d).toHaveCount(0); await expect(row).toHaveCount(0);
    } finally { await p.close(); }
});

test("falha da listagem oferece retry e não é apresentada como cadastro vazio", async () => {
    const e = estadoNovo(); e.erroLista = true; const p = await abrir(e);
    try {
        await expect(p.getByRole("alert")).toContainText("Falha de consulta");
        assert.equal(await p.getByText("Nenhum cadastro encontrado", { exact: true }).count(), 0);
        e.erroLista = false; await p.getByRole("button", { name: "Tentar novamente" }).click();
        await expect(p.getByRole("cell", { name: "Grupo 01", exact: true })).toBeVisible();
    } finally { await p.close(); }
});

test("acesso pela central, área ativa, retorno e layout em desktop, notebook, mobile e janela baixa", async () => {
    for (const [width, height] of [[1440,900],[1366,768],[390,844],[390,320]]) {
        const e = estadoNovo(), p = await abrir(e, { perfil: "OPERADOR", width, height, rota: "/configuracoes" });
        const erros = []; p.on("pageerror", error => erros.push(error.message));
        p.on("console", message => { if (message.type() === "error") erros.push(message.text()); });
        try {
            await p.getByRole("main").getByRole("link", { name: /Categorias e subcategorias/ }).click();
            await expect(p.getByRole("cell", { name: "Grupo 01", exact: true })).toBeVisible();
            await expect(p.getByRole("navigation").getByRole("link", { name: width < 600 ? "Configurações (ícone)" : "Configurações", exact: true })).toHaveAttribute("aria-current", "true");
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await p.getByRole("button", { name: "Nova categoria", exact: true }).click();
            await expect(p.getByRole("dialog").getByRole("textbox", { name: "Nome", exact: true })).toBeFocused();
            await p.getByRole("dialog").getByRole("textbox", { name: "Nome", exact: true }).fill("Nome longo para visualizar o cadastro");
            await p.waitForFunction(() => [...document.querySelectorAll(".MuiDialog-container, .MuiBackdrop-root")].every(el => getComputedStyle(el).opacity === "1"));
            if (process.env.NOVEXA_CATEGORIAS_SCREENSHOTS) await p.screenshot({ path: `node_modules/.novexa-categorias-validation/form-${width}-${height}.png` });
            await p.keyboard.press("Escape");
            await expect(p.getByRole("dialog")).toHaveCount(0);
            await expect(p.getByRole("button", { name: "Nova categoria", exact: true })).toBeFocused();
            if (process.env.NOVEXA_CATEGORIAS_SCREENSHOTS) await p.screenshot({ path: `node_modules/.novexa-categorias-validation/lista-${width}-${height}.png` });
            await p.getByRole("link", { name: "Voltar às configurações", exact: true }).click();
            await expect(p.getByRole("main").getByRole("heading", { name: "Configurações", exact: true })).toBeVisible();
            assert.deepEqual(erros, []);
        } finally { await p.close(); }
    }
});

test("acesso sem sessão exige login e não consulta o cadastro", async () => {
    const e = estadoNovo(), p = await abrir(e, { sessao: false });
    try { await expect(p).toHaveURL(`${url}/login`); assert.equal(e.chamadas.length, 0); }
    finally { await p.close(); }
});
