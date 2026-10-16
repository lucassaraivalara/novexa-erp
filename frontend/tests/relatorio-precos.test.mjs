import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const artefatos = "node_modules/etapa7-validacao";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const produtos = Array.from({ length: 205 }, (_, i) => ({
    id: i + 1, empresaId: 1, nome: `Produto ${String(i + 1).padStart(3, "0")}`,
    codigoInterno: `SKU-${String(i + 1).padStart(3, "0")}`, unidadeMedida: "UN",
    precoVenda: i + 10.5, precoCusto: i + 3.25, ativo: i < 201,
    codigoBarras: null, descricao: null, estoqueAtual: 0, estoqueMinimo: 0, controlaEstoque: true,
}));

before(async () => {
    await mkdir(artefatos, { recursive: true });
    server = await createServer({ cacheDir: "node_modules/.vite-relatorio-precos-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false } });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(estado = {}, sessao = { perfil: "USUARIO", empresa: { id: 1, nomeFantasia: "Empresa teste" }, token: "token-1" }) {
    const context = await browser.newContext({ viewport: estado.viewport ?? { width: 1536, height: 864 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await context.addInitScript(sessao => {
        if (sessao) localStorage.setItem("novexa-auth", JSON.stringify(sessao));
    }, sessao);
    estado.chamadas = [];
    await context.route("http://localhost:8080/**", async route => {
        const request = route.request();
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const u = new URL(request.url());
        if (u.pathname !== "/produtos") return route.fulfill({ json: [], headers: cors });
        const q = Object.fromEntries(u.searchParams);
        estado.chamadas.push({ ...q, metodo: request.method(), token: request.headers().authorization });
        assert.equal(request.method(), "GET");
        const empresa = Number(request.headers().authorization?.split("-").at(-1)) || 1;
        let items = produtos.map(p => ({ ...p, empresaId: empresa }));
        if (q.situacao !== "todos") items = items.filter(p => p.ativo === (q.situacao === "ativos"));
        if (q.busca?.trim()) items = items.filter(p => String(p[q.campoBusca ?? "nome"]).toLowerCase().includes(q.busca.trim().toLowerCase()));
        const [campo = "nome", direcao = "asc"] = (q.sort ?? "nome,asc").split(",");
        items.sort((a, b) => (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : a.id - b.id) * (direcao === "asc" ? 1 : -1));
        const size = Number(q.size), page = Number(q.page);
        let resposta = { items: items.slice(page * size, (page + 1) * size), page, size, totalItems: items.length, totalPages: Math.ceil(items.length / size) };
        if (size === 100 && estado.responderImpressao) {
            const resultado = await estado.responderImpressao(resposta, q, route);
            if (resultado === false) return;
            resposta = resultado ?? resposta;
        }
        await route.fulfill({ json: resposta, headers: cors }).catch(() => {});
    });
    await page.goto(`${url}/produtos?origem=consulta`);
    if (sessao) {
        await page.getByRole("button", { name: "Relatório de preços", exact: true }).click();
        await page.getByRole("dialog").getByRole("cell", { name: "Produto 001", exact: true }).waitFor();
    }
    return { page, context, dialog: page.getByRole("dialog") };
}
const preparar = async page => {
    const nova = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Preparar impressão / PDF", exact: true }).click();
    return nova;
};

test("abertura, filtros, ordenação e paginação consultam o servidor e preservam o cadastro", async () => {
    const estado = {};
    const { page, context, dialog } = await abrir(estado);
    try {
        await expect(dialog.getByText("1–25 de 201", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Próxima página" }).click();
        await expect(dialog.getByRole("cell", { name: "Produto 026", exact: true })).toBeVisible();
        assert.equal(estado.chamadas.at(-1).page, "1");
        await dialog.getByRole("columnheader", { name: "Preço de venda" }).click();
        await expect.poll(() => estado.chamadas.at(-1).sort).toBe("precoVenda,asc");
        assert.equal(estado.chamadas.at(-1).page, "0");
        await dialog.getByRole("columnheader", { name: "Preço de venda" }).click();
        await expect(dialog.locator("tbody tr").first()).toContainText("Produto 201");
        await dialog.getByRole("textbox").fill("Produto 019");
        await expect(dialog.locator("tbody tr")).toHaveCount(1);
        assert.equal(estado.chamadas.at(-1).campoBusca, "nome");
        await dialog.getByRole("combobox", { name: "Pesquisar em" }).click();
        await page.getByRole("option", { name: "Código interno / SKU", exact: true }).click();
        await dialog.getByRole("textbox").fill("SKU-020");
        await expect(dialog.getByRole("cell", { name: "Produto 020", exact: true })).toBeVisible();
        assert.equal(estado.chamadas.at(-1).campoBusca, "codigoInterno");
        await dialog.getByRole("textbox").fill("");
        await dialog.getByRole("combobox", { name: "Situação", exact: true }).click();
        await page.getByRole("option", { name: "Inativos", exact: true }).click();
        await expect(dialog.locator("tbody tr")).toHaveCount(4);
        await expect(dialog.locator("tbody tr").first()).toContainText("Inativo");
        await dialog.getByRole("combobox", { name: "Situação", exact: true }).click();
        await page.getByRole("option", { name: "Todas", exact: true }).click();
        await expect(dialog.getByText("1–25 de 205", { exact: true })).toBeVisible();
        assert.equal(estado.chamadas.at(-1).campoBusca, undefined);
        await dialog.getByRole("button", { name: "Voltar aos produtos" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        assert.ok(page.url().endsWith("/produtos?origem=consulta"));
        assert.ok(estado.chamadas.every(q => !q.empresaId && q.token === "Bearer token-1"));
    } finally { await context.close(); }
});

test("impressão aguarda todas as páginas, mantém seis campos e usa janela separada", async () => {
    let liberar;
    const pendente = new Promise(resolve => { liberar = resolve; });
    const estado = { responderImpressao: async (resposta, q) => { if (q.page === "1") await pendente; return resposta; } };
    const { page, context, dialog } = await abrir(estado);
    try {
        const popup = await preparar(page);
        await expect(dialog.getByRole("button", { name: "Preparando…" })).toBeDisabled();
        await expect(popup.getByText("Carregados 100 de 201 produtos…", { exact: true })).toBeVisible();
        await expect(popup.getByRole("button", { name: "Imprimir / Salvar como PDF" })).toHaveCount(0);
        liberar();
        const imprimir = popup.getByRole("button", { name: "Imprimir / Salvar como PDF" });
        await expect(imprimir).toBeVisible();
        await expect(popup.locator("tbody tr")).toHaveCount(201);
        assert.deepEqual(estado.chamadas.filter(q => q.size === "100").map(q => q.page), ["0", "1", "2"]);
        assert.deepEqual(await popup.getByRole("columnheader").allTextContents(), ["Produto", "Código interno / SKU", "Unidade", "Preço de venda", "Custo", "Situação"]);
        await expect(popup.locator("tbody tr").first()).toContainText("SKU-001");
        await expect(popup.locator("tbody tr").first()).toContainText("R$ 3,25");
        assert.equal(await popup.evaluate(() => window.opener), null);
        await popup.evaluate(() => { window.print = () => { window.imprimiu = true; }; });
        await imprimir.click();
        assert.equal(await popup.evaluate(() => window.imprimiu), true);
        await popup.emulateMedia({ media: "print" });
        await expect(imprimir).toBeHidden();
        await popup.pdf({ path: `${artefatos}/relatorio-precos.pdf`, preferCSSPageSize: true });
        await popup.screenshot({ path: `${artefatos}/impressao.png` });
    } finally { liberar(); await context.close(); }
});

for (const falha of ["http", "incompleto", "duplicado", "outra-empresa", "sessao", "contagem"]) {
    test(`preparação não libera impressão com ${falha}`, async () => {
        const estado = {};
        const { page, context, dialog } = await abrir(estado);
        estado.responderImpressao = async (resposta, q, route) => {
            if (q.page !== "1") return resposta;
            if (falha === "http") { await route.fulfill({ status: 500, headers: cors, body: "Falha de consulta" }); return false; }
            if (falha === "sessao") await page.evaluate(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "token-2", empresa: { id: 2 } })));
            if (falha === "incompleto") resposta.items.pop();
            if (falha === "duplicado") resposta.items[0].id = 1;
            if (falha === "outra-empresa") resposta.items[0].empresaId = 2;
            if (falha === "contagem") resposta.totalItems++;
            return resposta;
        };
        try {
            const popup = await preparar(page);
            await expect(dialog.getByRole("alert")).toBeVisible();
            await expect.poll(() => popup.isClosed()).toBe(true);
            await expect(dialog.getByRole("button", { name: "Preparar impressão / PDF" })).toBeEnabled();
        } finally { await context.close(); }
    });
}

test("bloqueador de pop-up e cancelamento mantêm o cadastro disponível", async () => {
    const estado = {};
    const { page, context, dialog } = await abrir(estado);
    try {
        await page.evaluate(() => { window.abrirOriginal = window.open; window.open = () => null; });
        await dialog.getByRole("button", { name: "Preparar impressão / PDF" }).click();
        await expect(dialog.getByRole("alert")).toContainText("Permita abrir uma nova janela");
        await page.evaluate(() => { window.open = window.abrirOriginal; });
        let liberar;
        const pendente = new Promise(resolve => { liberar = resolve; });
        estado.responderImpressao = async resposta => { await pendente; return resposta; };
        const popup = await preparar(page);
        await dialog.getByRole("button", { name: "Cancelar e fechar" }).click();
        liberar();
        await expect.poll(() => popup.isClosed()).toBe(true);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Relatório de preços", exact: true })).toBeVisible();
    } finally { await context.close(); }
});

test("acesso autenticado preserva os perfis existentes e a empresa da sessão", async () => {
    for (const perfil of ["ADMIN", "GERENTE", "USUARIO"]) {
        const estado = {};
        const { page, context } = await abrir(estado, { perfil, token: "token-2", empresa: { id: 2, nomeFantasia: "Outra empresa" } });
        try {
            const popup = await preparar(page);
            await expect(popup.getByText("Outra empresa", { exact: true })).toBeVisible();
            assert.ok(estado.chamadas.every(q => q.token === "Bearer token-2" && !q.empresaId));
        } finally { await context.close(); }
    }
    const { page, context } = await abrir({}, null);
    try { await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole("button", { name: "Relatório de preços", exact: true })).toHaveCount(0); }
    finally { await context.close(); }
});

test("desktop, notebook, mobile e janela baixa preservam rolagem interna, ações e foco", async () => {
    for (const [nome, width, height] of [["desktop", 1920, 1080], ["notebook", 1366, 768], ["mobile", 390, 844], ["baixa", 1366, 320]]) {
        const { page, context, dialog } = await abrir({ viewport: { width, height } });
        try {
            await expect(dialog.getByRole("button", { name: "Preparar impressão / PDF" })).toBeInViewport();
            await dialog.getByRole("textbox").focus();
            await expect(dialog.getByRole("textbox")).toBeFocused();
            const medidas = await dialog.evaluate(el => ({ largura: el.getBoundingClientRect().width, scroll: el.scrollWidth,
                tabela: el.querySelector(".MuiTableContainer-root").scrollWidth, container: el.querySelector(".MuiTableContainer-root").clientWidth }));
            assert.ok(medidas.largura <= width && medidas.scroll <= medidas.largura + 1, JSON.stringify(medidas));
            if (width < 820) assert.ok(medidas.tabela > medidas.container);
            await page.screenshot({ path: `${artefatos}/${nome}.png`, animations: "disabled" });
            await dialog.locator(".MuiDialogContent-root").evaluate(el => { el.scrollTop = el.scrollHeight; });
            await expect(dialog.getByText("1–25 de 201", { exact: true })).toBeInViewport();
            if (width < 820) {
                await dialog.locator(".MuiTableContainer-root").evaluate(el => { el.scrollLeft = el.scrollWidth; });
                await expect(dialog.getByRole("columnheader", { name: "Custo", exact: true })).toBeAttached();
            }
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Relatório de preços", exact: true })).toBeFocused();
        } finally { await context.close(); }
    }
});
