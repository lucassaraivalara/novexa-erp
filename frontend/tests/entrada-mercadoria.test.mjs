import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, regras;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const fornecedor = { id: 7, razaoSocial: "Distribuidora ABC", ativo: true };
const produto = { id: 10, nome: "Produto teste", precoCusto: 5, ativo: true, controlaEstoque: true };
const chaveNfe = "35261011222333000181550010000001231000001234";
const previewXml = (extra = {}) => ({
    fornecedorXml: { razaoSocial: "Emitente XML Ltda", nomeFantasia: "Emitente XML", cpfCnpj: "11222333000181" },
    fornecedorMatch: fornecedor, numeroNota: "123", serie: "1", dataEmissao: "2026-10-01", chaveAcessoNfe: chaveNfe,
    valorProdutos: 7, valorTotal: 9,
    itens: [{ codigoProdutoFornecedor: "FOR-123", descricaoOriginal: "Descrição da NF-e", gtin: "4006381333931",
        ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 2, valorUnitario: 3.5, valorTotal: 7,
        produtoMatch: { id: produto.id, nome: produto.nome, codigoBarras: "4006381333931" } }], ...extra,
});
const entrada = (id, status = "RASCUNHO", extra = {}) => ({
    id, status, origem: "MANUAL", fornecedorId: 7, fornecedorNome: fornecedor.razaoSocial,
    numeroNota: `N${id}`, serie: "1", dataEmissao: "2026-10-01", dataEntrada: "2026-10-02",
    valorProdutos: 10, valorTotal: 10, observacao: null, chaveAcessoNfe: null,
    itens: [{ id: id * 10, produtoId: 10, produtoNome: produto.nome, quantidade: 2, valorUnitario: 5, valorTotal: 10 }], ...extra,
});
const novoEstado = () => ({ chamadas: [], entradas: [entrada(1), entrada(2, "CONFIRMADA"), entrada(3, "CANCELADA")], falharConfirmacao: false });
const listagens = e => e.chamadas.filter(c => c.metodo === "GET" && c.caminho === "/estoque/entradas");
async function esperar(condicao) {
    for (let i = 0; i < 120 && !condicao(); i++) await new Promise(r => setTimeout(r, 50));
    assert.ok(condicao(), "Condicao nao atendida a tempo");
}

before(async () => {
    server = await createServer({
        optimizeDeps: { include: ["@mui/icons-material/UploadFileOutlined"] },
        cacheDir: "node_modules/.vite-entrada-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "entrada-fixture",
            resolveId(id) { if (id === "/fixture-entrada.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-entrada.js") return `
                import React from 'react'; import { createRoot } from 'react-dom/client';
                import { CssBaseline, ThemeProvider } from '@mui/material';
                import theme from '/src/theme/theme.ts'; import Estoque from '/src/pages/Estoque/Estoque.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider, { theme },
                    React.createElement(CssBaseline), React.createElement(Estoque)));`; },
            configureServer(vite) {
                vite.middlewares.use("/__entrada", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml("/__entrada", '<div id="root"></div><script type="module" src="/fixture-entrada.js"></script>'));
                });
            },
        }],
    });
    regras = await server.ssrLoadModule("/src/pages/Estoque/entradaMercadoriaRegras.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(estado, largura = 1440) {
    const page = await browser.newPage({ viewport: { width: largura, height: 900 } });
    page.setDefaultTimeout(6000);
    page.on("pageerror", e => console.error("Erro no navegador:", e.message));
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "t", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const responder = (status, data) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
        const multipart = req.headers()["content-type"]?.startsWith("multipart/form-data");
        const corpo = req.postData() ? multipart ? req.postData() : JSON.parse(req.postData()) : null;
        estado.chamadas.push({ metodo: req.method(), caminho: u.pathname, params: u.searchParams, corpo });
        if (u.pathname === "/estoque/entradas" && req.method() === "GET") {
            const page = Number(u.searchParams.get("page")), size = Number(u.searchParams.get("size"));
            return responder(200, { items: estado.entradas.map(e => ({ ...e, itens: null })), page, size, totalItems: 60, totalPages: Math.ceil(60 / size) });
        }
        if (u.pathname === "/estoque/entradas/importar-xml") {
            if (estado.atrasarPreview) await new Promise(r => setTimeout(r, 500));
            return responder(estado.erroPreview ?? 200, estado.erroPreview ? "Detalhe técnico que não deve aparecer no preview" : estado.preview ?? previewXml());
        }
        if ((u.pathname === "/estoque/entradas" || u.pathname === "/estoque/entradas/from-xml") && req.method() === "POST") {
            const total = corpo.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
            const criada = entrada(100, "RASCUNHO", { ...corpo, origem: u.pathname.endsWith("from-xml") ? "XML" : "MANUAL", fornecedorNome: estado.nomeNovo ?? fornecedor.razaoSocial, valorTotal: total,
                valorProdutos: total, itens: corpo.itens.map((i, n) => ({ ...i, id: 1000 + n, produtoNome: produto.nome, valorTotal: i.quantidade * i.valorUnitario })) });
            estado.entradas.push(criada); return responder(201, criada);
        }
        const detalhe = u.pathname.match(/^\/estoque\/entradas\/(\d+)(?:\/(confirmar|cancelar))?$/);
        if (detalhe) {
            const atual = estado.entradas.find(e => e.id === Number(detalhe[1]));
            if (req.method() === "GET") return responder(200, atual);
            if (req.method() === "PUT") {
                Object.assign(atual, corpo); return responder(200, atual);
            }
            if (detalhe[2] === "confirmar" && estado.falharConfirmacao) return responder(409, "Produto sem saldo disponivel para esta operacao.");
            atual.status = detalhe[2] === "confirmar" ? "CONFIRMADA" : "CANCELADA";
            return responder(200, atual);
        }
        if (u.pathname === "/fornecedores/buscar") return responder(200, estado.fornecedoresBusca ?? [fornecedor]);
        if (u.pathname === "/fornecedores" && req.method() === "POST") {
            estado.nomeNovo = corpo.razaoSocial; return responder(201, { ...fornecedor, ...corpo, id: 77 });
        }
        if (u.pathname === "/produtos/buscar") return responder(200, [produto]);
        if (u.pathname === "/produtos") return responder(200, { items: [], page: 0, size: 25, totalItems: 0, totalPages: 0 });
        throw new Error(`Chamada inesperada: ${req.method()} ${u.pathname}`);
    });
    await page.goto(`${url}/__entrada`);
    await page.getByRole("tab", { name: "Saldo", exact: true }).waitFor();
    return page;
}
async function entradas(page) {
    await page.getByRole("tab", { name: "Entradas", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "N1" }).waitFor();
}
async function preencher(page, estado) {
    await entradas(page);
    await page.getByRole("button", { name: "Entrada manual", exact: true }).click();
    const form = page.getByRole("dialog", { name: /^Entrada manual/ });
    assert.equal(estado.chamadas.some(c => c.caminho === "/produtos/buscar"), false, "Nao carrega catalogo completo");
    await form.getByRole("combobox", { name: /Fornecedor/ }).fill("dis");
    await page.getByRole("option", { name: fornecedor.razaoSocial }).click();
    await form.getByRole("combobox", { name: /Produto/ }).fill("pro");
    await page.getByRole("option", { name: produto.nome }).click();
    await form.getByLabel("Quantidade").fill("2");
    await form.getByLabel("Custo unitário").fill("5");
    await form.getByLabel("Número da nota").fill("123");
    return form;
}

test("Saldo preservado; Entradas consome items/totalItems e a ordem remota", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        assert.equal(listagens(estado).length, 0);
        await entradas(page);
        assert.ok(estado.chamadas.some(c => c.caminho === "/produtos"));
        assert.equal(listagens(estado)[0].params.get("page"), "0");
        assert.equal(listagens(estado)[0].params.get("size"), "25");
        assert.equal(listagens(estado)[0].params.get("sort"), "dataEntrada,desc");
        assert.match(await page.getByRole("table").innerText(), /N1[\s\S]*N2[\s\S]*N3/);
        assert.ok(await page.getByText(/de 60/).count());
        await page.screenshot({ path: "node_modules/.vite-entrada-tests/listagem-desktop.png", fullPage: true, animations: "disabled" });
        assert.equal(estado.chamadas.some(c => c.caminho === "/fornecedores"), false);
    } finally { await page.close(); }
});

test("pagina, size, busca com debounce, status, fornecedor, periodo e sort sao remotos", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    estado.entradas[0].valorTotal = 20;
    try {
        await entradas(page);
        await page.getByRole("button", { name: "Próxima página" }).click();
        await esperar(() => listagens(estado).some(c => c.params.get("page") === "1"));
        await page.getByRole("combobox", { name: /por página/ }).click();
        await page.getByRole("option", { name: "10", exact: true }).click();
        await esperar(() => listagens(estado).some(c => c.params.get("size") === "10" && c.params.get("page") === "0"));
        const busca = page.getByRole("textbox", { name: /Buscar por nota/ });
        await busca.fill("abc"); await busca.fill("abcd");
        await esperar(() => listagens(estado).some(c => c.params.get("termo") === "abcd"));
        assert.equal(listagens(estado).some(c => c.params.get("termo") === "abc"), false);
        await busca.fill("");
        await page.getByLabel("Status", { exact: true }).click();
        await page.getByRole("option", { name: "Confirmada", exact: true }).click();
        await page.getByRole("combobox", { name: "Fornecedor", exact: true }).fill("dis");
        await esperar(() => estado.chamadas.some(c => c.caminho === "/fornecedores/buscar" && c.params.get("termo") === "dis"));
        await page.getByRole("option", { name: fornecedor.razaoSocial }).click();
        await page.getByLabel("Data inicial").fill("2026-10-01");
        await page.getByLabel("Data final").fill("2026-10-31");
        await page.getByRole("columnheader", { name: /Valor/ }).getByText("Valor", { exact: true }).click();
        await esperar(() => listagens(estado).some(c => c.params.get("status") === "CONFIRMADA" && c.params.get("fornecedorId") === "7"
            && c.params.get("dataInicial") === "2026-10-01" && c.params.get("dataFinal") === "2026-10-31" && c.params.get("sort") === "valorTotal,asc"));
        assert.equal(listagens(estado).at(-1).params.get("page"), "0");
        assert.match(await page.getByRole("table").innerText(), /N1[\s\S]*N2[\s\S]*N3/, "Nao reordena os valores recebidos");
        assert.ok(estado.chamadas.some(c => c.caminho === "/fornecedores/buscar" && c.params.get("termo") === "dis"));
    } finally { await page.close(); }
});

test("validacao de itens aceita custo zero e rejeita quantidade/custo invalidos", () => {
    const item = { produto, quantidade: "1", custo: "0" };
    assert.equal(regras.validarItensEntrada([item]), null);
    for (const quantidade of ["0", "-1", "1.1234", "1000000000"]) assert.ok(regras.validarItensEntrada([{ ...item, quantidade }]));
    for (const custo of ["-1", "1.123", "", "1000000000000"]) assert.ok(regras.validarItensEntrada([{ ...item, custo }]));
    assert.ok(regras.validarItensEntrada([])); assert.ok(regras.validarItensEntrada([{ ...item, produto: null }]));
    assert.ok(regras.validarItensEntrada([item, item]));
    assert.equal(regras.totalPreviewEntrada([{ ...item, quantidade: "2,5", custo: "3,50" }]), 8.75);
});

test("salva rascunho, busca produto remota e nao envia tenant, totais ou estoque", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await preencher(page, estado);
        await form.getByRole("button", { name: "Salvar rascunho" }).click();
        await page.getByText("Rascunho salvo.").waitFor();
        const post = estado.chamadas.find(c => c.metodo === "POST" && c.caminho === "/estoque/entradas");
        assert.equal(post.corpo.fornecedorId, 7); assert.equal(post.corpo.numeroNota, "123");
        assert.deepEqual(post.corpo.itens, [{ produtoId: 10, quantidade: 2, valorUnitario: 5 }]);
        assert.match(post.corpo.chaveRequisicao, /^[a-f\d-]{36}$/);
        for (const campo of ["empresaId", "tenantId", "origem", "status", "valorTotal", "valorProdutos"]) assert.equal(post.corpo[campo], undefined);
        assert.equal(estado.entradas.at(-1).status, "RASCUNHO");
        assert.equal(estado.chamadas.some(c => c.caminho.endsWith("/confirmar")), false);
        assert.ok(estado.chamadas.some(c => c.caminho === "/produtos/buscar" && c.params.get("termo") === "pro"));
    } finally { await page.close(); }
});

test("confirmacao revisada cria rascunho e confirma pelo ID; lista recarrega sem update de produto", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await preencher(page, estado);
        await form.screenshot({ path: "node_modules/.vite-entrada-tests/formulario-desktop.png", animations: "disabled" });
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        const review = page.getByRole("dialog", { name: "Confirmar entrada?", exact: true });
        await review.waitFor(); assert.equal(estado.chamadas.some(c => c.metodo === "POST"), false);
        await review.getByRole("button", { name: "Confirmar entrada", exact: true }).evaluate(el => { el.click(); el.click(); });
        await page.getByText("Entrada confirmada. Estoque atualizado.").waitFor();
        const posts = estado.chamadas.filter(c => c.metodo === "POST");
        assert.deepEqual(posts.map(c => c.caminho), ["/estoque/entradas", "/estoque/entradas/100/confirmar"]);
        assert.equal(posts[1].corpo, null); assert.equal(estado.entradas.at(-1).status, "CONFIRMADA");
        assert.equal(estado.chamadas.some(c => c.metodo !== "GET" && c.caminho.startsWith("/produtos")), false);
        assert.ok(listagens(estado).length > 1);
    } finally { await page.close(); }
});

test("falha de confirmacao preserva ID e retry edita o mesmo rascunho sem novo POST", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await preencher(page, estado); estado.falharConfirmacao = true;
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByRole("dialog", { name: "Confirmar entrada?" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByText(/Rascunho preservado\./).waitFor();
        assert.equal(estado.entradas.at(-1).status, "RASCUNHO"); estado.falharConfirmacao = false;
        await page.getByRole("dialog", { name: "Editar entrada #100" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByRole("dialog", { name: "Confirmar entrada?" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByText("Entrada confirmada. Estoque atualizado.").waitFor();
        assert.equal(estado.chamadas.filter(c => c.metodo === "POST" && c.caminho === "/estoque/entradas").length, 1);
        assert.ok(estado.chamadas.some(c => c.metodo === "PUT" && c.caminho === "/estoque/entradas/100"));
    } finally { await page.close(); }
});

test("cadastro rapido reutilizado seleciona fornecedor criado e continua o formulario", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        await entradas(page); await page.getByRole("button", { name: "Entrada manual", exact: true }).click();
        await page.getByRole("dialog", { name: /^Entrada manual/ }).getByRole("button", { name: "Novo", exact: true }).click();
        const rapido = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Cadastrar e selecionar" }) });
        await rapido.getByLabel("Razão Social / Nome").fill("Fornecedor rapido novo");
        await rapido.getByRole("button", { name: "Cadastrar e selecionar" }).click();
        const form = page.getByRole("dialog", { name: /^Entrada manual/ });
        await form.getByRole("combobox", { name: /Fornecedor/ }).waitFor();
        await page.waitForFunction(() => document.querySelector('input[value="Fornecedor rapido novo"]'));
        assert.equal(await form.getByRole("combobox", { name: /Fornecedor/ }).inputValue(), "Fornecedor rapido novo");
        await form.getByRole("combobox", { name: /Produto/ }).fill("pro"); await page.getByRole("option", { name: produto.nome }).click();
        await form.getByRole("button", { name: "Salvar rascunho" }).click(); await page.getByText("Rascunho salvo.").waitFor();
        assert.equal(estado.chamadas.find(c => c.metodo === "POST" && c.caminho === "/estoque/entradas").corpo.fornecedorId, 77);
    } finally { await page.close(); }
});

test("rascunho edita via PUT; CONFIRMADA e CANCELADA sao somente leitura", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        await entradas(page);
        await page.getByRole("row").filter({ hasText: "N1" }).getByRole("button", { name: "Editar entrada" }).click();
        const edit = page.getByRole("dialog", { name: "Editar entrada #1" });
        await edit.getByLabel("Número da nota").fill("Editada"); await edit.getByRole("button", { name: "Salvar rascunho" }).click();
        await page.getByText("Rascunho salvo.").waitFor();
        assert.equal(estado.chamadas.find(c => c.metodo === "PUT").corpo.numeroNota, "Editada");
        for (const id of [2, 3]) {
            const row = page.getByRole("row").filter({ hasText: `N${id}` });
            assert.equal(await row.getByRole("button", { name: "Editar entrada" }).isDisabled(), true);
            await row.getByRole("button", { name: "Visualizar entrada" }).click();
            const detail = page.getByRole("dialog", { name: `Entrada de mercadoria #${id}` });
            assert.equal(await detail.getByLabel("Número da nota").evaluate(el => el.readOnly), true);
            assert.equal(await detail.getByLabel("Quantidade").evaluate(el => el.readOnly), true);
            assert.equal(await detail.getByRole("button", { name: "Confirmar entrada" }).count(), 0);
            await detail.getByRole("button", { name: "Fechar", exact: true }).click();
        }
    } finally { await page.close(); }
});

test("cancelamento exige confirmacao, chama endpoint e recarrega; cancelada nao permite repetir", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        await entradas(page);
        assert.equal(await page.getByRole("row").filter({ hasText: "N1" }).getByRole("button", { name: "Cancelar entrada" }).isDisabled(), true);
        await page.getByRole("row").filter({ hasText: "N2" }).getByRole("button", { name: "Cancelar entrada" }).click();
        const dialog = page.getByRole("dialog", { name: "Cancelar esta entrada?" });
        await dialog.getByRole("button", { name: "Cancelar entrada", exact: true }).click();
        await page.getByText("Entrada cancelada. Estoque revertido.").waitFor();
        const chamada = estado.chamadas.find(c => c.caminho === "/estoque/entradas/2/cancelar");
        assert.equal(chamada.metodo, "POST"); assert.equal(chamada.corpo, null);
        assert.equal(estado.entradas[1].status, "CANCELADA");
        await esperar(() => listagens(estado).length > 1);
        assert.equal(await page.getByRole("row").filter({ hasText: "N2" }).getByRole("button", { name: "Cancelar entrada" }).isDisabled(), true);
    } finally { await page.close(); }
});

test("mobile mantem tabela com scroll interno horizontal e formulario sem overflow", async () => {
    const estado = novoEstado(), page = await abrir(estado, 390);
    try {
        await entradas(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: "node_modules/.vite-entrada-tests/listagem-mobile.png", fullPage: true, animations: "disabled" });
        await page.getByRole("button", { name: "Entrada manual", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: /^Entrada manual/ });
        await dialog.waitFor();
        assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        for (const name of ["Salvar rascunho", "Confirmar entrada"]) {
            const box = await dialog.getByRole("button", { name, exact: true }).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= 390);
        }
        await page.screenshot({ path: "node_modules/.vite-entrada-tests/formulario-mobile.png", fullPage: true, animations: "disabled" });
    } finally { await page.close(); }
});

test("listagem nao filtra/ordena/pagina localmente, componentes nao usam HTTP direto", async () => {
    for (const arquivo of ["EntradasMercadoria", "EntradaMercadoriaForm", "EntradaMercadoriaItens", "EntradaXmlImportacao"]) {
        const fonte = await readFile(new URL(`../src/pages/Estoque/${arquivo}.tsx`, import.meta.url), "utf8");
        assert.doesNotMatch(fonte, /axios|api\.(get|post|put|delete)|fetch\(/);
        assert.doesNotMatch(fonte, /(linhas|entradas|items)\.(filter|sort|slice)\(/);
    }
});

async function selecionarXml(page, estado, arquivo = { name: "nota.xml", mimeType: "text/xml", buffer: Buffer.from("XML enviado sem parser frontend") }) {
    await entradas(page);
    await page.getByRole("button", { name: "Importar XML", exact: true }).click();
    const upload = page.getByRole("dialog", { name: /^Importar XML NF-e/ });
    await upload.waitFor();
    assert.equal(await upload.getByRole("button", { name: "Processar XML" }).isDisabled(), true);
    await upload.getByLabel("Arquivo XML").setInputFiles(arquivo);
    await upload.getByRole("button", { name: "Processar XML" }).click();
    if (!estado.erroPreview) await page.getByRole("dialog", { name: /^Revisar NF-e/ }).waitFor();
    return page.getByRole("dialog", { name: /^Revisar NF-e/ });
}
const criacoesXml = estado => estado.chamadas.filter(c => c.caminho === "/estoque/entradas/from-xml");

test("XML: botão, multipart arquivo, preview original e matches, sem persistencia ou estoque", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        const upload = estado.chamadas.find(c => c.caminho.endsWith("importar-xml"));
        assert.equal(upload.metodo, "POST");
        assert.match(upload.corpo, /name="arquivo"; filename="nota.xml"/);
        assert.match(upload.corpo, /XML enviado sem parser frontend/);
        for (const valor of [chaveNfe, "Emitente XML Ltda", "11222333000181", "Fornecedor encontrado", "Descrição da NF-e", "FOR-123", "4006381333931", "Produto vinculado"])
            assert.ok((await form.innerText()).includes(valor), valor);
        assert.equal(await form.getByLabel("Número da nota").inputValue(), "123");
        assert.equal(await form.getByLabel("Série", { exact: true }).inputValue(), "1");
        assert.equal(await form.getByLabel("Data de emissão").inputValue(), "2026-10-01");
        assert.equal(await form.getByRole("combobox", { name: /Fornecedor/ }).inputValue(), fornecedor.razaoSocial);
        assert.equal(await form.getByRole("combobox", { name: "Produto", exact: true }).inputValue(), produto.nome);
        assert.equal(await form.getByLabel("Custo unitário").inputValue(), "3.5", "Mantem custo do XML, nao preco do produto");
        assert.match(await form.innerText(), /Valor total \(NF-e\): R\$\s*9,00/);
        assert.match(await form.innerText(), /Total da entrada \(itens revisados\): R\$\s*7,00/);
        assert.equal(criacoesXml(estado).length, 0);
        assert.equal(estado.chamadas.filter(c => c.metodo !== "GET").length, 1);
        assert.equal(estado.chamadas.some(c => c.caminho === "/produtos/buscar"), false);
        await form.screenshot({ path: "node_modules/.vite-entrada-tests/xml-desktop.png", animations: "disabled" });
    } finally { await page.close(); }
});

test("XML: fornecedor ausente cadastra rapido com dados do emitente e seleciona o criado", async () => {
    const estado = { ...novoEstado(), preview: previewXml({ fornecedorMatch: null }) }, page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        assert.equal(await form.getByRole("button", { name: "Confirmar entrada", exact: true }).isDisabled(), true);
        await form.getByRole("button", { name: "Cadastrar fornecedor", exact: true }).click();
        const rapido = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Cadastrar e selecionar" }) });
        assert.equal(await rapido.getByLabel("Razão Social / Nome").inputValue(), "Emitente XML Ltda");
        assert.equal(await rapido.getByLabel("CPF/CNPJ").inputValue(), "11.222.333/0001-81");
        assert.equal(await rapido.getByLabel("Nome Fantasia").inputValue(), "Emitente XML");
        assert.equal(estado.chamadas.some(c => c.caminho === "/fornecedores"), false, "Nao cadastra automaticamente");
        await rapido.getByRole("button", { name: "Cadastrar e selecionar" }).click();
        await page.waitForFunction(() => document.querySelector('input[value="Emitente XML Ltda"]'));
        assert.equal(await form.getByRole("combobox", { name: /Fornecedor/ }).inputValue(), "Emitente XML Ltda");
        await form.getByRole("button", { name: "Salvar como rascunho" }).click();
        await page.getByText("Rascunho salvo.").waitFor();
        assert.equal(criacoesXml(estado)[0].corpo.fornecedorId, 77);
    } finally { await page.close(); }
});

test("XML: fornecedor inativo nao resolve; selecao remota de ativo libera entrada", async () => {
    const alternativo = { ...fornecedor, id: 8, razaoSocial: "Fornecedor ativo alternativo" };
    const estado = { ...novoEstado(), fornecedoresBusca: [alternativo], preview: previewXml({ fornecedorMatch: { ...fornecedor, ativo: false } }) }, page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByText(/Fornecedor encontrado, mas está inativo/).waitFor();
        assert.equal(await form.getByRole("combobox", { name: /Fornecedor/ }).inputValue(), "");
        assert.equal(await form.getByRole("button", { name: "Salvar como rascunho" }).isDisabled(), true);
        assert.equal(await form.getByRole("button", { name: "Cadastrar fornecedor" }).count(), 0);
        await form.getByRole("combobox", { name: /Fornecedor/ }).fill("dis");
        await esperar(() => estado.chamadas.some(c => c.caminho === "/fornecedores/buscar" && c.params.get("termo") === "dis"));
        await page.getByRole("option", { name: alternativo.razaoSocial }).click();
        assert.equal(await form.getByRole("button", { name: "Confirmar entrada", exact: true }).isDisabled(), false);
        assert.ok(estado.chamadas.some(c => c.caminho === "/fornecedores/buscar" && c.params.get("termo") === "dis"));
    } finally { await page.close(); }
});

test("XML: item sem match usa busca remota sem similaridade e preserva custo historico", async () => {
    const p = previewXml(); p.itens[0].produtoMatch = null; p.itens[0].descricaoOriginal = produto.nome; p.itens[0].gtin = null;
    const estado = { ...novoEstado(), preview: p }, page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByText("1 produto precisa ser vinculado.").waitFor();
        assert.equal(await form.getByRole("combobox", { name: "Produto", exact: true }).inputValue(), "");
        assert.equal(await form.getByRole("button", { name: "Confirmar entrada", exact: true }).isDisabled(), true);
        assert.equal(estado.chamadas.some(c => c.caminho === "/produtos/buscar"), false);
        await form.getByRole("combobox", { name: "Produto", exact: true }).fill("pro");
        await page.getByRole("option", { name: produto.nome }).click();
        assert.equal(await form.getByLabel("Custo unitário").inputValue(), "3.5");
        assert.equal(await form.getByRole("button", { name: "Confirmar entrada", exact: true }).isDisabled(), false);
        assert.ok(estado.chamadas.some(c => c.caminho === "/produtos/buscar" && c.params.get("termo") === "pro"));
        assert.equal(estado.chamadas.some(c => c.caminho === "/fornecedores" || c.metodo !== "GET" && c.caminho === "/produtos"), false);
    } finally { await page.close(); }
});

test("XML: salvar cria somente RASCUNHO/XML com metadados, sem tenant ou total fiscal enviado", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByRole("button", { name: "Salvar como rascunho" }).click();
        await page.getByText("Rascunho salvo.").waitFor();
        const corpo = criacoesXml(estado)[0].corpo;
        assert.equal(corpo.chaveAcessoNfe, chaveNfe); assert.equal(corpo.fornecedorId, fornecedor.id);
        assert.match(corpo.chaveRequisicao, /^[a-f\d-]{36}$/);
        assert.deepEqual(corpo.itens, [{ produtoId: 10, quantidade: 2, valorUnitario: 3.5,
            descricaoOriginal: "Descrição da NF-e", codigoProdutoFornecedor: "FOR-123", gtin: "4006381333931", ncm: "12345678", cfop: "5102", unidade: "UN" }]);
        for (const campo of ["empresaId", "tenantId", "status", "origem", "valorTotal", "valorProdutos"]) assert.equal(corpo[campo], undefined);
        assert.equal(estado.entradas.at(-1).status, "RASCUNHO"); assert.equal(estado.entradas.at(-1).origem, "XML");
        assert.equal(estado.chamadas.some(c => c.caminho.endsWith("/confirmar")), false);
    } finally { await page.close(); }
});

test("XML: revisao confirma pelo endpoint existente, clique duplo nao duplica e lista recarrega", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        const review = page.getByRole("dialog", { name: "Confirmar entrada?", exact: true });
        await review.getByText("Esta ação adicionará os produtos ao estoque.").waitFor();
        assert.equal(criacoesXml(estado).length, 0);
        assert.match(await review.innerText(), /Valor: R\$\s*7,00/);
        await review.getByRole("button", { name: "Confirmar entrada", exact: true }).evaluate(el => { el.click(); el.click(); });
        await page.getByText("Entrada confirmada. Estoque atualizado.").waitFor();
        assert.deepEqual(estado.chamadas.filter(c => c.metodo === "POST").map(c => c.caminho),
            ["/estoque/entradas/importar-xml", "/estoque/entradas/from-xml", "/estoque/entradas/100/confirmar"]);
        assert.equal(estado.entradas.at(-1).status, "CONFIRMADA");
        assert.equal(estado.chamadas.some(c => c.metodo !== "GET" && /\/produtos|\/estoque\/movimentacoes/.test(c.caminho)), false);
        await esperar(() => listagens(estado).length > 1);
    } finally { await page.close(); }
});

test("XML: falha na confirmacao preserva rascunho e retry usa mesmo ID sem novo from-xml", async () => {
    const estado = { ...novoEstado(), falharConfirmacao: true }, page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByRole("dialog", { name: "Confirmar entrada?" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByText(/Rascunho preservado\./).waitFor();
        estado.falharConfirmacao = false;
        await page.getByRole("dialog", { name: "Editar entrada #100" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByRole("dialog", { name: "Confirmar entrada?" }).getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await page.getByText("Entrada confirmada. Estoque atualizado.").waitFor();
        assert.equal(criacoesXml(estado).length, 1);
        assert.ok(estado.chamadas.some(c => c.metodo === "PUT" && c.caminho === "/estoque/entradas/100"));
    } finally { await page.close(); }
});

test("XML: precisao superior exige revisao explicita sem arredondar o custo original", async () => {
    const p = previewXml(); p.itens[0].quantidade = 2.1234; p.itens[0].valorUnitario = 3.567;
    const estado = { ...novoEstado(), preview: p }, page = await abrir(estado);
    try {
        const form = await selecionarXml(page, estado);
        assert.equal(await form.getByLabel("Quantidade").inputValue(), "2.1234");
        assert.equal(await form.getByLabel("Custo unitário").inputValue(), "3.567");
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await form.getByText("Informe quantidades positivas com até 3 casas decimais.").waitFor();
        assert.equal(criacoesXml(estado).length, 0);
        await form.getByLabel("Quantidade").fill("2.123");
        await form.getByRole("button", { name: "Confirmar entrada", exact: true }).click();
        await form.getByText("Informe custos não negativos com até 2 casas decimais.").waitFor();
        await form.getByLabel("Custo unitário").fill("3.57");
        await form.getByRole("button", { name: "Salvar como rascunho" }).click();
        await page.getByText("Rascunho salvo.").waitFor();
        assert.equal(criacoesXml(estado)[0].corpo.itens[0].valorUnitario, 3.57);
    } finally { await page.close(); }
});

for (const [status, mensagem] of [[409, "Esta nota fiscal já foi importada."], [400, "Não foi possível ler este XML."],
    [422, "Este arquivo não contém uma NF-e válida."], [413, "O arquivo XML deve ter no máximo 2 MB."]]) {
    test(`XML: erro ${status} amigavel sem preview inconsistente ou detalhe tecnico`, async () => {
        const estado = { ...novoEstado(), erroPreview: status }, page = await abrir(estado);
        try {
            await selecionarXml(page, estado);
            const upload = page.getByRole("dialog", { name: /^Importar XML NF-e/ });
            await upload.getByText(mensagem, { exact: false }).waitFor();
            assert.doesNotMatch(await upload.innerText(), /Detalhe técnico/);
            assert.equal(await page.getByRole("dialog", { name: /^Revisar NF-e/ }).count(), 0);
            assert.equal(criacoesXml(estado).length, 0);
        } finally { await page.close(); }
    });
}

test("XML: valida arquivo unico, extensao, vazio e limite de 2 MB antes do upload", async () => {
    const estado = novoEstado(), page = await abrir(estado);
    try {
        await entradas(page); await page.getByRole("button", { name: "Importar XML", exact: true }).click();
        const upload = page.getByRole("dialog", { name: /^Importar XML NF-e/ });
        assert.equal(await upload.getByLabel("Arquivo XML").getAttribute("accept"), ".xml");
        assert.equal(await upload.getByLabel("Arquivo XML").getAttribute("multiple"), null);
        for (const [name, buffer, mensagem] of [["nota.txt", Buffer.from("texto"), "Selecione um arquivo .xml de NF-e."],
            ["vazio.xml", Buffer.alloc(0), "O arquivo XML está vazio."],
            ["grande.xml", Buffer.alloc(2 * 1024 * 1024 + 1), "O arquivo XML deve ter no máximo 2 MB."]]) {
            await upload.getByLabel("Arquivo XML").setInputFiles({ name, mimeType: "text/xml", buffer });
            await upload.getByRole("button", { name: "Processar XML" }).click();
            await upload.getByText(mensagem).waitFor();
        }
        assert.equal(estado.chamadas.some(c => c.caminho.endsWith("importar-xml")), false);
    } finally { await page.close(); }
});

test("XML: processing bloqueia duplo upload e fechamento", async () => {
    const estado = { ...novoEstado(), atrasarPreview: true }, page = await abrir(estado);
    try {
        await entradas(page); await page.getByRole("button", { name: "Importar XML", exact: true }).click();
        const upload = page.getByRole("dialog", { name: /^Importar XML NF-e/ });
        await upload.getByLabel("Arquivo XML").setInputFiles({ name: "nota.XML", mimeType: "text/xml", buffer: Buffer.from("xml") });
        await upload.getByRole("button", { name: "Processar XML" }).evaluate(el => { el.click(); el.click(); });
        await upload.getByRole("status").waitFor();
        assert.equal(await upload.getByRole("button", { name: "Fechar", exact: true }).isDisabled(), true);
        await page.getByRole("dialog", { name: /^Revisar NF-e/ }).waitFor();
        assert.equal(estado.chamadas.filter(c => c.caminho.endsWith("importar-xml")).length, 1);
    } finally { await page.close(); }
});

test("XML: varios itens empilhados e preview mobile sem overflow", async () => {
    const p = previewXml();
    p.itens = [...p.itens, ...Array.from({ length: 9 }, (_, i) => ({ ...p.itens[0], descricaoOriginal: `Item XML ${i + 2}`, produtoMatch: null }))];
    const estado = { ...novoEstado(), preview: p }, page = await abrir(estado, 390);
    try {
        const form = await selecionarXml(page, estado);
        await form.getByText("9 produtos precisam ser vinculados.").waitFor();
        assert.equal(await form.getByRole("combobox", { name: "Produto", exact: true }).count(), 10);
        assert.ok(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const nome of ["Salvar como rascunho", "Confirmar entrada"]) {
            const box = await form.getByRole("button", { name: nome, exact: true }).boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= 390);
        }
        await form.screenshot({ path: "node_modules/.vite-entrada-tests/xml-mobile.png", animations: "disabled" });
    } finally { await page.close(); }
});

test("XML: cadastro de fornecedor pendente no mobile permanece acessivel e sem overflow", async () => {
    const estado = { ...novoEstado(), preview: previewXml({ fornecedorMatch: null }) }, page = await abrir(estado, 390);
    try {
        const form = await selecionarXml(page, estado);
        assert.ok(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        const cadastro = form.getByRole("button", { name: "Cadastrar fornecedor", exact: true });
        const box = await cadastro.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 390);
        await cadastro.click();
        const rapido = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Cadastrar e selecionar" }) });
        await rapido.waitFor();
        assert.ok(await rapido.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        assert.equal(await rapido.getByLabel("Razão Social / Nome").inputValue(), "Emitente XML Ltda");
    } finally { await page.close(); }
});
