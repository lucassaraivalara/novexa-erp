import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material';
import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import MainLayout from '/src/components/layout/MainLayout.tsx';
import AppRoutes from '/src/routes/AppRoutes.tsx';
import theme from '/src/theme/theme.ts';
function Content(){const location=useLocation();return React.createElement('h2',null,'Conteudo '+location.pathname);}
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,
    new URLSearchParams(location.search).has('real') ? React.createElement(AppRoutes) : React.createElement(Routes,null,
        React.createElement(Route,{path:'/login',element:React.createElement('h2',null,'Login') }),
        React.createElement(Route,{element:React.createElement(MainLayout)},
            React.createElement(Route,{path:'*',element:React.createElement(Content)}))))));
`;

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-layout-tests",
        server: {host:"127.0.0.1",port:0,hmr:false},
        plugins: [{
            name: "layout-test-fixture",
            resolveId(id) { if (id === "/layout-fixture.js") return "\0layout-fixture.js"; },
            load(id) { if (id === "\0layout-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use(async (req,res,next) => {
                    if (!["/dashboard","/pdv","/vendas","/estoque","/clientes","/produtos","/usuarios","/financeiro/contas-pagar","/financeiro/recebiveis","/financeiro/contas-financeiras","/financeiro/formas-pagamento","/financeiro/dados-bancarios","/login"].includes(req.url.split('?')[0])) return next();
                    res.setHeader("Content-Type","text/html");
                    res.end(await vite.transformIndexHtml(req.url,'<div id="root"></div><script type="module" src="/layout-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({headless:true});
});
after(async () => { await browser?.close(); await server?.close(); });

async function withLayout(run, options = {}) {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    await page.addInitScript(session => localStorage.setItem("novexa-auth",JSON.stringify(session)), {
        token:"test",perfil:options.perfil ?? "ADMIN",nomeUsuario:options.usuario ?? "Maria Silva",
        empresa:{id:1,nomeFantasia:options.empresa ?? "Loja Novexa",razaoSocial:"Razao social",logomarca:options.logo},
    });
    try {
        await page.goto(`${url}/clientes`);
        await page.getByRole("navigation",{name:"Menu principal"}).waitFor();
        await run(page);
    } finally { await page.close(); }
}

test("Sidebar organiza tarefas, configuracoes e remove item indisponivel", () => withLayout(async page => {
    const nav = page.getByRole("navigation");
    assert.deepEqual(await nav.getByRole("link").allTextContents(), ["Dashboard","Vender","Central de Vendas","Clientes","Produtos","Estoque","Caixas","Contas a Pagar","Recebimentos de cartão","Contas e saldos","Formas de Pagamento","Dados Bancários","Empresas","Usuários"]);
    assert.equal(await nav.getByRole("button",{name:"Financeiro",exact:true}).getAttribute("aria-expanded"),"true");
    assert.equal(await nav.getByRole("button",{name:"Configurações",exact:true}).getAttribute("aria-expanded"),"true");
    assert.equal(await nav.getByRole("button",{name:"Administra\u00e7\u00e3o",exact:true}).count(),1);
    const active = nav.getByRole("link",{name:"Clientes",exact:true});
    assert.equal(await active.getAttribute("aria-current"),"page");
    assert.equal(await active.evaluate(el => getComputedStyle(el,"::before").width),"3px");
    assert.equal(await nav.getByRole("button",{name:/Novo Cliente/}).count(),0);
    const config = nav.getByRole("list",{name:"Configurações",exact:true});
    assert.deepEqual(await config.getByRole("link").allTextContents(),["Formas de Pagamento","Dados Bancários"]);
    assert.equal(await config.getByRole("link",{name:"Contas a Pagar"}).count(),0);
    assert.equal(new URL(page.url()).pathname,"/clientes");
}));

test("Novos labels preservam URLs e titulos da topbar", () => withLayout(async page => {
    for (const [label,path] of [
        ["Central de Vendas","/vendas"], ["Recebimentos de cartão","/financeiro/recebiveis"],
        ["Contas e saldos","/financeiro/contas-financeiras"], ["Formas de Pagamento","/financeiro/formas-pagamento"],
        ["Dados Bancários","/financeiro/dados-bancarios"],
    ]) {
        const link = page.getByRole("navigation").getByRole("link",{name:label,exact:true});
        assert.equal(await link.getAttribute("href"),path);
        await link.click();
        await page.getByRole("heading",{name:label,exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,path);
        assert.equal(await link.getAttribute("aria-current"),"page");
    }
    const group = page.getByRole("button",{name:"Configurações",exact:true});
    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"),"false");
    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"),"true");
}));

async function mockCatalogs(page) {
    await page.route("http://localhost:8080/**",route => {
        const path = new URL(route.request().url()).pathname;
        const data = path === "/dashboard/resumo"
            ? {faturamentoHoje:0,quantidadeVendasHoje:0,ticketMedioHoje:0,quantidadeProdutosEstoqueBaixo:0,quantidadeClientesAtivos:0,sessoesCaixaAbertas:[]}
            : path.endsWith("/pagina") || ["/clientes","/produtos","/fornecedores","/vendas","/estoque/entradas"].includes(path)
                ? {items:[],page:0,size:25,totalItems:0,totalPages:0} : [];
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
}

test("Vender abre o PDV real na rota protegida e sem duplicar layout", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/clientes?real`);
    const sell = page.getByRole("navigation").getByRole("link",{name:"Vender",exact:true});
    assert.equal(await sell.getAttribute("href"),"/pdv");
    await sell.click();
    // Sem caixa aberto, o dialog operacional existente oculta o conteudo de fundo do leitor de tela.
    await page.getByRole("heading",{name:"Vender",exact:true,includeHidden:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,"/pdv");
    assert.equal(await page.getByRole("navigation",{name:"Menu principal"}).count(),0);
}));

test("Produtos e Estoque preservam abas contextuais reais", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/produtos?real`);
    const products = page.getByRole("tablist",{name:"Cadastros de produtos"});
    await products.waitFor();
    assert.deepEqual(await products.getByRole("tab").allTextContents(),["Produtos","Fornecedores"]);
    await products.getByRole("tab",{name:"Fornecedores",exact:true}).click();
    assert.equal(await products.getByRole("tab",{name:"Fornecedores",exact:true}).getAttribute("aria-selected"),"true");
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Fornecedores",exact:true}).count(),0);
    await page.goto(`${url}/estoque?real`);
    const stock = page.getByRole("tablist",{name:"Área de estoque"});
    await stock.waitFor();
    assert.deepEqual(await stock.getByRole("tab").allTextContents(),["Saldo","Entradas"]);
    await stock.getByRole("tab",{name:"Entradas",exact:true}).click();
    await page.getByRole("button",{name:"Entrada manual",exact:true}).waitFor();
    assert.equal(await stock.getByRole("tab",{name:"Entradas",exact:true}).getAttribute("aria-selected"),"true");
}));

test("Cabecalhos de pagina e atalhos usam a nomenclatura da navegacao", async () => {
    for (const [file,title] of [["Financeiro/Recebiveis","Recebimentos de cartão"],["Financeiro/ContasFinanceiras","Contas e saldos"],["Financeiro/FormasPagamento","Formas de Pagamento"],["Vendas/CentralVendas","Central de Vendas"]]) {
        const source = await readFile(new URL(`../src/pages/${file}.tsx`,import.meta.url),"utf8");
        assert.ok(source.includes(`titulo="${title}"`));
    }
    for (const file of ["Dashboard/Dashboard","Vendas/CentralVendas"]) {
        const source = await readFile(new URL(`../src/pages/${file}.tsx`,import.meta.url),"utf8");
        assert.match(source,/to="\/pdv"/);
        assert.match(source,/>Vender<\/Button>/);
    }
});

test("Sidebar preserva navegacao, expansao e foco de teclado", () => withLayout(async page => {
    const nav = page.getByRole("navigation");
    const products = nav.getByRole("link",{name:"Produtos",exact:true});
    await products.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading",{name:"Conteudo /produtos"}).waitFor();
    assert.equal(await products.getAttribute("aria-current"),"page");
    const group = nav.getByRole("button",{name:"Financeiro",exact:true});
    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"),"false");
    await group.click();
    await nav.getByRole("link",{name:"Contas a Pagar",exact:true}).click();
    await page.getByRole("heading",{name:"Contas a Pagar",exact:true}).waitFor();
}));

for (const perfil of ["GERENTE","OPERADOR","USUARIO"]) test(`Sidebar e rota preservam restricao de Usuarios para ${perfil}`, () => withLayout(async page => {
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Usu\u00e1rios",exact:true}).count(),0);
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Clientes",exact:true}).count(),1);
    await mockCatalogs(page);
    await page.goto(`${url}/usuarios?real`);
    await page.waitForURL(`${url}/dashboard`);
}, {perfil}));

test("Sidebar mostra tooltip somente quando os labels estao ocultos", () => withLayout(async page => {
    const clients = page.getByRole("navigation").getByRole("link",{name:"Clientes",exact:true});
    await clients.hover();
    await page.waitForTimeout(700);
    assert.equal(await page.getByRole("tooltip").count(),0);
    await page.setViewportSize({width:390,height:900});
    await clients.hover();
    await page.getByRole("tooltip",{name:"Clientes",exact:true}).waitFor();
}));

test("AppHeader preserva titulo, empresa, usuario, iniciais e logout", () => withLayout(async page => {
    await page.getByRole("heading",{name:"Clientes",exact:true}).waitFor();
    await page.getByText("Loja Novexa",{exact:true}).waitFor();
    await page.getByText("Maria Silva",{exact:true}).waitFor();
    await page.getByText("MS",{exact:true}).waitFor();
    const logout = page.getByRole("button",{name:"Sair",exact:true});
    await logout.hover();
    await page.getByRole("tooltip",{name:"Sair",exact:true}).waitFor();
    await logout.click();
    await page.getByRole("heading",{name:"Login",exact:true}).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("novexa-auth")),null);
}));

test("Dashboard usa identidade real, atalhos funcionais e não transborda nos breakpoints alvo", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/dashboard?real`);
    await page.getByRole("heading",{name:/Maria Silva/}).waitFor();
    await page.getByText("Loja Novexa",{exact:true}).waitFor();
    for (const [label,path] of [
        [/Nova venda/,"/pdv"], [/Entrada de mercadoria/,"/estoque?aba=entradas"], [/Confirmar PIX/,"/vendas"], [/Pagar conta/,"/financeiro/contas-pagar"],
    ]) assert.equal(await page.getByRole("link",{name:label}).getAttribute("href"),path);
    await page.getByText("Nenhum caixa aberto no momento.").waitFor();
    assert.equal(await page.getByRole("link",{name:"Abrir caixa",exact:true}).getAttribute("href"),"/financeiro/caixas");
    for (const width of [1440,1024,390]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),true,`horizontal overflow at ${width}px`);
        const rows = await page.locator('a[aria-label^="Nova venda"],a[aria-label^="Entrada de mercadoria"],a[aria-label^="Confirmar PIX"],a[aria-label^="Pagar conta"]').evaluateAll(links => new Set(links.map(link => Math.round(link.getBoundingClientRect().top))).size);
        assert.equal(rows,2,`quick actions should remain 2x2 at ${width}px`);
        if (process.env.NOVEXA_DASHBOARD_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/dashboard-${width}.png`,fullPage:true});
    }
    await page.getByRole("link",{name:/Entrada de mercadoria/}).click();
    await page.waitForURL(`${url}/estoque?aba=entradas`);
    assert.equal(await page.getByRole("tab",{name:"Entradas",exact:true}).getAttribute("aria-selected"),"true");
}, {usuario:"Maria Silva",empresa:"Loja Novexa"}));

test("AppHeader preserva logo e nomes longos com ellipsis e tooltip condicional", () => withLayout(async page => {
    const company = "Empresa com nome fantasia muito longo para testar truncamento visual sem perda de conteudo";
    const user = "Usuario com nome completo muito longo para verificar o tooltip do header";
    const logo = page.getByRole("img",{name:company,exact:true});
    await logo.waitFor();
    assert.equal(await logo.evaluate(img => img.complete && img.naturalWidth > 0),true);
    for (const name of [company,user]) {
        const label = page.getByText(name,{exact:true});
        assert.equal(await label.evaluate(el => getComputedStyle(el).textOverflow),"ellipsis");
        assert.equal(await label.evaluate(el => el.scrollWidth > el.clientWidth),true);
        await label.hover();
        await page.getByRole("tooltip",{name,exact:true}).waitFor();
        await page.mouse.move(0,0);
        await page.getByRole("tooltip").waitFor({state:"hidden"});
    }
}, {empresa:"Empresa com nome fantasia muito longo para testar truncamento visual sem perda de conteudo",usuario:"Usuario com nome completo muito longo para verificar o tooltip do header",logo:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII="}));

test("MainLayout preserva Outlet e estrutura fluida nos tres breakpoints", () => withLayout(async page => {
    for (const width of [1440,1024,390]) {
        await page.setViewportSize({width,height:900});
        await page.getByRole("heading",{name:"Conteudo /clientes"}).waitFor();
        const sizes = await page.evaluate(() => ({page:document.documentElement.scrollWidth,header:document.querySelector('header').getBoundingClientRect().height,
            sidebar:document.querySelector('nav').getBoundingClientRect().width,padding:getComputedStyle(document.querySelector('main')).paddingLeft}));
        assert.ok(sizes.page <= width);
        assert.ok(sizes.header >= 64 && sizes.header <= 65);
        assert.equal(sizes.sidebar,width < 600 ? 59 : 231);
        assert.equal(sizes.padding,width < 600 ? "16px" : "24px");
        assert.equal(await page.getByText("Loja Novexa",{exact:true}).isVisible(),width >= 900);
        assert.equal(await page.getByRole("button",{name:"Sair",exact:true}).isVisible(),true);
        const config = page.getByRole("button",{name:"Configurações",exact:true});
        assert.equal(await config.isVisible(),true);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/navigation-${width}.png`,fullPage:true});
    }
}));
