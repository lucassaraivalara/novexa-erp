import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server, browser, url;
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';
import {BrowserRouter} from 'react-router-dom';
import Contas from '/src/pages/Financeiro/ContasFinanceiras.tsx';
import {createNovexaTheme} from '/src/theme/theme.ts';
const mode = new URLSearchParams(location.search).get('mode') || 'light';
const resolved = mode === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme:createNovexaTheme(resolved)},
 React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(Contas))));
`;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-recebimentos-contas-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "recebimentos-contas-fixture",
            resolveId(id) { if (id === "/recebimentos-contas-fixture.js") return "\0recebimentos-contas-fixture.js"; },
            load(id) { if (id === "\0recebimentos-contas-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use("/__recebimentos", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml("/__recebimentos",
                        '<div id="root"></div><script type="module" src="/recebimentos-contas-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/__recebimentos`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

function pagamento(id, pix = false, destino = 8) {
    return { id, vendaId: 100 + id, recebivelId: pix ? null : id + 1000,
        formaPagamento: pix ? "PIX" : "CARTAO_CREDITO", configuracaoNome: pix ? "PIX gateway" : "Crédito gateway",
        contaDestinoId: destino, contaDestinoNome: destino ? "Gateway teste" : null,
        valorBruto: 100, valorTaxas: pix ? null : 3, valorLiquidoPrevisto: pix ? 100 : 97,
        dataHora: "2026-10-19T10:30:00", dataPrevista: pix ? null : "2026-10-21",
        status: "A_LIQUIDAR", valorLiquidado: null, dataLiquidacao: null, movimentacaoFinanceiraId: null };
}

async function comTela(callback, options = {}) {
    const page = await browser.newPage({ viewport: options.viewport ?? { width: 1440, height: 900 }, colorScheme: "dark" });
    const estado = { items: options.items ?? [pagamento(1), pagamento(2, true), pagamento(3, false, null)],
        posts: [], gets: [], erro: false, saldo: 0, postErro: false };
    await page.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "fixture-local", perfil, empresa: { id: 1 },
    })), options.perfil ?? "ADMIN");
    await page.route("**/financeiro/**", async route => {
        const req = route.request(), u = new URL(req.url());
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS" };
        const responder = (body, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });
        if (req.method() === "OPTIONS") return responder({});
        if (req.method() === "POST") {
            estado.posts.push(u.pathname);
            await new Promise(resolve => setTimeout(resolve, 180));
            if (estado.postErro) return responder({ detail: "Destino histórico indisponível." }, 409);
            const id = Number(u.pathname.split("/").at(-2));
            const item = estado.items.find(r => u.pathname.includes("/recebiveis/") ? r.recebivelId === id : r.id === id);
            assert.ok(item);
            item.status = "LIQUIDADO"; item.valorLiquidado = item.valorLiquidoPrevisto;
            item.dataLiquidacao = "2026-10-20T12:00:00"; item.movimentacaoFinanceiraId = 88;
            estado.saldo += item.valorLiquidado;
            return responder(item);
        }
        estado.gets.push(u);
        const conta = { id: 8, nome: "Gateway teste", tipo: "CARTEIRA_DIGITAL", saldoAtual: estado.saldo,
            saldoInicial: 0, saldoInicialAuditado: true, ativo: true, contaBancaria: null };
        if (u.pathname.endsWith("/contas-financeiras/pagina"))
            return responder({ items: [conta], page: 0, size: 10, totalItems: 1, totalPages: 1 });
        if (u.pathname.endsWith("/contas-financeiras/resumo"))
            return responder([{ tipo: "CARTEIRA_DIGITAL", quantidade: 1, saldoAtual: estado.saldo }]);
        if (u.pathname.endsWith("/recebimentos-contas/resumo")) {
            if (estado.erro) return responder({ detail: "Consulta temporariamente indisponível." }, 500);
            const resumo = [];
            for (const item of estado.items) {
                let r = resumo.find(r => r.contaDestinoId === item.contaDestinoId);
                if (!r) { r = { contaDestinoId: item.contaDestinoId, aLiquidar: 0, liquidado: 0, quantidadeALiquidar: 0, quantidadeSemValor: 0 }; resumo.push(r); }
                if (item.status === "A_LIQUIDAR") { r.aLiquidar += item.valorLiquidoPrevisto ?? 0; r.quantidadeALiquidar++;
                    if (item.valorLiquidoPrevisto == null) r.quantidadeSemValor++; }
                else r.liquidado += item.valorLiquidado;
            }
            return responder(resumo);
        }
        if (u.pathname.endsWith("/recebimentos-contas")) {
            if (estado.erro) return responder({ detail: "Consulta temporariamente indisponível." }, 500);
            const q = u.searchParams, pagina = Number(q.get("page") ?? 0), size = Number(q.get("size") ?? 10);
            const items = estado.items.filter(r => (!q.get("contaId") || r.contaDestinoId === Number(q.get("contaId")))
                && (q.get("semDestino") !== "true" || r.contaDestinoId === null)
                && (!q.get("status") || r.status === q.get("status")));
            return responder({ items: items.slice(pagina * size, (pagina + 1) * size), page: pagina, size,
                totalItems: items.length, totalPages: Math.ceil(items.length / size) });
        }
        if (u.pathname.endsWith("/cofre/resumo")) return responder({ saldo: 0, entradasConfirmadas: 0, saidas: 0, pendencias: 0 });
        return responder({ items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 });
    });
    try {
        await page.goto(`${url}?mode=${options.mode ?? "light"}`);
        await page.getByRole("heading", { name: "Contas e saldos", exact: true }).waitFor();
        await page.getByText("Gateway teste", { exact: true }).waitFor();
        await callback(page, estado);
    } finally { await page.close(); }
}

test("saldo disponível não soma previsão; pendência sem destino fica separada", () => comTela(async (page, estado) => {
    await page.getByRole("region", { name: "Previsão de PIX e cartões" }).getByText("A LIQUIDAR: R$ 197,00", { exact: true }).waitFor();
    const row = page.getByRole("row").filter({ hasText: "Gateway teste" });
    assert.match(await row.innerText(), /R\$\s*0,00/);
    assert.match(await row.innerText(), /A liquidar:\s*R\$\s*197,00/);
    await page.getByText(/1 recebimento\(s\) sem destino histórico/).waitFor();
    await row.getByRole("button", { name: "Consultar valores a liquidar e liquidados", exact: true }).click();
    await page.getByRole("heading", { name: "PIX e cartões · Gateway teste" }).waitFor();
    await page.getByRole("button", { name: "Liquidar cartão", exact: true }).waitFor();
    assert.ok(estado.gets.some(u => u.searchParams.get("contaId") === "8"));
    assert.equal(estado.posts.length, 0);
    assert.equal(await page.getByRole("link", { name: "Venda #101" }).getAttribute("target"), "_blank");
}));

test("liquidação usa endpoint existente somente após confirmação, não duplica e atualiza saldo", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Ver PIX e cartões" }).click();
    await page.getByRole("button", { name: "Liquidar cartão", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Voltar", exact: true }).click();
    assert.equal(estado.posts.length, 0);
    await page.getByRole("button", { name: "Liquidar cartão", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirmar recebimento", exact: true }).focus();
    await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    await page.getByText("Recebimento liquidado. O saldo disponível foi atualizado.").waitFor();
    assert.deepEqual(estado.posts, ["/financeiro/recebiveis/1001/liquidar"]);
    assert.equal(estado.saldo, 97);
    await page.getByRole("combobox", { name: "Situação do recebimento" }).click();
    await page.getByRole("option", { name: "LIQUIDADO", exact: true }).click();
    await page.getByText("Movimento #88").waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar cartão", exact: true }).count(), 0);
}));

test("PIX permite retornar, mantém erro e confirma exclusivamente pelo endpoint de PIX", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Ver PIX e cartões" }).click();
    await page.getByRole("button", { name: "Confirmar PIX" }).click();
    await page.keyboard.press("Escape");
    assert.equal(estado.posts.length, 0);
    await page.getByRole("button", { name: "Confirmar PIX" }).click();
    estado.postErro = true;
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar recebimento" }).click();
    await page.getByRole("dialog").getByText("Destino histórico indisponível.").waitFor();
    assert.equal(estado.saldo, 0);
    estado.postErro = false;
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar recebimento" }).click();
    await page.getByText("Recebimento liquidado. O saldo disponível foi atualizado.").waitFor();
    assert.deepEqual(estado.posts, ["/financeiro/pagamentos/2/confirmar-recebimento", "/financeiro/pagamentos/2/confirmar-recebimento"]);
    assert.equal(estado.saldo, 100);
}));

test("operador consulta sem ações gerenciais e sem destino não oferece confirmação", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Ver PIX e cartões" }).click();
    await page.getByText("Destino ausente no histórico", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Liquidar cartão|Confirmar PIX/ }).count(), 0);
    assert.equal(estado.posts.length, 0);
}, { perfil: "OPERADOR" }));

test("legado sem valor líquido informa previsão incompleta e bloqueia confirmação", () => comTela(async (page, estado) => {
    await page.getByText(/1 recebimento\(s\) com valor líquido não informado/).waitFor();
    await page.getByRole("button", { name: "Ver PIX e cartões" }).click();
    await page.getByText("Valor líquido ausente no histórico", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar cartão", exact: true }).count(), 0);
    assert.equal(estado.posts.length, 0);
}, { items: [{ ...pagamento(1), valorLiquidoPrevisto: null, valorTaxas: null, dataPrevista: null }] }));

test("paginação consulta backend e erro não aparece como ausência de recebimentos", () => comTela(async (page, estado) => {
    await page.getByRole("button", { name: "Ver PIX e cartões" }).click();
    const drawer = page.getByRole("heading", { name: /PIX e cartões · Todas/ }).locator("..").locator("..");
    await drawer.getByRole("button", { name: /próxima página|next page/i }).click();
    await page.getByRole("link", { name: "Venda #111" }).waitFor();
    assert.ok(estado.gets.some(u => u.searchParams.get("page") === "1"));
    estado.erro = true;
    await drawer.getByRole("button", { name: "Atualizar", exact: true }).click();
    await page.getByText("Consulta temporariamente indisponível.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Liquidar cartão", exact: true }).count(), 0);
    estado.erro = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page.getByRole("link", { name: "Venda #111" }).waitFor();
}, { items: Array.from({ length: 12 }, (_, i) => pagamento(i + 1)) }));

for (const [mode, width, height] of [["light", 1440, 900], ["dark", 1366, 768], ["auto", 390, 844], ["dark", 1024, 500]]) {
    test(`interface ${mode} ${width}x${height}: consulta, teclado, foco e limites da página`, () => comTela(async (page, estado) => {
        const abrir = page.getByRole("button", { name: "Ver PIX e cartões" });
        await abrir.focus(); await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Confirmar PIX" }).waitFor();
        await page.screenshot({ path: join(tmpdir(), `novexa-recebimentos-dados-${mode}-${width}.png`), fullPage: true });
        const combo = page.getByRole("combobox", { name: "Situação do recebimento" });
        await combo.focus(); await page.keyboard.press("ArrowDown");
        await page.keyboard.press("End"); await page.keyboard.press("Enter");
        await page.getByText("Nenhum recebimento nesta situação", { exact: true }).waitFor();
        await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => document.activeElement !== document.body));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: join(tmpdir(), `novexa-recebimentos-${mode}-${width}.png`), fullPage: true });
        await page.keyboard.press("Escape");
        await abrir.waitFor({ state: "visible" });
        assert.equal(estado.posts.length, 0);
    }, { mode, viewport: { width, height } }));
}
