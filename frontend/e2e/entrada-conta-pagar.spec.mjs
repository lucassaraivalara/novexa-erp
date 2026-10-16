import { test, expect } from "@playwright/test";

// Executar somente com usuário/empresa de um banco descartável; não intercepta HTTP.
const apiUrl = process.env.E2E_ENTRADA_API_URL;
const cpf = process.env.E2E_USER_CPF;
const senha = process.env.E2E_USER_PASSWORD;
let sessao, api, fornecedor, produto;

test.beforeAll(async ({ playwright }) => {
    if (!apiUrl || !cpf || !senha) return;
    const anonimo = await playwright.request.newContext({ baseURL: apiUrl });
    const login = await anonimo.post("/auth/login", { data: { cpf, senha } });
    expect(login.ok(), await login.text()).toBeTruthy(); sessao = await login.json();
    await anonimo.dispose();
    api = await playwright.request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { Authorization: `Bearer ${sessao.token}` } });
    fornecedor = await post("/fornecedores", { razaoSocial: `Etapa 5 ${Date.now()}`, ativo: true });
    produto = await post("/produtos", { nome: `Etapa 5 ${Date.now()}`, unidadeMedida: "UN", precoCusto: 2, precoVenda: 10, controlaEstoque: true, ativo: true });
});
test.afterAll(async () => { await api?.dispose(); });
test.beforeEach(async ({ page }) => {
    test.skip(!apiUrl || !cpf || !senha, "Exige API e credenciais de banco descartável da etapa 5.");
    await page.addInitScript(s => localStorage.setItem("novexa-auth", JSON.stringify(s)), sessao);
});

async function post(rota, data) {
    const resposta = await api.post(rota, { data });
    expect(resposta.ok(), `${rota}: ${await resposta.text()}`).toBeTruthy();
    return resposta.json();
}
async function entradaConfirmada() {
    const entrada = await post("/estoque/entradas", { fornecedorId: fornecedor.id, numeroNota: `E5-${Date.now()}`, dataEntrada: "2026-10-15",
        itens: [{ produtoId: produto.id, quantidade: 2, valorUnitario: 3.5 }] });
    return post(`/estoque/entradas/${entrada.id}/confirmar`);
}
async function semOverflow(page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    for (const papel of await page.locator(".MuiDialog-paper:visible, .MuiDrawer-paper:visible").all()) {
        expect(await papel.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBeTruthy();
    }
}

for (const [nome, width, height] of [["desktop", 1440, 900], ["notebook", 1366, 768], ["mobile", 390, 844], ["janela baixa", 1024, 600]]) {
    test(`geração explícita e acesso exato preservam contexto — ${nome}`, async ({ page, context }, testInfo) => {
        await page.setViewportSize({ width, height });
        const entrada = await entradaConfirmada();
        const origem = `/estoque?aba=entradas&entradaId=${entrada.id}&contexto=etapa5`;
        await page.goto(origem);
        const detalhe = page.getByRole("dialog", { name: `Entrada de mercadoria #${entrada.id}`, exact: true });
        const gerar = detalhe.getByRole("button", { name: "Gerar conta a pagar", exact: true });
        await expect(gerar).toBeVisible(); await semOverflow(page);
        await gerar.focus(); await expect(gerar).toBeFocused(); await page.keyboard.press("Enter");
        const form = page.getByRole("dialog", { name: "Gerar conta a pagar", exact: true });
        await expect(form.getByRole("textbox", { name: "Descrição", exact: true })).toBeFocused();
        await expect(form.getByLabel("Valor financeiro (R$)")).toHaveValue("7");
        await form.getByLabel("Valor financeiro (R$)").fill("9,25");
        await form.getByRole("textbox", { name: "Vencimento", exact: true }).fill("2026-12-10");
        await semOverflow(page);
        await page.screenshot({ path: testInfo.outputPath("gerar.png"), fullPage: true });
        await form.getByRole("button", { name: "Gerar conta a pagar", exact: true }).click();
        await expect(form).toHaveCount(0);
        await expect(detalhe.getByText(/Conta gerada pela entrada/)).toBeVisible();
        const vinculo = await (await api.get(`/estoque/entradas/${entrada.id}/conta-pagar`)).json();
        expect(vinculo.conta.valor).toBe(9.25); expect(vinculo.conta.status).toBe("ABERTA");
        const popupPromise = context.waitForEvent("page");
        await detalhe.getByRole("link", { name: "Abrir conta a pagar (nova aba)" }).click();
        const popup = await popupPromise;
        await popup.setViewportSize({ width, height });
        await expect(popup.getByRole("heading", { name: `Conta a pagar #${vinculo.conta.id}`, exact: true })).toBeVisible();
        await expect(popup.getByRole("link", { name: `Abrir entrada #${entrada.id} (nova aba)` })).toBeVisible();
        expect(new URL(page.url()).search).toBe(new URL(origem, "http://teste").search);
        await semOverflow(popup); await popup.screenshot({ path: testInfo.outputPath("conta.png"), fullPage: true });
        await popup.close();
        await page.screenshot({ path: testInfo.outputPath("vinculo.png"), fullPage: true });
        await detalhe.getByRole("button", { name: "Fechar", exact: true }).click();
        await expect(page).toHaveURL(/aba=entradas&contexto=etapa5$/);
        const linha = page.getByRole("row").filter({ hasText: entrada.numeroNota });
        // A confirmação permanece no fluxo existente e avisa sobre a obrigação aberta.
        await linha.getByRole("button", { name: "Cancelar entrada", exact: true }).click();
        const cancelamento = page.getByRole("dialog", { name: "Cancelar esta entrada?", exact: true });
        await expect(cancelamento.getByText(/conta gerada aberta será cancelada/)).toBeVisible();
        await cancelamento.getByRole("button", { name: "Cancelar entrada", exact: true }).click();
        await expect(cancelamento).toHaveCount(0);
        const cancelada = await (await api.get(`/estoque/entradas/${entrada.id}/conta-pagar`)).json();
        expect(cancelada.conta.status).toBe("CANCELADA");
    });
}

test("vínculo preexistente, desvinculação e conta paga usam os contratos reais", async ({ page }, testInfo) => {
    const entrada = await entradaConfirmada();
    const conta = await post("/financeiro/contas-pagar", { descricao: `Compra existente ${Date.now()}`, fornecedorId: fornecedor.id, valor: 12, dataVencimento: "2026-12-10" });
    await page.goto(`/estoque?aba=entradas&entradaId=${entrada.id}`);
    const detalhe = page.getByRole("dialog", { name: `Entrada de mercadoria #${entrada.id}`, exact: true });
    await detalhe.getByRole("button", { name: "Vincular conta existente", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Vincular conta existente", exact: true });
    await form.getByLabel("Buscar conta por descrição ou documento").fill(conta.descricao);
    await form.getByRole("combobox", { name: "Conta a pagar existente" }).click();
    await page.getByRole("option", { name: new RegExp(`#${conta.id} ·`) }).click();
    await form.getByRole("button", { name: "Vincular conta existente", exact: true }).click();
    await expect(detalhe.getByText(/Conta preexistente vinculada/)).toBeVisible();
    await detalhe.getByRole("button", { name: "Desvincular conta", exact: true }).click();
    await page.getByRole("dialog", { name: "Desvincular conta", exact: true }).getByRole("button", { name: "Desvincular conta", exact: true }).click();
    await expect(detalhe.getByText(/Sem obrigação vinculada/)).toBeVisible();
    const financeira = await post("/financeiro/contas-financeiras", { nome: "Cofre de validação", tipo: "COFRE", saldoInicial: 100 });
    await post(`/financeiro/contas-pagar/${conta.id}/pagar`, { contaFinanceiraId: financeira.id, valorPago: 12, dataPagamento: "2026-10-15" });
    await post(`/estoque/entradas/${entrada.id}/conta-pagar/vincular`, { contaPagarId: conta.id });
    await detalhe.getByRole("button", { name: "Atualizar vínculo", exact: true }).click();
    await expect(detalhe.getByText("Paga", { exact: true })).toBeVisible();
    await expect(detalhe.getByRole("button", { name: "Desvincular conta", exact: true })).toHaveCount(0);
    await expect(detalhe.getByText(/possui pagamento efetivo/)).toBeVisible();
    await detalhe.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByRole("row").filter({ hasText: entrada.numeroNota }).getByRole("button", { name: "Cancelar entrada", exact: true }).click();
    const cancelamento = page.getByRole("dialog", { name: "Cancelar esta entrada?", exact: true });
    await expect(cancelamento.getByText(/possui pagamento efetivo/)).toBeVisible();
    await expect(cancelamento.getByRole("button", { name: "Cancelar entrada", exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("conta-paga.png"), fullPage: true });
    const saldo = await (await api.get("/financeiro/contas-financeiras")).json();
    expect(saldo.find(c => c.id === financeira.id).saldoAtual).toBe(88);
});
