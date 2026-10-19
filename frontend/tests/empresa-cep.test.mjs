import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-empresa-cep-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "empresa-cep-fixture", resolveId(id) { if (id === "/fixture-empresa-cep.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-empresa-cep.js") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {createMemoryRouter, RouterProvider} from 'react-router-dom';
                import {ThemeProvider, CssBaseline} from '@mui/material'; import theme from '/src/theme/theme.ts';
                import EmpresaForm from '/src/pages/Empresa/EmpresaForm.tsx';
                const router = createMemoryRouter([{path:'/', element:React.createElement(EmpresaForm,{empresa:null,onFechar:()=>{},onSalvo:()=>{}})}]);
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),React.createElement(RouterProvider,{router})));`; },
            configureServer(vite) { vite.middlewares.use("/__empresa_cep", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml("/__empresa_cep", '<div id="root"></div><script type="module" src="/fixture-empresa-cep.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(status = 200, viewport = { width: 1366, height: 768 }) {
    const page = await browser.newPage({ viewport });
    const requests = [];
    await page.route("**/*", async route => {
        const req = route.request();
        if (!["xhr", "fetch"].includes(req.resourceType())) return route.continue();
        const path = new URL(req.url()).pathname;
        requests.push({ method: req.method(), path });
        assert.equal(req.method(), "GET");
        const geo = path === "/empresas/geocodificacao/status";
        assert.ok(geo || path === "/enderecos/cep/01001000");
        await route.fulfill({ status: geo ? 200 : status, headers: { "access-control-allow-origin": "*" },
            contentType: "application/json", body: JSON.stringify(geo ? { configurado: false } : status === 200
                ? { cep: "01001000", logradouro: "Praça da Sé", bairro: "Sé", cidade: "São Paulo", uf: "SP" }
                : "Consulta de CEP indisponível. Preencha o endereço manualmente; o cadastro continua disponível.") });
    });
    await page.goto(`${url}/__empresa_cep`);
    return { page, requests };
}

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 650 }, { width: 1024, height: 500 }])
test(`MEI e CEP editável sem gravar dados: ${viewport.width}x${viewport.height}`, async () => {
    const { page, requests } = await abrir(200, viewport);
    try {
        await page.getByRole("combobox", { name: "Regime Tributário" }).click();
        await page.getByRole("option", { name: "MEI", exact: true }).click();
        await expect(page.getByRole("combobox", { name: "Regime Tributário" })).toContainText("MEI");
        await page.getByRole("tab", { name: "Endereço", exact: true }).click();
        await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01001000");
        await expect(page.getByRole("textbox", { name: "Logradouro", exact: true })).toHaveValue("Praça da Sé");
        await expect(page.getByRole("textbox", { name: "Bairro", exact: true })).toHaveValue("Sé");
        await expect(page.getByRole("textbox", { name: "Cidade", exact: true })).toHaveValue("São Paulo");
        await expect(page.getByRole("combobox", { name: "UF", exact: true })).toContainText("SP");
        await page.getByRole("textbox", { name: "Logradouro", exact: true }).fill("Endereço revisado manualmente");
        await expect(page.getByRole("textbox", { name: "Logradouro", exact: true })).toHaveValue("Endereço revisado manualmente");
        assert.ok(requests.every(req => req.method === "GET"));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.keyboard.press("Tab");
    } finally { await page.close(); }
});

test("falha do CEP mantém endereço manual e permite continuar preenchendo", async () => {
    const { page } = await abrir(503);
    try {
        await page.getByRole("tab", { name: "Endereço", exact: true }).click();
        await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01001000");
        await expect(page.getByRole("status")).toContainText("Preencha o endereço manualmente");
        const logradouro = page.getByRole("textbox", { name: "Logradouro", exact: true });
        await logradouro.fill("Rua manual"); await expect(logradouro).toHaveValue("Rua manual");
        await expect(page.getByRole("button", { name: "Salvar empresa", exact: true })).toBeEnabled();
    } finally { await page.close(); }
});
