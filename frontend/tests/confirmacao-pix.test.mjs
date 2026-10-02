import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
const venda = {id: 30, status: "FATURADA", dataHora: "2026-10-01T10:00:00", total: 85, subtotal: 85,
    desconto: 0, formaPagamento: "PIX", valorRecebido: null, troco: null, itens: [], nomeCliente: null, sessaoCaixaId: 1};
const pagamento = {id: 50, vendaId: 30, formaPagamento: "PIX", valor: 85, status: "REGISTRADO",
    configuracaoNomeExibicao: "PIX Itaú", configuracaoTipo: "PIX", configuracaoContaFinanceiraDestinoNome: "Conta Itaú",
    confirmadoFinanceiramente: false, dataConfirmacaoFinanceira: null, movimentacaoFinanceiraId: null,
    usuarioConfirmacaoFinanceiraId: null};
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';
import {BrowserRouter} from 'react-router-dom';
import CentralVendas from '/src/pages/Vendas/CentralVendas.tsx';
import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(CentralVendas))));
`;
before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-confirmacao-pix-tests",
        server: {host: "127.0.0.1", port: 0, hmr: false},
        plugins: [{
            name: "confirmacao-pix-fixture",
            resolveId(id) { if (id === "/pix-fixture.js") return "\0pix-fixture.js"; },
            load(id) { if (id === "\0pix-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use(async (req, res, next) => {
                    if (req.url !== "/central") return next();
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/pix-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless: true});
});
after(async () => { await browser?.close(); await server?.close(); });

async function withPix(run, options = {}) {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    page.setDefaultTimeout(7000);
    let atual = {...pagamento, ...options.pagamento};
    const requests = [];
    let consultas = 0;
    await page.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste", perfil, id: 1, empresa: {id: 7},
    })), options.perfil ?? "ADMIN");
    await page.route("**/clientes?*", route => route.fulfill({json: {items: [], totalItems: 0}}));
    await page.route("**/vendas?*", route => route.fulfill({json: {items: [venda], totalItems: 1, totalPages: 1}}));
    await page.route("**/vendas/30", route => route.fulfill({json: {...venda, ...options.venda}}));
    await page.route("**/vendas/30/pagamentos", route => { consultas++; return route.fulfill({json: [atual]}); });
    await page.route("**/financeiro/pagamentos/*/confirmar-recebimento", async route => {
        requests.push({url: route.request().url(), method: route.request().method(), body: route.request().postData()});
        await options.gate;
        if (options.erro) return route.fulfill({status: options.erro.status, json: options.erro.message});
        atual = {...atual, confirmadoFinanceiramente: true, dataConfirmacaoFinanceira: "2026-10-01T11:00:00",
            usuarioConfirmacaoFinanceiraId: 1, movimentacaoFinanceiraId: 70};
        return route.fulfill({json: atual});
    });
    try {
        await page.goto(`${url}/central`);
        await page.getByRole("button", {name: "Visualizar detalhes", exact: true}).click();
        await page.getByRole("heading", {name: "Pagamentos", exact: true}).waitFor();
        await run(page, requests, () => consultas);
    } finally { await page.close(); }
}

async function abrirConfirmacao(page) {
    await page.getByRole("button", {name: "Confirmar recebimento", exact: true}).click();
    const dialog = page.getByRole("dialog", {name: "Confirmar recebimento PIX?"});
    await dialog.waitFor();
    return dialog;
}

for (const perfil of ["ADMIN", "GERENTE"]) {
    test(`${perfil} confirma PIX pelo detalhe com ID do pagamento e atualiza estado`, () => withPix(async (page, requests, consultas) => {
        await page.getByText("Aguardando confirmação", {exact: true}).waitFor();
        const dialog = await abrirConfirmacao(page);
        await dialog.getByText("Esta ação registrará a entrada financeira.", {exact: true}).waitFor();
        assert.match(await dialog.textContent(), /85,00/);
        assert.match(await dialog.textContent(), /PIX Itaú/);
        await dialog.getByRole("button", {name: "Confirmar recebimento", exact: true}).click();
        await page.getByText("Recebimento confirmado", {exact: true}).waitFor();
        await page.getByText("Recebimento PIX confirmado com sucesso.", {exact: true}).waitFor();
        await dialog.waitFor({state: "detached"});
        assert.equal(await page.getByRole("button", {name: "Confirmar recebimento", exact: true}).count(), 0);
        assert.equal(requests.length, 1);
        assert.equal(new URL(requests[0].url).pathname, "/financeiro/pagamentos/50/confirmar-recebimento");
        assert.equal(new URL(requests[0].url).search, "");
        assert.equal(requests[0].method, "POST");
        assert.equal(requests[0].body, null);
        await page.waitForFunction(() => document.body.textContent.includes("Movimento #70"));
        assert.ok(consultas() >= 2);
    }, {perfil}));
}

for (const perfil of ["OPERADOR", "USUARIO"]) {
    test(`${perfil} visualiza pendência mas não vê ação de confirmação`, () => withPix(async (page, requests) => {
        await page.getByText("Aguardando confirmação", {exact: true}).waitFor();
        assert.equal(await page.getByRole("button", {name: "Confirmar recebimento", exact: true}).count(), 0);
        assert.equal(requests.length, 0);
    }, {perfil}));
}

test("PIX já confirmado mostra auditoria sem ação de confirmar", () => withPix(async page => {
    await page.getByText("Recebimento confirmado", {exact: true}).waitFor();
    assert.equal(await page.getByRole("button", {name: "Confirmar recebimento", exact: true}).count(), 0);
    await page.getByText(/Movimento #70/).waitFor();
}, {pagamento: {confirmadoFinanceiramente: true, movimentacaoFinanceiraId: 70, dataConfirmacaoFinanceira: "2026-10-01T11:00:00"}}));

for (const erro of [
    {status: 403, message: "Acesso negado", esperado: "Acesso não permitido para confirmar recebimento PIX."},
    {status: 409, message: "Pagamento sem destino financeiro historico.", esperado: "Pagamento sem destino financeiro historico."},
]) {
    test(`Erro ${erro.status} permanece na confirmação sem ocultar pendência`, () => withPix(async (page, requests) => {
        const dialog = await abrirConfirmacao(page);
        await dialog.getByRole("button", {name: "Confirmar recebimento", exact: true}).click();
        await dialog.getByRole("alert").filter({hasText: erro.esperado}).waitFor();
        assert.equal(requests.length, 1);
        await dialog.getByRole("button", {name: "Cancelar", exact: true}).click();
        await page.getByText("Aguardando confirmação", {exact: true}).waitFor();
    }, {erro}));
}

test("Duplo clique e fechamento ficam bloqueados durante request", async () => {
    let liberar;
    const gate = new Promise(resolve => { liberar = resolve; });
    try {
        await withPix(async (page, requests) => {
            const dialog = await abrirConfirmacao(page);
            await dialog.getByRole("button", {name: "Confirmar recebimento", exact: true}).dblclick();
            const loading = dialog.getByRole("button", {name: "Confirmando…"});
            await loading.waitFor();
            assert.equal(await loading.isDisabled(), true);
            assert.equal(await dialog.getByRole("button", {name: "Cancelar", exact: true}).isDisabled(), true);
            await page.keyboard.press("Escape");
            assert.equal(await dialog.isVisible(), true);
            assert.equal(requests.length, 1);
            liberar();
            await page.getByText("Recebimento confirmado", {exact: true}).waitFor();
        }, {gate});
    } finally { liberar(); }
});

test("PIX cancelado e outros meios não apresentam ação de confirmação", async () => {
    for (const options of [
        {pagamento: {status: "CANCELADO"}, venda: {status: "CANCELADA"}},
        {pagamento: {formaPagamento: "DINHEIRO"}, venda: {formaPagamento: "DINHEIRO"}},
    ]) {
        await withPix(async page => {
            assert.equal(await page.getByRole("button", {name: "Confirmar recebimento", exact: true}).count(), 0);
        }, options);
    }
});
