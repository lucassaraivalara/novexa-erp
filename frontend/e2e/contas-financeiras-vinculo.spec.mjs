import { test, expect } from "@playwright/test";

const bancaria = { id: 7, bancoId: 1, bancoNome: "Sicredi", bancoNumero: "748", agenciaId: 1,
    agenciaNumero: "1234", agenciaDigito: null, numero: "56789", digito: "0", titular: "Empresa", tipo: "CORRENTE", ativo: true };
const base = { saldoInicial: 100, saldoAtual: 100, ativo: true, contaBancaria: null };
const contas = [
    { ...base, id: 1, nome: "Principal", tipo: "BANCO", contaBancaria: { ...bancaria, ativo: false } },
    { ...base, id: 2, nome: "Antiga", tipo: "CAIXA" },
    { ...base, id: 3, nome: "Banco antigo", tipo: "BANCO" },
    { ...base, id: 4, nome: "Cartões antigos", tipo: "ADQUIRENTE" },
];

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste-local", nomeUsuario: "Teste", perfil: "ADMIN", empresa: { id: 1, nomeFantasia: "Teste" },
    })));
    await page.route("**/financeiro/contas-bancarias?*", (route) => route.fulfill({ json: [bancaria] }));
    await page.route("**/financeiro/contas-financeiras", (route) => route.request().isNavigationRequest()
        ? route.continue() : route.fulfill({ json: contas }));
    await page.goto("/financeiro/contas-financeiras");
    await expect(page.getByText("Sicredi · 56789-0", { exact: true })).toBeVisible();
});

test("novo cadastro oferece tipos funcionais, exige banco e limpa vinculo ao trocar tipo", async ({ page }) => {
    await page.getByRole("button", { name: "Nova conta" }).click();
    await page.getByRole("textbox", { name: /^Nome/ }).fill("Nova");
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
    await page.getByRole("combobox", { name: /^Tipo/ }).click();
    await expect(page.getByRole("option")).toHaveText(["Banco", "Cofre", "Carteira digital", "Outros"]);
    await page.getByRole("option", { name: "Banco", exact: true }).click();
    await page.getByRole("combobox", { name: "Conta bancária" }).click();
    await page.getByRole("option", { name: /Sicredi/ }).click();
    await page.getByRole("combobox", { name: /^Tipo/ }).click();
    await page.getByRole("option", { name: "Cofre", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Conta bancária" })).toHaveCount(0);
    await page.getByRole("combobox", { name: /^Tipo/ }).click();
    await page.getByRole("option", { name: "Banco", exact: true }).click();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
    await page.getByRole("combobox", { name: "Conta bancária" }).click();
    await page.getByRole("option", { name: /Sicredi/ }).click();
    const request = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/contas-financeiras"));
    await page.route("**/financeiro/contas-financeiras", (route) => route.fulfill({ json: { ...base, id: 5, nome: "Nova", tipo: "BANCO", contaBancaria: bancaria } }));
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    expect((await request).postDataJSON()).toEqual({ nome: "Nova", tipo: "BANCO", saldoInicial: 0, contaBancariaId: 7 });
});

test("legados aparecem no total e banco sem vinculo pede regularizacao", async ({ page }) => {
    await expect(page.getByText("Caixa (legado)", { exact: true })).toBeVisible();
    await expect(page.getByText("Adquirente (legado)", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Saldos por tipo de conta")).toContainText(/400,00/);
    await page.getByRole("row").filter({ hasText: "Banco antigo" }).getByRole("button", { name: "Editar conta" }).click();
    await expect(page.getByText(/Conta legada sem vínculo bancário/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
});

test("edicao preserva a conta bancaria atual inativa", async ({ page }) => {
    await page.route("**/financeiro/contas-bancarias?*", (route) => route.fulfill({ json: [] }));
    await page.getByRole("row").filter({ hasText: "Principal" }).getByRole("button", { name: "Editar conta" }).click();
    await expect(page.getByRole("combobox", { name: "Conta bancária" })).toContainText("(inativa)");
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
});
