import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

let server, browser, url;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-empresa-estoque-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "empresa-estoque-fixture", resolveId(id) { if (id === "/fixture-estoque.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-estoque.js") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {createMemoryRouter, RouterProvider} from 'react-router-dom';
                import {ThemeProvider, CssBaseline} from '@mui/material'; import {createNovexaTheme} from '/src/theme/theme.ts';
                import EmpresaForm from '/src/pages/Empresa/EmpresaForm.tsx';
                const empresa = {id:7,razaoSocial:'Empresa sintetica',cnpj:'11222333000181',ativo:true,
                    controlaEstoque:false,permitirVendaEstoqueNegativo:true,cadastro:{regimeTributario:'MEI'}};
                function App(){const [valor,setValor]=React.useState(empresa);const [versao,setVersao]=React.useState(0);
                    return React.createElement(EmpresaForm,{key:versao,empresa:valor,onFechar:()=>{},onSalvo:e=>{
                        window.salvamentos=(window.salvamentos||0)+1;setValor(e);setVersao(v=>v+1);
                    }});}
                const router = createMemoryRouter([{path:'/',element:React.createElement(App)}]);
                const mode = new URLSearchParams(location.search).get('mode') || 'light';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme:createNovexaTheme(mode)},React.createElement(CssBaseline),React.createElement(RouterProvider,{router})));`; },
            configureServer(vite) { vite.middlewares.use("/__estoque", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml("/__estoque", '<div id="root"></div><script type="module" src="/fixture-estoque.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

for (const mode of ["light", "dark"]) for (const width of [390, 1366])
test(`controle empresarial: teclado, payload, erro e retorno ${mode}/${width}`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    let falhar = true, liberar, payload;
    await page.route("**/*", async route => {
        const req = route.request();
        if (!["xhr", "fetch"].includes(req.resourceType())) return route.continue();
        if (req.method() === "GET") return route.fulfill({ json: { configurado: false } });
        assert.equal(req.method(), "PUT"); assert.equal(new URL(req.url()).pathname, "/empresas/7");
        payload = req.postDataJSON();
        assert.equal(payload.controlaEstoque, true);
        assert.equal(payload.permitirVendaEstoqueNegativo, true);
        if (falhar) return route.fulfill({ status: 409, json: { detail: "Alteração indisponível. Tente novamente." } });
        await new Promise(resolve => { liberar = resolve; });
        await route.fulfill({ json: { ...payload, id: 7 } });
    });
    try {
        await page.goto(`${url}/__estoque?mode=${mode}`);
        const controle = page.getByRole("checkbox", { name: "Controlar estoque dos produtos" });
        await expect(controle).not.toBeChecked();
        await expect(controle).toHaveAttribute("aria-describedby", "empresa-controle-estoque-ajuda");
        await controle.focus(); await page.keyboard.press("Space"); await expect(controle).toBeChecked();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("checkbox", { name: /Permitir venda/ })).toBeFocused();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.NOVEXA_STOCK_SCREENSHOTS) {
            await mkdir(process.env.NOVEXA_STOCK_SCREENSHOTS, { recursive: true });
            await page.screenshot({ path: `${process.env.NOVEXA_STOCK_SCREENSHOTS}/empresa-${mode}-${width}.png` });
        }
        const salvar = page.getByRole("button", { name: "Salvar empresa", exact: true });
        await salvar.click(); await expect(page.getByRole("alert")).toContainText("Alteração indisponível");
        assert.equal(await page.evaluate(() => window.salvamentos || 0), 0);
        await expect(controle).toBeChecked(); falhar = false;
        await salvar.click(); await expect(page.getByRole("button", { name: /Salvando/ })).toBeDisabled();
        assert.equal(await page.evaluate(() => window.salvamentos || 0), 0);
        await expect.poll(() => typeof liberar).toBe("function"); liberar();
        await expect.poll(() => page.evaluate(() => window.salvamentos || 0)).toBe(1);
        await expect(controle).toBeChecked();
        await expect(page.getByText("Campos com * são obrigatórios")).toBeVisible();
        assert.deepEqual(errors, []);
    } finally { liberar?.(); await page.close(); }
});
