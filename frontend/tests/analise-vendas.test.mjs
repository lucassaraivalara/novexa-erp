import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-analise-vendas", optimizeDeps: { include: ["@mui/icons-material/FileDownloadOutlined", "@mui/icons-material/ReceiptLongOutlined"] }, server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "analise-fixture", resolveId(id) { if (id === "/analise-fixture.js") return "\0analise"; },
            load(id) { if (id === "\0analise") return `import React from 'react'; import {createRoot} from 'react-dom/client';
                import {BrowserRouter} from 'react-router-dom'; import {CssBaseline} from '@mui/material';
                import {ThemeModeProvider} from '/src/theme/ThemeModeProvider.tsx'; import AppRoutes from '/src/routes/AppRoutes.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider,null,React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!req.url.startsWith("/vendas")) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/analise-fixture.js"></script>'));
            }); },
        }],
    });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

async function abrir(opcoes = {}) {
    const e = { chamadas: [], erros: [], ...opcoes };
    const p = await browser.newPage({ viewport: e.viewport ?? { width: 1440, height: 900 } });
    p.setDefaultTimeout(7000);
    await p.emulateMedia({ colorScheme: e.tema === "auto" ? "dark" : "light" });
    await p.addInitScript(({ perfil, tema }) => {
        localStorage.setItem("novexa-auth", JSON.stringify({ token: "synthetic", perfil, nomeUsuario: "Gestor sintético", empresa: { id: 1, nomeFantasia: "Empresa sintética" } }));
        localStorage.setItem("novexa-theme-choice", tema);
    }, { perfil: e.perfil ?? "ADMIN", tema: e.tema ?? "light" });
    p.on("pageerror", erro => e.erros.push(erro.message));
    await p.route("**/*", async route => {
        const r = route.request();
        if (!["xhr", "fetch"].includes(r.resourceType())) return route.continue();
        const u = new URL(r.url());
        if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
        e.chamadas.push({ path: u.pathname, params: Object.fromEntries(u.searchParams), metodo: r.method() });
        let dados, status = 200;
        if (u.pathname === "/vendas/analise/resumo") {
            if (e.atraso) await new Promise(r => setTimeout(r, e.atraso));
            if (e.erro) { status = 503; dados = { detail: "Consulta indisponível. Tente novamente." }; }
            else dados = { vendasSemDataFaturamento: e.legado ? 2 : 0, periodo: { dataInicial: u.searchParams.get("dataInicial"), dataFinal: u.searchParams.get("dataFinal"), incompleto: true, geradoEm: "2026-10-22T14:03:00" },
                atual: { faturamento: e.vazio ? 0 : 150, quantidadeVendas: e.vazio ? 0 : 2, ticketMedio: e.vazio ? 0 : 75, descontos: e.vazio ? 0 : 15 },
                periodoAnterior: { dataInicial: "2026-10-19", dataFinal: "2026-10-20" },
                anterior: { faturamento: 0, quantidadeVendas: 0, ticketMedio: 0, descontos: 0 },
                evolucao: [{ data: "2026-10-21", faturamento: e.vazio ? 0 : 150 }, { data: "2026-10-22", faturamento: 0 }],
                evolucaoAnterior: [{ data: "2026-10-19", faturamento: 0 }, { data: "2026-10-20", faturamento: 0 }] };
        } else if (u.pathname === "/vendas/analise/pagamentos") {
            if (e.erroPagamento) { status = 503; dados = { detail: "Pagamentos comerciais indisponíveis." }; }
            else dados = e.vazio ? [] : [{ nome: "PIX", valor: 100, participacao: 66.67 }, { nome: "Dinheiro", valor: 50, participacao: 33.33 }];
        }
        else if (u.pathname === "/vendas/analise/produtos") {
            if (e.erroRanking) { status = 503; dados = { detail: "Ranking indisponível. Tente novamente." }; }
            else {
                const unidades = ["KG", "UN"];
                let itens = e.vazio ? [] : Array.from({ length: 7 }, (_, i) => ({ produtoId: i + 1, nome: `Produto sintético ${i + 1}`, unidade: i === 1 ? "KG" : "UN", quantidade: i + 1, valorVendido: i === 0 ? 30 : 20, participacao: i === 0 ? 20 : 13.33, categoria: i > 3 ? "Sem categoria" : "Bebidas" }));
                if (e.legado && !e.vazio) itens = [{ ...itens[0], unidade: null, quantidade: null }, { ...itens[0], unidade: "UN", quantidade: 1 }];
                if (u.searchParams.has("unidade")) itens = itens.filter(i => i.unidade === u.searchParams.get("unidade"));
                const page = Number(u.searchParams.get("page")), size = Number(u.searchParams.get("size"));
                dados = { itensSemUnidade: e.legado && !e.vazio ? 1 : 0, pagina: { items: itens.slice(page * size, (page + 1) * size), page, size, totalItems: itens.length, totalPages: Math.ceil(itens.length / size) }, unidades: e.vazio ? [] : unidades, faturamentoPeriodo: e.vazio ? 0 : 150 };
            }
        } else if (u.pathname === "/vendas/analise/categorias") dados = { items: e.vazio ? [] : [ { categoriaId: 1, nome: "Bebidas", valorVendido: 90, participacao: 60 }, { categoriaId: null, nome: "Sem categoria", valorVendido: 60, participacao: 40 } ], faturamentoPeriodo: e.vazio ? 0 : 150 };
        else if (u.pathname === "/vendas/analise/exportar") {
            if (e.erroExportacao) { status = 503; dados = { detail: "Exportação indisponível. Tente novamente." }; }
            else return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "text/csv;charset=UTF-8", body: '\uFEFF"Nome";"Valor"\r\n"Produto sintético";"150,00"' });
        } else if (u.pathname === "/vendas") dados = { items: [], page: 0, size: 25, totalItems: 0, totalPages: 0 };
        else throw new Error(`Requisição não simulada: ${u.pathname}`);
        if (e.painel22 && u.pathname.endsWith("/resumo")) {
            dados.atual = { faturamento: 150, quantidadeVendas: 12, ticketMedio: 12.5, descontos: 15, participacaoDescontos: 9.09 };
            dados.anterior = { faturamento: 120, quantidadeVendas: 14, ticketMedio: 8.57, descontos: 12 };
            dados.periodo.incompleto = false;
            dados.periodoAnterior = { dataInicial: "2026-10-16", dataFinal: "2026-10-22" };
            dados.evolucao = [10, 20, 30, 0, 40, 20, 30].map((faturamento, i) => ({ data: `2026-10-${23+i}`, faturamento, quantidadeVendas: faturamento ? 2 : 0, ticketMedio: faturamento/2, descontos: i === 0 ? 15 : 0 }));
            dados.evolucaoAnterior = [20, 10, 20, 10, 30, 10, 20].map((faturamento, i) => ({ data: `2026-10-${16+i}`, faturamento }));
        }
        if (u.pathname === "/vendas/analise/resumo" && status === 200 && !e.semMetadadosOperacionais) {
            const classificar = (dias, parcial) => dias.map((d, i) => ({ ...d, quantidadeVendas: d.quantidadeVendas ?? (d.faturamento > 0 ? 1 : 0), operado: Boolean(d.quantidadeVendas || d.faturamento || e.operadoSemVendas), parcial: parcial && i === dias.length-1 }));
            if (e.apenasParcial) { dados.evolucao = [{data: dados.periodo.dataFinal, faturamento:0, quantidadeVendas:0, descontos:0}]; dados.atual = {faturamento:0,quantidadeVendas:0,ticketMedio:0,descontos:0}; }
            dados.evolucao = classificar(dados.evolucao, Boolean(dados.periodo.incompleto));
            dados.evolucaoAnterior = classificar(dados.evolucaoAnterior, false);
            const operacao = (dias, total, parcial) => {
                const operados=dias.filter(d=>d.operado), completos=operados.filter(d=>!d.parcial);
                const destaque=d=>d ? {data:d.data,faturamento:d.faturamento,participacao:total ? d.faturamento/total*100:0}:null;
                return {diasPeriodo:dias.length,diasOperados:operados.length,diasConcluidos:completos.length,faturamentoMedio:operados.length ? Number((total/operados.length).toFixed(2)):null,parcial,
                    melhorDia:destaque([...completos].sort((a,b)=>b.faturamento-a.faturamento||a.data.localeCompare(b.data))[0]),piorDia:destaque([...completos].sort((a,b)=>a.faturamento-b.faturamento||a.data.localeCompare(b.data))[0])};
            };
            dados.operacao=operacao(dados.evolucao,dados.atual.faturamento,Boolean(dados.periodo.incompleto));
            dados.operacaoAnterior=operacao(dados.evolucaoAnterior,dados.anterior.faturamento,false);
            dados.variacaoMediaDiaria=!dados.operacao.parcial && dados.operacao.faturamentoMedio != null && dados.operacaoAnterior.faturamentoMedio > 0
                ? Number(((dados.atual.faturamento*dados.operacaoAnterior.diasOperados-dados.anterior.faturamento*dados.operacao.diasOperados)*100/(dados.anterior.faturamento*dados.operacao.diasOperados)).toFixed(2)) : null;
        }
        if (u.pathname.endsWith("/pagamentos") && status === 200) dados = { items: dados, faturamentoPeriodo: e.vazio ? 0 : 150 };
        await route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: JSON.stringify(dados) });
    });
    await p.goto(`${url}/vendas${e.query ?? "?aba=analise&dataInicial=2026-10-21&dataFinal=2026-10-22"}`);
    return { p, e };
}

test("Sprint22 dashboard completo nas quatro resoluções sem consultas duplicadas", async () => {
    const screenshotDir = process.env.NOVEXA_ANALISE_SCREENSHOTS ?? "../docs/audits/assets/sprint22";
    await mkdir(screenshotDir, { recursive: true });
    for (const width of [1920, 1366, 768, 390]) {
        const { p, e } = await abrir({ painel22: true, query: "?aba=analise&dataInicial=2026-10-23&dataFinal=2026-10-29", tema: "dark", viewport: { width, height: width === 1920 ? 1080 : width === 1366 ? 768 : width === 768 ? 1024 : 844 } });
        try {
            await expect(p.getByRole("heading", { name: "Evolução do faturamento" })).toBeVisible();
            await expect(p.getByText("Meta não configurada", { exact: true })).toBeVisible();
            await expect(p.getByText(/Comparado a 16\/10\/2026 a 22\/10\/2026/)).toBeVisible();
            await expect(p.getByRole("region", { name: "Formas de pagamento", exact: true }).getByText("PIX", { exact: true })).toBeVisible();
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(await p.locator("body *").evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().right > innerWidth + 1).slice(-12).map(n => ({ tag: n.tagName, text: n.textContent?.slice(0,80), right: n.getBoundingClientRect().right })))));
            assert.equal(e.chamadas.filter(c => c.path.endsWith("/resumo")).length, 1);
            assert.equal(e.chamadas.filter(c => c.path.endsWith("/categorias")).length, 1);
            assert.equal(e.chamadas.filter(c => c.path.endsWith("/pagamentos")).length, 1);
            assert.equal(e.chamadas.filter(c => c.path.endsWith("/produtos")).length, 0);
            await p.screenshot({ path: `${screenshotDir}/dashboard-dark-${width}.png`, fullPage: true, animations: "disabled" });
            assert.deepEqual(e.erros, []);
        } finally { await p.close(); }
    }
});

test("falha de pagamentos não mascara faturamento e permite atualização", async () => {
    const { p, e } = await abrir({ erroPagamento: true });
    try {
        await expect(p.getByText("Pagamentos comerciais indisponíveis.")).toBeVisible();
        await expect(p.getByRole("region", { name: "Resumo do período" }).getByText("R$ 150,00", { exact: true })).toBeVisible();
        e.erroPagamento = false;
        await p.getByRole("button", { name: "Atualizar análise" }).click();
        await expect(p.getByRole("region", { name: "Formas de pagamento" }).getByText("PIX", { exact: true })).toBeVisible();
    } finally { await p.close(); }
});

test("resumo gerencial usa dados reais do contrato e abre Consulta com o período FATURADA", async () => {
    const { p, e } = await abrir();
    try {
        await expect(p.getByRole("region", { name: "Resumo do período", exact: true }).getByText("R$ 150,00", { exact: true })).toBeVisible();
        await expect(p.getByText(/Período atual incompleto/)).toBeVisible();
        assert.equal(e.chamadas.filter(c => c.path === "/vendas").length, 0);
        await p.getByRole("button", { name: "Ver vendas do período" }).click();
        await expect(p.getByRole("tab", { name: "Consulta", exact: true })).toHaveAttribute("aria-selected", "true");
        await expect.poll(() => e.chamadas.find(c => c.path === "/vendas")?.params.status).toBe("FATURADA");
        assert.deepEqual(Object.fromEntries(new URL(p.url()).searchParams), { dataInicial: "2026-10-21", dataFinal: "2026-10-22", status: "FATURADA", referenciaData: "FATURAMENTO" });
        assert.ok(e.chamadas.every(c => c.metodo === "GET" && !("empresaId" in c.params)));
        assert.deepEqual(e.erros, []);
    } finally { await p.close(); }
});

test("período inválido não consulta, erro permite retry e vazio é explícito", async () => {
    const { p, e } = await abrir({ query: "?aba=analise&dataInicial=2026-10-22&dataFinal=2026-10-21", erro: true });
    try {
        await expect(p.getByText(/Informe um período válido/)).toBeVisible();
        assert.equal(e.chamadas.length, 0);
        await p.getByRole("region", { name: "Análise de vendas", exact: true }).getByLabel("Data final", { exact: true }).fill("2026-10-22");
        await expect(p.getByText("Consulta indisponível. Tente novamente.", { exact: true })).toBeVisible();
        e.erro = false; e.vazio = true;
        await p.getByRole("button", { name: "Tentar novamente" }).click();
        await expect(p.getByText("Nenhuma venda faturada neste período.")).toBeVisible();
    } finally { await p.close(); }
});

test("perfil operacional mantém Consulta e não dispara análise gerencial", async () => {
    const { p, e } = await abrir({ perfil: "OPERADOR" });
    try {
        await expect(p.getByText(/restrita a administradores e gerentes/)).toBeVisible();
        assert.equal(e.chamadas.length, 0);
    } finally { await p.close(); }
});

test("comparação sem base não inventa percentual e os valores diários são acessíveis por teclado", async () => {
    const { p } = await abrir();
    try {
        await expect(p.getByRole("region", { name: "Resumo do per\u00edodo", exact: true }).getByText("Sem base anterior", { exact: true })).toHaveCount(3);
        await expect(p.getByRole("img", { name: "Faturamento diário atual e anterior" })).toBeVisible();
        const dados = p.locator("summary"); await dados.focus(); await dados.press("Enter");
        await expect(p.getByRole("table", { name: "Valores diários da evolução" })).toBeVisible();
        await expect(p.getByRole("table").getByText("22/10/2026", { exact: true })).toBeVisible();
    } finally { await p.close(); }
});

test("ranking pagina cinco produtos, compara quantidade na mesma unidade e exporta sem limite de página", async () => {
    const { p, e } = await abrir();
    try {
        await p.getByRole("button", { name: "Consultar ranking de produtos e categorias" }).click();
        const lista = p.getByRole("list", { name: "Ranking de produtos" });
        await expect(lista.getByRole("listitem")).toHaveCount(5);
        await p.getByRole("button", { name: "Próxima página" }).last().click();
        await expect(lista.getByRole("listitem")).toHaveCount(2);
        await expect(lista.getByRole("listitem").last()).toContainText("Produto sintético 7");
        await p.getByLabel("Ranking", { exact: true }).click();
        await p.getByRole("option", { name: "Por quantidade" }).click();
        await expect(lista.getByRole("listitem")).toHaveCount(1);
        await expect(lista.getByRole("listitem").first()).toContainText("2 KG");
        assert.ok(e.chamadas.some(c => c.path.endsWith("/produtos") && c.params.ordem === "quantidade" && c.params.unidade === "KG" && c.params.page === "0"));
        await p.getByRole("button", { name: "Exportar CSV", exact: true }).click();
        const download = p.waitForEvent("download");
        await p.getByRole("menuitem", { name: "Produtos · ranking completo" }).click();
        const arquivo = await download;
        assert.equal(arquivo.suggestedFilename(), "analise-produtos-2026-10-21-2026-10-22.csv");
        assert.match(await readFile(await arquivo.path(), "utf8"), /Produto sintético/);
        const requisicao = e.chamadas.find(c => c.path.endsWith("/exportar"));
        assert.equal(requisicao.params.secao, "produtos"); assert.equal(requisicao.params.unidade, "KG");
        assert.ok(!("page" in requisicao.params) && !("size" in requisicao.params));
        assert.deepEqual(Object.keys(requisicao.params).sort(), ["dataFinal", "dataInicial", "ordem", "secao", "unidade"]);
    } finally { await p.close(); }
});

test("Consulta preserva seus filtros ao alternar abas", async () => {
    const { p, e } = await abrir({ query: "" });
    try {
        await expect(p.getByText("Nenhuma venda encontrada", { exact: true })).toBeVisible();
        await p.getByLabel("Data inicial", { exact: true }).fill("2026-09-01");
        await p.getByLabel("Status", { exact: true }).click(); await p.getByRole("option", { name: "Aberta", exact: true }).click();
        await p.getByRole("tab", { name: "Análise de vendas", exact: true }).click();
        await expect(p.getByRole("region", { name: "Resumo do período", exact: true })).toBeVisible();
        await p.getByRole("tab", { name: "Consulta", exact: true }).click();
        await expect(p.getByRole("tab", { name: "Consulta", exact: true })).toHaveAttribute("aria-selected", "true");
        await expect(p.getByLabel("Data inicial", { exact: true })).toHaveValue("2026-09-01");
        await expect.poll(() => e.chamadas.filter(c => c.path === "/vendas").at(-1)?.params.status).toBe("ABERTA");
    } finally { await p.close(); }
});

test("loading, falha do ranking e falha da exportação oferecem recuperação", async () => {
    const { p, e } = await abrir({ atraso: 600, erroRanking: true });
    try {
        await expect(p.getByText("Consultando vendas do período…", { exact: true })).toBeVisible();
        await p.getByRole("button", { name: "Consultar ranking de produtos e categorias" }).click();
        await expect(p.getByText("Ranking indisponível. Tente novamente.")).toBeVisible();
        e.erroRanking = false; await p.getByRole("button", { name: "Tentar novamente" }).click();
        await expect(p.getByRole("list", { name: "Ranking de produtos" }).getByRole("listitem")).toHaveCount(5);
        e.erroExportacao = true;
        await p.getByRole("button", { name: "Exportar CSV", exact: true }).click();
        await p.getByRole("menuitem", { name: "Indicadores do período" }).click();
        await expect(p.getByText("Exportação indisponível. Tente novamente.")).toBeVisible();
    } finally { await p.close(); }
});

test("análise responsiva preserva informações, teclado e temas sem overflow da página", async () => {
    await mkdir("node_modules/analise-vendas-validacao", { recursive: true });
    for (const c of [
        { tema: "light", viewport: { width: 1440, height: 900 } },
        { tema: "dark", viewport: { width: 1440, height: 900 } },
        { tema: "light", viewport: { width: 1024, height: 600 } },
        { tema: "dark", viewport: { width: 390, height: 844 } },
        { tema: "auto", viewport: { width: 1024, height: 360 } },
    ]) {
        const { p, e } = await abrir(c);
        try {
            await p.getByRole("button", { name: "Consultar ranking de produtos e categorias" }).click();
            await expect(p.getByRole("list", { name: "Ranking de produtos" }).getByRole("listitem")).toHaveCount(5);
            await expect(p.getByRole("progressbar", { name: "Sem categoria", exact: true })).toHaveAttribute("aria-valuenow", "40");
            assert.ok(await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth), `${c.tema} ${c.viewport.width}: overflow horizontal`);
            const primeiro = p.getByRole("list", { name: "Ranking de produtos" }).getByRole("listitem").first();
            await expect(primeiro).toBeVisible();
            for (const texto of ["Produto sintético 1", "1 UN", "R$ 30,00", "20%"]) await expect(primeiro).toContainText(texto);
            const botao = p.getByRole("button", { name: "Exportar CSV", exact: true });
            await botao.focus(); await botao.press("Enter"); await expect(p.getByRole("menu")).toBeVisible();
            await p.keyboard.press("Escape"); await expect(botao).toBeFocused();
            await p.screenshot({ path: `node_modules/analise-vendas-validacao/${c.tema}-${c.viewport.width}x${c.viewport.height}.png`, fullPage: true });
            assert.deepEqual(e.erros, []);
            assert.ok(e.chamadas.every(c => c.metodo === "GET"));
        } finally { await p.close(); }
    }
});

test("calendário civil, limite do período e comparação não dependem de offsets fixos", async () => {
    const p = await browser.newPage({ timezoneId: "Asia/Tokyo" });
    try {
        await p.goto(`${url}/vendas`);
        const r = await p.evaluate(async () => {
            const { periodoAnalise, erroPeriodo, variacao } = await import("/src/pages/Vendas/analiseVendasUtils.ts");
            return [periodoAnalise(7, "2026-01-01"), erroPeriodo({ dataInicial: "2025-10-22", dataFinal: "2026-10-22" }, "2026-10-22"),
                erroPeriodo({ dataInicial: "2026-02-30", dataFinal: "2026-03-01" }, "2026-10-22"),
                erroPeriodo({ dataInicial: "2025-10-21", dataFinal: "2026-10-22" }, "2026-10-22"), variacao(120, 100), variacao(50, 100), variacao(0, 0), variacao(100, 0)];
        });
        assert.deepEqual(r[0], { dataInicial: "2025-12-26", dataFinal: "2026-01-01" });
        assert.equal(r[1], ""); assert.ok(r[2]); assert.ok(r[3]);
        assert.match(r[4], /\+20%/); assert.match(r[5], /-50%/); assert.match(r[6], /base anterior zero/); assert.doesNotMatch(r[7], /\d%/);
    } finally { await p.close(); }
});

test("histórico incompleto é explícito e não apresenta quantidade ou unidade fictícia", async () => {
    const { p, e } = await abrir({ legado: true });
    try {
        await p.getByRole("button", { name: "Consultar ranking de produtos e categorias" }).click();
        await expect(p.getByText(/Há 2 venda.*sem data de faturamento confiável/)).toBeVisible();
        await expect(p.getByText(/Há 1 item.*sem unidade histórica/)).toBeVisible();
        const lista = p.getByRole("list", { name: "Ranking de produtos" });
        await expect(lista.getByRole("listitem")).toHaveCount(2);
        await expect(lista.getByRole("listitem").first()).toContainText("Não registrada");
        await expect(lista.getByRole("listitem").last()).toContainText("1 UN");
        assert.deepEqual(e.erros, []);
        await p.getByRole("button", { name: "Ver vendas do período" }).click();
        await expect(p.getByLabel("Faturamento inicial", { exact: true })).toHaveValue("2026-10-21");
        await expect.poll(() => e.chamadas.find(c => c.path === "/vendas")?.params.referenciaData).toBe("FATURAMENTO");
    } finally { await p.close(); }
});

test("somente legado sem data não é anunciado como inexistência de vendas", async () => {
    const { p } = await abrir({ legado: true, vazio: true });
    try {
        await expect(p.getByText("Nenhuma venda com data de faturamento registrada neste período.", { exact: true })).toBeVisible();
        await expect(p.getByText(/Há 2 venda.*sem data de faturamento confiável/)).toBeVisible();
        await expect(p.getByText("Nenhuma venda faturada neste período.", { exact: true })).toHaveCount(0);
    } finally { await p.close(); }
});


test("22.5 dias operados excluem dia sem operação dos destaques e preservam KPIs", async()=>{
 const {p,e}=await abrir({painel22:true});try {
  const destaques=p.getByRole('region',{name:'Destaques do período',exact:true});
  await expect(destaques.getByText('Melhor dia operado',{exact:true})).toBeVisible();
  await expect(destaques.getByText('23/10/2026',{exact:true})).toBeVisible();
  await expect(destaques.getByText('26/10/2026',{exact:true})).toHaveCount(0);
  const operacao=p.getByRole('region',{name:'Dias operados e produtividade',exact:true});
  await expect(operacao.getByText('6 de 7 dias',{exact:true})).toBeVisible();
  await expect(operacao.getByText('R$ 25,00',{exact:true})).toBeVisible();
  await expect(operacao.getByText(/\+45,8%/)).toBeVisible();
  await p.locator('summary').click();await expect(p.getByRole('table',{name:'Valores diários da evolução'}).getByText('Sem operação registrada',{exact:true})).toHaveCount(1);
  assert.equal(e.chamadas.length,3);assert.deepEqual(e.erros,[]);
 }finally{await p.close()}
});

test("22.5 operação sem vendas participa e parcial não inventa destaques",async()=>{
 for(const apenasParcial of [false,true]){const {p,e}=await abrir({vazio:true,operadoSemVendas:true,apenasParcial});try{
  if(apenasParcial)await expect(p.getByText('Sem dias operados concluídos neste período.',{exact:true})).toBeVisible();
  else await expect(p.getByText('Pior dia operado',{exact:true})).toBeVisible();
  const operacao=p.getByRole('region',{name:'Dias operados e produtividade',exact:true});
  await expect(operacao.getByText('R$ 0,00 · Parcial',{exact:true})).toBeVisible();
  await p.locator('summary').click();await expect(p.getByRole('table',{name:'Valores diários da evolução'}).getByText('Parcial · Operado sem vendas',{exact:true})).toBeVisible();
  assert.deepEqual(e.erros,[]);
 }finally{await p.close()}}
});

test("22.5 ausência de operação e API antiga têm estado explícito",async()=>{
 for(const semMetadadosOperacionais of [false,true]){const {p}=await abrir({vazio:true,semMetadadosOperacionais});try{
  const region=p.getByRole('region',{name:'Dias operados e produtividade',exact:true});
  if(semMetadadosOperacionais)await expect(region.getByText('Dados operacionais indisponíveis nesta versão da API.')).toBeVisible();
  else {await expect(region.getByText(/^Sem dados(?: · Parcial)?$/)).toBeVisible();await expect(p.getByText('Sem dias operados concluídos neste período.',{exact:true})).toBeVisible()}
 }finally{await p.close()}}
});


test("22.5 tooltip operacional cabe no mobile e desktop",async()=>{
 for(const width of [1366,390]){const {p,e}=await abrir({painel22:true,viewport:{width,height:844}});try{
  const plot=p.getByRole('img',{name:'Faturamento diário atual e anterior'});await expect(plot).toBeVisible();await plot.scrollIntoViewIfNeeded();
  const r=await plot.boundingBox();await p.mouse.move(r.x+70+(r.width-85)*.5,r.y+r.height*.55);
  const tooltip=p.locator('.recharts-tooltip-wrapper').filter({hasText:'Sem operação registrada'});await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Operado com vendas');const rect=await tooltip.boundingBox();assert.ok(rect.x>=0 && rect.x+rect.width<=width,JSON.stringify(rect));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(e.erros,[]);
 }finally{await p.close()}}
});
