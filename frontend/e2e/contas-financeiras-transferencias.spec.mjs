import { test, expect } from "@playwright/test";

test.use({ video: "off" });
const conta = (id, nome, tipo = "COFRE", ativo = true) => ({
    id, nome, tipo, ativo, saldoInicial: 1000, saldoAtual: 1000, saldoInicialAuditado: true, contaBancaria: null,
});
const contas = [conta(1, "Sicredi", "BANCO"), conta(2, "Nubank", "BANCO"), conta(3, "Cofre inativo", "COFRE", false),
    conta(4, "Caixa legado", "CAIXA"), conta(5, "Adquirente legado", "ADQUIRENTE")];

async function preparar(page) {
    let leituras = 0;
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste-local", nomeUsuario: "Teste", perfil: "ADMIN", empresa: { id: 1, nomeFantasia: "Teste" },
    })));
    await page.route("**/financeiro/contas-financeiras", (route) => {
        if (route.request().isNavigationRequest()) return route.continue();
        leituras++;
        return route.fulfill({ json: contas });
    });
    await page.goto("/financeiro/contas-financeiras");
    await page.getByRole("row").filter({ hasText: "Sicredi" }).getByRole("button", { name: "Transferir", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Transferir entre contas" })).toBeVisible();
    return () => leituras;
}

async function preencher(page) {
    await page.getByRole("combobox", { name: "Conta de destino" }).click();
    await page.getByRole("option", { name: "Nubank", exact: true }).click();
    await page.getByRole("textbox", { name: "Valor (R$)" }).fill("100,00");
    await page.getByLabel("Data do movimento").fill("2026-09-30");
    await page.getByRole("textbox", { name: "Observação" }).fill("Reserva");
}

test("drawer filtra contas, envia UUID e recarrega saldos sem calcular localmente", async ({ page }) => {
    const leituras = await preparar(page);
    await expect(page.getByRole("combobox", { name: "Conta de origem" })).toHaveText("Sicredi");
    await expect(page.getByText(/Saldo disponível:.*1.000,00/)).toBeVisible();
    await page.getByRole("combobox", { name: "Conta de destino" }).click();
    await expect(page.getByRole("option")).toHaveText(["Nubank"]);
    await page.keyboard.press("Escape");
    await page.getByRole("combobox", { name: "Conta de origem" }).click();
    await expect(page.getByRole("option")).toHaveText(["Sicredi", "Nubank"]);
    await page.keyboard.press("Escape");
    await preencher(page);
    let payload;
    let liberar;
    const espera = new Promise((resolve) => { liberar = resolve; });
    await page.route("**/financeiro/transferencias", async (route) => {
        payload = route.request().postDataJSON();
        await espera;
        await route.fulfill({ json: { id: 10, ...payload, status: "CONCLUIDA" } });
    });
    const antes = leituras();
    await page.getByRole("button", { name: "Confirmar transferência" }).click();
    await expect(page.getByRole("button", { name: "Transferindo..." })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Fechar transferência" })).toBeDisabled();
    await expect.poll(() => payload).toBeTruthy();
    expect(payload).toEqual({ chaveRequisicao: expect.stringMatching(/^[0-9a-f-]{36}$/),
        contaOrigemId: 1, contaDestinoId: 2, valor: 100, dataMovimento: "2026-09-30", observacao: "Reserva" });
    liberar();
    await expect(page.getByRole("heading", { name: "Transferir entre contas" })).toHaveCount(0);
    await expect.poll(leituras).toBeGreaterThan(antes);
    await expect(page.getByRole("row").filter({ hasText: "Sicredi" })).toContainText("1.000,00");
});

test("saldo insuficiente mantém formulário sem submissão", async ({ page }) => {
    await preparar(page); await preencher(page);
    let chamadas = 0;
    await page.route("**/financeiro/transferencias", (route) => { chamadas++; return route.fulfill({ json: {} }); });
    await page.getByRole("textbox", { name: "Valor (R$)" }).fill("1001");
    await page.getByRole("button", { name: "Confirmar transferência" }).click();
    await expect(page.getByRole("alert")).toHaveText("Saldo insuficiente na conta de origem.");
    expect(chamadas).toBe(0);
});

test("retry preserva UUID e reabertura cria nova tentativa", async ({ page }) => {
    await preparar(page); await preencher(page);
    const chaves = [];
    await page.route("**/financeiro/transferencias", async (route) => {
        chaves.push(route.request().postDataJSON().chaveRequisicao);
        await route.fulfill({ status: 409, contentType: "text/plain", body: "Saldo insuficiente para esta operação." });
    });
    await page.getByRole("button", { name: "Confirmar transferência" }).click();
    await expect(page.getByRole("alert")).toContainText("Saldo insuficiente");
    await page.getByRole("button", { name: "Confirmar transferência" }).click();
    await expect.poll(() => chaves.length).toBe(2);
    expect(chaves[1]).toBe(chaves[0]);
    await page.getByRole("button", { name: "Fechar transferência" }).click();
    await page.getByRole("row").filter({ hasText: "Sicredi" }).getByRole("button", { name: "Transferir", exact: true }).click();
    await preencher(page);
    await page.getByRole("button", { name: "Confirmar transferência" }).click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[2]).not.toBe(chaves[0]);
});

test("extrato mostra contraparte e estorna o agregado pelo endpoint próprio", async ({ page }) => {
    await preparar(page);
    await page.getByRole("button", { name: "Fechar transferência" }).click();
    let estornada = false;
    await page.route("**/financeiro/movimentacoes-financeiras?*", (route) => route.fulfill({ json: [
        { id: 11, transferenciaId: 10, contaContraparteNome: "Nubank", descricao: "Transferência enviada",
            origem: "TRANSFERENCIA", tipo: "SAIDA", valor: 100, dataMovimento: "2026-09-30", usuarioNome: "Teste", estornada },
        { id: 12, transferenciaId: 20, contaContraparteNome: "Nubank", descricao: "Transferência recebida",
            origem: "TRANSFERENCIA", tipo: "ENTRADA", valor: 50, dataMovimento: "2026-09-30", usuarioNome: "Teste", estornada: false },
    ] }));
    await page.route("**/financeiro/transferencias/10/estornar", async (route) => {
        expect(route.request().postDataJSON()).toEqual({ motivoEstorno: "Correção" });
        estornada = true; await route.fulfill({ json: { id: 10, status: "ESTORNADA" } });
    });
    await page.getByRole("row").filter({ hasText: "Sicredi" }).getByRole("button", { name: "Ver extrato" }).click();
    await expect(page.getByText("Transferência enviada para Nubank", { exact: true })).toBeVisible();
    await expect(page.getByText("Transferência recebida de Nubank", { exact: true })).toBeVisible();
    await page.getByRole("row").filter({ hasText: "Transferência enviada para Nubank" }).getByRole("button", { name: "Estornar movimentação" }).click();
    await expect(page.getByRole("heading", { name: "Estornar transferência?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Motivo do estorno" }).fill("Correção");
    await page.getByRole("button", { name: "Confirmar estorno" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Transferência enviada para Nubank" })).toContainText("Estornada");
});

test("drawer utilizável em viewport móvel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparar(page); await preencher(page);
    await expect(page.getByRole("button", { name: "Confirmar transferência" })).toBeInViewport();
    await page.screenshot({ path: "test-results/transferencia-mobile.png", fullPage: true });
    const box = await page.getByRole("heading", { name: "Transferir entre contas" }).boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
});
