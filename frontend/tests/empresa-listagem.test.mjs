import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const captura = "node_modules/.vite-empresa-listagem";
const empresa = { id: 1, razaoSocial: "Empresa de demonstração", cnpj: "11222333000181", ativo: true,
    nomeFantasia: null, cadastro: null, email: null, telefone: null, endereco: null };

before(async () => {
    await mkdir(captura, { recursive: true });
    server = await createServer({ cacheDir: captura, server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "empresa-listagem-fixture",
            resolveId(id) { if (id === "/empresa-fixture.js") return "\0empresa-fixture"; },
            load(id) { if (id === "\0empresa-fixture") return `
                import React from 'react'; import {createRoot} from 'react-dom/client'; import '/src/index.css';
                import {CssBaseline} from '@mui/material'; import {BrowserRouter} from 'react-router-dom';
                import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';
                import AppRoutes from '/src/routes/AppRoutes.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,
                    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (req.url !== "/empresa") return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/empresa-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(estado = {}, options = {}) {
    estado.requests = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
    await page.addInitScript(() => {
        localStorage.setItem("novexa-auth", JSON.stringify({ id: 1, nomeUsuario: "Administrador de teste",
            perfil: "ADMIN", token: "fixture-local", empresa: { id: 1, razaoSocial: "Empresa de demonstração" } }));
        localStorage.setItem("novexa-theme-choice", "dark");
    });
    // Intercepta todos os XHR/fetch: nenhuma chamada ou gravação em produção.
    await page.route("**/*", async route => {
        const req = route.request();
        if (!["xhr", "fetch"].includes(req.resourceType())) return route.continue();
        const u = new URL(req.url());
        estado.requests.push({ method: req.method(), path: u.pathname, params: Object.fromEntries(u.searchParams) });
        assert.equal(req.method(), "GET"); assert.equal(u.pathname, "/empresas/pagina");
        const params = u.searchParams;
        const items = estado.vazio || params.get("termo") === "sem resultado" || params.get("ativo") === "false" ? [] : [empresa];
        const status = estado.status ?? 200;
        await route.fulfill({ status, contentType: status === 500 ? "text/plain" : "application/json", body: status === 500
            ? "Falha simulada ao consultar empresas." : JSON.stringify(status === 200 ? {
            items, page: Number(params.get("page") ?? 0), size: Number(params.get("size") ?? 25),
            totalItems: items.length, totalPages: items.length ? 1 : 0,
        } : { detail: "Acesso não permitido." }) });
    });
    await page.goto(url + "/empresa");
    return { page, estado };
}

test("Empresas: listagem nullable, busca vazia/ausente, ordenação e tamanho remotos", async () => {
    const { page, estado } = await abrir();
    try {
        await expect(page.getByRole("table")).toContainText(empresa.razaoSocial);
        await expect(page.getByRole("table")).toContainText("Não informado");
        assert.deepEqual(estado.requests[0].params, { page: "0", size: "10", sort: "razaoSocial,asc", ativo: "true" });
        const busca = page.getByRole("textbox", { name: "Buscar por Razão Social ou CNPJ / CPF" });
        await busca.fill("demonstração");
        await expect.poll(() => estado.requests.at(-1).params.termo).toBe("demonstração");
        await busca.fill("   ");
        await expect.poll(() => estado.requests.at(-1).params.termo).toBeUndefined();
        await busca.fill("");
        await page.getByRole("button", { name: "Razão Social", exact: true }).click();
        await expect.poll(() => estado.requests.at(-1).params.sort).toBe("razaoSocial,desc");
        await page.getByRole("combobox", { name: "Itens por página" }).click();
        await page.getByRole("option", { name: "25", exact: true }).click();
        await expect.poll(() => estado.requests.at(-1).params.size).toBe("25");
        assert.ok(estado.requests.every(r => !r.params.empresaId && !r.params.tenantId));
    } finally { await page.close(); }
});

test("Empresas: situação e busca sem resultado mostram estado vazio", async () => {
    const { page, estado } = await abrir();
    try {
        await expect(page.getByRole("table")).toContainText(empresa.razaoSocial);
        await page.getByRole("combobox", { name: "Situação", exact: true }).click();
        await page.getByRole("option", { name: "Inativas", exact: true }).click();
        await expect.poll(() => estado.requests.at(-1).params.ativo).toBe("false");
        await expect(page.getByText("Nenhuma empresa encontrada", { exact: true })).toBeVisible();
        await page.getByRole("combobox", { name: "Situação", exact: true }).click();
        await page.getByRole("option", { name: "Todas", exact: true }).click();
        await expect.poll(() => estado.requests.at(-1).params.ativo).toBeUndefined();
        await page.getByRole("textbox", { name: "Buscar por Razão Social ou CNPJ / CPF" }).fill("sem resultado");
        await expect(page.getByText("Nenhuma empresa encontrada", { exact: true })).toBeVisible();
        await expect(page.getByRole("alert")).toHaveCount(0);
    } finally { await page.close(); }
});

for (const status of [403, 500]) test(`Empresas: HTTP ${status} preserva mensagem e filtro ao tentar novamente`, async () => {
    const { page, estado } = await abrir({ status });
    try {
        await expect(page.getByRole("alert")).toContainText(status === 403 ? "Acesso não permitido." : "Falha simulada ao consultar empresas.");
        const busca = page.getByRole("textbox", { name: "Buscar por Razão Social ou CNPJ / CPF" });
        await busca.fill("demonstração");
        await expect.poll(() => estado.requests.at(-1).params.termo).toBe("demonstração");
        estado.status = 200;
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await expect(page.getByRole("table")).toContainText(empresa.razaoSocial);
        await expect(busca).toHaveValue("demonstração");
        await expect(page.getByRole("alert")).toHaveCount(0);
    } finally { await page.close(); }
});

test("Empresas: claro, escuro e automático em desktop, mobile e janela baixa", async () => {
    const { page, estado } = await abrir({}, { colorScheme: "dark" });
    try {
        await expect(page.getByRole("table")).toContainText(empresa.razaoSocial);
        for (const modo of ["claro", "escuro", "automático"]) {
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.getByRole("button", { name: `Tema ${modo}`, exact: true }).click();
            if (modo === "automático") {
                await page.emulateMedia({ colorScheme: "light" });
                await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 249, 251)");
                await page.emulateMedia({ colorScheme: "dark" });
            }
            await expect(page.locator("body")).toHaveCSS("background-color", modo === "claro" ? "rgb(247, 249, 251)" : "rgb(14, 24, 40)");
            for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 640 }, { width: 390, height: 844 }, { width: 390, height: 480 }]) {
                await page.setViewportSize(viewport);
                await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
                await page.screenshot({ path: `${captura}/empresa-${modo}-${viewport.width}x${viewport.height}.png` });
            }
        }
        estado.vazio = true;
        await page.reload();
        await expect(page.getByText("Nenhuma empresa encontrada", { exact: true })).toBeVisible();
        await page.screenshot({ path: `${captura}/empresa-vazia.png` });
    } finally { await page.close(); }
});
