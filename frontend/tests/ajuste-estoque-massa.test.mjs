import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let vite, browser, base;
before(async () => {
    const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {CssBaseline} from '@mui/material';import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';import Ajuste from '/src/pages/Estoque/AjusteEstoqueMassa.tsx';window.atualizacoes=0;createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(Ajuste,{onConcluido:()=>window.atualizacoes++})));`;
    vite = await createServer({ optimizeDeps: { entries: ["src/pages/Estoque/AjusteEstoqueMassa.tsx"], include: ["react", "react-dom/client"] }, cacheDir: "node_modules/.vite-ajuste-massa", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "ajuste-massa-fixture",
            resolveId(id) { if (id === "/ajuste-massa.js") return "\0ajuste-massa.js"; },
            load(id) { if (id === "\0ajuste-massa.js") return fixture; },
            configureServer(server) { server.middlewares.use("/__ajuste-massa", async (_, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await server.transformIndexHtml("/__ajuste-massa", '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/ajuste-massa.js"></script>'));
            }); },
        }],
    });
    await vite.listen(); base = `http://127.0.0.1:${vite.httpServer.address().port}/__ajuste-massa`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await vite?.close(); });

const produtos = [{ id: 1, nome: "Produto A", codigoInterno: "001", ativo: true, controlaEstoque: true, composto: false, estoqueAtual: 10 },
    { id: 2, nome: "Produto B", codigoInterno: "002", ativo: true, controlaEstoque: true, composto: false, estoqueAtual: 20 }];
async function ambiente(t, options = {}) {
    const catalogo = options.catalogo ?? produtos;
    const page = await browser.newPage({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    t.after(() => page.close());
    await page.addInitScript(mode => localStorage.setItem("novexa-theme-choice", mode), options.theme ?? "light");
    const pedidos = [], buscas = [], erros = [];
    page.on("pageerror", e => erros.push(e.message));
    await page.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({ token: "fixture", perfil, id: 1, empresa: { id: 1 } })), options.perfil ?? "ADMIN");
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), url = new URL(req.url());
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        assert.equal(req.headers().authorization, "Bearer fixture");
        let data, status = 200;
        if (url.pathname === "/produtos") {
            buscas.push(Object.fromEntries(url.searchParams));
            data = { items: catalogo, page: 0, size: 10, totalItems: catalogo.length, totalPages: 1 };
        } else if (url.pathname.startsWith("/estoque/movimentacoes/produto/")) {
            pedidos.push({ path: url.pathname, params: Object.fromEntries(url.searchParams) });
            data = { items: [{ id: 90, produtoId: 1, produtoNome: "Produto A", tipo: "AJUSTE", origem: "AJUSTE", quantidade: 2,
                saldoAnterior: 10, saldoPosterior: 12, motivo: "Contagem anterior", dataHora: "2026-10-27T12:00:00-03:00", usuarioId: 1, nomeUsuario: "Admin" }],
                page: Number(url.searchParams.get("page") ?? 0), size: Number(url.searchParams.get("size") ?? 10), totalItems: 1, totalPages: 1 };
        } else if (url.pathname.endsWith("/importacao/previa")) {
            assert.match(req.headers()["content-type"], /multipart\/form-data/);
            pedidos.push({ path: url.pathname });
            data = options.importInvalido ? {
                linhas: [{ linha: 2, codigo: "999", descricaoPlanilha: "Produto inexistente", produtoId: null, produto: null, saldoAtual: null,
                    quantidade: "2", diferenca: null, ultimaMovimentacaoId: null, situacao: "INVALIDO", erros: ["Código não encontrado para esta empresa."] }],
                totais: { linhas: 1, identificados: 0, validos: 0, invalidos: 1, comDiferenca: 0, semAlteracao: 0 },
                lote: { chaveRequisicao: null, itens: [], alterados: 0, semAlteracao: 0 },
            } : {
                linhas: [{ linha: 2, codigo: "001", descricaoPlanilha: "Produto A", produtoId: 1, produto: "Produto A", saldoAtual: "10.000",
                    quantidade: "15.125", diferenca: "5.125", ultimaMovimentacaoId: 7, situacao: "VALIDO", erros: [] }],
                totais: { linhas: 1, identificados: 1, validos: 1, invalidos: 0, comDiferenca: 1, semAlteracao: 0 },
                lote: { chaveRequisicao: null, alterados: 0, semAlteracao: 0, itens: [{ produtoId: 1, codigoInterno: "001", nome: "Produto A", unidade: "UN",
                    saldoAnterior: 10, saldoFinal: 15.125, diferenca: 5.125, ultimaMovimentacaoId: 7, status: "VALIDO", erros: [], movimentacaoId: null }] },
            };
        } else {
            const p = req.postDataJSON(); pedidos.push({ path: url.pathname, ...p });
            if (options.falhaRedePrevia && url.pathname.endsWith('/previa')) return route.abort('failed');
            if (options.erroPrevia && url.pathname.endsWith('/previa')) return route.fulfill({ status: options.erroPrevia, headers: { ...headers, 'x-request-id': 'fixture-request', 'access-control-expose-headers': 'x-request-id' }, json: options.mensagemPrevia ?? 'Detalhe técnico que não deve aparecer em erro interno' });
            assert.equal(p.empresaId, undefined); assert.equal(p.usuarioId, undefined);
            const confirmacao = url.pathname.endsWith("confirmar");
            if (confirmacao && options.falharUmaVez && pedidos.filter(p => p.path.endsWith("confirmar")).length === 1) return route.abort("failed");
            if (confirmacao) await options.aguardarConfirmacao?.();
            if (confirmacao && options.conflito) { status = 409; data = "Atualize a prévia"; }
            else {
                data = { chaveRequisicao: p.chaveRequisicao ?? null, alterados: confirmacao ? p.itens.length : 0, semAlteracao: 0,
                    itens: p.itens.map(i => { const produto = catalogo.find(p => p.id === i.produtoId); return {
                        produtoId: i.produtoId, nome: produto.nome, codigoInterno: produto.codigoInterno, unidade: "UN",
                        saldoAnterior: produto.estoqueAtual, saldoFinal: Number(i.valor), diferenca: Number(i.valor) - produto.estoqueAtual,
                        ultimaMovimentacaoId: null, status: options.invalido ? "INVALIDO" : confirmacao ? "APLICADO" : "VALIDO",
                        erros: options.invalido ? ["Produto inativo. Reative o cadastro."] : [], movimentacaoId: confirmacao ? 41 : null,
                    }; }),
                };
            }
        }
        await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(base); return { page, pedidos, buscas, erros };
}
async function preencher(page) {
    await page.getByRole("button", { name: "Ajuste em massa", exact: true }).click();
    await page.getByRole("textbox", { name: "Pesquisar produtos" }).fill("Produto");
    await page.getByRole("button", { name: "Adicionar Produto A", exact: true }).click();
    await page.getByRole("textbox", { name: "Saldo físico Produto A", exact: true }).fill("15.125");
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem de conferência");
}

test('P014 saldo zero e físico 20,000 envia decimal canônico e mostra entrada +20,000', async t => {
    const { page, pedidos, erros } = await ambiente(t, { catalogo: [{ ...produtos[0], id: 14, nome: 'Bala de Menta', codigoInterno: 'P014', estoqueAtual: 0 }] });
    await page.getByRole('button', { name: 'Ajuste em massa', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pesquisar produtos' }).fill('P014');
    await page.getByRole('button', { name: 'Adicionar Bala de Menta', exact: true }).click();
    await page.getByRole('textbox', { name: 'Saldo físico Bala de Menta', exact: true }).fill('20,000');
    await page.getByRole('textbox', { name: 'Motivo do ajuste em massa' }).fill('teste');
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('cell', { name: '+20,000', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Entrada', exact: true })).toBeVisible();
    assert.equal(pedidos.length, 1); assert.equal(pedidos[0].itens[0].produtoId, 14); assert.equal(pedidos[0].itens[0].valor, '20.000');
    assert.equal(pedidos[0].motivo, 'teste'); assert.deepEqual(erros, []);
    await expect(page.getByRole('button', { name: 'Gerar prévia', exact: true })).toBeEnabled();
    await page.screenshot({ path: 'node_modules/sprint20g4-menta-previa.png', fullPage: true, animations: 'disabled' });
});

test('erros de prévia explicam HTTP sem descartar rascunho ou expor erro interno', async t => {
    for (const [status, expected] of [[400, 'Motivo obrigatório.'], [401, 'Sessão não autorizada'], [403, 'ADMIN'], [404, 'versão do backend local'], [500, 'HTTP 500']]) {
        const { page, pedidos } = await ambiente(t, { erroPrevia: status, mensagemPrevia: status === 400 ? 'Motivo obrigatório.' : undefined });
        await preencher(page);
        await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: expected })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Motivo do ajuste em massa' })).toHaveValue('Contagem de conferência');
        await expect(page.getByRole('button', { name: 'Confirmar ajustes', exact: true })).toHaveCount(0);
        if (status === 500) { await expect(page.getByText('Detalhe técnico que não deve aparecer em erro interno')).toHaveCount(0); await expect(page.getByText(/fixture-request/)).toBeVisible(); }
        assert.equal(pedidos.length, 1);
    }
});

test('falha de rede na prévia informa indisponibilidade e preserva o rascunho', async t => {
    const { page, pedidos } = await ambiente(t, { falhaRedePrevia: true });
    await preencher(page);
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível acessar a API de estoque');
    await expect(page.getByRole('textbox', { name: 'Motivo do ajuste em massa' })).toHaveValue('Contagem de conferência');
    await expect(page.getByRole('button', { name: 'Confirmar ajustes', exact: true })).toHaveCount(0);
    assert.equal(pedidos.length, 1);
});

test('saída, zero e edição invalidam a prévia anterior; lixeira mantém tooltip', async t => {
    const { page, pedidos } = await ambiente(t);
    await preencher(page);
    const input = page.getByRole('textbox', { name: 'Saldo físico Produto A', exact: true });
    await input.fill('7,500');
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('cell', { name: '-2,500', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Saída', exact: true })).toBeVisible();
    await input.fill('10,000');
    await expect(page.getByRole('button', { name: 'Confirmar ajustes', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Gerar prévia', exact: true }).click();
    await expect(page.getByRole('cell', { name: '0,000', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sem alteração', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remover Produto A', exact: true }).hover();
    await expect(page.getByRole('tooltip', { name: 'Remover Produto A' })).toBeVisible();
    await page.getByRole('button', { name: 'Remover Produto A', exact: true }).click();
    await expect(page.getByText('0/200', { exact: true })).toBeVisible();
    assert(pedidos.every(p => !p.path.endsWith('confirmar')));
});
for (const mobile of [false, true]) test(`seleção, fração, prévia e confirmação ${mobile ? "mobile" : "desktop"}`, async t => {
    const { page, pedidos, buscas, erros } = await ambiente(t, { mobile });
    await preencher(page);
    await expect(page.getByRole("button", { name: "Adicionar Produto A", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await expect(page.getByRole("cell", { name: "+5,125", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar ajustes", exact: true })).toBeEnabled();
    assert.equal(pedidos.length, 1); assert.equal(pedidos[0].modo, "SALDO_FINAL");
    await page.screenshot({ path: `node_modules/sprint20c-${mobile ? "mobile" : "desktop"}.png`, fullPage: true, animations: "disabled" });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.getByRole("button", { name: "Confirmar ajustes", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Lote confirmado");
    await expect(page.getByRole("cell").filter({ hasText: "movimento 41" })).toBeVisible();
    assert.equal(await page.evaluate(() => window.atualizacoes), 1);
    assert.equal(pedidos[1].itens[0].saldoEsperado, 10);
    assert.ok(pedidos[1].chaveRequisicao); assert.equal(buscas.at(-1).size, "10"); assert.deepEqual(erros, []);
});
test("perda de resposta conserva dados e UUID sem falso sucesso", async t => {
    const { page, pedidos } = await ambiente(t, { falharUmaVez: true }); await preencher(page);
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar ajustes", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "mesma chave" })).toBeVisible();
    await expect(page.getByText("Lote confirmado", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Revisar dados", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Tentar novamente com a mesma chave", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Lote confirmado");
    const c = pedidos.filter(p => p.path.endsWith("confirmar")); assert.deepEqual(c[0], c[1]);
});
test("conflito pede nova prévia mantendo motivo e quantidades", async t => {
    const { page } = await ambiente(t, { conflito: true }); await preencher(page);
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar ajustes", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Atualize a prévia");
    await expect(page.getByRole("textbox", { name: "Motivo do ajuste em massa" })).toHaveValue("Contagem de conferência");
    await expect(page.getByRole("textbox", { name: "Saldo físico Produto A", exact: true })).not.toBeEmpty();
    await expect(page.getByRole("button", { name: "Gerar prévia", exact: true })).toBeEnabled();
});
test("motivo obrigatório, prévia inválida e teclado", async t => {
    const { page } = await ambiente(t, { invalido: true });
    await page.getByRole("button", { name: "Ajuste em massa", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Gerar prévia", exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: "Pesquisar produtos" }).fill("Produto A");
    await page.getByRole("button", { name: "Adicionar Produto A", exact: true }).focus(); await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Saldo físico Produto A", exact: true }).fill("1");
    await expect(page.getByRole("button", { name: "Gerar prévia", exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Recontagem");
    await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
    await expect(page.getByText("Produto inativo. Reative o cadastro.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar ajustes", exact: true })).toBeDisabled();
});
for (const perfil of ["GERENTE", "OPERADOR"]) test(`${perfil} não vê ajuste em massa`, async t => {
    const { page, pedidos } = await ambiente(t, { perfil });
    await expect(page.getByRole("button", { name: "Ajuste em massa", exact: true })).toHaveCount(0); assert.equal(pedidos.length, 0);
});
test("confirmação em andamento desabilita ações e não apresenta sucesso antecipado", async t => {
    let liberar; const pendente = new Promise(resolve => { liberar = resolve; });
    const { page, pedidos } = await ambiente(t, { aguardarConfirmacao: () => pendente });
    try {
        await preencher(page); await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
        await page.getByRole("button", { name: "Confirmar ajustes", exact: true }).click();
        await expect(page.getByRole("button", { name: "Confirmando…", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Revisar dados", exact: true })).toBeDisabled();
        await expect(page.getByText("Lote confirmado", { exact: false })).toHaveCount(0);
        assert.equal(pedidos.filter(p => p.path.endsWith("confirmar")).length, 1);
        liberar(); await expect(page.getByRole("status")).toContainText("Lote confirmado");
    } finally { liberar(); }
});

for (const mobile of [false, true]) test(`tela dedicada mantém seleção ao voltar e reutiliza histórico ${mobile ? "mobile" : "desktop"}`, async t => {
    const { page, pedidos } = await ambiente(t, { mobile });
    await page.getByRole("button", { name: "Ajuste em massa", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Novo ajuste em massa" })).toBeVisible();
    await page.getByRole("textbox", { name: "Pesquisar produtos" }).fill("Produto A");
    await page.getByRole("button", { name: "Adicionar Produto A", exact: true }).click();
    await page.getByRole("textbox", { name: "Saldo físico Produto A", exact: true }).fill("12,5");
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem parcial");
    await page.getByRole("tab", { name: "Histórico" }).click();
    await page.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: "SAIDA", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Contagem anterior" })).toBeVisible();
    if (!mobile) await page.screenshot({ path: "node_modules/sprint20g-historico-desktop.png", fullPage: true, animations: "disabled" });
    const consulta = pedidos.find(p => p.path.startsWith("/estoque/movimentacoes/produto/") && p.params.tipo === "SAIDA");
    assert.equal(consulta.path, "/estoque/movimentacoes/produto/1");
    assert.equal(consulta.params.tipo, "SAIDA");
    await page.getByRole("button", { name: "Voltar para saldos", exact: true }).click();
    await page.getByRole("button", { name: "Ajuste em massa", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Saldo físico Produto A", exact: true })).toHaveValue("12,500");
    await expect(page.getByRole("textbox", { name: "Motivo do ajuste em massa" })).toHaveValue("Contagem parcial");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
});

test("importa CSV gera previa e confirma pelo contrato 20B", async t => {
    const { page, pedidos, erros } = await ambiente(t, { mobile: true });
    await page.getByRole("button", { name: "Importar planilha", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar modelo CSV" }).click();
    assert.equal((await download).suggestedFilename(), "modelo-ajuste-estoque.csv");
    await page.locator('input[type="file"]').setInputFiles({ name: "contagem.csv", mimeType: "text/csv", buffer: Buffer.from("Codigo;Produto;Quantidade\n001;Produto A;15,125\n") });
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem por planilha");
    await page.getByRole("button", { name: "Analisar arquivo" }).click();
    await expect(page.getByText(/1 linha .*1 identificado .*0 inv/)).toBeVisible();
    await expect(page.getByRole("cell", { name: "5,125", exact: true })).toBeVisible();
    await page.screenshot({ path: "node_modules/sprint20c-import-mobile.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "Confirmar ajustes" }).click();
    await expect(page.getByRole("status")).toContainText("Lote confirmado");
    assert.equal(pedidos[0].path, "/estoque/ajustes-lote/importacao/previa");
    assert.equal(pedidos[1].path, "/estoque/ajustes-lote/confirmar");
    assert.equal(pedidos[1].itens[0].valor, "15.125"); assert.equal(pedidos[1].itens[0].saldoEsperado, "10.000");
    assert.equal(pedidos[1].itens[0].ultimaMovimentacaoIdEsperada, 7); assert.deepEqual(erros, []);
});

test("importacao com erro por linha nao libera confirmacao", async t => {
    const { page, pedidos } = await ambiente(t, { importInvalido: true });
    await page.getByRole("button", { name: "Importar planilha", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "contagem.csv", mimeType: "text/csv", buffer: Buffer.from("Codigo;Produto;Quantidade\n999;Produto X;2\n") });
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem");
    await page.getByRole("button", { name: "Analisar arquivo" }).click();
    await expect(page.getByText("Código não encontrado para esta empresa.")).toBeVisible();
    await page.locator(".MuiDialogContent-root").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole("textbox", { name: "Motivo do ajuste em massa" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Confirmar ajustes" })).toBeDisabled();
    assert.equal(pedidos.filter(p => p.path.endsWith("confirmar")).length, 0);
});

test("retry de importacao reutiliza a mesma chave e o mesmo payload", async t => {
    const { page, pedidos } = await ambiente(t, { falharUmaVez: true });
    await page.getByRole("button", { name: "Importar planilha", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "contagem.csv", mimeType: "text/csv", buffer: Buffer.from("Codigo;Produto;Quantidade\n001;Produto A;15,125\n") });
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem por planilha");
    await page.getByRole("button", { name: "Analisar arquivo" }).click();
    await page.getByRole("button", { name: "Confirmar ajustes" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "mesma chave" })).toBeVisible();
    await page.getByRole("button", { name: "Tentar novamente com a mesma chave" }).click();
    await expect(page.getByRole("status")).toContainText("Lote confirmado");
    const confirmacoes = pedidos.filter(p => p.path.endsWith("confirmar"));
    assert.equal(confirmacoes.length, 2); assert.deepEqual(confirmacoes[0], confirmacoes[1]);
});

test("valida tema claro/escuro, responsividade e estados visuais da Sprint 20", async t => {
    let claro;
    for (const theme of ["light", "dark"]) for (const mobile of [false, true]) {
        const size = mobile ? "mobile" : "desktop";
        const { page, erros } = await ambiente(t, { theme, mobile });
        await page.screenshot({ path: `node_modules/sprint20e-${theme}-${size}-entrada.png`, fullPage: true, animations: "disabled" });
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        if (theme === "light") claro = bg; else assert.notEqual(bg, claro, "tema escuro precisa aplicar a paleta escura real");
        await preencher(page);
        await page.getByRole("button", { name: "Gerar prévia", exact: true }).click();
        await expect(page.getByRole("cell", { name: "+5,125", exact: true })).toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        await page.screenshot({ path: `node_modules/sprint20e-${theme}-${size}-previa.png`, fullPage: true, animations: "disabled" });
        await page.getByRole("button", { name: "Confirmar ajustes", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("Lote confirmado");
        await page.screenshot({ path: `node_modules/sprint20e-${theme}-${size}-resultado.png`, fullPage: true, animations: "disabled" });
        assert.deepEqual(erros, []);
    }
    const { page: importPage, erros: importErrors } = await ambiente(t, { theme: "dark", mobile: true });
    await importPage.getByRole("button", { name: "Importar planilha", exact: true }).click();
    await importPage.locator('input[type="file"]').setInputFiles({ name: "contagem.csv", mimeType: "text/csv", buffer: Buffer.from("Codigo;Produto;Quantidade\\n001;Produto A;15,125\\n") });
    await importPage.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem por planilha");
    await importPage.getByRole("button", { name: "Analisar arquivo" }).click();
    await expect(importPage.getByRole("cell", { name: "5,125", exact: true })).toBeVisible();
    const paneInfo = await importPage.locator(".MuiDialogContent-root").evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight }));
    assert.ok(paneInfo.content >= paneInfo.height);
    await importPage.locator(".MuiDialogContent-root").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(importPage.getByRole("textbox", { name: "Motivo do ajuste em massa" })).toBeInViewport();
    await importPage.screenshot({ path: "node_modules/sprint20e-dark-mobile-importacao-previa.png", fullPage: true, animations: "disabled" });
    await importPage.getByRole("button", { name: "Confirmar ajustes" }).click();
    await expect(importPage.getByRole("status")).toContainText("Lote confirmado");
    await importPage.screenshot({ path: "node_modules/sprint20e-dark-mobile-importacao-resultado.png", fullPage: true, animations: "disabled" });
    assert.deepEqual(importErrors, []);    const { page, erros } = await ambiente(t, { theme: "dark", mobile: true, importInvalido: true });
    await page.getByRole("button", { name: "Importar planilha", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "contagem.csv", mimeType: "text/csv", buffer: Buffer.from("Codigo;Produto;Quantidade\\n999;Produto X;2\\n") });
    await page.getByRole("textbox", { name: "Motivo do ajuste em massa" }).fill("Contagem");
    await page.getByRole("button", { name: "Analisar arquivo" }).click();
    await expect(page.getByText("Código não encontrado para esta empresa.")).toBeVisible();
    await page.locator(".MuiDialogContent-root").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole("textbox", { name: "Motivo do ajuste em massa" })).toBeInViewport();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: "node_modules/sprint20e-dark-mobile-erro-linha.png", fullPage: true, animations: "disabled" });
    assert.deepEqual(erros, []);
});
