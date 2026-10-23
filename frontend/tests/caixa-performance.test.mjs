import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let vite, browser, base;
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {ThemeProvider} from '@mui/material';import theme from '/src/theme/theme.ts';import Caixa from '/src/pages/Financeiro/Caixa.tsx';createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(Caixa)));`;
    vite = await createServer({
        cacheDir: "node_modules/.vite-caixa-performance-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "caixa-performance-fixture",
            resolveId(id) { if (id === "/caixa-performance.js") return "\0caixa-performance.js"; },
            load(id) { if (id === "\0caixa-performance.js") return fixture; },
            configureServer(server) { server.middlewares.use("/__caixa-performance", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await server.transformIndexHtml("/__caixa-performance", '<div id="root"></div><script type="module" src="/caixa-performance.js"></script>'));
            }); },
        }],
    });
    await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}/__caixa-performance`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await vite?.close(); });

const resumo = { sessaoId: 9, caixaId: 1, descricaoCaixa: "Caixa principal", status: "ABERTO", saldoInicial: 100,
    dataHoraAbertura: "2026-10-20T09:00:00", operadorAbertura: { id: 4, nome: "Operador" },
    totalVendas: 20, totaisPorFormaPagamento: [], suprimentos: 0, sangrias: 0, saldoEsperadoDinheiro: 100,
    saldoFinalInformado: null, diferenca: null };
const painel = { resumo, movimentacoes: [], vendas: [{ id: 7, dataHora: "2026-10-20T10:00:00", total: 20, formaPagamento: "PIX", usuarioNome: "Operador" }] };
const historico = [{ sessaoId: 8, caixaId: 1, descricaoCaixa: "Turno anterior", status: "FECHADO",
    dataHoraAbertura: "2026-10-19T09:00:00", dataHoraFechamento: "2026-10-19T18:00:00",
    operadorAbertura: { id: 4, nome: "Operador" }, operadorFechamento: { id: 4, nome: "Operador" },
    saldoInicial: 100, totalVendas: 20, dinheiroEsperado: 100, valorInformado: 100, diferenca: 0 }];

async function ambiente(t, op = {}) {
    const page = await browser.newPage({ viewport: op.viewport ?? { width: 1440, height: 900 } });
    t.after(() => page.close()); const chamadas = [], erros = [];
    page.on("pageerror", error => erros.push(error.message));
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture", perfil: "ADMIN", id: 4, empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        assert.equal(request.headers().authorization, "Bearer fixture"); chamadas.push(path);
        let data, status = 200;
        if (path.endsWith("/abertas")) data = [resumo];
        else if (path === "/financeiro/caixas") data = [{ id: 1, descricao: "Caixa principal", ativo: true }];
        else if (path.endsWith("/painel")) { await op.aguardarPainel?.(); data = painel; }
        else if (path.endsWith("/fechadas")) {
            if (op.falharHistorico?.()) { status = 500; data = "Falha ao consultar o histórico. Tente novamente."; }
            else data = historico;
        } else throw new Error(`Requisição inesperada: ${path}`);
        await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(base);
    return { page, chamadas, erros, paineis: () => chamadas.filter(p => p.endsWith("/painel")).length };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`painel usa três consultas e histórico somente na aba, ${viewport.width}px`, async t => {
        const a = await ambiente(t, { viewport });
        await expect(a.page.getByRole("heading", { name: "Saldo esperado em dinheiro" })).toBeVisible();
        await expect(a.page.getByText("Venda #7", { exact: true })).toBeVisible();
        assert.deepEqual(a.chamadas.slice().sort(), ["/financeiro/caixas", "/financeiro/caixas/sessoes/abertas", "/financeiro/caixas/sessoes/9/painel"].sort());
        assert.equal(a.chamadas.some(p => p.endsWith("/fechadas")), false);
        await a.page.getByRole("tab", { name: "Caixas Anteriores" }).click();
        await expect(a.page.getByRole("cell", { name: "Turno anterior", exact: true })).toBeVisible();
        assert.equal(a.chamadas.filter(p => p.endsWith("/fechadas")).length, 1);
        assert.deepEqual(a.erros, []);
        assert.equal(await a.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    });
}

test("requisição lenta não se sobrepõe e histórico interrompe o polling", async t => {
    let liberar; const pendente = new Promise(resolve => { liberar = resolve; });
    const a = await ambiente(t, { aguardarPainel: () => pendente });
    await expect.poll(a.paineis).toBe(1);
    await a.page.waitForTimeout(2500); assert.equal(a.paineis(), 1);
    liberar(); await expect(a.page.getByRole("heading", { name: "Saldo esperado em dinheiro" })).toBeVisible();
    await expect.poll(a.paineis, { timeout: 5000 }).toBe(2);
    await a.page.getByRole("tab", { name: "Caixas Anteriores" }).click();
    await expect(a.page.getByRole("cell", { name: "Turno anterior", exact: true })).toBeVisible();
    const antes = a.paineis(); await a.page.waitForTimeout(2500); assert.equal(a.paineis(), antes);
    await a.page.getByRole("tab", { name: "Caixa Atual", exact: true }).click();
    await expect.poll(a.paineis).toBe(antes + 1); assert.deepEqual(a.erros, []);
});

test("falha no histórico tem retry próprio e não bloqueia Caixa Atual", async t => {
    let falhar = true;
    const a = await ambiente(t, { falharHistorico: () => falhar });
    await expect(a.page.getByRole("heading", { name: "Saldo esperado em dinheiro" })).toBeVisible();
    await a.page.getByRole("tab", { name: "Caixas Anteriores" }).click();
    await expect(a.page.getByRole("alert")).toContainText("Falha ao consultar o histórico");
    falhar = false; await a.page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(a.page.getByRole("cell", { name: "Turno anterior", exact: true })).toBeVisible();
    await a.page.getByRole("tab", { name: "Caixa Atual", exact: true }).click();
    await expect(a.page.getByRole("heading", { name: "Saldo esperado em dinheiro" })).toBeVisible();
    await expect(a.page.getByRole("alert")).toHaveCount(0); assert.deepEqual(a.erros, []);
});
