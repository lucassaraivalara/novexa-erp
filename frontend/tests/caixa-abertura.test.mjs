import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

let vite, browser, base;
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createNovexaTheme } from '/src/theme/theme.ts';
import Abertura from '/src/pages/Financeiro/AberturaCaixaDialog.tsx';
import Caixa from '/src/pages/Financeiro/Caixa.tsx';
const params = new URLSearchParams(location.search);
const modo = params.get('theme') === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : params.get('theme') || 'light';
function Fixture() {
  const [aberto, setAberto] = React.useState(false), [salvo, setSalvo] = React.useState(false);
  const caixas = [{id: 1, descricao: 'Caixa 01', ativo: true}, ...(params.has('varios') ? [{id:2,descricao:'Caixa 02',ativo:true}] : [])];
  return React.createElement(ThemeProvider, {theme:createNovexaTheme(modo)}, React.createElement(CssBaseline),
    params.has('completo') ? React.createElement(Caixa) : React.createElement(React.Fragment, null,
      React.createElement('button', {onClick:()=>setAberto(true)}, 'Abrir Caixa'),
      salvo && React.createElement('p', {}, 'Abertura confirmada'),
      aberto && React.createElement(Abertura, {caixasAtivos:caixas,onClose:()=>setAberto(false),onSucesso:()=>{setAberto(false);setSalvo(true);}})));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;
before(async () => {
    vite = await createServer({ cacheDir: "node_modules/.vite-custodia-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "custodia-fixture", resolveId(id) { if (id === "/custodia.js") return "\0custodia.js"; },
            load(id) { if (id === "\0custodia.js") return fixture; },
            configureServer(s) { s.middlewares.use("/__custodia", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await s.transformIndexHtml("/__custodia", '<div id="root"></div><script type="module" src="/custodia.js"></script>'));
            }); } }],
    });
    await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}/__custodia`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await vite?.close(); });

const cofre = { id: 3, nome: "Cofre Principal", saldoAtual: 500 };
const contexto = (op = {}) => ({ caixaId: 1, descricaoCaixa: "Caixa 01", caixaAtivo: true, sessaoAberta: false,
    sessaoAbertaId: null, trocoAnterior: null, cofres: [cofre], saldoSugerido: 0, podeMovimentarCofre: true, ...op });
const troco = valor => ({ trocoAnterior: { sessaoId: 10, valor, dataFechamento: "2026-10-20T10:00:00", operadorFechamento: "Operador A" }, saldoSugerido: valor });
const sessao = { sessaoId: 11, caixaId: 1, descricaoCaixa: "Caixa 01", saldoInicial: 100, dataHoraAbertura: "2026-10-20T10:00:00", operadorAbertura: { id: 4, nome: "Operador A" }, status: "ABERTO" };
const resumo = { ...sessao, totalVendas: 55.3, totaisPorFormaPagamento: [], suprimentos: 0, sangrias: 0, saldoEsperadoDinheiro: 155.3, saldoFinalInformado: null, diferenca: null };

async function ambiente(t, op = {}) {
    const page = await browser.newPage({ viewport: op.viewport ?? { width: 1280, height: 720 }, colorScheme: "dark" });
    t.after(() => page.close());
    const posts = [], consultas = [], consoleErros = [];
    page.on("pageerror", e => consoleErros.push(e.message));
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture", perfil: "ADMIN", id: 4, empresa: { id: 1 } })));
    const headers = { "access-control-allow-origin": "*", "access-control-allow-methods": "*", "access-control-allow-headers": "*" };
    let falhasContexto = op.falhasContexto ?? 0;
    await page.route("**/financeiro/**", async route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        let data = [], status = 200;
        if (r.method() === "POST") {
            posts.push({ path, dados: r.postDataJSON() });
            if (op.demoraPost) await new Promise(r => setTimeout(r, 150));
            status = op.erroPost && posts.length === 1 ? typeof op.erroPost === "number" ? op.erroPost : 503 : 201;
            data = status === 400 ? { detail: "Requisição inválida." } : status === 503 ? "Servidor indisponível. Tente novamente." : { id: 11 };
        } else {
            consultas.push(path);
            if (path.endsWith("abertura-contexto")) {
                if (falhasContexto-- > 0) { status = 500; data = "Falha de consulta"; }
                else data = contexto(op.contexto);
            } else if (path === "/financeiro/configuracoes/recebimentos") data = { modo: "CONTROLADO", conferencia: "POR_FORMA_PAGAMENTO", exigirValoresInformadosNoFechamento: true };
            else if (path === "/financeiro/caixas") data = [{ id: 1, descricao: "Caixa 01", ativo: true }];
            else if (path.endsWith("sessoes/abertas")) data = op.completo ? [sessao] : [];
            else if (path.endsWith("sessoes/fechadas")) data = op.historico ? [op.historico] : [];
            else if (path.endsWith("/detalhe")) data = op.detalhe;
            else if (path.endsWith("/resumo") && !path.includes("cofre")) data = resumo;
            else if (path === "/financeiro/cofre/resumo") data = { saldo: 500, entradas: 0, saidas: 0, contas: [{ ...cofre, ativo: true }] };
        }
        await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.route("**/vendas/por-sessao/**", route => route.fulfill({ status: 200, headers, contentType: "application/json", body: "[]" }));
    await page.goto(base + `?theme=${op.tema ?? "light"}${op.completo ? "&completo" : ""}`);
    if (!op.completo) await page.getByRole("button", { name: "Abrir Caixa", exact: true }).click();
    const dialog = page.getByRole("dialog");
    return { page, dialog, posts, consultas, consoleErros, confirmar: () => dialog.getByRole("button", { name: "Confirmar abertura" }).click() };
}
async function pronto(a) { await expect(a.dialog.getByLabel("Fundo inicial (R$)", { exact: true })).toBeVisible(); }
async function fundo(a, valor) { await pronto(a); await a.dialog.getByLabel("Fundo inicial (R$)", { exact: true }).fill(valor); }

// HTTP simulado valida somente interface; integração real é coberta no PostgreSQL.
test("abertura consulta contexto e cancelar não grava nada", async t => {
    const a = await ambiente(t); await pronto(a);
    assert.deepEqual(a.consultas, ["/financeiro/caixas/1/abertura-contexto"]);
    assert.equal(a.posts.length, 0);
    await a.dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(a.dialog).toHaveCount(0); assert.equal(a.posts.length, 0);
    await expect(a.page.getByRole("button", { name: "Abrir Caixa", exact: true })).toBeFocused();
});
test("troco herdado pré-preenche e envia apenas confirmação, sem valor ou ID de origem inventado", async t => {
    const a = await ambiente(t, { contexto: troco(100) }); await pronto(a);
    await expect(a.dialog.getByLabel("Fundo inicial (R$)", { exact: true })).toHaveValue("100,00");
    await expect(a.dialog.getByText(/Sessão #10/)).toBeVisible();
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    const p = a.posts[0].dados;
    assert.equal(p.saldoInicial, 100); assert.equal(p.confirmarTroco, true);
    assert.equal(p.valorRetiradoCofre, 0); assert.equal(p.valorAporteExterno, 0);
    assert.ok(!("sessaoOrigemTrocoId" in p) && !("valorTrocoHerdado" in p));
});
test("primeira abertura retira do único cofre somente ao confirmar", async t => {
    const a = await ambiente(t); await fundo(a, "100.00");
    await expect(a.dialog.getByLabel("Cofre de origem")).toContainText("Cofre Principal");
    assert.equal(a.posts.length, 0);
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.equal(a.posts[0].dados.valorRetiradoCofre, 100); assert.equal(a.posts[0].dados.contaCofreId, 3);
});
test("múltiplos cofres exigem escolha e mostram cada saldo", async t => {
    const a = await ambiente(t, { contexto: { cofres: [cofre, { id: 4, nome: "Cofre Escritório", saldoAtual: 250 }] } });
    await fundo(a, "100"); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("Selecione um Cofre"); assert.equal(a.posts.length, 0);
    await a.dialog.getByLabel("Cofre de origem").click();
    await a.page.getByRole("option", { name: /Cofre Escritório.*250,00/ }).click();
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.equal(a.posts[0].dados.contaCofreId, 4);
});
test("complemento soma troco 70 e cofre 30 para fundo 100", async t => {
    const a = await ambiente(t, { contexto: troco(70) }); await fundo(a, "100");
    await expect(a.dialog.getByText(/Complemento necessário:.*30,00/)).toBeVisible();
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.deepEqual([a.posts[0].dados.saldoInicial, a.posts[0].dados.valorRetiradoCofre, a.posts[0].dados.valorAporteExterno], [100, 30, 0]);
});
test("saldo insuficiente não envia abertura e conserva os valores", async t => {
    const a = await ambiente(t); await fundo(a, "600"); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("Saldo insuficiente");
    await expect(a.dialog.getByLabel("Fundo inicial (R$)", { exact: true })).toHaveValue("600"); assert.equal(a.posts.length, 0);
});
test("aporte externo exige motivo, preserva dados e não seleciona conta", async t => {
    const a = await ambiente(t, { contexto: { cofres: [] } }); await fundo(a, "100"); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("Informe o motivo");
    await a.dialog.getByLabel("Motivo do aporte externo").fill("Fundo fornecido pelo proprietário");
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.equal(a.posts[0].dados.valorAporteExterno, 100); assert.equal(a.posts[0].dados.contaCofreId, null);
});
test("composição pode incluir troco, cofre e aporte", async t => {
    const a = await ambiente(t, { contexto: troco(70) }); await fundo(a, "100");
    await a.dialog.getByRole("radio", { name: "COFRE e aporte externo", exact: true }).check();
    await a.dialog.getByLabel("Valor a retirar do cofre (R$)").fill("20");
    await a.dialog.getByLabel("Motivo do aporte externo").fill("Complemento externo");
    await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.deepEqual([a.posts[0].dados.valorRetiradoCofre, a.posts[0].dados.valorAporteExterno], [20,10]);
});
test("operador sem permissão gerencial não retira nem aporta", async t => {
    const a = await ambiente(t, { contexto: { podeMovimentarCofre: false } }); await fundo(a, "100"); await a.confirmar();
    await expect(a.dialog.getByRole("alert").filter({ hasText: "Solicite a um administrador" })).toBeVisible(); assert.equal(a.posts.length, 0);
    await expect(a.dialog.getByRole("radio", { name: "COFRE", exact: true })).toBeDisabled();
});
test("troco não confirmado e fundo menor bloqueiam sem perder custódia", async t => {
    const a = await ambiente(t, { contexto: troco(100) }); await fundo(a, "80"); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("Regularize o excedente");
    await fundo(a, "100"); await a.dialog.getByLabel("Usar troco da sessão anterior").uncheck(); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("Confirme a utilização integral"); assert.equal(a.posts.length, 0);
});
test("valor com três casas é rejeitado, sem arredondar silenciosamente", async t => {
    const a = await ambiente(t); await fundo(a, "100,001"); await a.confirmar();
    await expect(a.dialog.getByRole("alert")).toContainText("duas casas decimais"); assert.equal(a.posts.length, 0);
});
test("erro de rede preserva a mesma chave no retry e impede duplo submit", async t => {
    const a = await ambiente(t, { erroPost: true, demoraPost: true }); await fundo(a, "100");
    await a.dialog.getByRole("button", { name: "Confirmar abertura" }).evaluate(b => { b.click(); b.click(); });
    await expect(a.dialog.getByRole("alert")).toContainText("Servidor indisponível");
    assert.equal(a.posts.length, 1); await a.confirmar(); await expect(a.page.getByText("Abertura confirmada")).toBeVisible();
    assert.equal(a.posts.length, 2); assert.deepEqual(a.posts[0].dados, a.posts[1].dados);
});
test("erro de contexto oferece retry e não permite abertura prematura", async t => {
    const a = await ambiente(t, { falhasContexto: 1 });
    await expect(a.dialog.getByRole("alert")).toContainText("Falha de consulta");
    await expect(a.dialog.getByRole("button", { name: "Confirmar abertura" })).toBeDisabled();
    await a.dialog.getByRole("button", { name: "Tentar novamente" }).click(); await pronto(a); assert.equal(a.posts.length, 0);
});
test("teclado permite Tab, Shift+Tab, Escape e confirmação sem mouse", async t => {
    const a = await ambiente(t, { contexto: troco(100) }); await pronto(a);
    const confirmar = a.dialog.getByRole("button", { name: "Confirmar abertura" });
    await confirmar.focus(); await a.page.keyboard.press("Shift+Tab");
    await expect(a.dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await a.page.keyboard.press("Tab"); await expect(confirmar).toBeFocused();
    await a.page.keyboard.press("Escape"); await expect(a.dialog).toHaveCount(0); assert.equal(a.posts.length, 0);
    await a.page.keyboard.press("Enter"); await pronto(a); await a.dialog.getByRole("button", { name: "Confirmar abertura" }).focus();
    await a.page.keyboard.press("Enter"); await expect(a.page.getByText("Abertura confirmada")).toBeVisible(); assert.equal(a.posts.length, 1);
});
test("fechamento exige classificação completa e mantém entrega pendente explícita", async t => {
    const a = await ambiente(t, { completo: true });
    await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
    await a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ }).fill("155,30");
    await expect(a.dialog.getByLabel("Valor mantido para troco (R$)")).toHaveValue("100,00");
    await expect(a.dialog.getByLabel("Recolher ao cofre (R$)")).toHaveValue("55,30");
    await a.dialog.getByLabel("Valor mantido para troco (R$)").fill("90");
    await expect(a.dialog.getByLabel("Recolher ao cofre (R$)")).toHaveValue("65,30");
    await a.dialog.getByLabel("Valor mantido para troco (R$)").fill("160");
    await expect(a.dialog.getByRole("status").filter({hasText:"excede"})).toContainText("4,70");
    await expect(a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true })).toBeDisabled(); assert.equal(a.posts.length, 0);
    await a.dialog.getByLabel("Valor mantido para troco (R$)").fill("100");
    await a.dialog.getByLabel("Conta COFRE").click(); await a.page.getByRole("option", { name: "Cofre Principal", exact: true }).click();
    await a.dialog.getByLabel("Responsável pelo recebimento").fill("Responsável local");
    await a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true }).click(); await expect(a.dialog).toHaveCount(0);
    assert.equal(a.posts.length, 1);
    assert.deepEqual([a.posts[0].dados.cofre.valorTroco, a.posts[0].dados.cofre.valor, a.posts[0].dados.cofre.confirmarEntrega], [100,55.3,false]);
});

test("fechamento calcula destino complementar e diferença, exige observação somente na divergência", async t => {
    const a = await ambiente(t, { completo: true });
    await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
    const contado = a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ });
    await expect(contado).toBeFocused();
    await contado.fill("155,30");
    await expect(a.dialog.getByLabel("Diferença de caixa", { exact: true })).toContainText("0,00");
    await a.dialog.getByLabel("Recolher ao cofre (R$)").fill("20");
    await expect(a.dialog.getByLabel("Valor mantido para troco (R$)")).toHaveValue("135,30");
    await contado.fill("150");
    await expect(a.dialog.getByLabel("Valor mantido para troco (R$)")).toHaveValue("135,30");
    await expect(a.dialog.getByLabel("Recolher ao cofre (R$)")).toHaveValue("14,70");
    await expect(a.dialog.getByLabel("Diferença de caixa", { exact: true })).toContainText("5,30");
    await expect(a.dialog.getByText("Falta de dinheiro", { exact: true })).toBeVisible();
    await expect(a.dialog.getByRole("button", { name: "Confirmar fechamento com divergência", exact: true })).toBeDisabled();
    await a.dialog.getByLabel("Observação da divergência").fill("Diferença identificada na conferência local simulada.");
    await contado.fill("160");
    await expect(a.dialog.getByText("Sobra de dinheiro", { exact: true })).toBeVisible();
    await expect(a.dialog.getByLabel("Diferença de caixa", { exact: true })).toContainText("4,70");
    await contado.fill("155,30");
    await expect(a.dialog.getByLabel("Observação da divergência")).toHaveCount(0);
    await a.dialog.getByLabel("Recolher ao cofre (R$)").fill("0");
    await a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true }).click();
    await expect(a.dialog).toHaveCount(0);
    assert.equal(a.posts[0].dados.saldoFinal, 155.3); assert.equal(a.posts[0].dados.cofre.valorTroco, 155.3);
});

test("fechamento preserva valores em erro HTTP e oferece orientação operacional", async t => {
    const a = await ambiente(t, { completo: true, erroPost: 400 });
    await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
    await a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ }).fill("155,30");
    await a.dialog.getByLabel("Recolher ao cofre (R$)").fill("0");
    await a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true }).click();
    await expect(a.dialog.getByRole("alert")).toContainText("Revise o dinheiro contado");
    await expect(a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ })).toHaveValue("155,30");
    await expect(a.dialog.getByLabel("Valor mantido para troco (R$)")).toHaveValue("155,30");
    assert.equal(a.posts.length, 1);
    await a.dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(a.dialog).toHaveCount(0); assert.equal(a.posts.length, 1);
});

test("fechamento mantém ações fixas e foco em desktop, notebook, mobile e janela baixa", async t => {
    for (const [tema, viewport] of [["light", {width:1440,height:900}], ["dark", {width:1280,height:720}], ["auto", {width:390,height:844}], ["dark", {width:1024,height:480}]]) {
        const a = await ambiente(t, { completo: true, tema, viewport });
        await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
        const contado = a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ });
        await expect(contado).toBeFocused(); await contado.fill("155,30");
        await a.dialog.getByLabel("Recolher ao cofre (R$)").fill("0");
        const confirmar = a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true });
        await expect(confirmar).toBeInViewport(); await expect(a.dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeInViewport();
        assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await confirmar.focus(); await a.page.keyboard.press("Tab");
        assert.ok(await a.dialog.evaluate(el => el.contains(document.activeElement)));
        await a.page.screenshot({ path: join(tmpdir(), `novexa-fechamento-${tema}-${viewport.width}-${viewport.height}.png`), animations: "disabled" });
        await a.page.keyboard.press("Escape"); await expect(a.dialog).toHaveCount(0);
        await expect(a.page.getByRole("button", { name: "Fechar Caixa", exact: true })).toBeFocused();
        assert.equal(a.posts.length, 0); assert.deepEqual(a.consoleErros, []);
        await a.page.close();
    }
});
test("fechamento integral em troco dispensa cofre e responsável", async t => {
    const a = await ambiente(t, { completo: true });
    await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
    await a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ }).fill("155,30");
    await a.dialog.getByLabel("Recolher ao cofre (R$)").fill("0");
    await a.dialog.getByLabel("Valor mantido para troco (R$)").fill("155,30");
    await expect(a.dialog.getByLabel("Responsável pelo recebimento")).toHaveCount(0);
    await a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true }).click(); await expect(a.dialog).toHaveCount(0);
    assert.equal(a.posts[0].dados.cofre.contaCofreId, null); assert.equal(a.posts[0].dados.cofre.valorTroco, 155.3);
});
test("entrega confirmada exige decisão explícita e fechamento não duplica submit", async t => {
    const a = await ambiente(t, { completo: true, demoraPost: true });
    await a.page.getByRole("button", { name: "Fechar Caixa", exact: true }).click();
    await a.dialog.getByRole("textbox", { name: /Dinheiro físico contado/ }).fill("155,30");
    await a.dialog.getByLabel("Conta COFRE").click(); await a.page.getByRole("option", { name: "Cofre Principal", exact: true }).click();
    await a.dialog.getByLabel("Responsável pelo recebimento").fill("Responsável local");
    await a.dialog.getByRole("checkbox", { name: /Confirmo que o dinheiro foi entregue/ }).check();
    await a.dialog.getByRole("button", { name: "Confirmar fechamento", exact: true }).evaluate(b => { b.click(); b.click(); });
    await expect(a.dialog).toHaveCount(0);
    assert.equal(a.posts.length, 1); assert.equal(a.posts[0].dados.cofre.confirmarEntrega, true);
});
test("detalhe mostra composição auditada e preserva leitura do legado", async t => {
    for (const composicao of [null, { valorTrocoHerdado: 70, sessaoOrigemTrocoId: 10, dataFechamentoOrigem: "2026-10-20T09:00:00",
        valorRetiradoCofre: 20, contaCofreId: 3, contaCofreNome: "Cofre Principal", movimentoFinanceiroId: 42,
        valorAporteExterno: 10, observacaoAporte: "Complemento do proprietário", operadorAbertura: "Operador A", dataCriacao: "2026-10-20T10:00:00" }]) {
        const historico = { ...sessao, status: "FECHADO", dataHoraFechamento: "2026-10-20T11:00:00", operadorFechamento: {id:4,nome:"Operador A"}, totalVendas: 0, dinheiroEsperado:100, valorInformado:100, diferenca:0 };
        const a = await ambiente(t, { completo: true, historico, detalhe: { sessao: historico, resumo, modalidadeConferencia:"LEGADA", observacaoFechamento:null, conferencias:[], movimentacoes:[], composicaoAbertura:composicao } });
        await a.page.getByRole("tab", { name: "Caixas Anteriores", exact: true }).click();
        await a.page.getByRole("button", { name: "Ver detalhes" }).click();
        await expect(a.page.getByRole("heading", { name: "Composição da abertura" })).toBeVisible();
        if (composicao) {
            await expect(a.page.getByText(/Troco herdado da sessão #10/)).toBeVisible();
            await expect(a.page.getByText(/Retirada do Cofre Principal · movimento #42/)).toBeVisible();
            await expect(a.page.getByText(/Aporte externo. Motivo: Complemento do proprietário/)).toBeVisible();
        } else await expect(a.page.getByText("Abertura legada sem composição de origens registrada.")).toBeVisible();
        assert.equal(a.posts.length,0);
        await a.page.close();
    }
});
test("abertura responsiva em claro, escuro e automático, incluindo janela baixa", async t => {
    for (const tema of ["light", "dark", "auto"]) for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:1280,height:480}]) {
        const a = await ambiente(t, { tema, viewport, contexto: troco(70) }); await fundo(a, "100");
        await a.dialog.getByRole("button", { name: "Confirmar abertura" }).scrollIntoViewIfNeeded();
        const caixa = await a.dialog.boundingBox(); assert.ok(caixa.x >= 0 && caixa.x + caixa.width <= viewport.width);
        assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await expect(a.dialog.getByRole("button", { name: "Confirmar abertura" })).toBeInViewport();
        assert.deepEqual(a.consoleErros, []);
        if ((tema === "dark" && viewport.width === 390) || (tema === "light" && viewport.height === 480))
            await a.page.screenshot({ path: join(tmpdir(), `novexa-custodia-${tema}-${viewport.width}.png`) });
        await a.page.close();
    }
});
