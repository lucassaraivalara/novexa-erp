import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
const conta = {id: 5, nome: "Banco Teste", tipo: "BANCO", ativo: true, saldoAtual: 100};
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';
import {BrowserRouter} from 'react-router-dom';
import FormasPagamento from '/src/pages/Financeiro/FormasPagamento.tsx';
import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(FormasPagamento))));
`;
before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-configuracao-cartao-tests",
        server: {host: "127.0.0.1", port: 0, hmr: false},
        plugins: [{
            name: "configuracao-cartao-fixture",
            resolveId(id) { if (id === "/cartao-fixture.js") return "\0cartao-fixture.js"; },
            load(id) { if (id === "\0cartao-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use(async (req, res, next) => {
                    if (req.url !== "/configuracoes") return next();
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/cartao-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless: true});
});
after(async () => { await browser?.close(); await server?.close(); });

async function withEditor(run, options = {}) {
    const page = await browser.newPage({viewport: {width: 1440, height: 960}});
    page.setDefaultTimeout(5000);
    const requests = [];
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({token: "test", empresa: {id: 7}})));
    await page.route("**/financeiro/contas-financeiras", route => route.fulfill({
        status: options.accountError ? 500 : 200,
        json: options.accountError ? "Falha ao consultar contas." : options.contas ?? [conta, {...conta, id: 6, tipo: "CAIXA"}, {...conta, id: 8, nome: "Conta inativa", ativo: false}],
    }));
    await page.route("**/financeiro/configuracoes-formas-pagamento**", async route => {
        const request = route.request();
        if (request.method() === "GET") return route.fulfill({json: options.config ? [options.config] : []});
        const payload = request.postDataJSON();
        requests.push({method: request.method(), path: new URL(request.url()).pathname, payload, auth: request.headers().authorization});
        await route.fulfill(options.apiError ? {status: 409, json: options.apiError} : {json: {
            ...payload, id: options.config?.id ?? 42,
            tipo: ["", "DINHEIRO", "PIX", "DEBITO", "CREDITO", "BOLETO", "TRANSFERENCIA"][payload.formaPagamentoId],
            contaFinanceiraDestino: payload.contaFinanceiraDestinoId ? conta : null,
        }});
    });
    try {
        await page.goto(`${url}/configuracoes`);
        if (options.config) await page.getByRole("button", {name: "Editar configuração de pagamento"}).click();
        else await page.getByRole("button", {name: "Nova Configuração", exact: true}).click();
        await page.getByRole("dialog").waitFor();
        await run(page, requests);
    } finally { await page.close(); }
}
const tipo = page => page.getByRole("combobox", {name: /Tipo \/ Forma de pagamento/});
const destino = page => page.getByRole("combobox", {name: /Conta Financeira de destino/});
async function selecionar(page, campo, texto) {
    await campo.click();
    await page.getByRole("option", {name: texto, exact: true}).click();
}
async function salvar(page, editando = false) {
    await page.getByRole("button", {name: editando ? "Atualizar" : "Criar", exact: true}).click();
}
function assertPayload(request, forma, id, ativo = true, taxas = {}) {
    assert.deepEqual(request.payload, {nomeExibicao: "Config teste", formaPagamentoId: forma, ativo,
        contaFinanceiraDestinoId: id, ...taxas});
    assert.equal(request.auth, "Bearer test");
    assert.deepEqual(Object.keys(request.payload).sort(), Object.keys({nomeExibicao: "", formaPagamentoId: 1,
        ativo: true, contaFinanceiraDestinoId: null, ...taxas}).sort());
}
function legado(ativo = true) {
    return {id: 20, nomeExibicao: "Config teste", formaPagamentoId: 3, tipo: "DEBITO", ativo,
        contaFinanceiraDestino: null, taxaPercentual: null, taxaFixa: null, prazoRecebimentoDias: null};
}

test("DINHEIRO salva sem destino nem tenant no payload", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    assert.equal(await destino(page).count(), 0);
    assert.equal(await page.getByLabel("Taxa percentual (%)").count(), 0);
    await salvar(page);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 1, null);
}));

for (const [nome, id] of [["Débito", 3], ["Crédito", 4]]) {
    test(`${nome} exige destino e envia ID selecionado em POST`, () => withEditor(async (page, requests) => {
        await page.getByLabel("Nome de exibição").fill("Config teste");
        await selecionar(page, tipo(page), nome);
        const percentual = page.getByLabel("Taxa percentual (%)");
        const fixa = page.getByLabel("Taxa fixa (R$)");
        const prazo = page.getByLabel("Prazo de recebimento (dias)");
        await percentual.waitFor();
        assert.equal(await percentual.inputValue(), "0");
        assert.equal(await fixa.inputValue(), "0");
        assert.equal(await prazo.inputValue(), "0");
        await salvar(page);
        await page.getByText("A conta financeira de destino é obrigatória para este tipo.").waitFor();
        assert.equal(requests.length, 0);
        await destino(page).click();
        assert.equal(await page.getByRole("option", {name: /Conta inativa|Caixa/}).count(), 0);
        await page.getByRole("option", {name: "Banco Teste — Banco", exact: true}).click();
        await percentual.fill("2.5");
        await fixa.fill("0.5");
        await prazo.fill("30");
        await salvar(page);
        await page.getByText("Configuração salva com sucesso.").waitFor();
        assertPayload(requests[0], id, 5, true, {taxaPercentual: 2.5, taxaFixa: 0.5, prazoRecebimentoDias: 30});
    }));
}

test("valida taxa percentual, taxa fixa e prazo de cartão sem enviar payload inválido", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    await selecionar(page, tipo(page), "Crédito");
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await page.getByLabel("Taxa percentual (%)").fill("100.1");
    await page.getByLabel("Taxa fixa (R$)").fill("-1");
    await page.getByLabel("Prazo de recebimento (dias)").fill("1.5");
    await salvar(page);
    await page.getByText("A taxa percentual não pode ultrapassar 100%.").waitFor();
    await page.getByText("A taxa fixa não pode ser negativa.").waitFor();
    await page.getByText("O prazo deve ser um número inteiro.").waitFor();
    assert.equal(requests.length, 0);
}));

test("edição carrega e preserva valores existentes de cartão", () => withEditor(async (page, requests) => {
    assert.equal(await page.getByLabel("Taxa percentual (%)").inputValue(), "2.5");
    assert.equal(await page.getByLabel("Taxa fixa (R$)").inputValue(), "0.75");
    assert.equal(await page.getByLabel("Prazo de recebimento (dias)").inputValue(), "45");
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, 5, true, {taxaPercentual: 2.5, taxaFixa: 0.75, prazoRecebimentoDias: 45});
}, {config: {...legado(), contaFinanceiraDestino: conta,
    taxaPercentual: 2.5, taxaFixa: 0.75, prazoRecebimentoDias: 45}}));

test("edição legada mantém snapshots nulos em branco e os omite do payload", () => withEditor(async (page, requests) => {
    assert.equal(await page.getByLabel("Taxa percentual (%)").inputValue(), "");
    assert.equal(await page.getByLabel("Taxa fixa (R$)").inputValue(), "");
    assert.equal(await page.getByLabel("Prazo de recebimento (dias)").inputValue(), "");
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, 5);
    assert.equal("taxaPercentual" in requests[0].payload, false);
    assert.equal("taxaFixa" in requests[0].payload, false);
    assert.equal("prazoRecebimentoDias" in requests[0].payload, false);
}, {config: {...legado(), contaFinanceiraDestino: conta}}));

test("Troca de cartão para dinheiro limpa destino e não reutiliza ao voltar", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    await selecionar(page, tipo(page), "Crédito");
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await page.getByLabel("Taxa percentual (%)").fill("2.5");
    await selecionar(page, tipo(page), "Dinheiro");
    assert.equal(await page.getByLabel("Taxa percentual (%)").count(), 0);
    await selecionar(page, tipo(page), "Débito");
    assert.equal(await destino(page).textContent(), "\u200b");
    await salvar(page);
    await page.getByText("A conta financeira de destino é obrigatória para este tipo.").waitFor();
    await selecionar(page, tipo(page), "Dinheiro");
    await salvar(page);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 1, null);
}));

test("Cartão legado é legível e regularizado explicitamente via PUT", () => withEditor(async (page, requests) => {
    await page.getByText("Pendente de regularização", {exact: true}).waitFor();
    await page.getByRole("alert").filter({hasText: "não possui conta financeira"}).waitFor();
    assert.equal(await tipo(page).getAttribute("aria-disabled"), "true");
    await salvar(page, true);
    await page.getByText("A conta financeira de destino é obrigatória para este tipo.").waitFor();
    assert.equal(requests.length, 0);
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, 5);
    assert.equal(requests[0].method, "PUT");
    assert.equal(requests[0].path, "/financeiro/configuracoes-formas-pagamento/20");
}, {config: legado()}));

test("Cartão legado pode ser inativado sem backfill", () => withEditor(async (page, requests) => {
    await page.getByRole("checkbox", {name: "Configuração ativa"}).uncheck();
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, null, false);
}, {config: legado()}));

test("Reativação de cartão legado exige regularização", () => withEditor(async (page, requests) => {
    await page.getByRole("checkbox", {name: "Configuração ativa"}).check();
    await salvar(page, true);
    await page.getByText("A conta financeira de destino é obrigatória para este tipo.").waitFor();
    assert.equal(requests.length, 0);
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, 5);
}, {config: legado(false)}));

test("Destino histórico inativo continua visível e pode ser mantido", () => withEditor(async (page, requests) => {
    await destino(page).getByText("Banco Teste — Inativa (vínculo atual)").waitFor();
    await salvar(page, true);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 3, 5);
}, {config: {...legado(), contaFinanceiraDestino: {...conta, ativo: false}}, contas: []}));

test("Sem contas disponíveis orienta cadastro sem escolher destino", () => withEditor(async page => {
    await selecionar(page, tipo(page), "Débito");
    await page.getByRole("alert").filter({hasText: "Cadastre uma Conta Financeira"}).waitFor();
    assert.equal(await destino(page).textContent(), "\u200b");
}, {contas: []}));

test("PIX preserva conta de destino e omite valores exclusivos de cartão", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    await selecionar(page, tipo(page), "PIX");
    assert.equal(await page.getByLabel("Taxa percentual (%)").count(), 0);
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await salvar(page);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 2, 5);
}, {contas: [conta]}));

test("Falha de carregamento é diferente de ausência de contas", () => withEditor(async page => {
    await selecionar(page, tipo(page), "Crédito");
    await page.getByRole("alert").filter({hasText: "Falha ao consultar contas."}).waitFor();
    assert.equal(await page.getByText(/Nenhuma conta financeira ativa/).count(), 0);
}, {accountError: true}));

test("Erros da API preservam mensagem, seleção e formulário", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    await selecionar(page, tipo(page), "Crédito");
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await salvar(page);
    await page.getByRole("alert").filter({hasText: "Conta financeira de destino inativa."}).waitFor();
    assert.equal(await destino(page).textContent(), "Banco Teste — Banco");
    assertPayload(requests[0], 4, 5, true, {taxaPercentual: 0, taxaFixa: 0, prazoRecebimentoDias: 0});
}, {apiError: "Conta financeira de destino inativa."}));

test("PIX/Transferência conservam destino obrigatório e Boleto não envia residual", () => withEditor(async (page, requests) => {
    await page.getByLabel("Nome de exibição").fill("Config teste");
    for (const nome of ["PIX", "Transferência"]) {
        await selecionar(page, tipo(page), nome);
        await salvar(page);
        await page.getByText("A conta financeira de destino é obrigatória para este tipo.").waitFor();
        assert.equal(requests.length, 0);
    }
    await selecionar(page, destino(page), "Banco Teste — Banco");
    await selecionar(page, tipo(page), "Boleto");
    assert.equal(await destino(page).count(), 0);
    await salvar(page);
    await page.getByText("Configuração salva com sucesso.").waitFor();
    assertPayload(requests[0], 5, null);
}));
