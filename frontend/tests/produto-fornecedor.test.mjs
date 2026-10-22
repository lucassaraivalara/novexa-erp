import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const fixture = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material'; import {BrowserRouter} from 'react-router-dom';
import AppRoutes from '/src/routes/AppRoutes.tsx'; import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-produto-fornecedor-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "produto-fornecedor-fixture", resolveId(id) { if (id === "/produto-fornecedor-fixture.js") return "\0produto-fornecedor-fixture"; },
            load(id) { if (id === "\0produto-fornecedor-fixture") return fixture; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!req.url.startsWith("/produtos")) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/produto-fornecedor-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`; browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const fornecedor = (id, nome, ativo = true) => ({ id, razaoSocial: nome, nomeFantasia: null, ativo });
const produto = { id: 10, empresaId: 1, codigoInterno: "P-01", codigoBarras: null, nome: "Produto teste", descricao: null, unidadeMedida: "UN", precoCusto: 3,
    precoVenda: 10, estoqueAtual: 0, estoqueMinimo: 0, controlaEstoque: true, ativo: true, imagemUrl: null, imagemPath: null, dataCadastro: "2026-10-17T10:00:00" };
const novoEstado = () => ({ chamadas: [], fornecedores: [fornecedor(1, "Distribuidora inicial"), fornecedor(2, "Outra distribuidora")],
    produtos: [{ ...produto, fornecedor: fornecedor(1, "Distribuidora inicial") }], erroBusca: false, erroSalvar: false, detalhe: null });
async function abrir(e, viewport = { width: 1440, height: 900 }) {
    const p = await browser.newPage({ viewport }); p.setDefaultTimeout(10000);
    await p.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "teste", perfil: "OPERADOR", nomeUsuario: "Teste", empresa: { id: 1, nomeFantasia: "Empresa teste" } })));
    await p.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const body = req.postData() ? JSON.parse(req.postData()) : null;
        e.chamadas.push({ path: u.pathname, metodo: req.method(), params: u.searchParams, body, auth: req.headers().authorization });
        const responder = (status, dados) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(dados) });
        if(u.pathname==="/produtos/composicao/capacidade")return responder(e.kitIndisponivel?404:200,{habilitado:!e.kitIndisponivel});
        if (u.pathname === "/produtos/buscar") return responder(200, [produto]);
        if (/\/produtos\/\d+\/composicoes$/.test(u.pathname)) return responder(200, e.composicoes ?? []);
        const tipo = u.pathname.match(/^\/produtos\/(categorias|subcategorias|marcas)$/)?.[1];
        if (tipo) {
            if (e.erroClassificacao) return responder(503, "Classificação indisponível");
            let items = tipo === "categorias" ? categorias : tipo === "marcas" ? marcas : subcategorias.filter(s => s.categoria.id === Number(u.searchParams.get("categoriaId")));
            items = items.filter(i => i.nome.toLowerCase().includes((u.searchParams.get("termo") ?? "").toLowerCase()));
            return responder(200, { items, page: 0, size: 25, totalItems: items.length, totalPages: 1 });
        }
        if (u.pathname === "/fornecedores/buscar") {
            if (e.erroBusca) return responder(503, "Consulta indisponível");
            return responder(200, e.fornecedores.filter(f => f.ativo && f.razaoSocial.toLowerCase().includes((u.searchParams.get("termo") ?? "").toLowerCase())).slice(0, 20));
        }
        if (u.pathname === "/produtos" && req.method() === "GET") {
            let itens = e.produtos.filter(p => p.nome.toLowerCase().includes((u.searchParams.get("busca") ?? "").toLowerCase()));
            for (const [campo, vinculo] of [["categoriaId", "categoria"], ["subcategoriaId", "subcategoria"], ["marcaId", "marca"]]) if (u.searchParams.has(campo)) itens = itens.filter(p => p[vinculo]?.id === Number(u.searchParams.get(campo)));
            return responder(200, { items: itens, page: 0, size: 25, totalItems: itens.length, totalPages: itens.length ? 1 : 0 });
        }
        const id = u.pathname.match(/^\/produtos\/(\d+)$/);
        if (id && req.method() === "GET") return responder(200, e.detalhe ?? e.produtos.find(p => p.id === Number(id[1])));
        if ((id && req.method() === "PUT") || (u.pathname === "/produtos" && req.method() === "POST")) {
            if (e.erroSalvar) return responder(404, "Fornecedor não encontrado para a empresa informada.");
            const salvo = { ...produto, ...body, id: id ? Number(id[1]) : 500, fornecedor: e.fornecedores.find(f => f.id === body.fornecedorId) ?? null };
            // Resposta simulada da API; o frontend não calcula o código.
            salvo.codigoInterno = body.codigoInterno || (id ? produto.codigoInterno : "2049");
            salvo.categoria = categorias.find(c => c.id === body.categoriaId) ?? null; salvo.subcategoria = subcategorias.find(c => c.id === body.subcategoriaId) ?? null; salvo.marca = marcas.find(c => c.id === body.marcaId) ?? null;
            if (id) e.produtos.splice(e.produtos.findIndex(p => p.id === salvo.id), 1, salvo); else e.produtos.push(salvo);
            return responder(id ? 200 : 201, salvo);
        }
        return responder(200, []);
    });
    await p.goto(`${url}/produtos?origem=consulta`); await expect(p.getByRole("cell", { name: /Produto teste/ })).toBeVisible(); return p;
}
async function editar(p) { await p.getByRole("row").filter({ has: p.getByRole("cell", { name: /Produto teste/ }) }).getByRole("button", { name: "Editar produto", exact: true }).click(); return p.getByRole("dialog"); }
const aba = (d, nome) => d.getByRole("tab", { name: nome, exact: true }).click();
const categorias = [{ id: 10, nome: "Bebidas", ativo: true }, { id: 11, nome: "Alimentos", ativo: true }];
const subcategorias = [{ id: 20, nome: "Sucos", ativo: true, categoria: categorias[0] }, { id: 21, nome: "Massas", ativo: true, categoria: categorias[1] }];
const marcas = [{ id: 30, nome: "Marca teste", ativo: true }];
const gravacoes = e => e.chamadas.filter(c => ["POST", "PUT"].includes(c.metodo));

test("listagem compacta omite descrições repetidas e campos vazios, preservando nomes e metadados", async () => {
    const e = novoEstado();
    const descricaoLonga = "Água mineral natural sem gás, envasada na fonte e indicada para consumo diário. ".repeat(4).trim();
    const nomeLongo = "Produto com nome extenso para conferir a leitura completa sem encobrir as colunas vizinhas da listagem";
    e.produtos = [
        { ...produto, descricao: "  PRODUTO — TESTE!!!  " },
        { ...produto, id: 11, nome: "Água Mineral 500ml", descricao: descricaoLonga, marca: marcas[0], categoria: categorias[0], subcategoria: subcategorias[0], fornecedor: fornecedor(1, "Distribuidora inicial", false) },
        { ...produto, id: 12, nome: "Amendoim Torrado 100g", descricao: "  AMENDOIM, torrado   100g. " },
        { ...produto, id: 13, nome: "Sem informações adicionais", descricao: "   ", marca: { id: 31, nome: " " }, fornecedor: fornecedor(2, " "), ativo: false },
        { ...produto, id: 14, nome: nomeLongo, composto: true },
    ];
    const originais = structuredClone(e.produtos), p = await abrir(e);
    try {
        const simples = p.getByRole("row").filter({ has: p.getByRole("cell", { name: "Produto teste", exact: true }) });
        const detalhado = p.getByRole("row").filter({ hasText: "Água Mineral 500ml" });
        await expect(simples.getByRole("cell").nth(1).locator("p")).toHaveCount(1);
        await expect(p.getByRole("cell", { name: "Amendoim Torrado 100g", exact: true })).toBeVisible();
        await expect(p.getByRole("cell", { name: "Sem informações adicionais", exact: true }).locator("p")).toHaveCount(1);
        await expect(detalhado.getByText(descricaoLonga, { exact: true })).toHaveAttribute("title", descricaoLonga);
        await expect(detalhado.getByText("Marca teste · Bebidas · Sucos · Distribuidora inicial (inativo)", { exact: true })).toBeVisible();
        await expect(p.getByText(/Categoria: —|Marca: —|Fornecedor: Não informado/)).toHaveCount(0);
        await expect(simples.locator(".MuiChip-root").filter({ hasText: "Ativo" })).toHaveClass(/MuiChip-filled/);
        await expect(p.getByRole("row").filter({ hasText: "Sem informações adicionais" }).locator(".MuiChip-root")).toHaveClass(/MuiChip-outlined/);
        for (const acao of ["Editar produto", "Criar novo produto baseado neste", "Inativar produto"]) {
            await expect(simples.getByRole("button", { name: acao, exact: true })).toBeEnabled();
        }
        await mkdir("node_modules/produtos-listagem-validacao", { recursive: true });
        for (const [nome, viewport] of [["desktop", { width: 1440, height: 900 }], ["notebook", { width: 1024, height: 600 }]]) {
            await p.setViewportSize(viewport);
            const medidas = await simples.evaluate(row => ({ altura: row.getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth }));
            assert.ok(medidas.altura <= 50, `Linha sem metadados deve ser compacta: ${medidas.altura}px`);
            assert.equal(medidas.overflow, false, "A tabela deve rolar dentro do próprio contêiner");
            const nomeCompleto = p.getByText(`${nomeLongo} (Kit/Combo)`, { exact: true });
            await expect(nomeCompleto).toHaveCSS("white-space", "normal");
            const texto = await nomeCompleto.evaluate(el => ({ altura: el.clientHeight, linha: parseFloat(getComputedStyle(el).lineHeight), largura: el.clientWidth, conteudo: el.scrollWidth }));
            assert.ok(texto.altura > texto.linha, "O nome longo deve poder quebrar linha");
            assert.ok(texto.conteudo <= texto.largura, "O nome não deve invadir outras colunas");
            await expect(detalhado.getByText(descricaoLonga, { exact: true })).toHaveCSS("text-overflow", "ellipsis");
            await p.screenshot({ path: `node_modules/produtos-listagem-validacao/${nome}.png`, fullPage: true });
        }
        assert.deepEqual(e.produtos, originais, "A apresentação não deve alterar os dados originais");
        assert.equal(gravacoes(e).length, 0);
        assert.ok(!e.chamadas.some(c => /^\/produtos\/\d+$/.test(c.path)), "A listagem não deve consultar cada produto");
    } finally { await p.close(); }
});

test("duplicar revisa dados, limpa identificadores e cria novo produto sem tocar na origem", async () => {
    const e = novoEstado();
    e.produtos[0] = { ...e.produtos[0], codigoBarras: "7890000000011", estoqueAtual: 12, ativo: false, ncm: "12345678", cest: "1234567" };
    const p = await abrir(e);
    try {
        const origem = { ...e.produtos[0] };
        const linha = p.getByRole("row").filter({ has: p.getByRole("cell", { name: /Produto teste/ }) });
        await linha.getByRole("button", { name: "Criar novo produto baseado neste" }).click();
        const d = p.getByRole("dialog");
        await expect(d.getByText("Duplicar produto")).toBeVisible();
        await expect(d.getByRole("textbox", { name: "Código de barras" })).toHaveValue("");
        await aba(d, "Fiscal");
        await expect(d.getByRole("textbox", { name: "NCM" })).toHaveValue("12345678");
        await expect(d.getByRole("textbox", { name: "CEST" })).toHaveValue("1234567");
        await aba(d, "Dados gerais");
        await expect(d.getByRole("radio", { name: "Gerar automaticamente" })).toBeChecked();
        await expect(d.getByRole("textbox", { name: "Código interno" })).toHaveCount(0);
        await aba(d, "Preços e estoque");
        await expect(d.getByText("Saldo atual:")).toBeVisible();
        await d.getByRole("button", { name: "Criar produto" }).click();
        await expect(d).toHaveCount(0);
        const criacao = gravacoes(e).at(-1);
        assert.equal(criacao.metodo, "POST");
        assert.equal(criacao.body.codigoInterno, null);
        assert.equal(criacao.body.codigoBarras, null);
        assert.equal(criacao.body.estoqueAtual, undefined);
        assert.equal(criacao.body.ativo, true);
        assert.equal(criacao.body.ncm, "12345678");
        assert.deepEqual(e.produtos[0], origem);
    } finally { await p.close(); }
});

test("duplicar permite código manual e exige preenchimento antes do POST", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        const linha = p.getByRole("row").filter({ has: p.getByRole("cell", { name: /Produto teste/ }) });
        await linha.getByRole("button", { name: "Criar novo produto baseado neste" }).click();
        const d = p.getByRole("dialog");
        await d.getByRole("radio", { name: "Informar manualmente" }).check();
        await d.getByRole("button", { name: "Criar produto" }).click();
        await expect(d.getByText("Informe um código interno válido.")).toBeVisible();
        assert.equal(gravacoes(e).length, 0);
        await d.getByRole("textbox", { name: "Código interno" }).fill("2050");
        await d.getByRole("button", { name: "Criar produto" }).click();
        await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.codigoInterno, "2050");
        assert.equal(gravacoes(e).at(-1).metodo, "POST");
    } finally { await p.close(); }
});

test("duplicar Kit não herda composição, custo calculado nem saldo", async () => {
    const e = novoEstado();
    e.produtos[0] = { ...e.produtos[0], composto: true, precoCusto: 18, estoqueAtual: 7,
        componentes: [{ produtoId: 23, nome: "Componente", unidade: "UN", quantidadePorKit: 2, estoqueAtual: 14 }] };
    const p = await abrir(e);
    try {
        const linha = p.getByRole("row").filter({ has: p.getByRole("cell", { name: /Produto teste/ }) });
        await linha.getByRole("button", { name: "Criar novo produto baseado neste" }).click();
        const d = p.getByRole("dialog");
        await aba(d, "Kit/Combo");
        await expect(d.getByText(/A composição e o custo calculado/)).toBeVisible();
        await aba(d, "Preços e estoque");
        await expect(d.getByRole("textbox", { name: "Preço de custo" })).toHaveValue("0,00");
        await d.getByRole("button", { name: "Criar produto" }).click();
        await expect(d).toHaveCount(0);
        const novo = gravacoes(e).at(-1).body;
        assert.equal(novo.composto, false);
        assert.equal(novo.precoCusto, 0);
        assert.equal(novo.componentes, undefined);
        assert.equal(novo.estoqueAtual, undefined);
        assert.equal(e.chamadas.some(c => c.path === "/produtos/10/composicoes"), false);
    } finally { await p.close(); }
});

for (const viewport of [{width:1440,height:900}, {width:390,height:480}]) {
    test(`Código interno opcional exibe somente o valor retornado pela API em ${viewport.width}px`, async () => {
        const e=novoEstado(), p=await abrir(e,viewport);
        try {
            await p.getByRole("button",{name:"Novo produto",exact:true}).click();
            const d=p.getByRole("dialog"), codigo=d.getByRole("textbox",{name:"Código interno",exact:true});
            await expect(codigo).toHaveValue("");
            await expect(codigo).toHaveAccessibleDescription("Opcional: gerado automaticamente ao cadastrar.");
            await codigo.fill("   ");
            await d.getByRole("textbox",{name:"Nome",exact:true}).fill("Produto com código automático");
            await aba(d, "Preços e estoque");
            await d.getByRole("textbox",{name:"Preço de venda",exact:true}).fill("10");
            await d.getByRole("button",{name:"Cadastrar produto",exact:true}).click();
            await expect(d).toHaveCount(0);
            assert.equal(gravacoes(e).at(-1).body.codigoInterno,null);
            const row=p.getByRole("row").filter({has:p.getByRole("cell",{name:/Produto com código automático/})});
            await expect(row.getByText("2049",{exact:true})).toBeVisible();
            assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        } finally {await p.close();}
    });
}

test("Edição informa preservação e listagem identifica código legado ausente sem placeholder",async()=>{
    const e=novoEstado();e.produtos[0].codigoInterno=null;
    const p=await abrir(e);
    try {
        await expect(p.getByText("Sem código interno",{exact:true})).toBeVisible();
        const d=await editar(p), campo=d.getByRole("textbox",{name:"Código interno",exact:true});
        await expect(campo).toHaveAccessibleDescription("Produto legado sem código: informe um código para identificá-lo.");
        await campo.fill("SKU-INFORMADO");
        await d.getByRole("button",{name:"Salvar alterações",exact:true}).click();
        await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.codigoInterno,"SKU-INFORMADO");
        await expect(p.getByText("SKU-INFORMADO",{exact:true})).toBeVisible();
    } finally {await p.close();}
});

test("Kit/Combo aguarda suporte da API sem bloquear cadastro simples",async()=>{
    const e=novoEstado();e.kitIndisponivel=true;const p=await abrir(e);
    try {
        await p.getByRole("button",{name:"Novo produto",exact:true}).click();const d=p.getByRole("dialog");
        await aba(d, "Kit/Combo");
        await expect(d.getByRole("switch",{name:"Produto composto (Kit/Combo)"})).toBeDisabled();
        await aba(d, "Dados gerais");
        await d.getByRole("textbox",{name:"Nome",exact:true}).fill("Produto simples");
        await aba(d, "Preços e estoque");
        await d.getByRole("textbox",{name:"Preço de venda",exact:true}).fill("10");
        await d.getByRole("button",{name:"Cadastrar produto",exact:true}).click();await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.composto,false);assert.equal("componentes" in gravacoes(e).at(-1).body,false);
    } finally {await p.close();}
});

test("Kit/Combo cadastra componentes, valida quantidade e preserva campos após erro", async () => {
    const e=novoEstado(), p=await abrir(e, { width:390,height:650 });
    try {
        await p.getByRole("button",{name:"Novo produto",exact:true}).click();const d=p.getByRole("dialog");
        await d.getByRole("textbox",{name:"Nome",exact:true}).fill("Kit teste");
        await aba(d, "Preços e estoque");
        await d.getByRole("textbox",{name:"Preço de venda",exact:true}).fill("10");
        await aba(d, "Kit/Combo");
        await d.getByRole("switch",{name:"Produto composto (Kit/Combo)"}).check();
        const busca=d.getByRole("combobox",{name:"Adicionar componente por nome, código ou EAN"});
        await busca.fill("Produto");await p.getByRole("option",{name:/Produto teste/}).click();
        await d.getByRole("textbox",{name:"Quantidade",exact:true}).fill("0");
        await d.getByRole("button",{name:"Cadastrar produto",exact:true}).click();
        await expect(d.getByRole("alert")).toContainText("quantidade positiva");assert.equal(gravacoes(e).length,0);
        await d.getByRole("textbox",{name:"Quantidade",exact:true}).fill("2");e.erroSalvar=true;
        await mkdir("node_modules/kit-validacao",{recursive:true});await p.screenshot({path:"node_modules/kit-validacao/cadastro-390.png"});
        await d.getByRole("button",{name:"Cadastrar produto",exact:true}).click();await expect(d.getByRole("alert")).toBeVisible();
        await aba(d, "Dados gerais");
        await expect(d.getByRole("textbox",{name:"Nome",exact:true})).toHaveValue("Kit teste");
        e.erroSalvar=false;await d.getByRole("button",{name:"Cadastrar produto",exact:true}).click();await expect(d).toHaveCount(0);
        const body=gravacoes(e).at(-1).body;assert.equal(body.composto,true);assert.deepEqual(body.componentes,[{produtoId:10,quantidade:2,fator:1,unidade:"UN"}]);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    } finally {await p.close();}
});

test("consulta identifica fornecedor e edição troca ou remove somente o fornecedor principal", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await expect(p.getByText("Distribuidora inicial", { exact: true })).toBeVisible();
        const d = await editar(p); await aba(d, "Fornecedores"); const campo = d.getByRole("combobox", { name: "Fornecedor principal", exact: true });
        await expect(campo).toHaveValue("Distribuidora inicial");
        await campo.fill("Outra"); await p.getByRole("option", { name: "Outra distribuidora", exact: true }).click();
        await d.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.fornecedorId, 2); assert.ok(!("empresaId" in gravacoes(e).at(-1).body));
        await expect(p.getByText("Outra distribuidora", { exact: true })).toBeVisible();
        await editar(p); await aba(d, "Fornecedores"); await d.getByRole("combobox", { name: "Fornecedor principal", exact: true }).focus();
        await d.getByRole("button", { name: /Limpar|Clear/ }).click();
        await d.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.fornecedorId, null);
        await expect(p.getByText("Fornecedor: Não informado", { exact: true })).toHaveCount(0);
        await expect(p.getByRole("row").filter({ hasText: "Produto teste" })).not.toContainText("Outra distribuidora");
        assert.ok(e.chamadas.every(c => c.auth === "Bearer teste" && !c.params.has("empresaId")));
        assert.ok(!e.chamadas.some(c => c.path === "/fornecedores"));
        assert.equal(new URL(p.url()).searchParams.get("origem"), "consulta");
    } finally { await p.close(); }
});

test("cadastro aceita produto sem fornecedor e permite selecionar fornecedor cadastrado", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        for (const selecionar of [false, true]) {
            await p.getByRole("button", { name: "Novo produto", exact: true }).click(); const d = p.getByRole("dialog");
            await d.getByRole("textbox", { name: "Nome", exact: true }).fill(selecionar ? "Com fornecedor" : "Sem fornecedor");
            await aba(d, "Preços e estoque");
            await d.getByRole("textbox", { name: "Preço de venda", exact: true }).fill("10,00");
            if (selecionar) { await aba(d, "Fornecedores"); await d.getByRole("combobox", { name: "Fornecedor principal", exact: true }).fill("Outra"); await p.getByRole("option", { name: "Outra distribuidora", exact: true }).click(); }
            await d.getByRole("button", { name: "Cadastrar produto", exact: true }).click(); await expect(d).toHaveCount(0);
            assert.equal(gravacoes(e).at(-1).body.fornecedorId, selecionar ? 2 : null);
        }
    } finally { await p.close(); }
});

test("edição usa fornecedor atualizado do detalhe, sem restaurar informação antiga da lista", async () => {
    const e = novoEstado(); e.detalhe = { ...e.produtos[0], fornecedor: e.fornecedores[1] }; const p = await abrir(e);
    try { const d = await editar(p); await aba(d, "Fornecedores"); await expect(d.getByRole("combobox", { name: "Fornecedor principal", exact: true })).toHaveValue("Outra distribuidora"); }
    finally { await p.close(); }
});

test("fornecedor inativo permanece selecionado e falha de busca oferece retry sem perder dados", async () => {
    const e = novoEstado(); e.fornecedores[0].ativo = false; e.produtos[0].fornecedor = e.fornecedores[0]; e.erroBusca = true;
    const p = await abrir(e);
    try {
        const d = await editar(p); await aba(d, "Fornecedores"); const campo = d.getByRole("combobox", { name: "Fornecedor principal", exact: true });
        await expect(campo).toHaveValue("Distribuidora inicial"); await expect(d.getByText(/Fornecedor inativo/)).toBeVisible();
        await expect(d.getByRole("alert")).toContainText("Não foi possível consultar");
        e.erroBusca = false; await d.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await expect(d.getByRole("alert")).toHaveCount(0); await expect(campo).toHaveValue("Distribuidora inicial");
        await d.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.equal(gravacoes(e).at(-1).body.fornecedorId, 1);
    } finally { await p.close(); }
});

test("referência rejeitada mantém formulário, nome digitado e seleção para correção", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        const d = await editar(p); await d.getByRole("textbox", { name: "Nome", exact: true }).fill("Produto editado");
        e.erroSalvar = true; await d.getByRole("button", { name: "Salvar alterações", exact: true }).click();
        await expect(d.getByRole("alert")).toContainText("Fornecedor não encontrado");
        await expect(d.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue("Produto editado");
        await aba(d, "Fornecedores");
        await expect(d.getByRole("combobox", { name: "Fornecedor principal", exact: true })).toHaveValue("Distribuidora inicial");
        e.erroSalvar = false; await d.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(d).toHaveCount(0);
    } finally { await p.close(); }
});

test("fornecedor e ações do formulário ficam acessíveis em desktop, notebook, mobile e janela baixa", async () => {
    for (const [width, height] of [[1440,900],[1366,768],[390,844],[390,320]]) {
        const e = novoEstado(), p = await abrir(e, { width, height }); const erros = []; p.on("pageerror", error => erros.push(error.message));
        try {
            const d = await editar(p); await aba(d, "Fornecedores"); const campo = d.getByRole("combobox", { name: "Fornecedor principal", exact: true });
            await campo.scrollIntoViewIfNeeded(); await campo.focus(); await expect(campo).toBeFocused();
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            assert.ok(await d.evaluate(el => el.scrollWidth <= el.getBoundingClientRect().width + 1));
            await p.waitForFunction(() => [...document.querySelectorAll(".MuiDialog-container, .MuiBackdrop-root")].every(el => getComputedStyle(el).opacity === "1"));
            if (process.env.NOVEXA_PRODUTO_FORNECEDOR_SCREENSHOTS) await p.screenshot({ path: `node_modules/.novexa-produto-fornecedor-validation/form-${width}-${height}.png` });
            await d.getByRole("button", { name: "Salvar alterações", exact: true }).scrollIntoViewIfNeeded();
            await expect(d.getByRole("button", { name: "Salvar alterações", exact: true })).toBeVisible(); assert.deepEqual(erros, []);
        } finally { await p.close(); }
    }
});

async function selecionarClassificacao(p, d) {
    await d.getByRole("combobox", { name: "Categoria", exact: true }).fill("Bebidas");
    await p.getByRole("option", { name: "Bebidas", exact: true }).click();
    await d.getByRole("combobox", { name: "Subcategoria", exact: true }).fill("Sucos");
    await p.getByRole("option", { name: "Sucos", exact: true }).click();
    await d.getByRole("combobox", { name: "Marca", exact: true }).fill("Marca");
    await p.getByRole("option", { name: "Marca teste", exact: true }).click();
}
test("classificação cria três vínculos, filtra subcategorias e mostra os nomes na consulta", async () => {
    const e = novoEstado(), p = await abrir(e);
    try {
        await p.getByRole("button", { name: "Novo produto", exact: true }).click(); const d = p.getByRole("dialog");
        await expect(d.getByRole("combobox", { name: "Subcategoria", exact: true })).toBeDisabled();
        await d.getByRole("textbox", { name: "Nome", exact: true }).fill("Classificado");
        await aba(d, "Preços e estoque");
        await d.getByRole("textbox", { name: "Preço de venda", exact: true }).fill("10,00");
        await aba(d, "Dados gerais");
        await selecionarClassificacao(p, d);
        assert.ok(e.chamadas.some(c => c.path === "/produtos/subcategorias" && c.params.get("categoriaId") === "10"));
        await d.getByRole("button", { name: "Cadastrar produto", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.deepEqual([gravacoes(e).at(-1).body.categoriaId,gravacoes(e).at(-1).body.subcategoriaId,gravacoes(e).at(-1).body.marcaId], [10,20,30]);
        await expect(p.getByRole("row").filter({ hasText: "Classificado" })).toContainText("Marca teste · Bebidas · Sucos");
    } finally { await p.close(); }
});
test("troca de categoria limpa subcategoria e remoção envia null sem apagar fornecedor", async () => {
    const e = novoEstado(); Object.assign(e.produtos[0], { categoria: categorias[0], subcategoria: subcategorias[0], marca: marcas[0] }); const p = await abrir(e);
    try {
        const d = await editar(p);
        await expect(d.getByRole("combobox", { name: "Subcategoria", exact: true })).toHaveValue("Sucos");
        await d.getByRole("combobox", { name: "Categoria", exact: true }).fill("Alimentos"); await p.getByRole("option", { name: "Alimentos", exact: true }).click();
        await expect(d.getByRole("combobox", { name: "Subcategoria", exact: true })).toHaveValue("");
        for (const nome of ["Categoria", "Marca"]) {
            const campo = d.getByRole("combobox", { name: nome, exact: true }); await campo.focus();
            await campo.locator("xpath=..").getByRole("button", { name: /Limpar|Clear/ }).click();
        }
        await d.getByRole("button", { name: "Salvar alterações", exact: true }).click(); await expect(d).toHaveCount(0);
        const body=gravacoes(e).at(-1).body;
        assert.deepEqual([body.categoriaId,body.subcategoriaId,body.marcaId,body.fornecedorId], [null,null,null,1]);
    } finally { await p.close(); }
});
test("filtros de classificação são remotos e mantêm contexto da consulta", async () => {
    const e = novoEstado(); Object.assign(e.produtos[0], { categoria: categorias[0], subcategoria: subcategorias[0], marca: marcas[0] }); const p = await abrir(e);
    try {
        await selecionarClassificacao(p, p);
        await expect.poll(() => e.chamadas.filter(c => c.path === "/produtos" && c.metodo === "GET").at(-1).params.get("marcaId")).toBe("30");
        const q=e.chamadas.filter(c => c.path === "/produtos" && c.metodo === "GET").at(-1).params;
        assert.equal(q.get("categoriaId"), "10"); assert.equal(q.get("subcategoriaId"), "20"); assert.equal(q.get("page"), "0");
        assert.equal(new URL(p.url()).searchParams.get("origem"), "consulta");
    } finally { await p.close(); }
});
