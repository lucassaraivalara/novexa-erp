import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let vite, browser, base;
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {CssBaseline} from '@mui/material';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import Estoque from '/src/pages/Estoque/Estoque.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(MemoryRouter,null,React.createElement('div',{style:{padding:16,minWidth:0}},React.createElement(Estoque)))));`;
    vite = await createServer({ cacheDir: "node_modules/.vite-saldo-ui", server: { host: "127.0.0.1", port: 0, hmr: false }, plugins: [{
        name: "saldo-fixture",
        resolveId(id) { if (id === "/saldo-fixture.tsx") return "\0saldo-fixture.tsx"; },
        load(id) { if (id === "\0saldo-fixture.tsx") return fixture; },
        configureServer(server) { server.middlewares.use("/__saldo", async (_, res) => {
            res.setHeader("Content-Type", "text/html");
            res.end(await server.transformIndexHtml("/__saldo", '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/saldo-fixture.tsx"></script>'));
        }); },
    }] });
    await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}/__saldo`;
    browser = await chromium.launch();
});
after(async () => { await browser?.close(); await vite?.close(); });

async function ambiente(t, { mobile = false, theme = "light" } = {}) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    t.after(() => page.close());
    const errors = [], posts = [], consultas = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(theme => { localStorage.setItem("novexa-theme-choice", theme); localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture", perfil: "ADMIN", empresa: { id: 1 } })); }, theme);
    const produtos = [
        { id: 1, nome: "Farinha", codigoInterno: "001", unidadeMedida: "KG", estoqueAtual: 5, estoqueMinimo: 1, ativo: true, controlaEstoque: true },
        { id: 2, nome: "Unidade fracionada", codigoInterno: "002", unidadeMedida: "UN", estoqueAtual: -1.125, estoqueMinimo: 0, ativo: true, controlaEstoque: true },
        { id: 3, nome: "Kit", codigoInterno: "003", unidadeMedida: "UN", estoqueAtual: 0, estoqueMinimo: 0, ativo: true, controlaEstoque: false, composto: true },
        { id: 4, nome: "Inativo", codigoInterno: "004", unidadeMedida: "UN", estoqueAtual: 0, estoqueMinimo: 0, ativo: false, controlaEstoque: true },
    ];
    let falhaHistorico = true, recusar = true;
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "*" } });
        let data, status = 200;
        if (req.method() === "POST") {
            const payload = req.postDataJSON(); posts.push({ path: url.pathname, ...payload });
            assert.equal(payload.empresaId, undefined); assert.equal(payload.usuarioId, undefined);
            if (recusar) { status = 409; data = { detail: "Saldo insuficiente. Revise a quantidade." }; recusar = false; }
            else { produtos[0].estoqueAtual = payload.quantidade; data = { id: 10 }; }
        } else if (url.pathname.includes("/movimentacoes/produto/")) {
            consultas.push(url);
            if (falhaHistorico) { status = 503; data = "SQL interno"; falhaHistorico = false; }
            else data = { items: [{ id: 10, tipo: "AJUSTE", origem: "AJUSTE", quantidade: 1.25, saldoAnterior: 5, saldoPosterior: 1.25, nomeUsuario: "Operador", motivo: "Contagem", dataHora: "2026-11-09T12:00:00", entradaMercadoriaId: 8 }], totalItems: 1 };
        } else {
            consultas.push(url);
            const items = url.searchParams.get("busca") === "inexistente" ? [] : produtos;
            data = { items, totalItems: items.length, totalPages: 1, page: 0, size: 25 };
        }
        await route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, json: data });
    });
    await page.goto(base);
    await expect(page.getByRole("cell", { name: "5 KG", exact: true })).toBeVisible();
    return { page, posts, consultas, errors };
}

for (const mobile of [false, true]) test(`saldo, operação e histórico ${mobile ? "mobile escuro" : "desktop claro"}`, async t => {
    const { page, posts, consultas, errors } = await ambiente(t, { mobile, theme: mobile ? "dark" : "light" });
    await expect(page.getByRole("cell", { name: "-1,125 UN", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrada avulsa · Kit", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Saída · Inativo", exact: true })).toBeDisabled();
    const abrir = page.getByRole("button", { name: "Ajuste · Farinha", exact: true });
    await abrir.click();
    const dialog = page.getByRole("dialog", { name: "Ajustar estoque", exact: true });
    const quantidade = dialog.getByRole("textbox", { name: "Novo saldo físico", exact: false });
    await expect(quantidade).toBeFocused();
    await quantidade.fill("1,250");
    await dialog.getByRole("textbox", { name: "Motivo", exact: true }).fill("Contagem");
    await expect(dialog.getByRole("status")).toContainText("1,25 KG");
    await quantidade.press("Enter");
    await expect(dialog.getByRole("alert")).toContainText("Saldo insuficiente");
    await expect(quantidade).toHaveValue("1,250");
    await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("movimentação registrada");
    assert.equal(posts.length, 2); assert.equal(posts[1].quantidade, 1.25); assert.equal(posts[1].motivo, "Contagem");
    await expect(abrir).toBeFocused();
    await page.getByRole("button", { name: "Histórico · Farinha", exact: true }).click();
    const historico = page.getByRole("dialog", { name: /Histórico de movimentações/ });
    await expect(historico.getByRole("alert")).toContainText("API não concluiu");
    await historico.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(historico.getByText(/Saldo: 5 KG → 1,25 KG/)).toBeVisible();
    await expect(historico.getByRole("link", { name: /entrada de origem #8/ })).toHaveAttribute("href", "/estoque?aba=entradas&entradaId=8");
    await historico.getByLabel("Data inicial", { exact: true }).fill("2026-11-10");
    await historico.getByLabel("Data final", { exact: true }).fill("2026-11-01");
    await expect(historico.getByRole("alert")).toContainText("Corrija o período");
    await historico.getByRole("button", { name: "Limpar filtros do histórico" }).click();
    await expect(historico.getByText(/Saldo: 5 KG → 1,25 KG/)).toBeVisible();
    await page.screenshot({ path: `node_modules/saldo-${mobile ? "mobile-dark" : "desktop-light"}-historico.png`, fullPage: true });
    await historico.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByPlaceholder("Pesquisar por produto ou código…").fill("inexistente");
    await expect(page.getByText("Nenhum produto encontrado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).first().click();
    await expect(page.getByRole("cell", { name: "1,25 KG", exact: true })).toBeVisible();
    assert(consultas.some(url => url.searchParams.get("busca") === "inexistente"));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `node_modules/saldo-${mobile ? "mobile-dark" : "desktop-light"}.png`, fullPage: true });
    assert.deepEqual(errors, []);
});

test("entrada, saída e ajuste zero preservam contratos e validações individuais", async t => {
    const { page, posts } = await ambiente(t);
    for (const [acao, campo, quantidade, endpoint] of [
        ["Entrada avulsa", "Quantidade", "0,125", "entrada"],
        ["Saída", "Quantidade", "0,125", "saida"],
        ["Ajuste", "Novo saldo físico", "0", "ajuste"],
    ]) {
        await page.getByRole("button", { name: `${acao} · Farinha`, exact: true }).click();
        const dialog = page.getByRole("dialog");
        const input = dialog.getByRole("textbox", { name: campo, exact: false });
        const antes = posts.length;
        await input.fill(acao === "Ajuste" ? "" : "0");
        await input.press("Enter");
        await expect(dialog.getByRole("alert")).toContainText(/Informe/);
        assert.equal(posts.length, antes);
        await input.fill(quantidade);
        await dialog.getByRole("textbox", { name: "Motivo", exact: true }).fill("x".repeat(256));
        await input.press("Enter");
        await expect(dialog.getByRole("alert")).toContainText("255 caracteres");
        assert.equal(posts.length, antes);
        await dialog.getByRole("textbox", { name: "Motivo", exact: true }).fill("");
        await input.press("Enter");
        if (antes === 0) {
            await expect(dialog.getByRole("alert")).toContainText("Saldo insuficiente");
            await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
        }
        await expect(dialog).not.toBeVisible();
        assert.equal(posts.at(-1).path, `/estoque/movimentacoes/${endpoint}`);
        assert.equal(posts.at(-1).quantidade, Number(quantidade.replace(",", ".")));
        assert.equal(posts.at(-1).motivo, undefined);
    }
});
