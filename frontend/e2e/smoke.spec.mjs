import { test, expect } from "@playwright/test";

const cpf = process.env.E2E_USER_CPF;
const senha = process.env.E2E_USER_PASSWORD;

test.describe("smoke da base estável", () => {
    test("login, produto, estoque e caixa", async ({ page }) => {
        test.skip(!cpf || !senha, "Defina E2E_USER_CPF e E2E_USER_PASSWORD para executar o smoke autenticado.");

        const sufixo = `${Date.now()}`;
        const produto = `E2E - Produto ${sufixo}`;
        const caixa = `E2E - Caixa ${sufixo}`;

        await page.goto("/login");
        await page.getByLabel("CPF").fill(cpf);
        await page.getByLabel("Senha", { exact: true }).fill(senha);
        await page.getByRole("button", { name: /Entrar/i }).click();
        await expect(page).toHaveURL(/\/dashboard$/);

        await page.goto("/produtos");
        await expect(page.getByRole("main").getByRole("heading", { name: "Produtos" })).toBeVisible();
        await page.getByRole("button", { name: "Novo produto" }).click();
        await page.getByLabel("Nome").fill(produto);
        await page.getByLabel("Unidade de medida").fill("UN");
        await page.getByLabel("Preço de venda").fill("10,00");
        await expect(page.getByText(/Saldo atual: 0,000/)).toBeVisible();
        await expect(page.getByLabel("Estoque atual")).toHaveCount(0);
        await page.getByRole("button", { name: "Cadastrar produto" }).click();
        await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();
        await expect(page.getByRole("row").filter({ hasText: produto })).toBeVisible();

        const linhaProduto = page.getByRole("row").filter({ hasText: produto });
        await linhaProduto.getByRole("button", { name: "Editar produto" }).click();
        await page.getByLabel("Descrição").fill("Produto criado pelo smoke E2E");
        await expect(page.getByLabel("Estoque atual")).toHaveCount(0);
        await page.getByRole("button", { name: "Salvar alterações" }).click();
        await expect(page.getByText("Produto atualizado com sucesso.")).toBeVisible();

        await page.goto("/estoque");
        await expect(page.getByRole("main").getByRole("heading", { name: "Estoque" })).toBeVisible();
        await expect(page.getByRole("row").filter({ hasText: produto })).toBeVisible();
        let linhaEstoque = page.getByRole("row").filter({ hasText: produto });

        await linhaEstoque.getByRole("button", { name: "Registrar entrada" }).click();
        await page.getByLabel("Quantidade").fill("10");
        await page.getByRole("button", { name: "Confirmar" }).click();
        await expect(page.getByRole("row").filter({ hasText: produto }).getByRole("cell", { name: "10", exact: true })).toBeVisible();

        linhaEstoque = page.getByRole("row").filter({ hasText: produto });
        await linhaEstoque.getByRole("button", { name: "Registrar saída" }).click();
        await page.getByLabel("Quantidade").fill("3");
        await page.getByRole("button", { name: "Confirmar" }).click();
        await expect(page.getByRole("row").filter({ hasText: produto }).getByRole("cell", { name: "7", exact: true })).toBeVisible();

        linhaEstoque = page.getByRole("row").filter({ hasText: produto });
        await linhaEstoque.getByRole("button", { name: "Ajustar novo saldo físico" }).click();
        await page.getByRole("textbox", { name: "Novo saldo físico", exact: true }).fill("5");
        await expect(page.getByText(/Novo saldo esperado: 5/)).toBeVisible();
        await page.getByRole("button", { name: "Confirmar" }).click();
        await expect(page.getByRole("row").filter({ hasText: produto }).getByRole("cell", { name: "5", exact: true })).toBeVisible();

        await page.getByRole("row").filter({ hasText: produto }).getByRole("button", { name: "Consultar histórico" }).click();
        const historico = page.getByRole("dialog", { name: /Histórico de movimentações/ });
        await expect(historico).toContainText("ENTRADA");
        await expect(historico).toContainText("SAIDA");
        await expect(historico).toContainText("AJUSTE");
        await page.getByRole("button", { name: "Fechar" }).click();

        await page.goto("/produtos");
        await page.getByPlaceholder("Pesquisar por nome, código interno ou código de barras").fill(produto);
        const produtoAtualizado = page.getByRole("row").filter({ hasText: produto });
        await expect(produtoAtualizado.getByRole("cell", { name: "5", exact: true })).toBeVisible();
        await produtoAtualizado.getByRole("button", { name: "Editar produto" }).click();
        await expect(page.getByText(/Saldo atual: 5,000/)).toBeVisible();
        await expect(page.getByLabel("Estoque atual")).toHaveCount(0);
        await page.getByRole("button", { name: "Cancelar" }).click();

        await page.goto("/financeiro/caixas");
        await expect(page.getByRole("main").getByRole("heading", { name: "Caixas", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Novo Caixa" }).click();
        await page.getByLabel("Descrição").fill(caixa);
        await page.getByRole("button", { name: "Criar" }).click();
        await expect(page.getByText("Caixa salvo com sucesso.")).toBeVisible();
        const linhaCaixa = page.getByRole("row").filter({ hasText: caixa });
        await expect(linhaCaixa).toBeVisible();
        await linhaCaixa.getByRole("button", { name: "Editar caixa" }).click();
        await page.getByLabel("Descrição").fill(`${caixa} atualizado`);
        await page.getByRole("button", { name: "Atualizar" }).click();
        await expect(page.getByRole("row").filter({ hasText: `${caixa} atualizado` })).toBeVisible();
    });
});
