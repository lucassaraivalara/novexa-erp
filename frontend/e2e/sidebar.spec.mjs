import { test, expect } from "@playwright/test";

const destinos = [
    ["Dashboard", "/dashboard"],
    ["Vendas", "/vendas"],
    ["Produtos", "/produtos"],
    ["Clientes", "/clientes"],
    ["Estoque", "/estoque"],
    ["Caixas", "/financeiro/caixas"],
    ["Formas de Pagamento", "/financeiro/formas-pagamento"],
    ["Dados Bancários", "/financeiro/dados-bancarios"],
    ["Empresas", "/empresa"],
];

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
]) {
    test.describe(`Sidebar ${viewport.width}px`, () => {
        test.use({ viewport, hasTouch: viewport.width < 600 });

        test.beforeEach(async ({ page }) => {
            await page.addInitScript(() => {
                localStorage.setItem("novexa-auth", JSON.stringify({
                    id: 1,
                    nomeUsuario: "Operador Teste",
                    perfil: "ADMIN",
                    empresa: { id: 1, nomeFantasia: "Empresa Teste" },
                    token: "sidebar-e2e",
                }));
            });
            await page.route("**/*", async route => {
                if (!["fetch", "xhr"].includes(route.request().resourceType())) {
                    return route.continue();
                }
                const path = new URL(route.request().url()).pathname;
                const data = path === "/dashboard/resumo" ? {
                    faturamentoHoje: 0,
                    quantidadeVendasHoje: 0,
                    ticketMedioHoje: 0,
                    quantidadeProdutosEstoqueBaixo: 0,
                    quantidadeClientesAtivos: 0,
                    sessoesCaixaAbertas: [],
                } : [];
                await route.fulfill({ json: data });
            });
            await page.goto("/dashboard");
        });

        test("hierarquia, limites visuais e itens indisponiveis", async ({ page }, testInfo) => {
            const menu = page.getByRole("navigation", { name: "Menu principal" });
            await expect(menu.locator(":scope > ul > li > a, :scope > ul > li > button")).toHaveText([
                "Dashboard", "Vendas", "Produtos", "Clientes", "Estoque", "Financeiro", "Administração",
            ]);
            await expect(menu.getByRole("list", { name: "Financeiro", exact: true }).getByRole("link"))
                .toHaveText(["Caixas", "Formas de Pagamento", "Dados Bancários"]);
            await expect(menu.getByRole("list", { name: "Administração", exact: true }).locator("a, button"))
                .toHaveText(["Empresas", "Usuários", "Padrões p/ Novo Cliente"]);
            await expect(menu.getByRole("button", { name: "Cadastros", exact: true })).toHaveCount(0);
            await expect(menu.locator("ul ul ul")).toHaveCount(0);
            await expect(page.getByText("Base preparada para o PDV.")).toHaveCount(0);

            for (const nome of ["Usuários", "Padrões p/ Novo Cliente"]) {
                const item = menu.getByRole("button", { name: `${nome} — ainda não disponível` });
                await item.scrollIntoViewIfNeeded();
                await expect(item).toBeVisible();
                await expect(item).toHaveAttribute("aria-disabled", "true");
                await expect(item).not.toHaveAttribute("href");
                await item.dispatchEvent("click");
                await item.focus();
                await item.press("Enter");
                await item.press("Space");
                await expect(page).toHaveURL(/\/dashboard$/);
            }

            const medidas = await menu.evaluate(nav => {
                const rect = nav.getBoundingClientRect();
                const textos = [...nav.querySelectorAll(".MuiListItemText-primary")]
                    .filter(texto => texto.getBoundingClientRect().width > 0);
                const icones = [...nav.querySelectorAll(".MuiListItemIcon-root svg")]
                    .filter(icone => icone.getBoundingClientRect().width > 0);
                return {
                    largura: nav.closest(".MuiDrawer-paper").getBoundingClientRect().width,
                    semOverflow: nav.scrollWidth <= nav.clientWidth,
                    textosInteiros: textos.every(texto => texto.scrollWidth <= texto.clientWidth + 1),
                    iconesCentralizados: icones.every(icone => {
                        const box = icone.getBoundingClientRect();
                        return Math.abs(box.x + box.width / 2 - (rect.x + rect.width / 2)) < 1;
                    }),
                };
            });
            expect(medidas.semOverflow).toBe(true);
            expect(medidas.textosInteiros).toBe(true);
            expect(medidas.largura).toBe(viewport.width < 600 ? 60 : 216);
            if (viewport.width < 600) expect(medidas.iconesCentralizados).toBe(true);

            await menu.getByRole("link", { name: "Dashboard", exact: true }).scrollIntoViewIfNeeded();
            await page.getByRole("main").click({ position: { x: 4, y: 4 } });
            await expect(page.getByRole("tooltip")).toHaveCount(0);
            await page.screenshot({ path: testInfo.outputPath("sidebar.png"), animations: "disabled" });
        });

        test("expansao, teclado, rotas e item ativo", async ({ page }) => {
            const menu = page.getByRole("navigation", { name: "Menu principal" });
            for (const [nome, filho] of [["Financeiro", "Caixas"], ["Administração", "Empresas"]]) {
                const grupo = menu.getByRole("button", { name: nome, exact: true });
                await expect(grupo).toHaveAttribute("aria-expanded", "true");
                await grupo.click();
                await expect(grupo).toHaveAttribute("aria-expanded", "false");
                await expect(menu.getByRole("link", { name: filho, exact: true })).not.toBeVisible();
                await grupo.press("Enter");
                await expect(menu.getByRole("link", { name: filho, exact: true })).toBeVisible();
                await grupo.press("Space");
                await expect(grupo).toHaveAttribute("aria-expanded", "false");
                await grupo.click();
                await expect(grupo).toHaveAttribute("aria-expanded", "true");
            }

            for (const [titulo, caminho] of destinos) {
                const link = menu.getByRole("link", { name: titulo, exact: true });
                await expect(link).toHaveAttribute("href", caminho);
                await link.click();
                await expect.poll(() => new URL(page.url()).pathname).toBe(caminho);
                await expect(link).toHaveAttribute("aria-current", "page");
                await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
                await expect(menu.locator(".Mui-selected")).toHaveCount(1);
                await expect(page.locator("header h1")).toHaveText(titulo);
                await expect(page.getByRole("main")).toBeVisible();
            }

            await menu.getByRole("link", { name: "Caixas", exact: true }).click();
            await menu.getByRole("link", { name: "Dashboard", exact: true }).click();
            const financeiro = menu.getByRole("button", { name: "Financeiro", exact: true });
            await financeiro.click();
            await page.goBack();
            await expect(financeiro).toHaveAttribute("aria-expanded", "true");
            await expect(menu.getByRole("link", { name: "Caixas", exact: true })).toHaveAttribute("aria-current", "page");
            await page.reload();
            await expect(menu.getByRole("link", { name: "Caixas", exact: true })).toBeVisible();
        });
    });
}
