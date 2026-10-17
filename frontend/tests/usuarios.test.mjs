import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';import {BrowserRouter} from 'react-router-dom';
import AppRoutes from '/src/routes/AppRoutes.tsx';import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-usuarios-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "usuarios-fixture", resolveId(id) { if (id === "/usuarios-fixture.js") return "\0usuarios-fixture"; },
            load(id) { if (id === "\0usuarios-fixture") return fixture; }, configureServer(vite) {
                vite.middlewares.use(async (req, res, next) => {
                    if (!/^\/(usuarios|configuracoes|login)(\?|$)/.test(req.url)) return next();
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/usuarios-fixture.js"></script>'));
                });
            } }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const novoEstado = () => ({ chamadas: [], erro: null, usuarios: Array.from({ length: 30 }, (_, i) => ({ id: i + 1,
    nomeUsuario: `Pessoa ${String(i + 1).padStart(2, "0")}`, cpf: i === 0 ? "02360684663" : "52998224725",
    login: `pessoa${i + 1}`, email: `pessoa${i + 1}@teste.com`, perfil: i === 0 ? "ADMIN" : "OPERADOR", ativo: true, empresa: { id: 1 } })) });
async function abrir(e, { perfil = "ADMIN", width = 1440, height = 900 } = {}) {
    const p = await browser.newPage({ viewport: { width, height } });
    await p.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({ id: 1, token: "teste", perfil, nomeUsuario: "Admin", empresa: { id: 1, nomeFantasia: "Empresa teste" } })), perfil);
    await p.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const corpo = req.postData() ? JSON.parse(req.postData()) : null;
        e.chamadas.push({ metodo: req.method(), path: u.pathname, params: u.searchParams, corpo, auth: req.headers().authorization });
        const responder = (status, data) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
        if (!u.pathname.startsWith("/usuarios")) return responder(200, []);
        if (e.erro) return responder(e.erro.status, e.erro.mensagem);
        if (req.method() === "GET") {
            const termo = (u.searchParams.get("termo") ?? "").toLowerCase();
            let linhas = e.usuarios.filter(a => [a.nomeUsuario, a.cpf, a.login, a.email].some(v => v.toLowerCase().includes(termo)));
            if (u.searchParams.has("ativo")) linhas = linhas.filter(a => a.ativo === (u.searchParams.get("ativo") === "true"));
            const [campo, direcao] = (u.searchParams.get("sort") ?? "nomeUsuario,asc").split(",");
            linhas.sort((a, b) => String(a[campo]).localeCompare(String(b[campo])) * (direcao === "desc" ? -1 : 1));
            const page = Number(u.searchParams.get("page") ?? 0), size = Number(u.searchParams.get("size") ?? 25);
            return responder(200, { items: linhas.slice(page * size, (page + 1) * size), page, size, totalItems: linhas.length, totalPages: Math.ceil(linhas.length / size) });
        }
        const match = u.pathname.match(/\/usuarios\/(\d+)(?:\/(senha|situacao))?$/), id = Number(match?.[1]);
        if (match?.[2]) {
            const a = e.usuarios.find(a => a.id === id); if (match[2] === "situacao") a.ativo = corpo.ativo;
            return responder(200, a);
        }
        const a = { ...corpo, senha: undefined, id: id || 31, empresa: { id: 1 } };
        if (id) e.usuarios.splice(e.usuarios.findIndex(a => a.id === id), 1, a); else e.usuarios.push(a);
        return responder(200, a);
    });
    await p.goto(`${url}/usuarios`); return p;
}
const chamadas = (e, metodo, path) => e.chamadas.filter(c => c.metodo === metodo && c.path === path);
const linha = (p, nome) => p.getByRole("row").filter({ has: p.getByRole("cell", { name: nome, exact: true }) });
async function preencher(p) {
    await p.getByRole("button", { name: "Novo usuário", exact: true }).click();
    await p.getByRole("textbox", { name: "Nome", exact: true }).fill("Nova pessoa");
    await p.getByRole("textbox", { name: "CPF", exact: true }).fill("39053344705");
    await p.getByRole("textbox", { name: "Login", exact: true }).fill("nova");
    await p.getByRole("textbox", { name: "E-mail", exact: true }).fill("nova@teste.com");
    await p.locator('input[name="senha"]').fill(" senha preservada ");
}

test("cadastro envia senha inicial, login e perfil; mostra/oculta senha; conflito preserva formulário", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await preencher(p);
        await p.getByRole("button", { name: "Mostrar senha" }).click(); await expect(p.locator('input[name="senha"]')).toHaveAttribute("type", "text");
        await p.getByRole("button", { name: "Ocultar senha" }).click(); await expect(p.locator('input[name="senha"]')).toHaveAttribute("type", "password");
        await p.getByRole("combobox", { name: "Perfil", exact: true }).click(); await p.getByRole("option", { name: "Gestor", exact: true }).click();
        e.erro = { status: 409, mensagem: "Já existe um usuário com este login nesta empresa." };
        await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("alert")).toContainText("este login"); await expect(p.locator('input[name="senha"]')).toHaveValue(" senha preservada ");
        e.erro = null; await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("heading", { name: "Novo usuário", exact: true })).toHaveCount(0);
        const enviado = chamadas(e, "POST", "/usuarios").at(-1).corpo;
        assert.equal(enviado.senha, " senha preservada "); assert.equal(enviado.login, "nova"); assert.equal(enviado.perfil, "GESTOR"); assert.equal(enviado.empresaId, undefined);
    } finally { await p.close(); }
});

test("consulta busca remota, paginação, ordenação e filtro não carregam todos os usuários", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await expect(p.getByRole("cell", { name: "Pessoa 01", exact: true })).toBeVisible();
        await p.getByRole("button", { name: "Próxima página" }).click(); await expect(p.getByRole("cell", { name: "Pessoa 26", exact: true })).toBeVisible();
        await p.getByRole("textbox", { name: "Buscar por nome, CPF, login ou e-mail…", exact: true }).fill("pessoa30@teste.com");
        await expect(p.getByRole("cell", { name: "Pessoa 30", exact: true })).toBeVisible();
        await expect.poll(() => chamadas(e, "GET", "/usuarios/pagina").at(-1).params.get("page")).toBe("0");
        await p.getByRole("columnheader", { name: "Nome", exact: true }).getByRole("button").click();
        await expect.poll(() => chamadas(e, "GET", "/usuarios/pagina").at(-1).params.get("sort")).toBe("nomeUsuario,desc");
        await p.getByRole("combobox", { name: "Situação", exact: true }).click(); await p.getByRole("option", { name: "Inativos", exact: true }).click();
        await expect(p.getByText("Nenhum usuário encontrado", { exact: true })).toBeVisible();
        assert.ok(e.chamadas.every(c => c.auth === "Bearer teste" && !c.params.has("empresaId")));
    } finally { await p.close(); }
});

test("edição preserva senha; inativação exige confirmação; redefinição envia somente senha", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await linha(p, "Pessoa 02").getByRole("button", { name: "Editar usuário", exact: true }).click();
        await p.getByRole("textbox", { name: "Nome", exact: true }).fill("Pessoa 02 editada");
        await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("cell", { name: "Pessoa 02 editada", exact: true })).toBeVisible();
        assert.equal(chamadas(e, "PUT", "/usuarios/2")[0].corpo.senha, undefined);
        await linha(p, "Pessoa 02 editada").getByRole("button", { name: "Ativar ou inativar usuário", exact: true }).click();
        assert.equal(chamadas(e, "PATCH", "/usuarios/2/situacao").length, 0);
        await p.getByRole("dialog").getByRole("button", { name: "Inativar", exact: true }).click();
        await expect(linha(p, "Pessoa 02 editada").getByText("Inativo", { exact: true })).toBeVisible();
        await linha(p, "Pessoa 02 editada").getByRole("button", { name: "Ativar ou inativar usuário", exact: true }).click();
        await p.getByRole("dialog").getByRole("button", { name: "Ativar", exact: true }).click();
        await expect(linha(p, "Pessoa 02 editada").getByText("Ativo", { exact: true })).toBeVisible();
        assert.deepEqual(chamadas(e, "PATCH", "/usuarios/2/situacao").map(c => c.corpo), [{ ativo: false }, { ativo: true }]);
        await linha(p, "Pessoa 02 editada").getByRole("button", { name: "Redefinir senha", exact: true }).click();
        await p.locator('input[name="senha"]').fill("nova senha"); await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect.poll(() => chamadas(e, "PATCH", "/usuarios/2/senha").length).toBe(1);
        assert.deepEqual(chamadas(e, "PATCH", "/usuarios/2/senha")[0].corpo, { senha: "nova senha" });
    } finally { await p.close(); }
});

test("conta própria e ADMIN preservado não oferecem inativação", async () => {
    const e = novoEstado(), p = await abrir(e);
    try { await expect(linha(p, "Pessoa 01").getByRole("button", { name: "Ativar ou inativar usuário", exact: true })).toBeDisabled(); }
    finally { await p.close(); }
});

test("lista vazia permite cadastrar sem consultar gerenciamento de acessos", async () => {
    const e = novoEstado(); e.usuarios = []; const p = await abrir(e);
    try {
        await expect(p.getByText("Nenhum usuário encontrado", { exact: true })).toBeVisible();
        await preencher(p);
        await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("cell", { name: "Nova pessoa", exact: true })).toBeVisible();
        assert.ok(e.chamadas.every(c => !/acessos|permissoes/.test(c.path)));
    } finally { await p.close(); }
});

test("inativar pelo formulário só envia edição após confirmação", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await linha(p, "Pessoa 02").getByRole("button", { name: "Editar usuário", exact: true }).click();
        await p.getByLabel("Usuário ativo", { exact: true }).uncheck();
        await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("dialog", { name: "Inativar usuário?", exact: true })).toBeVisible();
        assert.equal(chamadas(e, "PUT", "/usuarios/2").length, 0);
        await p.getByRole("button", { name: "Inativar e salvar", exact: true }).click();
        await expect(linha(p, "Pessoa 02").getByText("Inativo", { exact: true })).toBeVisible();
    } finally { await p.close(); }
});

for (const perfil of ["GESTOR", "GERENTE", "OPERADOR"]) test(`${perfil} não acessa administração de usuários`, async () => {
    const e = novoEstado(), p = await abrir(e, { perfil });
    try { await expect(p.getByRole("button", { name: "Novo usuário", exact: true })).toHaveCount(0); assert.equal(chamadas(e, "GET", "/usuarios/pagina").length, 0); }
    finally { await p.close(); }
});

test("erros de consulta e sessão expirada são explícitos, sem falso cadastro vazio", async () => {
    const e = novoEstado(); e.erro = { status: 401, mensagem: "Unauthorized" }; const p = await abrir(e);
    try {
        await expect(p.getByRole("alert")).toContainText("Sessão expirada");
        await expect(p.getByText("Nenhum usuário encontrado", { exact: true })).toHaveCount(0);
        e.erro = null; await p.getByRole("button", { name: "Tentar novamente" }).click();
        await expect(p.getByRole("cell", { name: "Pessoa 01", exact: true })).toBeVisible();
    } finally { await p.close(); }
});

for (const [width, height] of [[1440,900],[1366,600],[390,844],[390,480]]) test(`formulário acessível sem overflow externo em ${width}x${height}`, async () => {
    const e = novoEstado(), p = await abrir(e, { width, height });
    try {
        await preencher(p);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await expect(p.getByRole("button", { name: "Salvar", exact: true })).toBeInViewport();
        await p.locator('input[name="senha"]').press("Tab"); await expect(p.getByRole("button", { name: "Mostrar senha" })).toBeFocused();
        await p.screenshot({ path: `node_modules/.usuarios-${width}x${height}.png`, fullPage: true });
        await p.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(p.getByRole("heading", { name: "Novo usuário", exact: true })).toHaveCount(0);
    } finally { await p.close(); }
});
