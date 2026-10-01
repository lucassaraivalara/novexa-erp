import { after, before, test } from "node:test";
import assert from "node:assert/strict";
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
import theme from '/src/theme/theme.ts';
function Content(){const location=useLocation();return React.createElement('h2',null,'Conteudo '+location.pathname);}
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},
    React.createElement(CssBaseline),React.createElement(BrowserRouter,null,
    React.createElement(Routes,null,
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
                    if (!["/clientes","/produtos","/usuarios","/financeiro/contas-pagar","/login"].includes(req.url)) return next();
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

test("Sidebar preserva grupos, ordem, item ativo e indisponibilidade", () => withLayout(async page => {
    const nav = page.getByRole("navigation");
    assert.deepEqual(await nav.getByRole("link").allTextContents(), ["Dashboard","Vendas","Produtos","Clientes","Estoque","Caixas","Contas a Pagar","Contas Financeiras","Formas de Pagamento","Dados Bancarios","Empresas","Usuarios"].map(x => x === "Dados Bancarios" ? "Dados Banc\u00e1rios" : x === "Usuarios" ? "Usu\u00e1rios" : x));
    assert.equal(await nav.getByRole("button",{name:"Financeiro",exact:true}).getAttribute("aria-expanded"),"true");
    assert.equal(await nav.getByRole("button",{name:"Administra\u00e7\u00e3o",exact:true}).count(),1);
    const active = nav.getByRole("link",{name:"Clientes",exact:true});
    assert.equal(await active.getAttribute("aria-current"),"page");
    assert.equal(await active.evaluate(el => getComputedStyle(el,"::before").width),"3px");
    const unavailable = nav.getByRole("button",{name:/Novo Cliente/});
    assert.equal(await unavailable.getAttribute("aria-disabled"),"true");
    assert.equal(await unavailable.isDisabled(),true);
    assert.equal(new URL(page.url()).pathname,"/clientes");
}));

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

test("Sidebar preserva restricao de Usuarios por perfil", () => withLayout(async page => {
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Usu\u00e1rios",exact:true}).count(),0);
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Clientes",exact:true}).count(),1);
}, {perfil:"OPERADOR"}));

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
        assert.equal(sizes.sidebar,width < 600 ? 59 : 251);
        assert.equal(sizes.padding,width < 600 ? "16px" : "24px");
        assert.equal(await page.getByText("Loja Novexa",{exact:true}).isVisible(),width >= 900);
        assert.equal(await page.getByRole("button",{name:"Sair",exact:true}).isVisible(),true);
    }
}));
