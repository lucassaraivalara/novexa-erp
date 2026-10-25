import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { posix, resolve } from "node:path";
import { createServer } from "vite";
import ts from "typescript";
import { chromium } from "@playwright/test";

let server, browser, url;
const evidence = process.env.FORM_EVIDENCE_DIR;
const original = { id: 42, empresaId: 7, nome: "Café torrado", codigoInterno: "42", codigoBarras: null,
    descricao: null, unidadeMedida: "KG", precoCusto: 10.5, precoVenda: 1234.56, estoqueMinimo: 0.125,
    estoqueAtual: 8, controlaEstoque: true, ativo: true, composto: false, imagemUrl: null, fornecedoresAdicionais: [] };

const fixture = (antes) => `
import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline,Box} from '@mui/material';
import ProdutoForm from '${antes ? "/baseline-produto.tsx" : "/src/pages/Produtos/ProdutoForm.tsx"}';
import CampoDecimal,{CampoQuantidade,CampoPercentual} from '/src/components/ui/CampoDecimal.tsx';
import {createNovexaTheme} from '/src/theme/theme.ts';
import api from '/src/services/api.ts';
const q=new URLSearchParams(location.search), editar=q.has('editar'), rapido=q.has('rapido'), produtoId=q.get('id')||'42';
function App(){
 const [produto,setProduto]=useState(null),[carregando,setCarregando]=useState(editar),[salvo,setSalvo]=useState('');
 const [decimal,setDecimal]=useState(''),[quantidade,setQuantidade]=useState('0'),[percentual,setPercentual]=useState('10,50');
 useEffect(()=>{if(editar)api.get('/produtos/'+produtoId).then(r=>{setProduto(r.data);setCarregando(false)});},[]);
 return React.createElement(ThemeProvider,{theme:createNovexaTheme(q.has('escuro')?'dark':'light')},
  React.createElement(CssBaseline),q.has('componentes')?React.createElement(Box,{sx:{p:3,display:'grid',gap:3,maxWidth:420}},
   React.createElement(CampoDecimal,{label:'Decimal preciso',name:'decimal',casas:4,value:decimal,onValueChange:setDecimal,helperText:'Até 4 casas decimais.'}),
   React.createElement(CampoQuantidade,{label:'Quantidade',name:'quantidade',value:quantidade,onValueChange:setQuantidade,passo:'0,1',maximo:0.3}),
   React.createElement(CampoPercentual,{label:'Percentual',name:'percentual',value:percentual,onValueChange:setPercentual,maximo:100}),
   React.createElement('output',{'data-testid':'texto-decimal'},decimal)):
  React.createElement(ProdutoForm,{key:carregando?'carregando':'pronto',aberto:true,
   ...(rapido?{modo:'rapido',onSalvo:p=>setSalvo(String(p.id))}:{produto,carregandoProduto:carregando,salvando:false,erroExterno:'',
   onSalvar:async dados=>{const r=await api[editar?'put':'post'](editar?'/produtos/'+produtoId:'/produtos',dados);setSalvo(String(r.data.id));}}),onFechar:()=>{}}),
  React.createElement('output',{'data-testid':'salvo'},salvo));
}createRoot(document.getElementById('root')).render(React.createElement(App));`;

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-produto-campos-tests", server: {host: "127.0.0.1", port: Number(process.env.FORM_REAL_UI_PORT ?? 0), hmr: false},
        plugins: [{ name: "produto-campos-fixture",
            resolveId(id) { if (id.startsWith("/form-fixture") || id === "/baseline-produto.tsx") return `\0${id}`; },
            async load(id) {
                if (id.startsWith("\0/form-fixture")) return fixture(id.includes("antes"));
                if (id === "\0/baseline-produto.tsx") {
                    const source = await readFile(process.env.FORM_BASELINE_SOURCE, "utf8");
                    const imports = source.replace(/from "(\.\.?\/[^"\n]+)"/g,
                        (_, path) => `from "${posix.resolve("/src/pages/Produtos", path)}"`);
                    return ts.transpileModule(imports, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext}}).outputText;
                }
            },
            configureServer(vite) {
                vite.middlewares.use(async (req, res, next) => {
                    if (!req.url.startsWith("/piloto")) return next();
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml(req.url,
                        `<div id="root"></div><script type="module" src="/form-fixture${req.url.includes("antes=1") ? "-antes" : ""}.js"></script>`));
                });
            },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless: true});
});
after(async () => { await browser?.close(); await server?.close(); });

async function loginReal(cpf = "12345678909") {
    assert.match(process.env.FORM_REAL_API, /^http:\/\/127\.0\.0\.1:\d+$/);
    const state = JSON.parse(await readFile(process.env.FORM_REAL_STATE, "utf8"));
    assert.equal(state.database, "novexa_forms_test"); assert.equal(state.stopped, false);
    assert.match(state.data.replaceAll("\\", "/"), /\/novexa-form-15-[^/]+\/pgdata$/);
    assert.notEqual(state.pgport, 5432); assert.notEqual(state.apiport, 8080);
    assert.equal(process.env.FORM_REAL_API, `http://127.0.0.1:${state.apiport}`);
    const r = await fetch(`${process.env.FORM_REAL_API}/auth/login`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({cpf, senha: "formTeste123"})});
    assert.equal(r.status, 200); return r.json();
}
async function withForm(run, {query = "", viewport = {width: 1440, height: 960}, failSave = false, real = false} = {}) {
    const page = await browser.newPage({viewport}); page.setDefaultTimeout(6000);
    const writes = [], errors = []; let stored = {...original};
    page.on("pageerror", e => errors.push(e.message));
    const auth = real ? await loginReal() : {token: "teste-isolado", perfil: "ADMIN", empresa: {id: 7}};
    await page.addInitScript(s => localStorage.setItem("novexa-auth", JSON.stringify(s)), auth);
    await page.route("**/*", async route => {
        const request = route.request(), parsed = new URL(request.url()), path = parsed.pathname;
        if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
        if (real && parsed.origin === process.env.FORM_REAL_API) {
            if (["POST", "PUT"].includes(request.method())) writes.push({method: request.method(), payload: request.postDataJSON()});
            return route.continue();
        }
        if (path === "/produtos/composicao/capacidade") return route.fulfill({json: {habilitado: true}});
        if (/kits-dependentes|composicoes/.test(path)) return route.fulfill({json: []});
        if (path === "/produtos/42" && request.method() === "GET") return route.fulfill({json: stored});
        if (/^\/produtos(?:\/42)?$/.test(path) && ["POST", "PUT"].includes(request.method())) {
            const payload = request.postDataJSON(); writes.push({method: request.method(), payload});
            if (failSave) return route.fulfill({status: 409, json: "Código já utilizado nesta empresa."});
            stored = {...stored, ...payload}; return route.fulfill({json: stored});
        }
        if (/categorias|subcategorias|marcas|fornecedores/.test(path)) return route.fulfill({json: {items: [], totalItems: 0, totalPages: 0}});
        // A fixture nunca alcança um backend real, mesmo que o .env aponte para outro host.
        return route.abort("blockedbyclient");
    });
    try { await page.goto(`${url}/piloto${query}`); await run(page, writes, () => stored); assert.deepEqual(errors, []); }
    catch (e) {
        e.message += `\nDOM: ${(await page.locator("body").innerText()).slice(-2500)}`;
        throw e;
    }
    finally { await page.close(); }
}
const campo = (page, name) => page.getByLabel(new RegExp(`^${name}\\s*\\*?$`));
async function precos(page) { await page.getByRole("tab", {name: "Preços e estoque", exact: true}).click(); }
const salvar = page => page.getByRole("button", {name: /^(Cadastrar produto|Salvar alterações|Cadastrar e selecionar)$/}).click();

test("decimal: quatro casas, colagem, vazio, erro visível e texto preservado", () => withForm(async page => {
    const d = campo(page, "Decimal preciso");
    for (const v of ["0,0002", "1,2500", "10,50", "1.234,56"]) {
        await d.fill(v); await d.press("Tab");
        assert.equal(await d.getAttribute("aria-invalid"), "false", v);
        assert.equal(await page.getByTestId("texto-decimal").textContent(), v);
    }
    await d.fill("0,0002"); await d.press("Tab"); assert.equal(await d.inputValue(), "0,0002");
    for (const v of ["-1", "abc", "1,12345", "1e3"]) {
        await d.fill(v); await d.press("Tab");
        assert.equal(await d.inputValue(), v); assert.equal(await d.getAttribute("aria-invalid"), "true");
    }
    await d.fill(""); await d.press("Tab"); assert.equal(await d.inputValue(), "");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => navigator.clipboard.writeText("1.234,56"));
    await d.focus(); await d.press("Control+V"); await d.press("Tab");
    assert.equal(await d.inputValue(), "1.234,5600");
}, {query: "?componentes=1"}));

test("spinbox: passos exatos, limites, teclado, botões e rolagem sem alteração", () => withForm(async page => {
    const q = campo(page, "Quantidade");
    assert.equal(await q.getAttribute("role"), "spinbutton");
    assert.equal(await page.getByRole("button", {name: "Diminuir quantidade"}).isDisabled(), true);
    await q.focus(); await q.press("ArrowUp"); await q.press("ArrowUp"); await q.press("ArrowUp"); await q.press("ArrowUp");
    assert.equal(await q.inputValue(), "0,300");
    assert.equal(await page.getByRole("button", {name: "Aumentar quantidade"}).isDisabled(), true);
    await q.press("ArrowDown"); assert.equal(await q.inputValue(), "0,200");
    await page.getByRole("button", {name: "Diminuir quantidade"}).press("Enter");
    assert.equal(await q.inputValue(), "0,100");
    await q.hover(); await page.mouse.wheel(0, 600); assert.equal(await q.inputValue(), "0,100");
    await q.fill("-2"); assert.equal(await page.getByRole("button", {name: "Aumentar quantidade"}).isDisabled(), true);
    const p = campo(page, "Percentual"); await p.fill("101"); await p.press("Tab");
    assert.equal(await p.getAttribute("aria-invalid"), "true");
    await p.fill("10,50"); await p.press("Tab"); assert.equal(await p.inputValue(), "10,50");
}, {query: "?componentes=1"}));

test("cadastro: moeda brasileira e quantidade chegam como números no contrato existente", () => withForm(async (page, writes, stored) => {
    assert.equal(await campo(page, "Código de barras").getAttribute("aria-invalid"), "false");
    await page.getByText("Identificador GTIN/EAN do produto. Opcional.", {exact: true}).waitFor();
    await campo(page, "Nome").fill("Produto piloto"); await precos(page);
    await campo(page, "Preço de custo").fill("R$ 10,50");
    await campo(page, "Preço de venda").fill("1.234,56");
    await page.getByRole("button", {name: "Aumentar estoque mínimo"}).click(); assert.equal(writes.length, 0);
    await campo(page, "Estoque mínimo").fill("1,250"); await salvar(page);
    await page.getByTestId("salvo").filter({hasText: "42"}).waitFor();
    assert.equal(writes.length, 1); assert.equal(writes[0].method, "POST");
    assert.equal(writes[0].payload.precoCusto, 10.5); assert.equal(writes[0].payload.precoVenda, 1234.56);
    assert.equal(writes[0].payload.estoqueMinimo, 1.25); assert.equal("empresaId" in writes[0].payload, false);
    assert.equal(stored().estoqueAtual, 8); // Nenhum saldo é enviado/editado.
}));

test("edição e releitura mantêm os dados após salvar; erros da API preservam texto", () => withForm(async (page, writes, stored) => {
    await precos(page); assert.equal(await campo(page, "Preço de venda").inputValue(), "1.234,56");
    assert.equal(await campo(page, "Estoque mínimo").inputValue(), "0,125");
    await campo(page, "Preço de custo").fill("0"); await campo(page, "Preço de venda").fill("10,50");
    await campo(page, "Estoque mínimo").fill("0,002"); await salvar(page);
    await page.getByTestId("salvo").filter({hasText: "42"}).waitFor();
    assert.equal(writes[0].method, "PUT"); assert.equal(stored().estoqueMinimo, 0.002);
    await page.reload(); await campo(page, "Nome").waitFor(); await precos(page);
    assert.equal(await campo(page, "Preço de custo").inputValue(), "0,00");
    assert.equal(await campo(page, "Preço de venda").inputValue(), "10,50");
    assert.equal(await campo(page, "Estoque mínimo").inputValue(), "0,002");
}, {query: "?editar=1"}));

test("preço inválido não salva nem arredonda; zero é permitido e vazio continua inválido", () => withForm(async (page, writes) => {
    await campo(page, "Nome").fill("Teste de validação"); await precos(page);
    for (const v of ["0,0002", "1,2500", "-1", "abc", ""]) {
        await campo(page, "Preço de venda").fill(v); await salvar(page);
        assert.equal(writes.length, 0); assert.equal(await campo(page, "Preço de venda").inputValue(), v);
        assert.equal(await campo(page, "Preço de venda").getAttribute("aria-invalid"), "true");
    }
    await campo(page, "Preço de venda").fill("0"); await campo(page, "Preço de custo").fill(""); await salvar(page);
    assert.equal(writes.length, 0); assert.equal(await campo(page, "Preço de custo").getAttribute("aria-invalid"), "true");
    await campo(page, "Preço de custo").fill("0"); await salvar(page);
    await page.getByTestId("salvo").filter({hasText: "42"}).waitFor(); assert.equal(writes[0].payload.precoVenda, 0);
}));

test("fiscal opcional, mensagens de erro prevalecem e cadastro rápido mantém fluxo", () => withForm(async (page, writes) => {
    await campo(page, "Nome").fill("Produto rápido");
    await campo(page, "Preço de venda").fill("10,50"); await salvar(page);
    await page.getByTestId("salvo").filter({hasText: "42"}).waitFor();
    assert.equal(writes[0].payload.precoVenda, 10.5); assert.equal("ncm" in writes[0].payload, false);
}, {query: "?rapido=1", viewport: {width: 390, height: 844}}));

test("falha ao salvar mantém dados digitados e orientação da API", () => withForm(async (page, writes) => {
    await campo(page, "Nome").fill("Produto em revisão");
    await campo(page, "Preço de venda").fill("10,50"); await salvar(page);
    await page.getByText("Código já utilizado nesta empresa.", {exact: true}).waitFor();
    assert.equal(await campo(page, "Preço de venda").inputValue(), "10,50"); assert.equal(writes.length, 1);
}, {query: "?rapido=1", failSave: true}));

test("sem controle de estoque, quantidade e botões ficam desabilitados e saldo não é alterado", () => withForm(async (page, writes) => {
    await campo(page, "Nome").fill("Sem controle de estoque"); await precos(page);
    await campo(page, "Preço de venda").fill("10,50");
    await campo(page, "Estoque mínimo").fill("-1");
    await page.getByRole("switch", {name: "Controla estoque", exact: true}).uncheck();
    assert.equal(await campo(page, "Estoque mínimo").isDisabled(), true);
    assert.equal(await campo(page, "Estoque mínimo").getAttribute("aria-invalid"), "false");
    assert.equal(await page.getByRole("button", {name: "Aumentar estoque mínimo"}).isDisabled(), true);
    assert.equal(await page.getByRole("button", {name: "Diminuir estoque mínimo"}).isDisabled(), true);
    await salvar(page); await page.getByTestId("salvo").filter({hasText: "42"}).waitFor();
    assert.equal(writes[0].payload.controlaEstoque, false); assert.equal(writes[0].payload.estoqueMinimo, 0);
    assert.equal("estoqueAtual" in writes[0].payload, false);
}));

test("fiscal: erro junto do campo substitui ajuda, sem exigir metadados opcionais", () => withForm(async (page, writes) => {
    await campo(page, "Nome").fill("Fiscal opcional"); await precos(page); await campo(page, "Preço de venda").fill("1");
    await page.getByRole("tab", {name: "Fiscal", exact: true}).click();
    await campo(page, "NCM").fill("123"); await salvar(page);
    await page.getByText("NCM deve conter 8 dígitos.", {exact: true}).waitFor();
    assert.equal(writes.length, 0); assert.equal(await page.getByText("Metadado fiscal opcional. Informe 8 dígitos.", {exact: true}).count(), 0);
    await campo(page, "NCM").fill(""); await salvar(page); await page.getByTestId("salvo").filter({hasText: "42"}).waitFor();
    assert.equal(writes[0].payload.ncm, null);
}));

test("integração HTTP real: criar, editar, reler e isolar produto em PostgreSQL descartável", {skip: !process.env.FORM_REAL_API}, async () => {
    let id;
    await withForm(async (page, writes) => {
        await campo(page, "Nome").fill("Produto piloto HTTP"); await precos(page);
        await campo(page, "Preço de custo").fill("10,50"); await campo(page, "Preço de venda").fill("1.234,56");
        await campo(page, "Estoque mínimo").fill("1,250"); await salvar(page);
        await page.getByTestId("salvo").filter({hasText: /^\d+$/}).waitFor(); id = Number(await page.getByTestId("salvo").textContent());
        assert.equal(writes.length, 1); assert.equal(writes[0].payload.precoVenda, 1234.56);
    }, {real: true});
    const auth = await loginReal();
    const obter = async () => {
        const r = await fetch(`${process.env.FORM_REAL_API}/produtos/${id}`, {headers: {Authorization: `Bearer ${auth.token}`}});
        assert.equal(r.status, 200); return r.json();
    };
    const criado = await obter();
    assert.equal(criado.precoVenda, 1234.56); assert.equal(criado.precoCusto, 10.5); assert.equal(criado.estoqueMinimo, 1.25);
    await withForm(async page => {
        await campo(page, "Nome").waitFor(); await precos(page);
        assert.equal(await campo(page, "Preço de venda").inputValue(), "1.234,56");
        await campo(page, "Preço de custo").fill("0"); await campo(page, "Preço de venda").fill("10,50");
        await campo(page, "Estoque mínimo").fill("0,125"); await salvar(page);
        await page.getByTestId("salvo").filter({hasText: String(id)}).waitFor();
    }, {real: true, query: `?editar=1&id=${id}`});
    const editado = await obter();
    assert.equal(editado.precoCusto, 0); assert.equal(editado.precoVenda, 10.5); assert.equal(editado.estoqueMinimo, 0.125); assert.equal(editado.estoqueAtual, 0);
    const externo = await loginReal("98765432100");
    const negado = await fetch(`${process.env.FORM_REAL_API}/produtos/${id}`, {headers: {Authorization: `Bearer ${externo.token}`}});
    assert.equal(negado.status, 404);
});

test("evidência visual e layout: desktop/mobile, claro/escuro, abas e foco", {skip: !evidence}, async () => {
    await mkdir(evidence, {recursive: true});
    const medidas = [];
    for (const antes of process.env.FORM_BASELINE_SOURCE ? [true, false] : [false]) {
        for (const mobile of [false, true]) {
            for (const dark of [false, true]) {
                await withForm(async page => {
                    await campo(page, "Nome").waitFor();
                    await page.screenshot({animations: "disabled", path: resolve(evidence, `${antes ? "antes" : "depois"}-${mobile ? "mobile" : "desktop"}-${dark ? "escuro" : "claro"}-dados.png`)});
                    await precos(page);
                    const p = campo(page, "Preço de venda"); await p.focus(); await p.press("Tab");
                    assert.equal(await campo(page, "Estoque mínimo").isVisible(), true);
                    const bounds = await page.getByRole("dialog").boundingBox(); assert.ok(bounds.width <= (mobile ? 390 : 1440));
                    const fieldBounds = await campo(page, "Estoque mínimo").boundingBox();
                    assert.ok(fieldBounds.x + fieldBounds.width <= (mobile ? 390 : 1440));
                    if (!antes) {
                        const style = await campo(page, "Preço de venda").evaluate(el => {
                            const placeholder = getComputedStyle(el, "::placeholder");
                            return {color: placeholder.color, opacity: placeholder.opacity,
                                background: getComputedStyle(el.closest(".MuiOutlinedInput-root")).backgroundColor};
                        });
                        const foreground = style.color.match(/[\d.]+/g).slice(0, 3).map(Number);
                        const background = style.background.match(/[\d.]+/g).slice(0, 3).map(Number);
                        const luminancia = rgb => rgb.map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
                            .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
                        const lum = [luminancia(foreground), luminancia(background)].sort((a, b) => b - a);
                        const contraste = (lum[0] + 0.05) / (lum[1] + 0.05);
                        assert.equal(Number(style.opacity), 1); assert.ok(contraste >= 4.5, JSON.stringify(style));
                        medidas.push({mobile, dark, ...style, contraste, larguraCampo: fieldBounds.width, alturaCampo: fieldBounds.height});
                    }
                    await page.screenshot({animations: "disabled", path: resolve(evidence, `${antes ? "antes" : "depois"}-${mobile ? "mobile" : "desktop"}-${dark ? "escuro" : "claro"}-precos.png`)});
                }, {query: `?editar=1${antes ? "&antes=1" : ""}${dark ? "&escuro=1" : ""}`, viewport: {width: mobile ? 390 : 1440, height: mobile ? 844 : 960}});
            }
        }
    }
    await writeFile(resolve(evidence, "medidas.json"), JSON.stringify(medidas, null, 2));
});
