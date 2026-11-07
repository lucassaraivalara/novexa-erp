import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const conta = { id: 1, nome: "Banco Loja", tipo: "BANCO", saldoInicial: 100, saldoInicialAuditado: true, saldoAtual: 100,
    ativo: true, dataCriacao: "2026-11-01T10:00:00", dataAtualizacao: "2026-11-01T10:00:00",
    contaBancaria: { id: 4, bancoNome: "Banco Teste", numero: "12345", digito: "6", ativo: true } };
const pagina = (items, totalItems = items.length, page = 0) => ({ items, page, size: 10, totalItems, totalPages: Math.ceil(totalItems / 10) });

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-contas-financeiras-ux-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "contas-financeiras-ux-fixture",
            resolveId(id) { if (id === "/contas-financeiras-fixture.js") return "\0contas-financeiras-fixture.js"; },
            load(id) { if (id === "\0contas-financeiras-fixture.js") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {BrowserRouter} from 'react-router-dom'; import {ThemeProvider,CssBaseline} from '@mui/material';
                import {createNovexaTheme} from '/src/theme/theme.ts'; import ContasFinanceiras from '/src/pages/Financeiro/ContasFinanceiras.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme:createNovexaTheme()},
                    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(ContasFinanceiras))));`; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (req.url.split("?")[0] !== "/financeiro/contas-financeiras") return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/contas-financeiras-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(config = {}) {
    const estado = { requests: [], writes: [], falharCadastro: false, ...config };
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture", perfil: "ADMIN", usuarioId: 1,
        nome: "Admin de teste", empresa: { id: 7, nomeFantasia: "Loja sintética" } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url()), params = Object.fromEntries(u.searchParams);
        const body = req.postDataJSON(); estado.requests.push({ method: req.method(), path: u.pathname, params, body });
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        let data = {}, status = 200;
        if (req.method() === "POST" || req.method() === "PUT" || req.method() === "PATCH") {
            estado.writes.push({ method: req.method(), path: u.pathname, body });
            if (estado.falharCadastro && u.pathname === "/financeiro/contas-financeiras") { status = 400; data = "Falha sintética de validação"; }
            else data = { ...conta, ...body, id: 2 };
        } else if (u.pathname === "/financeiro/contas-financeiras/pagina") data = pagina([conta], 21, Number(params.page ?? 0));
        else if (u.pathname === "/financeiro/contas-financeiras/resumo") data = [
            { tipo: "BANCO", quantidade: 1, saldoAtual: 100 }, { tipo: "CAIXA", quantidade: 1, saldoAtual: 40 },
        ];
        else if (u.pathname === "/financeiro/recebimentos-contas/resumo") data = [{ contaDestinoId: 1, aLiquidar: 25, quantidadeSemValor: 0, quantidadeALiquidar: 1 }];
        else if (u.pathname === "/financeiro/cofre/pendencias") data = pagina([{ sessaoId: 10, operador: "Operador sintético", contado: 20, valor: 20, valorTroco: 0,
            recolhimentoId: null, responsavel: "Admin", data: "2026-11-06T12:00:00" }], 21, Number(params.page ?? 0));
        else if (u.pathname === "/financeiro/cofre/resumo") data = { saldo: 80, entradas: 100, saidas: 20, contas: [{ id: 5, nome: "Cofre teste", saldoAtual: 80, ativo: true }] };
        else if (u.pathname === "/financeiro/cofre/recolhimentos") data = pagina([], 0, Number(params.page ?? 0));
        else if (u.pathname.startsWith("/financeiro/cofre/contas/")) data = pagina([], 0, Number(params.page ?? 0));
        else if (u.pathname === "/financeiro/contas-bancarias") data = [];
        else { status = 404; data = { detail: `Endpoint inesperado: ${u.pathname}` }; }
        await route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
    });
    const erros = []; page.on("pageerror", e => erros.push(e.message));
    await page.goto(`${url}/financeiro/contas-financeiras`);
    await page.getByText("21 pendência(s) de sessão para conferir", { exact: true }).waitFor();
    return { page, estado, erros };
}
const chamadas = (estado, path) => estado.requests.filter(r => r.path === path);

test("consulta separa saldo registrado de liquidação e usa filtros remotos progressivos", async () => {
    const { page, estado, erros } = await abrir();
    try {
        await expect(page.getByText("O total global inclui contas inativas e tipos legados, independentemente dos filtros.")).toBeVisible();
        await expect(page.getByText("R$ 140,00").first()).toBeVisible();
        await expect(page.getByText("R$ 25,00").first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Abrir extrato de Banco Loja" })).toBeVisible();
        assert.equal(chamadas(estado, "/financeiro/cofre/pendencias").length, 1);
        assert.equal(chamadas(estado, "/financeiro/cofre/resumo").length, 0);
        assert.equal(chamadas(estado, "/financeiro/cofre/recolhimentos").length, 0);

        await page.getByRole("combobox", { name: "Situação" }).click();
        await page.getByRole("option", { name: "Inativas" }).click();
        await expect.poll(() => chamadas(estado, "/financeiro/contas-financeiras/pagina").some(r => r.params.ativo === "false")).toBe(true);
        await page.getByRole("button", { name: /Mais filtros/ }).click();
        await page.getByRole("combobox", { name: "Tipo de conta" }).click();
        await page.getByRole("option", { name: "Caixa (legado)" }).click();
        await expect.poll(() => chamadas(estado, "/financeiro/contas-financeiras/pagina").some(r => r.params.tipo === "CAIXA" && r.params.ativo === "false")).toBe(true);
        assert.deepEqual(erros, []);
    } finally { await page.close(); }
});

test("Cofre recolhido mantém pendências e carrega resumo e históricos somente sob demanda", async () => {
    const { page, estado, erros } = await abrir();
    try {
        await page.getByRole("button", { name: "Consultar cofre" }).click();
        await expect.poll(() => chamadas(estado, "/financeiro/cofre/resumo").length).toBe(1);
        assert.equal(chamadas(estado, "/financeiro/cofre/pendencias").length, 1, "expandir reutiliza a primeira página consultada");
        assert.equal(chamadas(estado, "/financeiro/cofre/recolhimentos").length, 0);
        await page.getByRole("tab", { name: "Recolhimentos e troco" }).click();
        await expect.poll(() => chamadas(estado, "/financeiro/cofre/recolhimentos").length).toBe(1);
        assert.equal(chamadas(estado, "/financeiro/cofre/contas/5/movimentos").length, 0);
        await page.getByRole("tab", { name: "Entradas, saídas e depósitos" }).click();
        await page.getByRole("combobox", { name: "Cofre do extrato" }).click();
        await page.getByRole("option", { name: "Cofre teste" }).click();
        await expect.poll(() => chamadas(estado, "/financeiro/cofre/contas/5/movimentos").length).toBe(1);
        assert.equal(estado.writes.length, 0, "consultar painel e histórico não grava movimentação");
        await expect(page.getByText("21 pendência(s) de sessão para conferir", { exact: true })).toBeVisible();
        assert.deepEqual(erros, []);
    } finally { await page.close(); }
});

test("cadastro centralizado mantém campos após falha e permite corrigir sem fechar", async () => {
    const { page, estado, erros } = await abrir({ falharCadastro: true });
    try {
        await page.getByRole("button", { name: "Nova conta" }).click();
        const dialog = page.getByRole("dialog", { name: "Nova conta financeira" });
        await dialog.waitFor();
        await page.getByRole("combobox", { name: "Tipo" }).click();
        await page.getByRole("option", { name: "Outros" }).click();
        await page.getByRole("textbox", { name: "Nome" }).fill("Conta sintética");
        await page.getByRole("button", { name: "Salvar", exact: true }).click();
        await page.getByText("Falha sintética de validação", { exact: true }).waitFor();
        await expect(page.getByRole("textbox", { name: "Nome" })).toHaveValue("Conta sintética");
        assert.equal(estado.writes.filter(w => w.path === "/financeiro/contas-financeiras").length, 1);
        estado.falharCadastro = false;
        await page.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        assert.equal(estado.writes.filter(w => w.path === "/financeiro/contas-financeiras").length, 2);
        assert.equal(estado.writes.at(-1).body.nome, "Conta sintética");
        assert.equal(estado.writes.at(-1).body.tipo, "OUTROS");
        assert.deepEqual(erros, []);
    } finally { await page.close(); }
});
