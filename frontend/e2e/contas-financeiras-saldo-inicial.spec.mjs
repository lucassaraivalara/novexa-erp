import { test, expect } from "@playwright/test";

test.use({ video: "off" });
const conta = { id: 1, nome: "Cofre", tipo: "COFRE", saldoInicial: 1000, saldoAtual: 1000,
    saldoInicialAuditado: true, ativo: true, contaBancaria: null };

async function preparar(page, dados, movimentos) {
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste-local", nomeUsuario: "Teste", perfil: "ADMIN", empresa: { id: 1, nomeFantasia: "Teste" },
    })));
    await page.route("**/financeiro/contas-financeiras", (route) => route.request().isNavigationRequest()
        ? route.continue() : route.fulfill({ json: [dados] }));
    await page.route("**/financeiro/movimentacoes-financeiras?*", (route) => route.fulfill({ json: movimentos }));
    await page.goto("/financeiro/contas-financeiras");
    await page.getByRole("button", { name: "Ver extrato" }).click();
    await expect(page.getByRole("heading", { name: "Extrato · Cofre" })).toBeVisible();
}

test("extrato identifica origem Saldo inicial e bloqueia estorno individual", async ({ page }) => {
    await preparar(page, conta, [{ id: 10, contaFinanceiraId: 1, descricao: "Abertura da conta",
        tipo: "ENTRADA", origem: "SALDO_INICIAL", valor: 1000, dataMovimento: "2026-09-30",
        usuarioNome: "Administrador", estornada: false }]);
    await expect(page.getByText("Saldo inicial", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Estornar movimentação" })).toBeDisabled();
    await expect(page.getByText(/Conta legada:/)).toHaveCount(0);
});

test("extrato sinaliza saldo inicial legado sem inventar lancamento", async ({ page }) => {
    await preparar(page, { ...conta, saldoInicialAuditado: false, saldoAtual: 1400 }, []);
    await expect(page.getByText(/Conta legada: o saldo inicial/)).toBeVisible();
    await expect(page.getByText("Nenhuma movimentação", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Estornar movimentação" })).toHaveCount(0);
});
