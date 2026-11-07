import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarSessoesFechadas, buscarDetalheSessao } = await server.ssrLoadModule("/src/services/caixaService.ts");
const { criarTimeline } = await server.ssrLoadModule("/src/pages/Financeiro/caixaTimeline.ts");
await server.close();

test("timeline apresenta ESTORNO_VENDA como cancelamento com saída", () => {
    const timeline = criarTimeline([
        { id: 1, sessaoId: 9, vendaId: 123, usuarioId: 4, chaveRequisicao: "estorno", tipo: "ESTORNO_VENDA",
            valor: 20, observacao: "Cancelamento da venda 123", dataHora: "2026-10-02T12:00:00" },
        { id: 2, sessaoId: 9, vendaId: null, usuarioId: 4, chaveRequisicao: "sangria", tipo: "SANGRIA",
            valor: 5, observacao: null, dataHora: "2026-10-02T11:00:00" },
        { id: 3, sessaoId: 9, vendaId: null, usuarioId: 4, chaveRequisicao: "suprimento", tipo: "SUPRIMENTO",
            valor: 30, observacao: null, dataHora: "2026-10-02T10:00:00" },
    ], []);

    assert.deepEqual(timeline.map(({ descricao, sinal }) => [descricao, sinal]), [
        ["Cancelamento de venda", "−"],
        ["Sangria", "−"],
        ["Suprimento", "+"],
    ]);
    assert.notEqual(timeline[0].descricao, "Sangria");
});

test("historico e detalhe usam apenas IDs da sessao, com tenant no token", async () => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    globalThis.window = { location: { assign() {} } };
    salvarSessao({ token: "token-caixa", empresa: { id: 7 } });
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        return { data: [], status: 200, statusText: "OK", headers: {}, config };
    };

    await listarSessoesFechadas();
    await buscarDetalheSessao(42);

    assert.deepEqual(chamadas.map(({ url }) => url), [
        "/financeiro/caixas/sessoes/fechadas",
        "/financeiro/caixas/sessoes/42/detalhe",
    ]);
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-caixa"));
    assert.ok(chamadas.every(({ params, data }) => !params && !data));
});

test("smoke visual mostra estorno de venda como saída, nunca como sangria", async () => {
    const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '/src/theme/theme.ts';
import Caixa from '/src/pages/Financeiro/Caixa.tsx';
createRoot(document.getElementById('root')).render(
    React.createElement(ThemeProvider, { theme }, React.createElement(React.Fragment, null,
        React.createElement(CssBaseline), React.createElement(Caixa)))
);
`;
    const vite = await createServer({
        cacheDir: "node_modules/.vite-caixa-smoke-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "caixa-smoke-fixture",
            resolveId(id) { if (id === "/caixa-smoke-fixture.js") return "\0caixa-smoke-fixture.js"; },
            load(id) { if (id === "\0caixa-smoke-fixture.js") return fixture; },
            configureServer(devServer) {
                devServer.middlewares.use("/__caixa-smoke", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await devServer.transformIndexHtml("/__caixa-smoke", '<div id="root"></div><script type="module" src="/caixa-smoke-fixture.js"></script>'));
                });
            },
        }],
    });
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const origem = "http://localhost:8080";

    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "token-smoke", perfil: "ADMIN", empresa: { id: 1, nomeFantasia: "Loja" },
    })));
    await page.route(`${origem}/**`, async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const headers = {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
        };
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        let data = [];
        if (path === "/financeiro/caixas/sessoes/abertas") data = [{
            sessaoId: 9, caixaId: 1, descricaoCaixa: "Caixa principal", saldoInicial: 100,
            dataHoraAbertura: "2026-10-02T09:00:00", operadorAbertura: { id: 4, nome: "Operador" },
        }];
        else if (path.endsWith("/painel")) data = { resumo: {
            sessaoId: 9, caixaId: 1, status: "ABERTO", descricaoCaixa: "Caixa principal",
            dataHoraAbertura: "2026-10-02T09:00:00", operadorAbertura: { id: 4, nome: "Operador" },
            saldoInicial: 100, totalVendas: 20, totaisPorFormaPagamento: [], suprimentos: 0, sangrias: 0,
            saldoEsperadoDinheiro: 100, saldoFinalInformado: null, diferenca: null,
        }, movimentacoes: [{
            id: 71, sessaoId: 9, vendaId: 123, usuarioId: 4, chaveRequisicao: "estorno-venda-123",
            tipo: "ESTORNO_VENDA", valor: 20, observacao: "Cancelamento da venda 123",
            dataHora: "2026-10-02T10:00:00",
        }], vendas: [] };
        await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(data) });
    });

    try {
        await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__caixa-smoke`);
        const timeline = page.getByRole("list", { name: "Histórico de movimentações da sessão" });
        const estorno = timeline.getByRole("listitem").filter({ hasText: "Cancelamento de venda" });
        await estorno.getByText("Cancelamento de venda", { exact: true }).waitFor();
        const texto = (await estorno.innerText()).replace(/\u00a0/g, " ").replace(/\s+/g, " ");
        assert.match(texto, /−\s*R\$\s*20,00/);
        assert.doesNotMatch(texto, /Sangria\s*\+/);
    } finally {
        await page.close();
        await browser.close();
        await vite.close();
    }
});

test("Caixas Anteriores organiza o detalhe nas três abas sem repetir a consulta", async () => {
    const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '/src/theme/theme.ts';
import Caixa from '/src/pages/Financeiro/Caixa.tsx';
createRoot(document.getElementById('root')).render(
    React.createElement(ThemeProvider, { theme }, React.createElement(React.Fragment, null,
        React.createElement(CssBaseline), React.createElement(Caixa)))
);
`;
    const vite = await createServer({
        cacheDir: "node_modules/.vite-caixa-historico-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "caixa-historico-smoke-fixture",
            resolveId(id) { if (id === "/caixa-historico-fixture.js") return "\0caixa-historico-fixture.js"; },
            load(id) { if (id === "\0caixa-historico-fixture.js") return fixture; },
            configureServer(devServer) {
                devServer.middlewares.use("/__caixa-historico", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await devServer.transformIndexHtml("/__caixa-historico", '<div id="root"></div><script type="module" src="/caixa-historico-fixture.js"></script>'));
                });
            },
        }],
    });
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let consultasDetalhe = 0;
    let modalidadeConferencia = "POR_FORMA";
    const sessao = {
        sessaoId: 42, caixaId: 3, descricaoCaixa: "Caixa principal", status: "FECHADO",
        dataHoraAbertura: "2026-11-06T08:00:00", operadorAbertura: { id: 7, nome: "Operador" },
        dataHoraFechamento: "2026-11-06T18:00:00", operadorFechamento: { id: 7, nome: "Operador" },
        saldoInicial: 100, totalVendas: 250, dinheiroEsperado: 200, valorInformado: 200, diferenca: 0,
    };
    const resumo = {
        sessaoId: 42, caixaId: 3, status: "FECHADO", descricaoCaixa: "Caixa principal",
        dataHoraAbertura: sessao.dataHoraAbertura, operadorAbertura: sessao.operadorAbertura,
        saldoInicial: 100, totalVendas: 250, totaisPorFormaPagamento: [
            { formaPagamentoId: 2, descricao: "PIX", tipo: "PIX", total: 50 },
        ], suprimentos: 20, sangrias: 10, saldoEsperadoDinheiro: 200, saldoFinalInformado: 200, diferenca: 0,
    };

    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "token-smoke", perfil: "ADMIN", empresa: { id: 1, nomeFantasia: "Loja" },
    })));
    await page.route("http://localhost:8080/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const headers = {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
        };
        if (route.request().method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers });
            return;
        }
        if (path === "/financeiro/caixas/sessoes/abertas" || path === "/financeiro/caixas") {
            await route.fulfill({ status: 200, contentType: "application/json", headers, body: "[]" });
        } else if (path === "/financeiro/caixas/sessoes/fechadas") {
            await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify([sessao]) });
        } else if (path === "/financeiro/caixas/sessoes/42/detalhe") {
            consultasDetalhe++;
            await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify({
                sessao, resumo, modalidadeConferencia, observacaoFechamento: null,
                conferencias: [{ escopo: "FORMA_PAGAMENTO", formaPagamentoId: 2, descricao: "PIX", tipo: "PIX", valorEsperado: 50, valorInformado: 50, diferenca: 0 }],
                movimentacoes: [{ tipo: "SUPRIMENTO", dataHora: "2026-11-06T09:00:00", valor: 20, vendaId: null, observacao: "Troco", usuarioNome: "Operador", origemAutomatica: false }],
            }) });
        } else {
            await route.fulfill({ status: 404, contentType: "application/json", headers, body: "{}" });
        }
    });

    try {
        await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/__caixa-historico`);
        await page.getByRole("tab", { name: "Caixas Anteriores" }).click();
        await page.getByText("Caixa principal", { exact: true }).first().waitFor();
        await page.getByRole("button", { name: "Ver detalhes da sessão" }).click();
        const dialog = page.getByRole("dialog", { name: /Caixa principal/ });
        await dialog.getByRole("tab", { name: "Resumo" }).waitFor();
        await dialog.getByText("Composição da abertura").waitFor();
        await dialog.getByRole("tab", { name: "Conferência" }).click();
        await dialog.getByText("Meios de pagamento").waitFor();
        await dialog.getByText("PIX", { exact: true }).waitFor();
        await dialog.getByRole("tab", { name: "Movimentações" }).click();
        await dialog.getByText("Suprimento").waitFor();
        assert.equal(consultasDetalhe, 1);
        assert.equal(await dialog.getByRole("tab").count(), 3);
        await page.setViewportSize({ width: 390, height: 844 });
        await dialog.getByRole("tab", { name: "Movimentações" }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        await dialog.getByRole("button", { name: "Fechar detalhe da sessão" }).click();
        await dialog.waitFor({ state: "detached" });
        await page.getByRole("tab", { name: "Caixas Anteriores" }).waitFor();
        modalidadeConferencia = "LEGADA";
        await page.getByRole("button", { name: "Ver detalhes da sessão" }).click();
        const dialogLegado = page.getByRole("dialog", { name: /Caixa principal/ });
        await dialogLegado.getByRole("tab", { name: "Conferência" }).click();
        await dialogLegado.getByText("Fechamento legado: somente o dinheiro físico foi informado. Os demais meios não têm valores conferidos.").waitFor();
        assert.equal(consultasDetalhe, 2);
    } finally {
        await page.close();
        await browser.close();
        await vite.close();
    }
});
