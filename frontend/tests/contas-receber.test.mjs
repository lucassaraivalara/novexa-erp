import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, api, service, utils;
const base = "/financeiro/contas-receber";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const cliente = { id: 8, nome: "Maria Oliveira", cpfCnpj: "02360684663", ativo: true };
const banco = { id: 3, nome: "Banco principal", tipo: "BANCO", saldoAtual: 1000, ativo: true };
const conta = (id = 1, extras = {}) => ({ id, cliente, vendaId: null, descricao: "Venda manual de outubro", valorOriginal: 100,
    valorRecebido: 0, saldo: 100, dataEmissao: "2026-10-01", dataVencimento: "2026-10-20", status: "PENDENTE", origem: "MANUAL",
    numeroParcela: 1, totalParcelas: 1, observacao: "Entrega realizada", dataCriacao: "2026-10-06T10:00:00",
    dataAtualizacao: "2026-10-06T10:00:00", recebimentos: [], ...extras });
const movimento = (id, valor, extras = {}) => ({ id, valor, contaFinanceiraId: banco.id, contaFinanceiraNome: banco.nome,
    tipo: "ENTRADA", origem: "CONTA_RECEBER", contaReceberId: 1, dataMovimento: "2026-10-06", dataCriacao: "2026-10-06T11:00:00",
    usuarioNome: "Gestora", estornada: false, observacao: null, ...extras });
const resumo = { vencidas: { total: 120, quantidade: 2 }, seteDias: { total: 100, quantidade: 1 },
    trintaDias: { total: 210, quantidade: 3 }, emAberto: { total: 330, quantidade: 5 }, recebidasMes: { total: 60, quantidade: 2 } };

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-contas-receber-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "contas-receber-fixture",
            resolveId(id) { if (id === "/receber-fixture.js") return "\0receber-fixture.js"; },
            load(id) { if (id === "\0receber-fixture.js") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {BrowserRouter} from 'react-router-dom'; import {ThemeProvider,CssBaseline} from '@mui/material';
                import theme from '/src/theme/theme.ts'; import AppRoutes from '/src/routes/AppRoutes.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
                    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!["/financeiro/contas-receber", "/dashboard"].includes(req.url.split("?")[0])) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/receber-fixture.js"></script>'));
            }); },
        }],
    });
    ({ default: api } = await server.ssrLoadModule("/src/services/api.ts"));
    service = await server.ssrLoadModule("/src/services/contaReceberService.ts");
    utils = await server.ssrLoadModule("/src/pages/Financeiro/contaReceberUtils.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function esperar(fn) {
    for (let i = 0; i < 160 && !fn(); i++) await new Promise(r => setTimeout(r, 25));
    assert.ok(fn(), "Request esperado não chegou");
}
async function abrir(extras = {}, viewport = { width: 1440, height: 1000 }) {
    const estado = { conta: conta(1, extras), requests: [], falhaBaixa: false, falhaAcao: false, keys: new Set(), falhaStatus: 503 };
    const page = await browser.newPage({ viewport }); page.setDefaultTimeout(10000);
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "teste", perfil: "ADMIN", usuarioId: 2,
        nome: "Gestora", empresa: { id: 1, nomeFantasia: "Loja de teste" } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const params = Object.fromEntries(u.searchParams), body = req.postDataJSON();
        estado.requests.push({ method: req.method(), path: u.pathname, params, body });
        let data, status = 200;
        if (u.pathname === `${base}/pagina`) data = { items: [{ ...estado.conta, recebimentos: [] }], page: Number(params.page),
            size: Number(params.size), totalItems: 63, totalPages: 3 };
        else if (u.pathname === `${base}/resumo`) data = resumo;
        else if (u.pathname === "/clientes/buscar") {
            if (params.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            data = [{ ...cliente, nome: params.termo === "antiga" ? "Resposta antiga" : "Cliente remoto", ativo: params.termo !== "historico" }];
        } else if (u.pathname === "/clientes/8") data = cliente;
        else if (u.pathname === "/financeiro/contas-financeiras/pagina") data = { items: [params.termo === "Secundário"
            ? { ...banco, id: 4, nome: "Banco secundário" } : banco], page: 0, size: 10, totalItems: 1, totalPages: 1 };
        else if (u.pathname === base && req.method() === "POST") { data = { ...conta(2), ...body }; }
        else if (u.pathname === `${base}/1` && req.method() === "PUT") { estado.conta = { ...estado.conta, ...body }; data = estado.conta; }
        else if (u.pathname === `${base}/1`) data = estado.conta;
        else if (u.pathname === `${base}/1/receber`) {
            if (estado.falhaBaixa && estado.falhaBaixa !== "aposCommit") { status = estado.falhaStatus; data = { detail: "Resposta temporariamente indisponível." }; }
            else if (estado.keys.has(body.chaveRequisicao)) data = estado.conta;
            else { const recebidos = estado.conta.valorRecebido + body.valor;
                estado.keys.add(body.chaveRequisicao);
                estado.conta = { ...estado.conta, valorRecebido: recebidos, saldo: 100 - recebidos,
                    status: recebidos === 100 ? "RECEBIDA" : "PARCIAL",
                    recebimentos: [...estado.conta.recebimentos, movimento(estado.conta.recebimentos.length + 10, body.valor,
                        { contaFinanceiraId: body.contaFinanceiraId })] }; data = estado.conta;
                if (estado.falhaBaixa === "aposCommit") { status = 503; data = { detail: "Resposta temporariamente indisponível." }; }
            }
        } else if (/\/recebimentos\/\d+\/estornar$/.test(u.pathname)) {
            if (estado.falhaAcao) { status = 409; data = { detail: "Saldo insuficiente para estornar." }; }
            else { const id = Number(u.pathname.split("/").at(-2)); const m = estado.conta.recebimentos.find(m => m.id === id);
                estado.conta = { ...estado.conta, valorRecebido: estado.conta.valorRecebido - m.valor,
                    saldo: estado.conta.saldo + m.valor, status: estado.conta.valorRecebido - m.valor === 0 ? "PENDENTE" : "PARCIAL",
                    recebimentos: estado.conta.recebimentos.map(mov => mov.id === id ? { ...mov, estornada: true, motivoEstorno: body.motivoEstorno,
                        dataEstorno: "2026-10-06T12:00:00", usuarioEstornoNome: "Gestora" } : mov) }; data = estado.conta; }
        } else if (u.pathname === `${base}/1/cancelar`) { estado.conta = { ...estado.conta, status: "CANCELADA" }; data = estado.conta; }
        else if (u.pathname === "/dashboard/resumo") data = { faturamentoHoje: 420, quantidadeVendasHoje: 6, ticketMedioHoje: 70,
            quantidadeProdutosEstoqueBaixo: 0, quantidadeClientesAtivos: 15, sessoesCaixaAbertas: [] };
        else if (u.pathname === "/vendas") data = { items: [], page: 0, size: 5, totalItems: 0, totalPages: 0 };
        else if (u.pathname === "/estoque") data = { items: [], page: 0, size: 5, totalItems: 0, totalPages: 0 };
        else { status = 404; data = { detail: `HTTP inesperado: ${u.pathname}` }; }
        await route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${url}/financeiro/contas-receber`);
    await page.getByRole("cell", { name: estado.conta.descricao, exact: true }).waitFor();
    return { page, estado, errors };
}
const chamadas = (e, path) => e.requests.filter(r => r.path === path);
async function detalhe(page) { await page.getByRole("button", { name: "Consultar histórico", exact: true }).click(); await page.getByText("Histórico de recebimentos", { exact: true }).waitFor(); }
async function abrirBaixa(page) { await page.getByRole("button", { name: "Receber", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Receber conta" }).waitFor(); }
async function escolherDestino(page) { const campo = page.getByRole("combobox", { name: "Conta de destino" });
    await campo.fill("Banco"); await page.getByRole("option", { name: banco.nome, exact: true }).click(); }

test("services usam contrato real, paginação, detalhe, resumo e estorno específico sem tenant no payload", async () => {
    globalThis.localStorage = { getItem: () => JSON.stringify({ token: "jwt", empresa: { id: 1 } }) };
    const requests = []; api.defaults.adapter = async config => { requests.push(config); return { config, data: {}, status: 200, statusText: "OK", headers: {} }; };
    const params = { page: 2, size: 25, sort: "dataVencimento,desc", clienteId: 8, termo: "Maria", status: "PARCIAL", vencimentoDe: "2026-10-01" };
    const signal = new AbortController().signal;
    await service.listarContasReceber(params, signal); await service.resumirContasReceber(signal); await service.buscarContaReceber(1, signal);
    const input = { clienteId: 8, descricao: "Conta", valorOriginal: 100, dataEmissao: null, dataVencimento: "2026-10-20", numeroParcela: 1, totalParcelas: 1, observacao: null };
    await service.salvarContaReceber(input); await service.salvarContaReceber(input, 1);
    await service.receberConta(1, { contaFinanceiraId: 3, valor: 40, dataRecebimento: "2026-10-06", observacao: null, chaveRequisicao: "uuid" });
    await service.estornarRecebimentoConta(1, 10, "Correção"); await service.cancelarContaReceber(1);
    assert.deepEqual(requests.map(r => [r.method, r.url]), [["get", `${base}/pagina`], ["get", `${base}/resumo`], ["get", `${base}/1`],
        ["post", base], ["put", `${base}/1`], ["post", `${base}/1/receber`], ["post", `${base}/1/recebimentos/10/estornar`], ["post", `${base}/1/cancelar`]]);
    assert.deepEqual(requests[0].params, params); assert.equal(requests[0].signal, signal);
    assert.deepEqual(JSON.parse(requests[6].data), { motivoEstorno: "Correção" });
    assert.ok(requests.every(r => r.headers.Authorization === "Bearer jwt" && !/empresaId|tenantId|vendaId/.test(r.data ?? "")));
});
test("valida valores e elegibilidade pelo detalhe, incluindo histórico totalmente estornado", () => {
    for (const v of ["0", "-1", "1,001", "", "abc"]) assert.equal(utils.valorMonetario(v), null);
    assert.equal(utils.valorMonetario("40,50"), 40.5); assert.equal(utils.podeEditarConta(conta()), true);
    assert.equal(utils.podeEditarConta(conta(1, { recebimentos: [movimento(10, 100, { estornada: true })] })), false);
    assert.equal(utils.podeCancelarConta(conta()), true);
    assert.equal(utils.podeCancelarConta(conta(1, { origem: "VENDA_A_PRAZO", vendaId: 123 })), false);
    assert.equal(utils.podeEditarConta(conta(1, { origem: "VENDA_A_PRAZO", vendaId: 123 })), false);
    assert.equal(utils.podeCancelarConta(conta(1, { valorRecebido: 40, status: "PARCIAL" })), false);
    assert.equal(utils.podeReceberConta(conta(1, { status: "RECEBIDA", saldo: 0 })), false);
});

test("link da Central abre a parcela da venda sem permitir editar ou cancelar individualmente", async () => {
    const { page } = await abrir({ origem: "VENDA_A_PRAZO", vendaId: 123 });
    try {
        await page.goto(`${url}/financeiro/contas-receber?contaId=1`);
        const detalhe = page.getByRole("dialog", { name: "Conta a receber #1", exact: true });
        await detalhe.waitFor();
        assert.equal(await detalhe.getByRole("button", { name: "Editar", exact: true }).count(), 0);
        assert.equal(await detalhe.getByRole("button", { name: "Cancelar conta", exact: true }).count(), 0);
    } finally { await page.close(); }
});
test("listagem/resumo reais, filtro remoto com inativos, sort e paginação server-side", async () => {
    const { page, estado } = await abrir(); try {
        assert.equal(chamadas(estado, "/clientes/opcoes").length, 0); assert.equal(chamadas(estado, "/clientes/buscar").length, 0);
        assert.deepEqual(chamadas(estado, `${base}/pagina`)[0].params, { page: "0", size: "25", sort: "dataVencimento,asc" });
        await page.getByRole("button", { name: "Próxima página" }).click(); await esperar(() => chamadas(estado, `${base}/pagina`).at(-1).params.page === "1");
        const c = page.getByRole("combobox", { name: "Cliente", exact: true }); await c.fill("hi"); await page.waitForTimeout(100); await c.fill("historico");
        await page.getByRole("option", { name: /Cliente remoto.*inativo/ }).click();
        await esperar(() => chamadas(estado, `${base}/pagina`).at(-1).params.clienteId === "8");
        assert.equal(chamadas(estado, `${base}/pagina`).at(-1).params.page, "0");
        assert.equal(chamadas(estado, "/clientes/buscar").at(-1).params.incluirInativos, "true");
        await page.getByRole("textbox", { name: "Buscar descrição, cliente ou documento", exact: true }).fill("outubro");
        await esperar(() => chamadas(estado, `${base}/pagina`).at(-1).params.termo === "outubro");
        await page.getByRole("combobox", { name: "Status", exact: true }).click(); await page.getByRole("option", { name: "Parcial", exact: true }).click();
        await page.getByLabel("Vencimento de", { exact: true }).fill("2026-10-01");
        await esperar(() => chamadas(estado, `${base}/pagina`).at(-1).params.vencimentoDe === "2026-10-01");
        await page.getByRole("button", { name: "Vencimento", exact: true }).click();
        await esperar(() => chamadas(estado, `${base}/pagina`).at(-1).params.sort === "dataVencimento,desc");
        assert.equal(chamadas(estado, `${base}/pagina`).at(-1).params.status, "PARCIAL");
        await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
        await esperar(() => !chamadas(estado, `${base}/pagina`).at(-1).params.clienteId);
        assert.equal(await page.getByText("1–25 de 63", { exact: true }).count(), 1);
    } finally { await page.close(); }
});
test("resposta antiga de cliente não sobrescreve a busca nova", async () => {
    const { page, estado } = await abrir(); try {
        const c = page.getByRole("combobox", { name: "Cliente", exact: true }); await c.fill("antiga");
        await esperar(() => chamadas(estado, "/clientes/buscar").some(r => r.params.termo === "antiga"));
        await c.fill("nova"); await page.getByRole("option", { name: /Cliente remoto/ }).waitFor(); await page.waitForTimeout(1100);
        assert.equal(await page.getByRole("option", { name: /Resposta antiga/ }).count(), 0);
    } finally { await page.close(); }
});
test("cadastro manual e edição antes de baixa usam cliente remoto e campos reais", async () => {
    const { page, estado } = await abrir(); try {
        await page.getByRole("button", { name: "Nova conta", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Nova conta a receber" });
        await dialog.getByRole("combobox", { name: "Cliente *", exact: true }).fill("Maria");
        await page.getByRole("option", { name: /Cliente remoto/ }).click();
        await dialog.getByRole("textbox", { name: "Descrição", exact: true }).fill("Serviço manual");
        await dialog.getByRole("textbox", { name: "Valor original (R$)", exact: true }).fill("100,00");
        await dialog.getByLabel("Vencimento").fill("2026-10-20");
        await dialog.getByRole("button", { name: "Salvar", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
        assert.deepEqual(chamadas(estado, base)[0].body, { clienteId: 8, descricao: "Serviço manual", valorOriginal: 100,
            dataEmissao: null, dataVencimento: "2026-10-20", numeroParcela: 1, totalParcelas: 1, observacao: null });
        assert.equal(chamadas(estado, "/financeiro/movimentacoes-financeiras").length, 0);
        await detalhe(page); await page.getByRole("button", { name: "Editar", exact: true }).click();
        const edicao = page.getByRole("dialog", { name: "Editar conta a receber" });
        await edicao.getByRole("textbox", { name: "Descrição", exact: true }).fill("Descrição revisada");
        await edicao.getByRole("button", { name: "Salvar", exact: true }).click(); await edicao.waitFor({ state: "hidden" });
        assert.equal(chamadas(estado, `${base}/1`).find(r => r.method === "PUT").body.descricao, "Descrição revisada");
    } finally { await page.close(); }
});
test("duas baixas preservam histórico, usam saldo parcial e atualizam listagem/resumo/detalhe", async () => {
    const { page, estado } = await abrir(); try {
        await abrirBaixa(page); await escolherDestino(page);
        await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).fill("40");
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        await page.getByRole("dialog", { name: "Receber conta" }).waitFor({ state: "hidden" });
        await page.getByRole("cell", { name: "Parcial", exact: true }).waitFor();
        const primeiro = chamadas(estado, `${base}/1/receber`)[0].body;
        assert.equal(primeiro.valor, 40); assert.equal(primeiro.contaFinanceiraId, 3); assert.match(primeiro.chaveRequisicao, /^[0-9a-f-]{36}$/);
        assert.ok(!Object.hasOwn(primeiro, "empresaId"));
        await abrirBaixa(page); assert.equal(await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).inputValue(), "60");
        await page.getByRole("combobox", { name: "Conta de destino" }).fill("Secundário");
        await page.getByRole("option", { name: "Banco secundário", exact: true }).click();
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        await page.getByRole("dialog", { name: "Receber conta" }).waitFor({ state: "hidden" });
        await page.getByRole("cell", { name: "Recebida", exact: true }).waitFor();
        assert.equal(estado.conta.recebimentos.length, 2); assert.notEqual(chamadas(estado, `${base}/1/receber`)[1].body.chaveRequisicao, primeiro.chaveRequisicao);
        assert.equal(chamadas(estado, `${base}/1/receber`)[1].body.contaFinanceiraId, 4);
        assert.ok(chamadas(estado, `${base}/resumo`).length >= 3);
        await detalhe(page); assert.equal(await page.getByRole("button", { name: "Estornar recebimento", exact: true }).count(), 2);
        assert.equal(await page.getByRole("button", { name: "Editar", exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: "Cancelar conta", exact: true }).count(), 0);
    } finally { await page.close(); }
});
test("recebimento inválido bloqueia envio e retry após 503/reload conserva UUID e payload", async () => {
    const { page, estado } = await abrir(); try {
        await abrirBaixa(page); await escolherDestino(page);
        await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).fill("101");
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        assert.equal(chamadas(estado, `${base}/1/receber`).length, 0);
        estado.falhaBaixa = "aposCommit"; await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).fill("40");
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).dblclick();
        await page.getByText("Resposta temporariamente indisponível.", { exact: true }).waitFor();
        assert.equal(chamadas(estado, `${base}/1/receber`).length, 1);
        const payload = chamadas(estado, `${base}/1/receber`)[0].body;
        assert.equal(await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).isDisabled(), true);
        await page.reload(); await page.getByRole("cell", { name: estado.conta.descricao, exact: true }).waitFor(); await abrirBaixa(page);
        assert.equal(await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).inputValue(), "40");
        estado.falhaBaixa = false; await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await page.getByRole("dialog", { name: "Receber conta" }).waitFor({ state: "hidden" });
        assert.deepEqual(chamadas(estado, `${base}/1/receber`)[1].body, payload);
        assert.equal(estado.conta.valorRecebido, 40); assert.equal(estado.conta.recebimentos.length, 1);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("novexa-recebimento:1:1")), null);
    } finally { await page.close(); }
});
test("erros 403/409 permanecem no dialog sem falso sucesso e liberam correção dos dados", async () => {
    const { page, estado } = await abrir(); try {
        await abrirBaixa(page); await escolherDestino(page); estado.falhaBaixa = true; estado.falhaStatus = 403;
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        await page.getByText("Você não tem permissão para realizar esta operação.", { exact: true }).waitFor();
        assert.equal(await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).isDisabled(), false);
        estado.falhaStatus = 409; await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        await page.getByText("Resposta temporariamente indisponível.", { exact: true }).waitFor();
        assert.equal(estado.conta.valorRecebido, 0); assert.equal(await page.getByText("Recebimento registrado.", { exact: true }).count(), 0);
    } finally { await page.close(); }
});
test("tentativa antiga já estornada não é reutilizada para um novo recebimento", async () => {
    const key = "2fafcddb-ae80-4d13-880c-b6ea1e4a6a61";
    const { page, estado } = await abrir({ recebimentos: [movimento(10, 100, { estornada: true, chaveRequisicao: key })] });
    try {
        await page.evaluate(({ key, banco }) => sessionStorage.setItem("novexa-recebimento:1:1", JSON.stringify({ destino: banco,
            dados: { contaFinanceiraId: 3, valor: 100, dataRecebimento: "2026-10-06", observacao: null, chaveRequisicao: key } })), { key, banco });
        await abrirBaixa(page); await escolherDestino(page);
        assert.equal(await page.getByRole("textbox", { name: "Valor recebido (R$)", exact: true }).isDisabled(), false);
        await page.getByRole("button", { name: "Confirmar recebimento", exact: true }).click();
        await page.getByRole("dialog", { name: "Receber conta" }).waitFor({ state: "hidden" });
        assert.notEqual(chamadas(estado, `${base}/1/receber`)[0].body.chaveRequisicao, key);
    } finally { await page.close(); }
});
test("estorno identifica baixa, exige motivo, mostra conflito e preserva histórico", async () => {
    const { page, estado } = await abrir({ valorRecebido: 100, saldo: 0, status: "RECEBIDA", recebimentos: [movimento(10, 40), movimento(11, 60)] });
    try {
        await detalhe(page); await page.getByRole("button", { name: "Estornar recebimento", exact: true }).last().click();
        const dialog = page.getByRole("dialog", { name: "Estornar recebimento?" });
        await dialog.getByRole("button", { name: "Estornar recebimento", exact: true }).click();
        assert.equal(chamadas(estado, `${base}/1/recebimentos/11/estornar`).length, 0);
        await dialog.getByRole("textbox", { name: "Motivo do estorno", exact: true }).fill("Correção do recebimento");
        estado.falhaAcao = true; await dialog.getByRole("button", { name: "Estornar recebimento", exact: true }).click();
        await dialog.getByText("Saldo insuficiente para estornar.", { exact: true }).waitFor();
        estado.falhaAcao = false; await dialog.getByRole("button", { name: "Estornar recebimento", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
        await page.getByText("Estornado", { exact: true }).waitFor(); assert.equal(estado.conta.valorRecebido, 40);
        assert.equal(estado.conta.recebimentos.length, 2); assert.equal(estado.conta.status, "PARCIAL");
        assert.equal(chamadas(estado, `${base}/1/recebimentos/11/estornar`)[0].body.motivoEstorno, "Correção do recebimento");
    } finally { await page.close(); }
});
test("histórico totalmente estornado não permite edição, mas permite cancelamento sem apagar baixas", async () => {
    const { page, estado } = await abrir({ recebimentos: [movimento(10, 100, { estornada: true })] }); try {
        await detalhe(page); assert.equal(await page.getByRole("button", { name: "Editar", exact: true }).count(), 0);
        await page.getByRole("button", { name: "Cancelar conta", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Cancelar conta?" });
        await dialog.getByRole("button", { name: "Cancelar conta", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
        assert.equal(chamadas(estado, `${base}/1/cancelar`).length, 1); assert.equal(estado.conta.recebimentos.length, 1);
        assert.equal(await page.getByRole("button", { name: "Cancelar conta", exact: true }).count(), 0);
        await page.getByRole("button", { name: "Fechar detalhe", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Receber", exact: true }).last().isDisabled(), true);
    } finally { await page.close(); }
});
test("tela cancelada permanece consultável e não permite operações", async () => {
    const { page } = await abrir({ status: "CANCELADA" }); try {
        await detalhe(page);
        assert.equal(await page.getByRole("button", { name: "Editar", exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: "Cancelar conta", exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: "Estornar recebimento", exact: true }).count(), 0);
    } finally { await page.close(); }
});
test("desktop/mobile seguem identidade atual sem overflow; screenshot comparativo com Dashboard", async () => {
    await mkdir("node_modules/.cache/contas-receber", { recursive: true });
    for (const width of [1440, 390]) {
        const { page, errors } = await abrir({}, { width, height: 1000 }); try {
            assert.equal(await page.getByRole("link", { name: /Contas a Receber/ }).count(), 1);
            const estilos = await page.locator("[data-app-table]").evaluate(el => { const s = getComputedStyle(el); return { raio: s.borderRadius, fundo: s.backgroundColor }; });
            assert.equal(estilos.raio, "0px 0px 10px 10px"); assert.equal(estilos.fundo, "rgb(255, 255, 255)");
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            await page.screenshot({ path: `node_modules/.cache/contas-receber/contas-${width}.png`, fullPage: true });
            await page.getByRole("button", { name: "Nova conta", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Nova conta a receber" });
            const bounds = await dialog.boundingBox(); assert.ok(bounds.width <= width);
            await page.waitForTimeout(350);
            await page.screenshot({ path: `node_modules/.cache/contas-receber/cadastro-${width}.png`, fullPage: true });
            await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
            await page.goto(`${url}/dashboard`); await page.getByText("Faturamento hoje", { exact: true }).waitFor();
            await page.screenshot({ path: `node_modules/.cache/contas-receber/dashboard-${width}.png`, fullPage: true });
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    }
});
test("review estático: HTTP só no service, sem filtro/paginação local ou integrações Venda/PDV", async () => {
    const page = await readFile(new URL("../src/pages/Financeiro/ContasReceber.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(page, /\.filter\(|\.sort\(|\.slice\(|listarClientes\(|listarContasFinanceiras\(|axios|vendaService|size:\s*(100|500)/);
    assert.match(page, /ordenacaoRemota/); assert.match(page, /setTotalItems\(r.totalItems\)/);
    const baixa = await readFile(new URL("../src/pages/Financeiro/ContaReceberBaixaDialog.tsx", import.meta.url), "utf8");
    assert.match(baixa, /useRemoteSearch/); assert.match(baixa, /size: 10/); assert.match(baixa, /crypto.randomUUID/);
});
test("drawer/histórico e baixa mobile mantêm scroll e nomes longos sem overflow", async () => {
    const { page } = await abrir({ descricao: "X".repeat(180), cliente: { ...cliente, nome: "Y".repeat(100) },
        recebimentos: [movimento(10, 40)] }, { width: 390, height: 840 });
    try {
        await detalhe(page); await page.waitForTimeout(350);
        const drawer = page.getByRole("dialog", { name: "Conta a receber #1", exact: true });
        assert.ok(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        await page.screenshot({ path: "node_modules/.cache/contas-receber/historico-390.png" });
        await page.getByRole("button", { name: "Receber", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Receber conta" }); await dialog.waitFor(); await page.waitForTimeout(350);
        assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        await page.screenshot({ path: "node_modules/.cache/contas-receber/baixa-390.png" });
    } finally { await page.close(); }
});
