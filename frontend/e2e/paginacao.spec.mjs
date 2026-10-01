import { test, expect } from "@playwright/test";

const produto = { id: 1, nome: "Produto remoto", codigoInterno: "P1", codigoBarras: "789", unidadeMedida: "UN",
    precoVenda: 10, estoqueAtual: 3, estoqueMinimo: 5, controlaEstoque: true, ativo: true };
const cliente = { id: 1, nome: "Cliente remoto", ativo: true, enderecos: [], contatos: [] };
const conta = { id: 1, nome: "Cofre", tipo: "COFRE", saldoAtual: 100, saldoInicial: 0, ativo: true };
const titulo = { id: 1, descricao: "Titulo remoto", status: "ABERTA", valor: 10, dataVencimento: "2026-10-01" };
const movimento = { id: 1, tipo: "ENTRADA", origem: "MANUAL", valor: 10, descricao: "Movimento remoto", dataMovimento: "2026-10-01", estornada: false };
const venda = { id: 1, total: 10, status: "FATURADA", dataHora: "2026-10-01T12:00:00", nomeCliente: "Cliente remoto" };

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({
        token: "teste", perfil: "ADMIN", nomeUsuario: "Teste", empresa: { id: 1, razaoSocial: "Empresa teste" },
    })));
});

async function mockApi(page) {
    const chamadas = [];
    await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.port !== "8080") return route.continue();
        chamadas.push(url);
        let data = [];
        const params = url.searchParams;
        const pagina = Number(params.get("page") ?? 0), size = Number(params.get("size") ?? 25);
        const paginaDe = item => ({ items: [{ ...item, id: pagina * size + 1 }], page: pagina, size, totalItems: 60, totalPages: Math.ceil(60 / size) });
        if (url.pathname === "/produtos") data = paginaDe(produto);
        if (url.pathname === "/clientes") data = paginaDe(cliente);
        if (url.pathname === "/vendas") data = paginaDe(venda);
        if (url.pathname === "/financeiro/contas-pagar") data = paginaDe(titulo);
        if (url.pathname === "/financeiro/contas-financeiras") data = [conta];
        if (url.pathname === "/financeiro/movimentacoes-financeiras") data = paginaDe(movimento);
        if (url.pathname.includes("/estoque/movimentacoes/produto/")) data = paginaDe({ id: 1, tipo: "ENTRADA", origem: "MANUAL", dataHora: "2026-10-01T12:00:00", quantidade: 3, saldoAnterior: 0, saldoPosterior: 3 });
        if (url.pathname.endsWith("/resumo")) data = Object.fromEntries(["vencidas", "seteDias", "trintaDias", "emAberto", "pagasMes"].map(chave => [chave, { total: 60, quantidade: 60 }]));
        await route.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } });
    });
    return chamadas;
}

for (const [tela, endpoint, texto, filtro, busca, coluna] of [
    ["clientes", "/clientes", "Cliente remoto", "Situação", "Pesquisar por nome, razão social", "Nome / Razão social"],
    ["produtos", "/produtos", "Produto remoto", "Situação", "Pesquisar por nome, código interno", "Produto"],
    ["estoque", "/produtos", "Produto remoto", "Situação do estoque", "Pesquisar por produto ou código", "Produto"],
    ["financeiro/contas-pagar", "/financeiro/contas-pagar", "Titulo remoto", "Status", "Buscar por descrição", "Vencimento"],
    ["vendas", "/vendas", "#1", "Status", null, "Data / hora"],
]) {
    test(`${tela}: página, size, filtros, sort e totais remotos`, async ({ page }) => {
        const chamadas = await mockApi(page);
        const ultimas = () => chamadas.filter(url => url.pathname === endpoint);
        await page.goto(`/${tela}`);
        await expect(page.getByRole("table")).toContainText(texto);
        await expect(page.getByText(/de 60/).first()).toBeVisible();
        await page.getByRole("button", { name: "Próxima página" }).click();
        await expect.poll(() => ultimas().at(-1)?.searchParams.get("page")).toBe("1");
        const paginador = page.locator(".MuiTablePagination-root");
        await paginador.getByRole("combobox").click();
        await page.getByRole("option", { name: "10", exact: true }).click();
        await expect.poll(() => ultimas().at(-1)?.searchParams.get("size")).toBe("10");
        expect(ultimas().at(-1).searchParams.get("page")).toBe("0");
        const seletor = page.getByRole("combobox", { name: filtro, exact: true });
        await seletor.click();
        await page.getByRole("option", { name: tela === "estoque" ? "Baixo" : tela === "financeiro/contas-pagar" ? "Abertas" : tela === "vendas" ? "Aberta" : tela === "produtos" ? "Inativas" : "Inativos" }).click();
        await expect.poll(() => ultimas().at(-1)?.searchParams.get(tela === "estoque" ? "situacaoEstoque" : tela.includes("contas-pagar") || tela === "vendas" ? "status" : "situacao"))
            .toBe(tela === "estoque" ? "baixo" : tela.includes("contas-pagar") || tela === "vendas" ? "ABERTA" : "inativos");
        const botao = page.getByRole("button", { name: new RegExp(`Ordenar por ${coluna}:`) });
        if (await botao.count()) await botao.click();
        else await page.getByRole("button", { name: coluna, exact: true }).click();
        const campoSort = tela === "clientes" || tela === "produtos" || tela === "estoque" ? "nome"
            : tela === "vendas" ? "dataHora" : "dataVencimento";
        await expect.poll(() => ultimas().at(-1)?.searchParams.get("sort")).toBe(`${campoSort},${tela === "vendas" ? "asc" : "desc"}`);
        expect(ultimas().at(-1).searchParams.get("page")).toBe("0");
        if (busca) {
            const input = page.getByPlaceholder(new RegExp(busca));
            const antes = ultimas().length;
            await input.fill("abc");
            await input.fill("abcd");
            await page.waitForTimeout(100);
            expect(ultimas().length).toBe(antes);
            await expect.poll(() => ultimas().at(-1)?.searchParams.get("busca")).toBe("abcd");
            expect(ultimas().length).toBe(antes + 1);
        }
        expect(ultimas().every(url => !url.searchParams.has("empresaId"))).toBe(true);
    });
}

test("extrato e histórico usam páginas, filtros e totais remotos", async ({ page }) => {
    const chamadas = await mockApi(page);
    await page.goto("/financeiro/contas-financeiras");
    await page.getByRole("button", { name: "Ver extrato" }).click();
    await expect(page.getByRole("table").last()).toContainText("Movimento remoto");
    const extrato = page.getByRole("dialog");
    await extrato.getByRole("button", { name: "Próxima página" }).click();
    await expect.poll(() => chamadas.filter(url => url.pathname.endsWith("movimentacoes-financeiras")).at(-1)?.searchParams.get("page")).toBe("1");
    await extrato.getByRole("combobox", { name: "Tipo", exact: true }).click();
    await page.getByRole("option", { name: "Saída", exact: true }).click();
    await expect.poll(() => chamadas.filter(url => url.pathname.endsWith("movimentacoes-financeiras")).at(-1)?.searchParams.get("tipo")).toBe("SAIDA");
    expect(chamadas.filter(url => url.pathname.endsWith("movimentacoes-financeiras")).at(-1).searchParams.get("page")).toBe("0");
    await page.goto("/estoque");
    await page.getByRole("button", { name: "Consultar histórico" }).click();
    const historico = page.getByRole("dialog", { name: /Histórico de movimentações/ });
    await expect(historico).toContainText("ENTRADA");
    await historico.getByRole("button", { name: "Go to next page" }).click();
    await expect.poll(() => chamadas.filter(url => url.pathname.includes("/estoque/movimentacoes/produto/")).at(-1)?.searchParams.get("page")).toBe("1");
    await historico.getByRole("combobox", { name: "Tipo", exact: true }).click();
    await page.getByRole("option", { name: "SAIDA", exact: true }).click();
    await expect.poll(() => chamadas.filter(url => url.pathname.includes("/estoque/movimentacoes/produto/")).at(-1)?.searchParams.get("tipo")).toBe("SAIDA");
    expect(chamadas.filter(url => url.pathname.includes("/estoque/movimentacoes/produto/")).at(-1).searchParams.get("page")).toBe("0");
});
