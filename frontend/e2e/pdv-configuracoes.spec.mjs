import { test, expect } from "@playwright/test";

const configs = [
    [1, "DINHEIRO", "Dinheiro"], [2, "PIX", "PIX Itau"], [3, "PIX", "PIX Mercado Pago"],
    [4, "DEBITO", "Debito Stone"], [5, "DEBITO", "Debito Cielo"],
    [6, "CREDITO", "Credito Cielo"], [7, "CREDITO", "Credito Stone"],
    [8, "BOLETO", "Boleto"], [9, "TRANSFERENCIA", "Transferencia"],
].map(([id, tipo, nomeExibicao]) => ({ id, tipo, nomeExibicao, ativo: true }));

for (const [id, legado, recebido] of [[3, "PIX", null], [4, "CARTAO_DEBITO", null], [6, "CARTAO_CREDITO", null], [1, "DINHEIRO", "30"]]) {
    test(`PDV configura ${legado}, envia ID e mostra nome no dialog`, async ({ page }) => {
        let pedido;
        await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
            id: 1, token: "teste", perfil: "ADMIN", nomeUsuario: "Teste", empresa: { id: 1, razaoSocial: "Empresa" },
        })));
        await page.route("**/*", async route => {
            const url = new URL(route.request().url());
            if (url.port !== "8080") return route.continue();
            let data = [];
            if (url.pathname === "/financeiro/configuracoes-formas-pagamento") {
                expect(url.searchParams.get("situacao")).toBe("ativas");
                data = configs;
            }
            if (url.pathname === "/produtos/buscar") data = [{ id: 1, nome: "Produto", precoVenda: 20, ativo: true, codigoInterno: "P1", unidadeMedida: "UN" }];
            if (url.pathname === "/financeiro/caixas/sessoes/abertas") data = [{ sessaoId: 10 }];
            if (url.pathname === "/vendas" && route.request().method() === "POST") {
                pedido = route.request().postDataJSON();
                data = { id: 1, total: 20, troco: recebido ? 10 : 0 };
            }
            await route.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } });
        });
        await page.goto("/pdv");
        const select = page.getByRole("combobox", { name: "Forma de pagamento", exact: true });
        await expect(select.locator("option")).toHaveText(["Selecione uma forma de pagamento", ...configs.slice(0, 7).map(c => c.nomeExibicao)]);
        await select.selectOption(String(id));
        const busca = page.getByRole("combobox", { name: "Buscar produto ou ler c\u00f3digo de barras" });
        await busca.fill("P1");
        await busca.press("Enter");
        await expect(page.getByRole("table")).toContainText("Produto");
        if (recebido) await page.getByLabel("Valor recebido (R$)").fill(recebido);
        await page.keyboard.press("F2");
        await expect.poll(() => pedido?.configuracaoFormaPagamentoId).toBe(id);
        expect(pedido.formaPagamento).toBe(legado);
        expect(pedido.valorRecebido).toBe(recebido ? 30 : 20);
        expect(pedido.sessaoCaixaId).toBe(10);
        expect(pedido.empresaId).toBeUndefined();
        await expect(page.getByRole("dialog")).toContainText(configs.find(c => c.id === id).nomeExibicao);
        if (recebido) await expect(page.getByRole("dialog")).toContainText(/10,00/);
    });
}
