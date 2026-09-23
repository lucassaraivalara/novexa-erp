import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1536, height: 864 }, video: "off" });

const base = { unidadeMedida: "UN", estoqueAtual: 8, estoqueMinimo: 2, controlaEstoque: true, descricao: "", ativo: true };
const produtos = [
    { ...base, id: 1, nome: "Café torrado", codigoInterno: "B02", codigoBarras: "789123", precoVenda: 20 },
    { ...base, id: 2, nome: "Água mineral", codigoInterno: "A01", codigoBarras: "789456", precoVenda: 3 },
    { ...base, id: 3, nome: "Café inativo", codigoInterno: null, codigoBarras: null, precoVenda: 10, ativo: false },
];

async function preparar(page) {
    const consultas = [];
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste-local", nomeUsuario: "Teste", empresa: { id: 1, nomeFantasia: "Teste" },
    })));
    await page.route("**/produtos?*", async (route) => {
        consultas.push("");
        await route.fulfill({ json: produtos });
    });
    await page.route("**/produtos/buscar?*", async (route) => {
        const termo = new URL(route.request().url()).searchParams.get("termo");
        consultas.push(termo);
        const normalizar = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        await route.fulfill({ json: produtos.filter(p => normalizar(p.nome).includes(normalizar(termo))) });
    });
    await page.goto("/produtos");
    await expect(page.getByRole("row")).toHaveCount(4);
    return consultas;
}

test("filtro local, ordenacao independente e retorno remoto preservam o texto", async ({ page }) => {
    const consultas = await preparar(page);
    const campo = page.getByRole("textbox");
    const produto = page.getByRole("button", { name: "Buscar por: Produto", exact: true });
    await produto.focus();
    await page.keyboard.press("Enter");
    await expect(produto).toHaveAttribute("aria-pressed", "true");
    await expect(campo).toHaveAttribute("placeholder", "Pesquisar por produto…");
    await campo.fill(" cafe ");
    await campo.press("Enter");
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByRole("button", { name: "Ordenar por Preço de venda: crescente", exact: true }).click();
    await expect(page.getByRole("row").nth(1)).toContainText("Café inativo");
    await expect(produto).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("columnheader", { name: /Preço de venda/ })).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("button", { name: "Ordenar por Preço de venda: decrescente", exact: true }).click();
    await expect(page.getByRole("row").nth(1)).toContainText("Café torrado");
    // Wait beyond the remote debounce to detect accidental HTTP from local typing.
    await page.waitForTimeout(450);
    expect(consultas).toEqual([""]);
    const chip = page.getByRole("button", { name: "Buscando por: Produto. Remover filtro de coluna", exact: true });
    await chip.focus();
    await page.keyboard.press("Delete");
    await expect(campo).toBeFocused();
    await expect(campo).toHaveValue(" cafe ");
    await expect.poll(() => consultas).toEqual(["", "cafe"]);
    await expect(produto).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("row").nth(1)).toContainText("Café torrado");
});

test("codigo, situacao, filtro existente e limpeza usam a base original", async ({ page }) => {
    const consultas = await preparar(page);
    const campo = page.getByRole("textbox");
    await page.getByRole("button", { name: "Buscar por: Código interno", exact: true }).click();
    await campo.fill("789123");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").nth(1)).toContainText("Café torrado");
    await campo.fill("a01");
    await expect(page.getByRole("row").nth(1)).toContainText("Água mineral");
    await page.getByRole("button", { name: "Buscar por: Situação", exact: true }).click();
    await expect(campo).toHaveValue("a01");
    await campo.fill("ativo");
    await expect(page.getByRole("row")).toHaveCount(3);
    await campo.fill("inativo");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").nth(1)).toContainText("Café inativo");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Ativas", exact: true }).click();
    await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
    await campo.fill("");
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Todas", exact: true }).click();
    await expect(page.getByRole("row")).toHaveCount(4);
    await page.waitForTimeout(450);
    expect(consultas).toEqual([""]);
});

test("resposta geral pendente nao substitui a base depois de ativar coluna", async ({ page }) => {
    const consultas = await preparar(page);
    let pendente;
    await page.route("**/produtos/buscar?*", route => { pendente = route; });
    await page.getByRole("textbox").fill("cafe");
    await expect.poll(() => Boolean(pendente)).toBe(true);
    await page.getByRole("button", { name: "Buscar por: Produto", exact: true }).click();
    await expect(page.getByRole("textbox")).toHaveValue("cafe");
    await pendente.fulfill({ json: [produtos[0]] }).catch(() => {});
    await page.getByRole("textbox").fill("");
    await expect(page.getByRole("row")).toHaveCount(4);
    expect(consultas).toEqual([""]);
});

test("busca local restringe resultados remotos sem recarregar o catalogo", async ({ page }) => {
    const consultas = await preparar(page);
    await page.getByRole("textbox").fill("cafe");
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByRole("button", { name: "Buscar por: Código interno", exact: true }).click();
    await page.getByRole("textbox").fill("A01");
    await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
    await page.getByRole("textbox").fill("");
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.waitForTimeout(450);
    expect(consultas).toEqual(["", "cafe"]);
});
