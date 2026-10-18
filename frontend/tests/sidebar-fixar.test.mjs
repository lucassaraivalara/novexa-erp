import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const capturas = "node_modules/.vite-sidebar-fixar";
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CssBaseline,TextField,Table,TableHead,TableBody,TableRow,TableCell,Button} from '@mui/material';
import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';
import MainLayout from '/src/components/layout/MainLayout.tsx';
import '/src/index.css';
function Content(){const l=useLocation();return React.createElement(React.Fragment,null,
    React.createElement('h1',null,'Consulta '+l.pathname),
    React.createElement(TextField,{label:'Nome',fullWidth:true}),
    React.createElement(Table,{'aria-label':'Consulta de demonstração'},
        React.createElement(TableHead,null,React.createElement(TableRow,null,React.createElement(TableCell,null,'Nome'))),
        React.createElement(TableBody,null,React.createElement(TableRow,null,React.createElement(TableCell,null,'Registro de demonstração')))),
    React.createElement(Button,null,'Continuar'));}
createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(Routes,null,
        React.createElement(Route,{element:React.createElement(MainLayout)},
            React.createElement(Route,{path:'*',element:React.createElement(Content)}))))));
`;

before(async () => {
    await mkdir(capturas, { recursive: true });
    server = await createServer({ cacheDir: capturas, server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "sidebar-fixar-fixture",
            resolveId(id) { if (id === "/sidebar-fixture.js") return "\0sidebar-fixture"; },
            load(id) { if (id === "\0sidebar-fixture") return fixture; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!["/clientes", "/produtos", "/dashboard", "/configuracoes"].includes(req.url.split("?")[0])) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/sidebar-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function withShell(run, { fixado = true, tema = "light", viewport = { width: 1440, height: 900 } } = {}) {
    const page = await browser.newPage({ viewport, colorScheme: "dark" });
    await page.addInitScript(({ fixado, tema }) => {
        localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture-local", perfil: "ADMIN", nomeUsuario: "Demonstração",
            empresa: { id: 1, razaoSocial: "Empresa de demonstração" } }));
        if (localStorage.getItem("novexa-menu-fixed") === null) localStorage.setItem("novexa-menu-fixed", String(fixado));
        if (localStorage.getItem("novexa-theme-choice") === null) localStorage.setItem("novexa-theme-choice", tema);
    }, { fixado, tema });
    await page.route("**/*", route => ["xhr", "fetch"].includes(route.request().resourceType()) ? route.abort() : route.continue());
    try {
        await page.goto(`${url}/clientes`);
        await page.getByRole("heading", { name: "Consulta /clientes", exact: true }).waitFor();
        await run(page, page.getByRole("navigation", { name: "Menu principal" }));
    } finally { await page.close(); }
}

async function geometria(page, nav, largura, reserva) {
    await expect(nav).toHaveCSS("width", `${largura}px`);
    await expect.poll(() => page.getByRole("main").evaluate(el => Math.round(el.getBoundingClientRect().x))).toBe(reserva);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    const main = await page.getByRole("main").boundingBox();
    for (const item of [page.getByRole("table"), page.getByRole("textbox", { name: "Nome", exact: true })]) {
        const bounds = await item.boundingBox();
        assert.ok(bounds.x >= main.x && bounds.x + bounds.width <= main.x + main.width + 1);
    }
}

test("Fixar menu: separa largura fixa, recolhida e temporaria, persistindo apos recarregar", () => withShell(async (page, nav) => {
    const fixar = nav.getByRole("switch", { name: "Fixar menu", exact: true });
    await expect(fixar).toBeChecked();
    await geometria(page, nav, 264, 280);
    await fixar.click(); // O ponteiro continua na sidebar: desfixar deve recolher imediatamente.
    await geometria(page, nav, 56, 72);
    assert.equal(await nav.getByText("NOVEXA", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("novexa-menu-fixed")), "false");
    await page.mouse.move(700, 100);
    await page.reload();
    await geometria(page, nav, 56, 72);
    await nav.getByRole("button", { name: "Cadastros (ícone)", exact: true }).hover();
    await geometria(page, nav, 264, 72);
    await expect(fixar).not.toBeChecked();
    await fixar.click();
    await geometria(page, nav, 264, 280);
    await page.mouse.move(700, 100);
    await page.reload();
    await geometria(page, nav, 264, 280);
    await expect(fixar).toBeChecked();
    await nav.getByRole("link", { name: "Configurações", exact: true }).click();
    await page.getByRole("heading", { name: "Consulta /configuracoes", exact: true }).waitFor();
    await geometria(page, nav, 264, 280);
}));

test("Menu temporario: teclado, Escape, clique fora e navegacao preservam a reserva compacta", () => withShell(async (page, nav) => {
    const trigger = nav.getByRole("button", { name: "Cadastros (ícone)", exact: true });
    await geometria(page, nav, 56, 72);
    await trigger.focus();
    await page.keyboard.press("ArrowRight");
    await expect(nav.getByRole("link", { name: "Produtos", exact: true })).toBeFocused();
    await geometria(page, nav, 528, 72);
    await page.keyboard.press("Escape");
    await geometria(page, nav, 56, 72);
    await expect(trigger).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await nav.getByRole("link", { name: "Produtos", exact: true }).click();
    await page.getByRole("heading", { name: "Consulta /produtos", exact: true }).waitFor();
    await geometria(page, nav, 56, 72);
    await trigger.hover();
    await geometria(page, nav, 264, 72);
    await page.mouse.move(700, 100);
    await geometria(page, nav, 56, 72);
    await trigger.focus(); await page.keyboard.press("ArrowRight");
    const main = await page.getByRole("main").boundingBox();
    await page.mouse.click(main.x + main.width - 20, main.y + 20);
    await geometria(page, nav, 56, 72);
    // O controle continua alcancavel por teclado mesmo sem hover.
    await trigger.focus(); await page.keyboard.press("ArrowRight");
    const fixar = nav.getByRole("switch", { name: "Fixar menu", exact: true });
    await fixar.focus();
    await expect(fixar).toBeFocused();
    assert.notEqual(await fixar.locator("..").evaluate(el => getComputedStyle(el).outlineStyle), "none");
    await page.keyboard.press("Space");
    await geometria(page, nav, 528, 280);
    await expect(fixar).toBeChecked();
    await page.keyboard.press("Space");
    await geometria(page, nav, 56, 72);
    await expect(nav.getByRole("link", { name: "Vender (ícone)", exact: true })).toBeFocused();
}, { fixado: false }));

for (const tema of ["light", "dark", "auto"]) test(`Fixar menu: ${tema}, desktop, notebook e janela baixa`, () => withShell(async (page, nav) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 640 }, { width: 1024, height: 320 }]) {
        await page.setViewportSize(viewport);
        await geometria(page, nav, 264, 280);
        const fixar = nav.getByRole("switch", { name: "Fixar menu", exact: true });
        const bounds = await fixar.boundingBox();
        assert.ok(bounds.y >= 8 && bounds.y + bounds.height <= viewport.height - 8);
        await expect(page.locator("body")).toHaveCSS("background-color", tema === "light" ? "rgb(247, 249, 251)" : "rgb(14, 24, 40)");
        await fixar.click();
        await geometria(page, nav, 56, 72);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({ path: `${capturas}/recolhido-${tema}-${viewport.width}x${viewport.height}.png` });
        await nav.getByRole("button", { name: "Cadastros (ícone)", exact: true }).hover();
        await geometria(page, nav, 264, 72);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({ path: `${capturas}/temporario-${tema}-${viewport.width}x${viewport.height}.png` });
        await fixar.click();
        await geometria(page, nav, 264, 280);
        await page.mouse.move(viewport.width - 20, 100);
    }
    if (tema === "auto") {
        await page.emulateMedia({ colorScheme: "light" });
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 249, 251)");
    }
}, { tema }));

for (const tema of ["light", "dark", "auto"]) test(`Menu mobile ${tema}: faixa e submenus acessiveis em janela baixa sem reservar coluna desktop`, () => withShell(async (page, nav) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 480 }, { width: 320, height: 320 }]) {
        await page.setViewportSize(viewport);
        await geometria(page, nav, 56, 72);
        await expect(page.locator("body")).toHaveCSS("background-color", tema === "light" ? "rgb(247, 249, 251)" : "rgb(14, 24, 40)");
        assert.equal(await nav.getByRole("switch", { name: "Fixar menu" }).count(), 0);
        const trigger = nav.getByRole("button", { name: "Cadastros (ícone)", exact: true });
        await trigger.focus(); await page.keyboard.press("ArrowRight");
        await geometria(page, nav, Math.min(320, viewport.width - 16), 72);
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await geometria(page, nav, 56, 72);
        const config = nav.getByRole("link", { name: "Configurações (ícone)", exact: true });
        await config.focus();
        const bounds = await config.boundingBox();
        assert.ok(bounds.y >= 8 && bounds.y + bounds.height <= viewport.height - 8);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({ path: `${capturas}/mobile-${tema}-${viewport.width}x${viewport.height}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.mouse.move(700, 100);
    await geometria(page, nav, 264, 280);
}, { tema }));
