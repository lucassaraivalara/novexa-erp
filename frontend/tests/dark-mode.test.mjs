import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url, createTheme;
const produto = { id: 7, nome: "Café especial 500g", codigoInterno: "CAFE", codigoBarras: "7890001", unidadeMedida: "UN",
    precoVenda: 24.9, precoCusto: 15, estoqueAtual: 50, estoqueMinimo: 5, controlaEstoque: true, ativo: true };
const usuario = { id: 9, nomeUsuario: "Administrador de teste", cpf: "52998224725", login: "admin.fixture", email: "admin@example.invalid", perfil: "ADMIN", ativo: true };
const empresa = { id: 1, razaoSocial: "Empresa de demonstração", nomeFantasia: "Loja Novexa", cnpj: "11222333000181", ativo: true, cadastro: { regimeTributario: "SIMPLES_NACIONAL", uf: "MG" } };
const cliente = { id: 3, nome: "Cliente de demonstração", nomeFantasia: "", cpfCnpj: "", telefone: "", ativo: true, enderecos: [], contatos: [] };
const fornecedor = { id: 4, razaoSocial: "Fornecedor de demonstração", nomeFantasia: "Distribuidora", cpfCnpj: "", ativo: true };

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-dark-mode-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "dark-mode-fixture", resolveId(id) { if (id === "/dark-fixture.js") return "\0dark-fixture"; },
            load(id) { if (id === "\0dark-fixture") return `
                import React from 'react'; import {createRoot} from 'react-dom/client';
                import {CssBaseline} from '@mui/material'; import {BrowserRouter} from 'react-router-dom';
                import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx';
                import AppRoutes from '/src/routes/AppRoutes.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,
                    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!["/produtos", "/clientes", "/usuarios", "/empresa", "/configuracoes", "/pdv", "/dashboard"].includes(req.url.split("?")[0])) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/dark-fixture.js"></script>'));
            }); },
        }],
    });
    ({ createNovexaTheme: createTheme } = await server.ssrLoadModule("/src/theme/theme.ts"));
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

function luminancia(cor) {
    const rgb = cor.startsWith("#") ? cor.slice(1).match(/../g).map(v => parseInt(v, 16)) : cor.match(/[\d.]+/g).slice(0, 3).map(Number);
    return rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
        .reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
}
function contraste(texto, fundo) {
    const [a, b] = [luminancia(texto), luminancia(fundo)].sort((a, b) => b - a);
    return (a + .05) / (b + .05);
}
const fundo = el => el.evaluate(e => getComputedStyle(e).backgroundColor);
async function abrir() {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const estado = { vazio: false, erro: false, escritas: [], errosJS: [] };
    page.on("pageerror", e => estado.errosJS.push(e.message));
    await page.addInitScript(({ usuario, empresa }) => {
        localStorage.setItem("novexa-auth", JSON.stringify({ ...usuario, empresa, token: "fixture-local" }));
        localStorage.setItem("novexa-theme-choice", "dark");
    }, { usuario, empresa });
    // Toda consulta HTTP da aplicação é simulada, independentemente da URL configurada.
    await page.route("**/*", async route => {
        const r = route.request();
        if (!["fetch", "xhr"].includes(r.resourceType())) return route.continue();
        const p = new URL(r.url()).pathname;
        if (r.method() !== "GET") estado.escritas.push(p);
        let dados = [];
        const pagina = items => ({ items: estado.vazio ? [] : items, page: 0, size: 25, totalItems: estado.vazio ? 0 : items.length, totalPages: estado.vazio ? 0 : 1 });
        if (p === "/produtos") dados = pagina([produto]);
        else if (p === "/produtos/buscar") dados = [produto];
        else if (p === "/clientes") dados = pagina([cliente]);
        else if (p === "/fornecedores") dados = pagina([fornecedor]);
        else if (p === "/usuarios/pagina") dados = pagina([usuario]);
        else if (["/produtos/categorias", "/produtos/subcategorias", "/produtos/marcas"].includes(p)) dados = pagina([]);
        else if (p === "/empresas/pagina") dados = pagina([empresa]);
        else if (p === "/vendas") dados = pagina([]);
        else if (p === "/dashboard/resumo") dados = { faturamentoHoje: 249, quantidadeVendasHoje: 10, ticketMedioHoje: 24.9,
            quantidadeProdutosEstoqueBaixo: 2, quantidadeClientesAtivos: 5, sessoesCaixaAbertas: [] };
        else if (p === "/empresas/geocodificacao/status") dados = { configurado: false };
        else if (p === "/financeiro/caixas/sessoes/abertas") dados = [{ sessaoId: 10, caixaId: 1, descricaoCaixa: "Caixa de teste", saldoInicial: 0, operadorAbertura: { id: 9, nome: usuario.nomeUsuario } }];
        else if (p === "/financeiro/configuracoes-formas-pagamento") dados = [{ id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true }];
        else if (p === "/usuarios/9") dados = usuario;
        const status = estado.erro ? 500 : r.method() === "GET" ? 200 : 400;
        await route.fulfill({ status, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
            contentType: "application/json", body: JSON.stringify(status === 500 ? { detail: "Falha simulada de consulta." } : dados) });
    });
    return { page, estado };
}

test("paleta escura distingue camadas e mantém contraste de texto e estados", () => {
    const { palette: p } = createTheme("dark");
    for (const bg of [p.background.default, p.background.paper]) {
        for (const fg of [p.text.primary, p.text.secondary, p.text.disabled]) assert.ok(contraste(fg, bg) >= 4.5, `${fg} em ${bg}`);
    }
    for (const cor of ["primary", "success", "warning", "error", "info"]) {
        assert.ok(contraste(p[cor].main, p[cor].light) >= 4.5, cor);
        assert.ok(contraste(p[cor].contrastText, p[cor].main) >= 4.5, `${cor} preenchida`);
    }
    assert.notEqual(p.background.default, p.background.paper);
    assert.ok(luminancia(p.background.default) > 0 && luminancia(p.background.paper) < .1);
});

test("sete telas reais usam camadas escuras em desktop, notebook, mobile e janela baixa", async () => {
    const { page, estado } = await abrir();
    try {
        const telas = [["produtos", "/produtos"], ["clientes", "/clientes"], ["fornecedores", "/produtos?aba=fornecedores"],
            ["usuarios", "/usuarios"], ["empresas", "/empresa"], ["configuracoes", "/configuracoes"], ["pdv", "/pdv"]];
        for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 640 }, { width: 390, height: 844 }, { width: 390, height: 480 }]) {
            await page.setViewportSize(viewport);
            for (const [nome, path] of telas) {
                await page.goto(url + path);
                if (nome === "pdv") {
                    const busca = page.getByRole("combobox", { name: "Buscar produto ou ler código de barras" });
                    await expect(busca).toBeEnabled();
                    await busca.fill("7890001"); await busca.press("Enter");
                    await page.getByLabel("Quantidade de Café especial 500g").waitFor();
                    const borda = await page.locator(viewport.width >= 600 ? "tbody td" : "tbody tr").first().evaluate(e => getComputedStyle(e).borderBottomColor);
                    assert.ok(luminancia(borda) < .15, "PDV: separador discreto");
                } else if (nome !== "configuracoes") {
                    await page.locator("tbody tr").filter({ hasText: /especial|demonstração|Administrador/ }).first().waitFor();
                } else await page.getByRole("heading", { name: "Configurações", exact: true }).last().waitFor();
                assert.ok(luminancia(await fundo(page.locator("body"))) < .1, nome);
                const th = page.locator("th").first();
                if (await th.count() && await th.isVisible()) {
                    const cor = await th.evaluate(e => ({ text: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
                    assert.ok(luminancia(cor.bg) < .15, `${nome}: cabeçalho não pode ficar branco`);
                    assert.ok(contraste(cor.text, cor.bg) >= 4.5, `${nome}: contraste do cabeçalho`);
                }
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), nome);
                await page.screenshot({ path: `node_modules/.vite-dark-mode-tests/${nome}-${viewport.width}x${viewport.height}.png` });
            }
        }
        assert.deepEqual(estado.escritas, []);
        assert.deepEqual(estado.errosJS, []);
    } finally { await page.close(); }
});

test("alternância claro/escuro e automático preserva tabela e seleção sem branco no dark", async () => {
    const { page } = await abrir();
    try {
        await page.goto(url + "/clientes");
        await page.locator("tbody").getByText(cliente.nome, { exact: true }).waitFor();
        const bodyDark = await fundo(page.locator("body"));
        await page.getByRole("button", { name: "Tema claro", exact: true }).click();
        await expect.poll(() => fundo(page.locator("body"))).not.toBe(bodyDark);
        const bodyLight = await fundo(page.locator("body"));
        assert.ok(luminancia(await fundo(page.locator("th").first())) > .8);
        await page.getByRole("button", { name: "Tema escuro", exact: true }).click();
        await expect.poll(() => fundo(page.locator("body"))).toBe(bodyDark);
        await page.getByRole("button", { name: "Cadastros", exact: true }).click();
        const ativo = page.getByRole("link", { name: "Clientes", exact: true });
        const cores = await ativo.evaluate(e => ({ text: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }));
        assert.ok(contraste(cores.text, cores.bg) >= 4.5);
        await page.keyboard.press("Escape");
        await page.emulateMedia({ colorScheme: "light" });
        await page.getByRole("button", { name: "Tema automático", exact: true }).click();
        await expect.poll(() => fundo(page.locator("body"))).toBe(bodyLight);
        await page.emulateMedia({ colorScheme: "dark" });
        await expect.poll(() => fundo(page.locator("body"))).toBe(bodyDark);
    } finally { await page.close(); }
});

test("Dashboard mantém indicadores legíveis e superfícies tonais escuras", async () => {
    const { page, estado } = await abrir();
    try {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(url + "/dashboard");
            const valor = page.getByText("R$ 249,00", { exact: true });
            await valor.waitFor();
            const cores = await valor.evaluate(e => ({ text: getComputedStyle(e).color,
                bg: getComputedStyle(e.closest('.MuiPaper-root')).backgroundColor }));
            assert.ok(contraste(cores.text, cores.bg) >= 4.5);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: `node_modules/.vite-dark-mode-tests/dashboard-${width}.png` });
        }
        assert.deepEqual(estado.escritas, []); assert.deepEqual(estado.errosJS, []);
    } finally { await page.close(); }
});

test("tabela, hover, menu, inputs e drawer mantêm contraste, foco e estados no dark", async () => {
    const { page, estado } = await abrir();
    try {
        await page.goto(url + "/produtos");
        const linha = page.locator("tbody tr").filter({ hasText: produto.nome });
        await linha.waitFor(); const normal = await fundo(linha);
        await linha.hover(); await expect.poll(() => fundo(linha)).not.toBe(normal);
        const campo = page.getByRole("textbox", { name: "Pesquisar por nome, código interno ou código de barras…" });
        await expect(page.getByRole("combobox", { name: "Subcategoria", exact: true })).toBeDisabled();
        const desabilitado = await page.getByRole("combobox", { name: "Subcategoria", exact: true }).evaluate(e => ({
            text: getComputedStyle(e).webkitTextFillColor, bg: getComputedStyle(e.closest('.MuiInputBase-root')).backgroundColor,
        }));
        assert.ok(contraste(desabilitado.text, desabilitado.bg) >= 4.5);
        const chip = await page.getByText("Ativo", { exact: true }).evaluate(e => {
            const c = getComputedStyle(e.closest('.MuiChip-root')); return { text: c.color, bg: c.backgroundColor };
        });
        assert.ok(contraste(chip.text, chip.bg) >= 4.5);
        assert.equal(await campo.evaluate(e => getComputedStyle(e, "::placeholder").opacity), "1");
        assert.match(await campo.evaluate(e => getComputedStyle(e).fontFamily), /Inter|Segoe UI|Roboto/);
        await campo.click(); await campo.fill("Café");
        assert.equal(await campo.inputValue(), "Café");
        const foco = await campo.locator("..").evaluate(e => getComputedStyle(e.querySelector("fieldset")).borderWidth);
        assert.equal(foco, "2px");
        await page.getByRole("combobox", { name: "Situação", exact: true }).click();
        const menu = page.getByRole("listbox"); await menu.waitFor();
        assert.ok(luminancia(await menu.evaluate(e => getComputedStyle(e.closest('.MuiPaper-root')).backgroundColor)) < .15);
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/menu-situacao.png" });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Inativar produto", exact: true }).click();
        const dialog = page.getByRole("dialog"); await dialog.waitFor();
        await expect(page.locator(".MuiDialog-container")).toHaveCSS("opacity", "1");
        assert.ok(luminancia(await fundo(dialog)) < .15);
        assert.notEqual(await fundo(dialog), await fundo(page.locator("body")));
        await page.getByRole("button", { name: "Cancelar", exact: true }).press("Tab");
        await expect(page.getByRole("button", { name: "Inativar", exact: true })).toBeFocused();
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/modal-foco.png" });
        await page.getByRole("button", { name: "Cancelar", exact: true }).click();
        await page.goto(url + "/usuarios");
        await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
        const drawer = page.locator(".MuiDrawer-paper"); await drawer.waitFor();
        assert.ok(luminancia(await fundo(drawer)) < .15);
        const nome = page.getByRole("textbox", { name: "Nome", exact: true });
        await nome.click();
        await page.keyboard.press("Tab"); await expect(page.getByRole("textbox", { name: "CPF", exact: true })).toBeFocused();
        await nome.fill("Teste visual");
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/drawer-preenchido.png" });
        await nome.fill("   ");
        await page.getByRole("textbox", { name: "CPF", exact: true }).fill("52998224725");
        await page.getByRole("textbox", { name: "Login", exact: true }).fill("fixture");
        await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("fixture@example.invalid");
        await page.locator('input[name="senha"]').fill("fixture-local-only");
        await page.getByRole("button", { name: "Salvar", exact: true }).click();
        await expect(nome).toHaveAttribute("aria-invalid", "true");
        await page.getByText("Informe o nome do usuário.", { exact: true }).waitFor();
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/drawer-erro-campo.png" });
        // Voltar à listagem sem submeter o formulário nem criar usuário.
        await page.goto(url + "/produtos");
        estado.vazio = true; await page.reload();
        await page.getByText("Nenhum produto encontrado", { exact: true }).waitFor();
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/tabela-vazia.png" });
        estado.erro = true; await page.reload();
        await page.getByRole("alert").first().waitFor();
        await page.screenshot({ path: "node_modules/.vite-dark-mode-tests/erro-consulta.png" });
        assert.deepEqual(estado.escritas, []);
        assert.deepEqual(estado.errosJS, []);
    } finally { await page.close(); }
});
