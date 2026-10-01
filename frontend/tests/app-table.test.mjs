import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;
const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, CssBaseline, Stack } from '@mui/material';
import AppTable from '/src/components/ui/AppTable.tsx';
import PageContainer from '/src/components/layout/PageContainer.tsx';
import PageFilters from '/src/components/ui/PageFilters.tsx';
import theme from '/src/theme/theme.ts';
window.events = [];
function Fixture() {
    const [options, setOptions] = React.useState({});
    window.setTableOptions = setOptions;
    const props = {
        colunas: [{campo:'nome',cabecalho:'Nome',ordenavel:true,pesquisavel:true},
                  {campo:'valor',cabecalho:'Valor',alinhar:'right'}],
        linhas: [{id:1,nome:'Zulu',valor:100},{id:2,nome:'Alfa',valor:20}],
        obterChaveLinha: linha => linha.id,
        acoes: [{rotulo:'Editar',tooltip:'Editar registro',icone:'E',
                 onClick:linha => window.events.push(['acao',linha.id]),
                 desabilitado:linha => linha.id === 2}],
        linhaCliqueavel: true,
        onLinhaClick:linha => window.events.push(['linha',linha.id]),
        paginacao: {pagina:0,linhasPorPagina:25,total:260,
                    onPageChange:pagina => window.events.push(['pagina',pagina]),
                    onRowsPerPageChange:size => window.events.push(['size',size])},
        ordenacao: {campo:'nome',direcao:'asc',onSort:campo => window.events.push(['sort',campo])},
        ordenacaoComIcone:true,ordenacaoRemota:true,
        ...options,
    };
    return React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),
        React.createElement('main',{style:{padding:16,minWidth:0}},options.filtrosIntegrados
            ? React.createElement(PageContainer,null,React.createElement(Stack,{spacing:1.5},
                React.createElement(PageFilters,{busca:{placeholder:'Pesquisar',valor:'',onChange(){}}}),React.createElement(AppTable,props)))
            : React.createElement(AppTable,props)));
}
createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`;

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-app-table-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "app-table-test-fixture",
            resolveId(id) { if (id === "/app-table-fixture.js") return "\0app-table-fixture.js"; },
            load(id) { if (id === "\0app-table-fixture.js") return fixture; },
            configureServer(vite) {
                vite.middlewares.use("/__app-table", async (_req, res) => {
                    res.setHeader("Content-Type", "text/html");
                    res.end(await vite.transformIndexHtml("/__app-table", '<div id="root"></div><script type="module" src="/app-table-fixture.js"></script>'));
                });
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/__app-table`;
    browser = await chromium.launch({ headless: true });
});

after(async () => {
    await browser?.close();
    await server?.close();
});

async function withTable(run) {
    const page = await browser.newPage();
    try {
        await page.goto(url);
        await page.getByRole("table").waitFor();
        await run(page);
    } finally {
        await page.close();
    }
}

test("AppTable preserva colunas, renderizadores e ordem recebida do backend", () => withTable(async page => {
    assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), ["Zulu", "Alfa"]);
    assert.equal(await page.getByRole("columnheader").count(), 3);
    assert.equal(await page.getByRole("columnheader").first().getAttribute("aria-sort"), "ascending");
    assert.equal(await page.getByRole("columnheader").nth(1).getByRole("button").count(), 0);
    await page.evaluate(() => window.setTableOptions({ colunas: [{campo:"nome",cabecalho:"Nome",render: (_v, row, index) => `${row.id}:${index}`}]}));
    await page.getByRole("cell", { name: "1:0", exact: true }).waitFor();
}));

test("Filtros adjacentes integram-se visualmente a tabela mesmo dentro de um Stack", () => withTable(async page => {
    await page.evaluate(() => window.setTableOptions({filtrosIntegrados:true}));
    await page.locator('[data-page-filters]').waitFor();
    const spacing = await page.evaluate(() => {
        const filter = document.querySelector('[data-page-filters]');
        const table = document.querySelector('[data-app-table]');
        return {gap:table.getBoundingClientRect().top-filter.getBoundingClientRect().bottom,
            filterBottom:getComputedStyle(filter).borderBottomLeftRadius,tableTop:getComputedStyle(table).borderTopLeftRadius};
    });
    assert.equal(spacing.gap,0);
    assert.equal(spacing.filterBottom,"0px");
    assert.equal(spacing.tableTop,"0px");
}));

test("AppTable preserva acao, tooltip, aria-label, disabled e propagacao", () => withTable(async page => {
    const actions = page.getByRole("button", { name: "Editar registro", exact: true });
    await actions.first().hover();
    await page.getByRole("tooltip", { name: "Editar registro" }).waitFor();
    assert.equal(await actions.nth(1).isDisabled(), true);
    await actions.first().click();
    assert.deepEqual(await page.evaluate(() => window.events), [["acao", 1]]);
    await page.locator("tbody tr").first().focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.events), [["acao", 1], ["linha", 1]]);
}));

test("AppTable usa total remoto e preserva callbacks de pagina e size", () => withTable(async page => {
    await page.getByText("1\u201325 de 260", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Pr\u00f3xima p\u00e1gina" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "50", exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.events), [["pagina", 1], ["size", 50]]);
}));

test("AppTable mantem sort remoto e callback do campo sem reordenar linhas", () => withTable(async page => {
    await page.getByRole("button", { name: "Ordenar por Nome: decrescente" }).click();
    assert.deepEqual(await page.evaluate(() => window.events), [["sort", "nome"]]);
    assert.deepEqual(await page.locator("tbody tr td:first-child").allTextContents(), ["Zulu", "Alfa"]);
    await page.evaluate(() => window.setTableOptions({ ordenacaoRemota:false }));
    await page.waitForFunction(() => document.querySelector("tbody td").textContent === "Alfa");
}));

test("AppTable preserva API de busca e ordenacao local opcional", () => withTable(async page => {
    await page.evaluate(() => window.setTableOptions({ordenacao:undefined,ordenacaoRemota:false,
        buscaPorColuna:{campo:null,onSelecionar:campo => window.events.push(['busca',campo])}}));
    await page.getByRole("button", { name: "Buscar por: Nome" }).click();
    await page.getByRole("button", { name: "Ordenar por Nome: crescente" }).click();
    await page.waitForFunction(() => document.querySelector("tbody td").textContent === "Alfa");
    await page.getByRole("button", { name: "Ordenar por Nome: decrescente" }).click();
    await page.waitForFunction(() => document.querySelector("tbody td").textContent === "Zulu");
    assert.deepEqual(await page.evaluate(() => window.events), [["busca", "nome"]]);
}));

test("AppTable preserva loading e EmptyState customizado com acao", () => withTable(async page => {
    await page.setViewportSize({width:390,height:800});
    await page.evaluate(() => window.setTableOptions({carregando:true}));
    await page.getByRole("progressbar").waitFor();
    const loading = await page.getByRole("progressbar").boundingBox();
    assert.ok(loading.x >= 0 && loading.x + loading.width <= 390);
    assert.equal(await page.getByRole("cell", {name:"Zulu",exact:true}).count(), 0);
    await page.evaluate(() => window.setTableOptions({linhas:[],vazio:{titulo:'Sem resultados',descricao:'Busca especifica',acao:'Nova entrada'}}));
    await page.getByText("Sem resultados", {exact:true}).waitFor();
    await page.getByText("Busca especifica", {exact:true}).waitFor();
    await page.getByText("Nova entrada", {exact:true}).waitFor();
    const empty = await page.getByText("Sem resultados", {exact:true}).boundingBox();
    assert.ok(empty.x >= 0 && empty.x + empty.width <= 390);
    assert.equal(await page.getByRole("progressbar").count(), 0);
    await page.evaluate(() => window.setTableOptions({linhas:[]}));
    await page.getByText("Nenhum registro encontrado", {exact:true}).waitFor();
}));

test("AppTable limita overflow horizontal ao container sem scroll vertical em tres larguras", () => withTable(async page => {
    await page.evaluate(() => window.setTableOptions({alturaCorpo:480,minWidth:1540,
        linhas:Array.from({length:25},(_,i) => ({id:i+1,nome:`Registro ${i}`,valor:i}))}));
    await page.locator("tbody tr").nth(24).waitFor();
    for (const width of [1440, 1024, 390]) {
        await page.setViewportSize({width,height:800});
        const dimensions = await page.getByRole("table").evaluate(table => {
            const container = table.parentElement;
            return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,
                width:container.clientWidth,scrollWidth:container.scrollWidth,
                height:container.clientHeight,scrollHeight:container.scrollHeight,
                tableWidth:table.getBoundingClientRect().width};
        });
        assert.ok(dimensions.pageWidth <= dimensions.viewport);
        assert.ok(dimensions.scrollWidth > dimensions.width);
        assert.equal(dimensions.height, dimensions.scrollHeight);
        assert.ok(dimensions.tableWidth >= 1540);
        assert.equal(await page.getByRole("button", {name:"Pr\u00f3xima p\u00e1gina"}).isVisible(), true);
    }
}));
