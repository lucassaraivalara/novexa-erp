import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

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
                    if (!["/dashboard","/pdv","/vendas","/estoque","/clientes","/produtos","/empresa","/usuarios","/configuracoes","/financeiro/contas-pagar","/financeiro/recebiveis","/financeiro/contas-financeiras","/financeiro/formas-pagamento","/financeiro/dados-bancarios","/login"].includes(req.url.split('?')[0])) return next();
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

test("Sidebar organiza seis dominios compartilhados pela faixa compacta", () => withLayout(async page => {
    const nav = page.getByRole("navigation");
    const domains = ["Visão geral","Cadastros","Estoque","Vendas","Financeiro","Configurações"];
    assert.deepEqual(await nav.getByRole("list",{name:"Áreas do sistema"}).locator("a,button").allTextContents(),domains);
    for (const domain of domains) assert.equal(await nav.getByLabel(`${domain} (ícone)`,{exact:true}).count(),1);
    assert.equal(await nav.getByRole("link",{name:"Vender",exact:true}).getByTestId("AddShoppingCartRoundedIcon").count(),1);
    assert.equal(await nav.getByRole("link",{name:"Vender (ícone)",exact:true}).getAttribute("href"),"/pdv");
    assert.equal(await nav.getByRole("region").count(),0);
    await nav.getByRole("button",{name:"Cadastros",exact:true}).click();
    assert.deepEqual(await nav.getByRole("region").getByRole("link").allTextContents(),["Produtos","Clientes","Fornecedores"]);
    const active = nav.getByRole("link",{name:"Clientes",exact:true});
    assert.equal(await active.getAttribute("aria-current"),"page");
    assert.equal(await nav.getByRole("button",{name:/Novo Cliente/}).count(),0);
    await nav.getByRole("button",{name:"Vendas",exact:true}).click();
    assert.equal(await nav.getByRole("link",{name:"PDV",exact:true}).getAttribute("href"),"/pdv");
    await nav.getByRole("button",{name:"Financeiro",exact:true}).click();
    assert.deepEqual(await nav.getByRole("region").getByRole("link").allTextContents(),["Caixas","Contas e saldos","Contas a Pagar","Contas a Receber","Recebimentos de cartão"]);
    assert.equal(await nav.getByRole("link",{name:"Caixas",exact:true}).getAttribute("href"),"/financeiro/caixas");
    assert.equal(new URL(page.url()).pathname,"/clientes");
}));

test("Novos labels preservam URLs e titulos da topbar", () => withLayout(async page => {
    for (const [label,path,title,domain] of [
        ["Central de Vendas","/vendas","Central de Vendas","Vendas"], ["Recebimentos de cartão","/financeiro/recebiveis","Recebimentos de cartão","Financeiro"],
        ["Contas e saldos","/financeiro/contas-financeiras","Contas e saldos","Financeiro"],
    ]) {
        await page.getByRole("navigation").getByRole("button",{name:domain,exact:true}).click();
        const link = page.getByRole("navigation").getByRole("link",{name:label,exact:true});
        assert.equal(await link.getAttribute("href"),path);
        await link.click();
        await page.getByRole("heading",{name:title,exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,path);
        assert.equal(await page.getByRole("navigation").getByRole("region").count(),0);
        await page.getByRole("navigation").getByRole("button",{name:domain,exact:true}).click();
        assert.equal(await link.getAttribute("aria-current"),"page");
        await page.keyboard.press("Escape");
    }
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

test("Visão geral abre Dashboard diretamente em desktop e mobile", () => withLayout(async page => {
    await mockCatalogs(page);
    for (const width of [1440,390]) {
        await page.setViewportSize({width,height:844});
        await page.goto(`${url}/clientes?real`);
        const nav = page.getByRole("navigation");
        const overview = nav.getByRole("link",{name:width < 600 ? "Visão geral (ícone)" : "Visão geral",exact:true});
        assert.equal(await overview.getAttribute("href"),"/dashboard");
        await overview.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading",{name:/Maria Silva/}).waitFor();
        assert.equal(new URL(page.url()).pathname,"/dashboard");
        assert.equal(await nav.getByRole("region").count(),0);
    }
}));

test("Central compacta preserva destinos, teclado e acesso no rodape sem consultas", () => withLayout(async page => {
    const requests = [];
    page.on("request",request => { if (["xhr","fetch"].includes(request.resourceType())) requests.push(request.url()); });
    for (const [width,height] of [[1440,900],[1366,768],[1024,768],[390,844],[320,568],[1024,320],[390,320]]) {
        await page.setViewportSize({width,height});
        await page.goto(`${url}/configuracoes?real`);
        const main = page.getByRole("main");
        await main.getByRole("heading",{name:"Configurações",exact:true}).waitFor();
        assert.deepEqual(await main.getByRole("heading",{level:2}).allTextContents(),["Empresa","Usuários e acesso","Financeiro"]);
        const links = main.getByRole("link");
        assert.deepEqual(await links.evaluateAll(items => items.map(item => item.getAttribute("href"))),[
            "/empresa","/usuarios","/financeiro/formas-pagamento","/financeiro/dados-bancarios",
        ]);
        for (const link of await links.all()) {
            await link.focus();
            await expect(link).toBeFocused();
            const bounds = await link.boundingBox();
            assert.ok(bounds.y >= -1 && bounds.y + bounds.height <= height + 1,`Link fora da janela em ${width}x${height}`);
        }
        const config = page.getByRole("navigation").getByRole("link",{name:width < 600 ? "Configurações (ícone)" : "Configurações",exact:true});
        await config.scrollIntoViewIfNeeded();
        await expect(config).toHaveAttribute("aria-current","true");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
        if (height >= 568) {
            const bounds = await config.boundingBox();
            assert.ok(bounds.y > height - 90,"Configurações deve ficar no rodapé");
        }
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/configuracoes-${width}-${height}.png`,fullPage:true});
    }
    assert.deepEqual(requests,[],"A central não deve carregar cadastros");
}));

test("Rotas administrativas diretas mantem Configuracoes ativa, retorno e historico", () => withLayout(async page => {
    await mockCatalogs(page);
    for (const [path,title] of [["/empresa","Empresas"],["/usuarios","Usuários"],["/financeiro/formas-pagamento","Formas de pagamento"],["/financeiro/dados-bancarios","Dados bancários"]]) {
        await page.goto(`${url}${path}?real&origem=atalho`);
        await page.getByRole("main").getByRole("heading",{name:title,exact:true}).waitFor();
        const config = page.getByRole("navigation").getByRole("link",{name:"Configurações",exact:true});
        await expect(config).toHaveAttribute("aria-current","true");
        const back = page.getByRole("link",{name:"Voltar às configurações",exact:true});
        assert.equal(await back.getAttribute("href"),"/configuracoes");
        assert.equal(new URL(page.url()).searchParams.get("origem"),"atalho");
        await back.click();
        await page.getByRole("main").getByRole("heading",{name:"Configurações",exact:true}).waitFor();
        await page.goBack();
        await page.getByRole("main").getByRole("heading",{name:title,exact:true}).waitFor();
        assert.equal(new URL(page.url()).searchParams.get("origem"),"atalho");
        await config.click();
        await page.getByRole("main").locator(`a[href="${path}"]`).click();
        await page.getByRole("main").getByRole("heading",{name:title,exact:true}).waitFor();
        assert.equal(new URL(page.url()).pathname,path);
    }
}));

test("Vender abre o PDV real na rota protegida e sem duplicar layout", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/clientes?real`);
    const sell = page.getByRole("navigation").getByRole("link",{name:"Vender",exact:true});
    assert.equal(await sell.getAttribute("href"),"/pdv");
    await sell.click();
    // Sem caixa aberto, o dialog operacional existente oculta o conteudo de fundo do leitor de tela.
    await page.getByRole("heading",{name:/Vender/,includeHidden:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,"/pdv");
    assert.equal(await page.getByRole("navigation",{name:"Menu principal"}).count(),0);
}));

test("Produtos e Estoque preservam abas contextuais reais", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/produtos?real&origem=atalho`);
    const products = page.getByRole("tablist",{name:"Cadastros de produtos"});
    await products.waitFor();
    assert.deepEqual(await products.getByRole("tab").allTextContents(),["Produtos","Fornecedores"]);
    await products.getByRole("tab",{name:"Fornecedores",exact:true}).click();
    await expect(products.getByRole("tab",{name:"Fornecedores",exact:true})).toHaveAttribute("aria-selected","true");
    assert.equal(new URL(page.url()).searchParams.get("aba"),"fornecedores");
    assert.equal(new URL(page.url()).searchParams.get("origem"),"atalho");
    await page.getByRole("button",{name:"Cadastros",exact:true}).click();
    assert.equal(await page.getByRole("link",{name:"Fornecedores",exact:true}).getAttribute("aria-current"),"page");
    await page.getByRole("link",{name:"Produtos",exact:true}).click();
    await expect(products.getByRole("tab",{name:"Produtos",exact:true})).toHaveAttribute("aria-selected","true");
    await page.getByRole("button",{name:"Cadastros",exact:true}).click();
    await page.getByRole("link",{name:"Fornecedores",exact:true}).click();
    await expect(products.getByRole("tab",{name:"Fornecedores",exact:true})).toHaveAttribute("aria-selected","true");
    await page.goto(`${url}/estoque?real&origem=atalho`);
    const stock = page.getByRole("tablist",{name:"Área de estoque"});
    await stock.waitFor();
    assert.deepEqual(await stock.getByRole("tab").allTextContents(),["Saldo","Entradas"]);
    await stock.getByRole("tab",{name:"Entradas",exact:true}).click();
    await page.getByRole("button",{name:"Entrada manual",exact:true}).waitFor();
    assert.equal(await stock.getByRole("tab",{name:"Entradas",exact:true}).getAttribute("aria-selected"),"true");
    assert.equal(new URL(page.url()).searchParams.get("aba"),"entradas");
    assert.equal(new URL(page.url()).searchParams.get("origem"),"atalho");
    await page.getByRole("navigation").getByRole("button",{name:"Estoque",exact:true}).click();
    assert.equal(await page.getByRole("link",{name:"Entradas de mercadoria",exact:true}).getAttribute("aria-current"),"page");
    await page.getByRole("link",{name:"Saldo",exact:true}).click();
    await expect(stock.getByRole("tab",{name:"Saldo",exact:true})).toHaveAttribute("aria-selected","true");
    await page.getByRole("navigation").getByRole("button",{name:"Estoque",exact:true}).click();
    await page.getByRole("link",{name:"Entradas de mercadoria",exact:true}).click();
    await expect(stock.getByRole("tab",{name:"Entradas",exact:true})).toHaveAttribute("aria-selected","true");
}));

test("Cabecalhos de pagina e atalhos usam a nomenclatura da navegacao", async () => {
    for (const [file,title] of [["Financeiro/Recebiveis","Recebimentos de cartão"],["Financeiro/ContasFinanceiras","Contas e saldos"],["Financeiro/FormasPagamento","Formas de pagamento"],["Vendas/CentralVendas","Central de Vendas"]]) {
        const source = await readFile(new URL(`../src/pages/${file}.tsx`,import.meta.url),"utf8");
        assert.ok(source.includes(`titulo="${title}"`));
    }
    for (const file of ["Dashboard/Dashboard","Vendas/CentralVendas"]) {
        const source = await readFile(new URL(`../src/pages/${file}.tsx`,import.meta.url),"utf8");
        assert.match(source,/to="\/pdv"/);
        assert.match(source,/>Vender<\/Button>/);
        assert.match(source,/startIcon={<AddShoppingCartRoundedIcon/);
    }
});

test("Sidebar preserva navegacao, expansao e foco de teclado", () => withLayout(async page => {
    const nav = page.getByRole("navigation");
    const domain = nav.getByRole("button",{name:"Cadastros",exact:true});
    await domain.focus();
    await page.keyboard.press("ArrowRight");
    const products = nav.getByRole("link",{name:"Produtos",exact:true});
    assert.equal(await products.evaluate(el => el === document.activeElement),true);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await domain.evaluate(el => el === document.activeElement),true);
    await page.keyboard.press("ArrowRight");
    await expect(products).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("heading",{name:"Conteudo /produtos"}).waitFor();
    await domain.click();
    assert.equal(await products.getAttribute("aria-current"),"page");
    await page.keyboard.press("Escape");
    assert.equal(await domain.evaluate(el => el === document.activeElement),true);
    const group = nav.getByRole("button",{name:"Financeiro",exact:true});
    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"),"true");
    await group.click();
    assert.equal(await group.getAttribute("aria-expanded"),"false");
    await group.click();
    await nav.getByRole("link",{name:"Contas a Pagar",exact:true}).click();
    await page.getByRole("heading",{name:"Contas a Pagar",exact:true}).waitFor();
}));

for (const perfil of ["ADMIN","GERENTE","OPERADOR","USUARIO"]) test(`Central e rota preservam restricao de Usuarios para ${perfil}`, () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/configuracoes?real`);
    const central = page.getByRole("main");
    await central.getByRole("heading",{name:"Configurações",exact:true}).waitFor();
    assert.equal(await central.getByRole("link",{name:/Usuários/}).count(),perfil === "ADMIN" ? 1 : 0);
    assert.equal(await central.getByRole("region",{name:"Usuários e acesso",exact:true}).count(),perfil === "ADMIN" ? 1 : 0);
    assert.equal(await central.getByRole("link",{name:/Empresas/}).count(),1);
    await page.getByRole("button",{name:"Cadastros",exact:true}).click();
    assert.equal(await page.getByRole("navigation").getByRole("link",{name:"Clientes",exact:true}).count(),1);
    await page.goto(`${url}/usuarios?real`);
    if (perfil === "ADMIN") await page.getByRole("main").getByRole("heading",{name:"Usuários",exact:true}).waitFor();
    else await page.waitForURL(`${url}/dashboard`);
}, {perfil}));

test("Sidebar mostra tooltip somente quando os labels estao ocultos", () => withLayout(async page => {
    await page.getByRole("button",{name:"Cadastros",exact:true}).hover();
    await page.waitForTimeout(700);
    assert.equal(await page.getByRole("tooltip").count(),0);
    await page.setViewportSize({width:390,height:900});
    await page.getByRole("button",{name:"Cadastros (ícone)",exact:true}).hover();
    await page.getByRole("tooltip",{name:"Cadastros",exact:true}).waitFor();
}));

test("Faixa de icones preserva alvos e acesso aos dominios em telas baixas", () => withLayout(async page => {
    for (const width of [1024,390]) {
        await page.setViewportSize({width,height:320});
        const rail = page.getByLabel("Áreas compactas",{exact:true});
        const admin = rail.getByRole("link",{name:"Configurações (ícone)",exact:true});
        await rail.hover();
        await page.mouse.wheel(0,600);
        await expect.poll(() => rail.evaluate(element => element.scrollTop),{timeout:1500}).toBeGreaterThan(0);
        const sizes = await rail.locator("button,a").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
        assert.ok(sizes.every(height => height >= 44),`compact targets shrank at ${width}px: ${sizes}`);
        const bounds = await admin.boundingBox();
        assert.ok(bounds.y >= 8 && bounds.y + bounds.height <= 312);
        await admin.focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(`${url}/configuracoes`);
        await expect(admin).toHaveAttribute("aria-current","true");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    }
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
        await expect(page.getByRole("navigation")).toHaveCSS("width",width < 600 ? "56px" : "264px");
        await page.getByRole("heading",{name:"Conteudo /clientes"}).waitFor();
        const sizes = await page.evaluate(() => ({page:document.documentElement.scrollWidth,header:document.querySelector('header').getBoundingClientRect().height,
            sidebar:document.querySelector('nav').getBoundingClientRect().width,padding:getComputedStyle(document.querySelector('main')).paddingLeft}));
        assert.ok(sizes.page <= width);
        assert.ok(sizes.header >= 64 && sizes.header <= 65);
        assert.equal(sizes.sidebar,width < 600 ? 56 : 264);
        assert.equal(sizes.padding,width < 600 ? "16px" : "24px");
        assert.equal(await page.getByText("Loja Novexa",{exact:true}).isVisible(),width >= 900);
        assert.equal(await page.getByRole("button",{name:"Sair",exact:true}).isVisible(),true);
        const config = page.getByRole("button",{name:width < 600 ? "Financeiro (ícone)" : "Financeiro",exact:true});
        assert.equal(await config.isVisible(),true);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/navigation-${width}.png`,fullPage:true});
    }
}));

test("Menu flutuante sobrepoe conteudo sem deslocamento e fecha ao clicar fora", () => withLayout(async page => {
    await mockCatalogs(page);
    await page.goto(`${url}/dashboard?real`);
    await page.getByRole("heading",{name:/Maria Silva/}).waitFor();
    const nav = page.getByRole("navigation",{name:"Menu principal"});
    for (const [width,height] of [[1366,768],[1920,1080],[1024,768],[390,844]]) {
        await page.setViewportSize({width,height});
        const before = await page.locator("main").boundingBox();
        const trigger = nav.getByRole("button",{name:width < 600 ? "Financeiro (ícone)" : "Financeiro",exact:true});
        await trigger.click();
        await nav.getByRole("region",{name:"Funções de Financeiro"}).waitFor();
        assert.deepEqual(await page.locator("main").boundingBox(),before,"opening submenu must not move content");
        const bounds = await nav.boundingBox();
        assert.equal(bounds.x,8);
        assert.equal(bounds.y,8);
        assert.equal(bounds.height,height-16);
        assert.ok(bounds.x+bounds.width <= width-8);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
        assert.equal(await nav.evaluate(el => getComputedStyle(el).borderRadius),"12px");
        assert.equal(await nav.evaluate(el => [...el.children].every(child => getComputedStyle(child).boxShadow === "none")),true);
        assert.equal(await nav.getByRole("link",{name:"Recebimentos de cartão",exact:true}).isVisible(),true);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/navigation-open-${width}.png`});
        await page.mouse.click(width-20,72);
        assert.equal(await nav.getByRole("region").count(),0);
        if (process.env.NOVEXA_NAV_SCREENSHOTS) await page.screenshot({path:`node_modules/.vite-layout-tests/navigation-closed-${width}.png`});
    }
}));
