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
        else if (path.endsWith("/resumo")) data = {
            sessaoId: 9, caixaId: 1, status: "ABERTO", descricaoCaixa: "Caixa principal",
            dataHoraAbertura: "2026-10-02T09:00:00", operadorAbertura: { id: 4, nome: "Operador" },
            saldoInicial: 100, totalVendas: 20, totaisPorFormaPagamento: [], suprimentos: 0, sangrias: 0,
            saldoEsperadoDinheiro: 100, saldoFinalInformado: null, diferenca: null,
        };
        else if (path.endsWith("/movimentacoes")) data = [{
            id: 71, sessaoId: 9, vendaId: 123, usuarioId: 4, chaveRequisicao: "estorno-venda-123",
            tipo: "ESTORNO_VENDA", valor: 20, observacao: "Cancelamento da venda 123",
            dataHora: "2026-10-02T10:00:00",
        }];
        else if (path === "/vendas/por-sessao/9") data = [];
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
