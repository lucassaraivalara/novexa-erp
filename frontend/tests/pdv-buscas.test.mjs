import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url, api, produtos, clientes;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const produto = (nome = "Produto remoto", codigoInterno = "P1") => ({ id: 1, nome, codigoInterno,
    codigoBarras: "7890001", precoVenda: 10, unidadeMedida: "UN", ativo: true });
const cliente = nome => ({ id: 8, nome, nomeFantasia: "Loja", cpfCnpj: "02360684663", ativo: true });
const sessaoCaixa = (id, operadorId = 1) => ({ sessaoId: id, caixaId: id, descricaoCaixa: `Caixa ${id}`,
    saldoInicial: 0, dataHoraAbertura: "2026-10-08T09:00:00", operadorAbertura: { id: operadorId, nome: `Operador ${operadorId}` } });

before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-pdv-buscas-tests", optimizeDeps: { include: ["@mui/icons-material/CreditCardOutlined", "@mui/icons-material/EventNoteOutlined", "@mui/icons-material/PaymentOutlined", "@mui/icons-material/Pix"] }, server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "pdv-buscas-fixture",
            resolveId(id) { if (id === "/fixture-pdv.js") return `\0${id}`; },
            load(id) { if (id === "\0/fixture-pdv.js") return `
                import React from 'react'; import { createRoot } from 'react-dom/client';
                import { MemoryRouter } from 'react-router-dom';
                import { CssBaseline } from '@mui/material'; import { ThemeModeProvider } from '/src/theme/ThemeModeProvider.tsx';
                import Vendas from '/src/pages/Vendas/Vendas.tsx';
                createRoot(document.getElementById('root')).render(React.createElement(ThemeModeProvider, null,
                    React.createElement(CssBaseline),
                    React.createElement(MemoryRouter, null, React.createElement(Vendas))));`; },
            configureServer(vite) { vite.middlewares.use("/__pdv", async (_req, res) => {
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml("/__pdv", '<div id="root"></div><script type="module" src="/fixture-pdv.js"></script>'));
            }); },
        }],
    });
    ({ default: api } = await server.ssrLoadModule("/src/services/api.ts"));
    produtos = await server.ssrLoadModule("/src/services/produtoService.ts");
    clientes = await server.ssrLoadModule("/src/services/clienteService.ts");
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });
const consultas = (estado, dominio) => estado.requests.filter(r => r.path === `/${dominio}/buscar`);
const consultasAvancadas = estado => estado.requests.filter(r => r.path === "/produtos");
async function abrirBuscaAvancada(page) {
    await page.keyboard.press("Control+b");
    const dialogo = page.getByRole("dialog", { name: "Busca avançada de produtos" });
    await esperarFoco(page, dialogo.getByRole("textbox", { name: "Pesquisar produtos" }));
    await dialogo.getByRole("button", { name: "Adicionar produto", exact: true }).first().waitFor();
    return dialogo;
}
async function esperar(condicao) {
    for (let i = 0; i < 120 && !condicao(); i++) await new Promise(r => setTimeout(r, 25));
    assert.ok(condicao(), "Request esperado nao chegou");
}
async function abrir({ hasTouch = false, adiarRender = false, sessoes, caixas = [], resolverCaixa = true, tema = "light", colorScheme = "light", contextoAbertura = {}, configuracoesPagamento } = {}) {
    const estado = { requests: [], atrasar: false, atrasarScanner: false, sessaoCaixaId: 10, sessoes, caixas, configuracoesPagamento };
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch });
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(tema => localStorage.setItem("novexa-theme-choice", tema), tema);
    page.setDefaultTimeout(7000);
    if (adiarRender) await page.addInitScript(() => {
        // O scheduler do React pode concluir o render depois do proximo frame.
        const Canal = window.MessageChannel;
        window.MessageChannel = class extends Canal {
            constructor() {
                super();
                const postar = this.port2.postMessage.bind(this.port2);
                this.port2.postMessage = (...args) => setTimeout(() => postar(...args), 50);
            }
        };
    });
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ id: 1, token: "teste",
        nomeUsuario: "Operador", perfil: "OPERADOR", empresa: { id: 1, razaoSocial: "Empresa" } })));
    await page.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const registro = { path: u.pathname, at: Date.now(), termo: u.searchParams.get("termo"), params: Object.fromEntries(u.searchParams),
            method: req.method(), body: req.postData() };
        estado.requests.push(registro);
        let dados;
        if (u.pathname === "/financeiro/caixas/sessoes/abertas") dados = estado.sessoes ?? [sessaoCaixa(estado.sessaoCaixaId)];
        else if (u.pathname === "/financeiro/caixas") dados = estado.caixas;
        else if (u.pathname.endsWith("/abertura-contexto")) dados = { caixaId: Number(u.pathname.split("/")[3]), descricaoCaixa: "Caixa livre", caixaAtivo: true,
            sessaoAberta: false, sessaoAbertaId: null, trocoAnterior: null, saldoSugerido: 0, cofres: [], podeMovimentarCofre: false, ...contextoAbertura };
        else if (/^\/financeiro\/caixas\/\d+\/sessoes$/.test(u.pathname) && req.method() === "POST") dados = { id: 40 };
        else if (u.pathname === "/financeiro/configuracoes-formas-pagamento") dados = estado.configuracoesPagamento ?? [
            { id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true },
            { id: 2, tipo: "PIX", nomeExibicao: "PIX Loja", ativo: true, contaFinanceiraDestino: { id: 3, ativo: true, tipo: "BANCO" } },
            { id: 3, tipo: "DEBITO", nomeExibicao: "Débito Loja", ativo: true },
            { id: 6, tipo: "PIX", nomeExibicao: "PIX sem destino", ativo: true, contaFinanceiraDestino: null },
            { id: 7, tipo: "PIX", nomeExibicao: "PIX destino inativo", ativo: true, contaFinanceiraDestino: { id: 4, ativo: false, tipo: "BANCO" } },
            { id: 8, tipo: "PIX", nomeExibicao: "PIX destino incompatível", ativo: true, contaFinanceiraDestino: { id: 5, ativo: true, tipo: "CAIXA" } },
            { id: 4, tipo: "CREDITO", nomeExibicao: "Crédito Loja", ativo: true },
            { id: 5, tipo: "CREDITO", nomeExibicao: "Cartão inativo", ativo: false },
        ];
        else if (["/produtos/categorias", "/produtos/marcas"].includes(u.pathname)) {
            dados = { items: [{ id: 12, nome: u.pathname.endsWith("marcas") ? "Marca teste" : "Categoria teste", ativo: true }], totalItems: 1, page: 0, size: 25, totalPages: 1 };
        }
        else if (u.pathname === "/produtos") {
            if (estado.atrasarAvancada && u.searchParams.get("busca") === "antiga") await new Promise(r => setTimeout(r, 900));
            if (estado.erroAvancada) return route.fulfill({ status: 500, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: "Consulta temporariamente indisponível." }) });
            const lista = estado.produtosAvancados ?? Array.from({ length: 23 }, (_, i) => ({ ...produto(`Produto avançado ${i + 1}`, String(1001 + i)),
                id: i + 1, codigoBarras: `789000${i + 1}`, controlaEstoque: true, estoqueAtual: i === 0 ? 0 : 20,
                categoria: { id: 12, nome: "Categoria teste", ativo: true }, marca: { id: 12, nome: "Marca teste", ativo: true } }));
            const termo = (u.searchParams.get("busca") ?? "").toLowerCase();
            const campo = u.searchParams.get("campoBusca");
            const filtrada = lista.filter(p => (!termo || (campo ? [p[campo]] : [p.nome, p.codigoInterno, p.codigoBarras]).some(v => String(v).toLowerCase().includes(termo)))
                && (u.searchParams.get("situacao") === "todos" || p.ativo === (u.searchParams.get("situacao") !== "inativos")));
            const page = Number(u.searchParams.get("page")), size = Number(u.searchParams.get("size"));
            dados = { items: filtrada.slice(page * size, (page + 1) * size), totalItems: filtrada.length, page, size, totalPages: Math.ceil(filtrada.length / size) };
        }
        else if (u.pathname.endsWith("/buscar")) {
            if (estado.atrasar && registro.termo === "antiga") await new Promise(r => setTimeout(r, 1000));
            if (estado.atrasarScanner && registro.termo === "7890001") await new Promise(r => setTimeout(r, 700));
            dados = u.pathname === "/produtos/buscar" ? (estado.semResultados ? [] : estado.produtos ?? [{ ...produto(registro.termo === "antiga" ? "Resposta antiga" : "Produto remoto", registro.termo === "1" ? "1" : "P1"),
                controlaEstoque: estado.controlaEstoque ?? true, estoqueAtual: estado.estoqueAtual ?? 100 }])
                : [cliente(registro.termo === "antiga" ? "Cliente antigo" : "Cliente remoto")];
        } else if (u.pathname === "/vendas" && req.method() === "POST") {
            if (estado.atrasarVenda) await new Promise(r => setTimeout(r, 500));
            if (estado.estoqueInsuficiente && !JSON.parse(req.postData()).confirmarEstoqueInsuficiente)
                return route.fulfill({ status: 409, headers: cors, contentType: "application/json", body: JSON.stringify({
                    codigo: "ESTOQUE_INSUFICIENTE", permitido: estado.permitirEstoqueNegativo ?? true,
                    itens: [{ produtoId: 1, nome: "Produto remoto", disponivel: 0, solicitada: 1 }],
                }) });
            if (estado.erroVenda) return route.fulfill({status:estado.erroVenda,headers:cors,contentType:"application/json",body:JSON.stringify({detail:estado.mensagemErro ?? "A soma dos pagamentos deve corresponder ao total da venda."})});
            dados = { id: 20, total: 10, troco: 0 };
        }
        else throw new Error(`HTTP inesperado: ${u.pathname}`);
        await route.fulfill({ status: req.method() === "POST" ? 201 : 200, headers: cors,
            contentType: "application/json", body: JSON.stringify(dados) });
    });
    await page.goto(`${url}/__pdv`);
    const busca = page.getByRole("combobox", { name: "Buscar produto ou ler código de barras", includeHidden: true });
    if (resolverCaixa) {
        await esperarFoco(page, busca);
        assert.equal(await busca.isEnabled(), true);
    }
    return { page, estado, busca };
}

test("busca avançada reutiliza carrinho por mouse e teclado, preserva rascunho e não grava venda", async () => {
    const { page, estado, busca } = await abrir();
    try {
        assert.equal(consultasAvancadas(estado).length, 0);
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        const dialogo = await abrirBuscaAvancada(page);
        assert.match(await dialogo.getByRole("row").filter({ hasText: "Produto avançado 1" }).first().innerText(), /R\$\s*10,00/);
        const pesquisa = dialogo.getByRole("textbox", { name: "Pesquisar produtos" });
        await pesquisa.press("ArrowDown");
        const primeiro = dialogo.getByRole("button", { name: "Adicionar produto", exact: true }).first();
        await esperarFoco(page, primeiro); await primeiro.press("Enter");
        await dialogo.getByRole("status").filter({ hasText: "Produto avançado 1 adicionado" }).waitFor();
        await esperarFoco(page, primeiro);
        await primeiro.press("ArrowDown");
        const segundo = dialogo.getByRole("button", { name: "Adicionar produto", exact: true }).nth(1);
        await esperarFoco(page, segundo); await segundo.press("Space");
        await segundo.click();
        await page.keyboard.press("F2");
        assert.equal(await page.getByRole("dialog", { name: "Pagamento da venda" }).count(), 0);
        await page.keyboard.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await page.getByLabel("Quantidade de Produto avançado 1").inputValue(), "2");
        assert.equal(await page.getByLabel("Quantidade de Produto avançado 2").inputValue(), "2");
        const salvo = JSON.parse(await page.evaluate(() => sessionStorage.getItem("novexa-pdv:1:1:10")));
        assert.equal(salvo.itens.length, 2);
        assert.equal(consultasAvancadas(estado).length, 1);
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
    } finally { await page.close(); }
});

test("busca avançada envia filtros, paginação e ordenação ao servidor sem tenant ou consultas por linha", async () => {
    const { page, estado } = await abrir();
    try {
        const dialogo = await abrirBuscaAvancada(page);
        assert.deepEqual(consultasAvancadas(estado)[0].params, { situacao: "ativos", page: "0", size: "10", sort: "nome,asc" });
        await dialogo.getByRole("button", { name: "Próxima página" }).click();
        await dialogo.getByText("Produto avançado 11", { exact: true }).waitFor();
        assert.equal(consultasAvancadas(estado).at(-1).params.page, "1");
        await dialogo.getByRole("button", { name: "Preço" }).click();
        await esperar(() => consultasAvancadas(estado).at(-1)?.params.sort === "precoVenda,asc");
        await dialogo.getByRole("combobox", { name: "Categoria", exact: true }).fill("Categoria");
        await page.getByRole("option", { name: "Categoria teste", exact: true }).click();
        await dialogo.getByRole("combobox", { name: "Marca", exact: true }).fill("Marca");
        await page.getByRole("option", { name: "Marca teste", exact: true }).click();
        await dialogo.getByRole("combobox", { name: "Estoque", exact: true }).click();
        await page.getByRole("option", { name: "Zerado", exact: true }).click();
        await esperar(() => consultasAvancadas(estado).at(-1)?.params.situacaoEstoque === "zerado");
        assert.equal(consultasAvancadas(estado).at(-1).params.page, "0");
        assert.equal(consultasAvancadas(estado).at(-1).params.categoriaId, "12");
        assert.equal(consultasAvancadas(estado).at(-1).params.marcaId, "12");
        await dialogo.getByRole("button", { name: "Limpar filtros" }).click();
        await esperar(() => !consultasAvancadas(estado).at(-1)?.params.categoriaId);
        assert.ok(estado.requests.every(r => !r.params.empresaId && !/^\/produtos\/\d+$/.test(r.path)));
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
    } finally { await page.close(); }
});

test("busca avançada busca nome/código/EAN com debounce, cancela respostas antigas e trata vazio/erro/retry", async () => {
    const { page, estado } = await abrir();
    try {
        const dialogo = await abrirBuscaAvancada(page);
        const pesquisa = dialogo.getByRole("textbox", { name: "Pesquisar produtos" });
        await pesquisa.fill("78900"); await page.waitForTimeout(80); await pesquisa.fill("7890002");
        await esperar(() => consultasAvancadas(estado).at(-1)?.params.busca === "7890002");
        await dialogo.getByRole("button", { name: "Adicionar produto", exact: true }).first().waitFor();
        assert.equal(consultasAvancadas(estado).filter(r => r.params.busca === "78900").length, 0);
        assert.equal(consultasAvancadas(estado).at(-1).params.busca, "7890002");
        await dialogo.getByRole("combobox", { name: "Pesquisar por", exact: true }).click();
        await page.getByRole("option", { name: "Código interno", exact: true }).click();
        await pesquisa.fill("1002"); await pesquisa.press("Enter");
        await esperar(() => consultasAvancadas(estado).at(-1)?.params.busca === "1002");
        assert.equal(consultasAvancadas(estado).at(-1).params.campoBusca, "codigoInterno");
        estado.atrasarAvancada = true;
        await pesquisa.fill("antiga"); await esperar(() => consultasAvancadas(estado).at(-1)?.params.busca === "antiga");
        await pesquisa.fill("1003"); await dialogo.getByText("Produto avançado 3", { exact: true }).waitFor();
        await page.waitForTimeout(1000);
        assert.equal(await dialogo.getByText("Produto avançado 3", { exact: true }).count(), 1);
        await pesquisa.fill("não existe"); await dialogo.getByText("Nenhum produto encontrado", { exact: true }).waitFor();
        estado.erroAvancada = true;
        await dialogo.getByRole("button", { name: "Buscar", exact: true }).click();
        await dialogo.getByRole("alert").filter({ hasText: "Consulta temporariamente indisponível." }).waitFor();
        assert.equal(await pesquisa.inputValue(), "não existe");
        estado.erroAvancada = false;
        await dialogo.getByRole("button", { name: "Tentar novamente", exact: true }).click();
        await dialogo.getByText("Nenhum produto encontrado", { exact: true }).waitFor();
        await pesquisa.fill("   ");
        await dialogo.getByText("Produto avançado 1", { exact: true }).waitFor();
        assert.equal("busca" in consultasAvancadas(estado).at(-1).params, false);
        estado.produtosAvancados = [];
        await dialogo.getByRole("button", { name: "Buscar", exact: true }).click();
        await dialogo.getByText("Nenhum produto encontrado", { exact: true }).waitFor();
        const antesDeFechar = consultasAvancadas(estado).length;
        await pesquisa.fill("cancelar consulta pendente"); await pesquisa.press("Escape");
        await page.waitForTimeout(450);
        assert.equal(consultasAvancadas(estado).length, antesDeFechar);
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
    } finally { await page.close(); }
});

test("busca avançada bloqueia produto inativo e preserva kit com estoque zerado sem baixa antecipada", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.produtosAvancados = [{ ...produto("Kit disponível", "KIT-1"), composto: true, controlaEstoque: true, estoqueAtual: 0,
            componentes: [{ produtoId: 20, nome: "Componente", unidade: "UN", quantidadePorKit: 2, estoqueAtual: 0 }] },
            { ...produto("Produto inativo", "P2"), id: 2, ativo: false }];
        const dialogo = await abrirBuscaAvancada(page);
        await dialogo.getByRole("combobox", { name: "Situação", exact: true }).click();
        await page.getByRole("option", { name: "Todos", exact: true }).click();
        const inativo = dialogo.getByRole("row").filter({ hasText: "Produto inativo" });
        await inativo.waitFor();
        assert.equal(await inativo.getByRole("button", { name: "Adicionar produto" }).isDisabled(), true);
        await dialogo.getByRole("row").filter({ hasText: "Kit disponível" }).getByRole("button", { name: "Adicionar produto" }).click();
        await dialogo.getByRole("button", { name: "Voltar à venda" }).click(); await esperarFoco(page, busca);
        await page.getByLabel("Quantidade de Kit disponível").waitFor();
        const salvo = JSON.parse(await page.evaluate(() => sessionStorage.getItem("novexa-pdv:1:1:10")));
        assert.equal(salvo.itens[0].produto.composto, true);
        assert.equal(salvo.itens[0].produto.componentes[0].quantidadePorKit, 2);
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
    } finally { await page.close(); }
});

for (const [largura, altura, tema, colorScheme] of [[1440, 900, "light", "light"], [1280, 650, "dark", "dark"], [390, 844, "system", "dark"], [1024, 480, "system", "light"]]) {
    test(`busca avançada visual/foco ${largura}x${altura} ${tema}`, async () => {
        const { page, estado, busca } = await abrir({ tema, colorScheme });
        try {
            await page.setViewportSize({ width: largura, height: altura });
            await page.getByRole("button", { name: "Busca avançada · Ctrl+B", exact: true }).click();
            const dialogo = page.getByRole("dialog", { name: "Busca avançada de produtos" });
            const pesquisa = dialogo.getByRole("textbox", { name: "Pesquisar produtos" });
            await esperarFoco(page, pesquisa);
            await dialogo.getByRole("button", { name: "Adicionar produto", exact: true }).first().waitFor();
            await pesquisa.press("Tab"); await page.keyboard.press("Shift+Tab"); await esperarFoco(page, pesquisa);
            await page.keyboard.press("Control+b"); await page.keyboard.press("F5"); await esperarFoco(page, pesquisa);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const fechar = dialogo.getByRole("button", { name: "Voltar à venda" });
            await fechar.focus(); await fechar.press("Tab");
            assert.equal(await dialogo.evaluate(el => el.contains(document.activeElement)), true);
            await mkdir("node_modules/busca-avancada-validacao", { recursive: true });
            await page.screenshot({ path: `node_modules/busca-avancada-validacao/${largura}-${altura}-${tema}.png`, animations: "disabled" });
            await page.keyboard.press("Escape"); await esperarFoco(page, busca);
            assert.equal(estado.requests.some(r => r.method === "POST"), false);
        } finally { await page.close(); }
    });
}

for (const largura of [1440,390]) test(`Kit/Combo no PDV recalcula consumo sem movimentar antes de finalizar em ${largura}px`, async () => {
    const {page,estado,busca}=await abrir();
    try {
        await page.setViewportSize({width:largura,height:650});
        estado.produtos=[{...produto("Kit teste","KIT-1"),composto:true,controlaEstoque:true,estoqueAtual:5,
            componentes:[{produtoId:2,nome:"Componente físico",unidade:"UN",quantidadePorKit:2,estoqueAtual:10}]}];
        await busca.fill("7890001");await busca.press("Enter");await page.getByLabel("Quantidade de Kit teste").waitFor();
        assert.equal(estado.requests.filter(r=>r.method==="POST").length,0);
        await page.getByLabel("Quantidade de Kit teste").fill("3");await page.getByLabel("Quantidade de Kit teste").press("Tab");
        await page.getByText("Consumo previsto dos componentes",{exact:true}).click();
        await page.getByText("Componente físico: 6 UN · disponível 10",{exact:true}).waitFor();
        await mkdir("node_modules/kit-validacao",{recursive:true});await page.screenshot({path:`node_modules/kit-validacao/pdv-${largura}.png`});
        await confirmarPagamento(page);await page.getByText("Venda concluída",{exact:true}).waitFor();
        const body=JSON.parse(estado.requests.find(r=>r.path==="/vendas"&&r.method==="POST").body);
        assert.equal(body.itens.length,1);assert.equal(body.itens[0].quantidade,3);assert.equal(body.itens[0].produtoId,1);
        assert.equal("componentes" in body.itens[0],false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    } finally {await page.close();}
});

for (const sessoes of [[sessaoCaixa(10)], [sessaoCaixa(20, 2), sessaoCaixa(10), sessaoCaixa(30, 3)]]) {
    test(`Caixa proprio unico entre ${sessoes.length} sessoes e usado no faturamento`, async () => {
        const { page, estado, busca } = await abrir({ sessoes });
        try {
            assert.equal(await page.getByRole("dialog").count(), 0);
            await busca.fill("7890001"); await busca.press("Enter");
            await page.getByLabel("Quantidade de Produto remoto").waitFor();
            await confirmarPagamento(page);
            await page.getByText("Venda concluída", { exact: true }).waitFor();
            const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas" && r.method === "POST").body);
            assert.equal(pedido.sessaoCaixaId, 10);
        } finally { await page.close(); }
    });
}

for (const sessoes of [[sessaoCaixa(10, 2)], [sessaoCaixa(10, 2), sessaoCaixa(20, 3)]]) {
    test(`somente ${sessoes.length} sessoes alheias bloqueiam PDV sem tentar faturar`, async () => {
        const caixas = sessoes.map(s => ({ id: s.caixaId, descricao: s.descricaoCaixa, ativo: true }));
        const { page, estado, busca } = await abrir({ sessoes, caixas, resolverCaixa: false });
        try {
            await page.getByText("Não há sessão de caixa aberta para o seu usuário.", { exact: true }).waitFor();
            await page.getByText("Nenhum Caixa ativo está disponível.", { exact: true }).waitFor();
            assert.equal(await busca.isDisabled(), true);
            assert.equal(await page.getByRole("button", { name: "Finalizar venda · F2", includeHidden: true }).isDisabled(), true);
            assert.equal(await page.getByRole("button", { name: "Confirmar abertura", exact: true }).isDisabled(), true);
            await page.keyboard.press("F2");
            assert.equal(estado.requests.some(r => r.path === "/vendas" && r.method === "POST"), false);
            assert.equal(estado.requests.some(r => r.method === "POST"), false);
        } finally { await page.close(); }
    });
}

test("multiplas sessoes proprias permitem escolher sem oferecer sessao alheia", async () => {
    const { page, estado, busca } = await abrir({ sessoes: [sessaoCaixa(30, 2), sessaoCaixa(10), sessaoCaixa(20)], resolverCaixa: false });
    try {
        const dialogo = page.getByRole("dialog", { name: "Selecionar Caixa" });
        await dialogo.waitFor();
        assert.equal(await dialogo.getByText("Caixa 30", { exact: true }).count(), 0);
        await dialogo.getByText("Caixa 20", { exact: true }).click();
        await dialogo.getByRole("button", { name: "Usar sessão" }).click();
        await esperarFoco(page, busca);
        await esperarFoco(page, busca);
        await busca.fill("7890001"); await busca.press("Enter");
        await page.getByLabel("Quantidade de Produto remoto").waitFor();
        await confirmarPagamento(page);
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.equal(JSON.parse(estado.requests.find(r => r.path === "/vendas" && r.method === "POST").body).sessaoCaixaId, 20);
    } finally { await page.close(); }
});

test("abertura pelo PDV reutiliza troco confirmado e não grava venda", async () => {
    const { page, estado, busca } = await abrir({ sessoes: [], caixas: [{id:30,descricao:"Caixa livre",ativo:true}], resolverCaixa:false,
        contextoAbertura: { saldoSugerido:70, trocoAnterior:{sessaoId:29,valor:70,dataFechamento:"2026-10-20T10:00:00",operadorFechamento:"Outro operador"} } });
    try {
        const dialogo = page.getByRole("dialog", { name: "Abrir Caixa" });
        await dialogo.getByText(/Troco disponível da sessão anterior/).waitFor();
        assert.equal(await dialogo.getByLabel("Fundo inicial (R$)").inputValue(), "70,00");
        assert.equal(estado.requests.filter(r => r.method === "POST").length, 0);
        await dialogo.getByRole("button", { name: "Confirmar abertura" }).click();
        await esperarFoco(page, busca);
        const posts = estado.requests.filter(r => r.method === "POST");
        assert.equal(posts.length,1); assert.equal(posts[0].path,"/financeiro/caixas/30/sessoes");
        assert.equal(JSON.parse(posts[0].body).confirmarTroco,true);
        assert.equal(JSON.parse(posts[0].body).valorRetiradoCofre,0);
        assert.equal(posts.some(r => r.path === "/vendas"),false);
    } finally { await page.close(); }
});

for (const sessoes of [[], [sessaoCaixa(10, 2)]]) {
    test(`sem sessao propria preserva abertura em Caixa livre com ${sessoes.length} sessoes existentes`, async () => {
        const caixas = [{ id: 10, descricao: "Caixa ocupado", ativo: true }, { id: 30, descricao: "Caixa livre", ativo: true },
            { id: 50, descricao: "Caixa inativo", ativo: false }];
        const { page, estado, busca } = await abrir({ sessoes, caixas, resolverCaixa: false });
        try {
            const dialogo = page.getByRole("dialog", { name: "Abrir Caixa" });
            await dialogo.getByText("Não há sessão de caixa aberta para o seu usuário.", { exact: true }).waitFor();
            if (sessoes.length) {
                assert.equal(await dialogo.getByText("Caixa ocupado", { exact: true }).count(), 0);
                await dialogo.getByText("Caixa livre", { exact: true }).waitFor();
            } else {
                await dialogo.getByRole("combobox", { name: /Caixa/ }).click();
                await page.getByRole("option", { name: "Caixa livre" }).click();
            }
            await dialogo.getByLabel("Fundo inicial (R$)").fill("0");
            await dialogo.getByRole("button", { name: "Confirmar abertura", exact: true }).click();
            await esperarFoco(page, busca);
            const abertura = estado.requests.find(r => r.method === "POST");
            assert.equal(abertura.path, "/financeiro/caixas/30/sessoes");
            const origens = JSON.parse(abertura.body);
            assert.equal(origens.saldoInicial, 0); assert.equal(origens.confirmarTroco, false);
            assert.equal(origens.valorRetiradoCofre, 0); assert.equal(origens.valorAporteExterno, 0);
            assert.match(origens.chaveRequisicao, /^[0-9a-f-]{36}$/);
            await esperarFoco(page, busca);
            await busca.fill("7890001"); await busca.press("Enter");
            await page.getByLabel("Quantidade de Produto remoto").waitFor();
            await confirmarPagamento(page);
            await page.getByText("Venda concluída", { exact: true }).waitFor();
            assert.equal(JSON.parse(estado.requests.find(r => r.path === "/vendas" && r.method === "POST").body).sessaoCaixaId, 40);
        } finally { await page.close(); }
    });
}

test("services usam endpoints limitados, signal e JWT sem tenant no payload; vazio nao faz HTTP", async () => {
    globalThis.localStorage = { getItem: () => null };
    const requests = []; api.defaults.adapter = async config => {
        requests.push(config); return { config, data: [], status: 200, statusText: "OK", headers: {} };
    };
    const signal = new AbortController().signal;
    await produtos.pesquisarProdutos("P1", signal); await clientes.pesquisarClientes("Loja", signal);
    await produtos.pesquisarProdutos(" ", signal); await clientes.pesquisarClientes("", signal);
    assert.deepEqual(requests.map(r => r.url), ["/produtos/buscar", "/clientes/buscar"]);
    assert.deepEqual(requests.map(r => r.params), [{ termo: "P1" }, { termo: "Loja" }]);
    assert.ok(requests.every(r => r.signal === signal && !r.data));
});

test("PDV nao pre-carrega produtos/clientes; digitar usa debounce e selecao adiciona produto", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await page.waitForTimeout(400);
        assert.equal(consultas(estado, "produtos").length, 0);
        assert.equal(estado.requests.some(r => r.path === "/clientes/opcoes"), false);
        await busca.fill("Pr"); await page.waitForTimeout(100); await busca.fill("Prod");
        await page.waitForTimeout(100); assert.equal(consultas(estado, "produtos").length, 0);
        await page.getByRole("listbox").getByRole("option").click();
        assert.deepEqual(consultas(estado, "produtos").map(r => r.termo), ["Prod"]);
        assert.match(await page.getByRole("table").innerText(), /Produto remoto/);
        assert.equal(await busca.inputValue(), "");
    } finally { await page.close(); }
});

test("rascunho com itens e pagamento sobrevive ao reload; sucesso remove storage e reabre limpo", async () => {
    const { page, busca } = await abrir();
    try {
        await busca.fill("7890001"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
        await quantidade.press("Enter"); await esperarFoco(page, busca);
        await abrirPagamento(page);
        await page.getByLabel("Valor de Dinheiro (R$)").fill("20");
        await page.reload(); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "1");
        await abrirPagamento(page);
        assert.equal(await page.getByLabel("Valor de Dinheiro (R$)").inputValue(), "20,00");
        await confirmarPagamento(page);
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem("novexa-pdv:1:1:10")), null);
        await page.reload(); await esperarFoco(page, busca);
        assert.equal(await quantidade.count(), 0);
        assert.equal(await page.getByLabel("Valor de Dinheiro (R$)").count(), 0);
    } finally { await page.close(); }
});

test("limpar venda explicitamente remove rascunho e dados; sessao diferente nao restaura itens", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        await page.getByRole("button", { name: "Limpar venda", exact: true }).click();
        await page.getByRole("dialog", { name: "Limpar esta venda?" }).getByRole("button", { name: "Limpar venda", exact: true }).click();
        await esperarFoco(page, busca);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("novexa-pdv:1:1:10")), null);
        await page.reload(); await esperarFoco(page, busca);
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").count(), 0);
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        estado.sessaoCaixaId = 11;
        await page.reload(); await esperarFoco(page, busca);
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").count(), 0);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("novexa-pdv:1:1:11")), null);
    } finally { await page.close(); }
});

test("retry apos reload preserva UUID e payload; tentativa incerta nao pode ser limpa", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        estado.erroVenda = 503;
        await confirmarPagamento(page);
        await page.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
        const original = estado.requests.find(r => r.path === "/vendas" && r.method === "POST").body;
        await page.reload(); await esperarFoco(page, busca);
        assert.equal(await page.getByRole("button", { name: "Limpar venda", exact: true }).isDisabled(), true);
        estado.erroVenda = undefined;
        await confirmarPagamento(page);
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.deepEqual(estado.requests.filter(r => r.path === "/vendas" && r.method === "POST").map(r => r.body), [original, original]);
    } finally { await page.close(); }
});

async function esperarFoco(page, campo) {
    await page.waitForFunction(el => el === document.activeElement, await campo.elementHandle()).catch(async erro => {
        const ativo = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id,
            label: document.activeElement?.getAttribute("aria-label") }));
        throw new Error(`Foco inesperado: ${JSON.stringify(ativo)}`, { cause: erro });
    });
}
async function conferirQuantidade(page, nome, valor) {
    const campo = page.getByLabel(`Quantidade de ${nome}`);
    await esperarFoco(page, campo);
    assert.equal(await campo.inputValue(), valor);
    assert.deepEqual(await campo.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, valor.length]);
    return campo;
}

test("scanner Enter imediato seleciona quantidade; digitar substitui valor e Enter volta a busca", async () => {
    for (const codigo of ["7890001", "p1", "1"]) {
        const { page, estado, busca } = await abrir();
        try {
            await esperarFoco(page, busca);
            await busca.fill(codigo); const inicio = Date.now(); await busca.press("Enter");
            await esperar(() => consultas(estado, "produtos").length > 0);
            await page.getByLabel("Quantidade de Produto remoto").waitFor();
            assert.equal(consultas(estado, "produtos").length, 1);
            assert.ok(consultas(estado, "produtos")[0].at - inicio < 350, "Leitor nao deve esperar o debounce");
            assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "1");
            const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
            await quantidade.press("3");
            assert.equal(await quantidade.inputValue(), "3");
            await quantidade.press("Enter"); await esperarFoco(page, busca);
        } finally { await page.close(); }
    }
});

test("digitacao e leitor como teclado adicionam por Enter sem gravar antes da finalizacao", async () => {
    for (const leitor of [false, true]) {
        const { page, estado, busca } = await abrir();
        try {
            await esperarFoco(page, busca);
            if (leitor) await page.keyboard.type("7890001", { delay: 5 });
            else await busca.fill("7890001");
            await page.keyboard.press("Enter");
            await conferirQuantidade(page, "Produto remoto", "1");
            await page.keyboard.press("Enter"); await esperarFoco(page, busca);
            await busca.pressSequentially("7890001", { delay: 5 }); await busca.press("Enter");
            await conferirQuantidade(page, "Produto remoto", "2");
            assert.equal(estado.requests.some(r => r.method !== "GET"), false, "Carrinho nao grava venda, estoque ou financeiro");
            await confirmarPagamento(page);
            await page.getByRole("heading", { name: "Venda concluída" }).waitFor();
            const escritas = estado.requests.filter(r => r.method !== "GET");
            assert.equal(escritas.length, 1);
            assert.equal(escritas[0].path, "/vendas");
            assert.equal(JSON.parse(escritas[0].body).itens[0].quantidade, 2);
        } finally { await page.close(); }
    }
});

test("codigo ambiguo exibe selecao tanto no leitor imediato quanto apos debounce", async () => {
    for (const aguardarLista of [false, true]) {
        const { page, estado, busca } = await abrir();
        try {
            estado.produtos = [produto(), { ...produto("Outro produto", "7890001"), id: 2, codigoBarras: "7890002" }];
            await busca.fill("7890001");
            if (aguardarLista) await page.getByRole("option").first().waitFor();
            await busca.press("Enter");
            await page.getByText("Código corresponde a mais de um produto. Selecione o item na lista.", { exact: true }).waitFor();
            assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
            await page.getByRole("option").filter({ hasText: "Outro produto" }).click();
            await conferirQuantidade(page, "Outro produto", "1");
            assert.equal(estado.requests.some(r => r.method !== "GET"), false);
        } finally { await page.close(); }
    }
});

test("render adiado preserva foco e selecao ao criar e incrementar item; Enter e Esc voltam a busca", async () => {
    const { page, busca } = await abrir({ adiarRender: true });
    try {
        await esperarFoco(page, busca);
        await busca.fill("7890001"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
        await quantidade.press("3"); await quantidade.press("Enter"); await esperarFoco(page, busca);
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "4");
        await quantidade.press("8"); await quantidade.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "4");
    } finally { await page.close(); }
});

test("setas e Enter adicionam resultado escolhido; Esc restaura quantidade, Tab e Ctrl+Delete continuam livres", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.produtos = [produto(), { ...produto("Segundo produto", "P2"), id: 2, codigoBarras: "7890002" }];
        await busca.fill("Produto");
        const opcoes = page.getByRole("listbox").getByRole("option");
        await opcoes.nth(1).waitFor();
        await busca.press("ArrowDown"); assert.equal(await opcoes.nth(1).getAttribute("aria-selected"), "true");
        await busca.press("ArrowUp"); assert.equal(await opcoes.nth(0).getAttribute("aria-selected"), "true");
        await busca.press("ArrowDown"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Segundo produto", "1");
        assert.equal(consultas(estado, "produtos").length, 1);
        await quantidade.press("3"); await quantidade.press("Enter"); await esperarFoco(page, busca);
        await busca.fill("7890002"); await busca.press("Enter");
        await conferirQuantidade(page, "Segundo produto", "4");
        await quantidade.press("8"); await quantidade.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "4");
        assert.equal(await page.getByRole("heading", { name: "Vender" }).count(), 1);
        await quantidade.focus(); await quantidade.press("Tab");
        await esperarFoco(page, page.getByRole("button", { name: "Remover Segundo produto" }));
        await quantidade.focus(); await quantidade.press("Control+Delete"); await esperarFoco(page, busca);
        assert.equal(await quantidade.count(), 0);
    } finally { await page.close(); }
});

test("codigo exato tem prioridade sobre resultado navegado e novo termo limpa escolha anterior", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.produtos = [produto(), { ...produto("Segundo produto", "P2"), id: 2, codigoBarras: "7890002" }];
        await busca.fill("7890001"); await page.getByRole("listbox").getByRole("option").nth(1).waitFor();
        await busca.press("ArrowDown"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
        await quantidade.press("Enter"); await esperarFoco(page, busca);
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").nth(1).waitFor();
        await busca.press("ArrowDown"); await busca.fill("Parcial");
        await page.getByRole("listbox").getByRole("option").nth(1).waitFor();
        await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "2");
        assert.equal(await page.getByLabel("Quantidade de Segundo produto").count(), 0);
    } finally { await page.close(); }
});

test("nome com resultado destacado por padrao aceita Enter e preserva foco/quantidade sem nova busca", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").waitFor();
        assert.equal(await page.getByRole("listbox").getByRole("option").getAttribute("aria-selected"), "true");
        await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
        assert.equal(consultas(estado, "produtos").length, 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        await quantidade.press("3"); await quantidade.press("Enter"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "3");
        assert.equal(await busca.inputValue(), "");
    } finally { await page.close(); }
});

test("Enter sem resultado mostra somente feedback contextual; trocar/limpar termo remove mensagem", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.semResultados = true;
        await busca.fill("Inexistente"); await busca.press("Enter");
        const mensagem = page.getByText("Nenhum produto encontrado para esta busca.", { exact: true });
        await mensagem.waitFor();
        assert.equal(await mensagem.count(), 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
        assert.equal(consultas(estado, "produtos").length, 1);
        await busca.press("Enter"); await page.waitForTimeout(400);
        assert.equal(consultas(estado, "produtos").length, 1);
        assert.equal(await mensagem.count(), 1);
        await busca.fill("Outro"); assert.equal(await mensagem.count(), 0);
        await mensagem.waitFor();
        await busca.fill(""); assert.equal(await mensagem.count(), 0);
        assert.equal(await page.getByRole("alert").count(), 0);
        estado.semResultados = false;
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").waitFor(); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
    } finally { await page.close(); }
});

test("busca vazia orienta desde a abertura; Enter nao faz HTTP e digitar remove orientacao", async () => {
    const { page, estado, busca } = await abrir();
    try {
        const aviso = page.getByText("Digite nome, código interno ou código de barras.", { exact: true });
        await aviso.waitFor();
        await busca.press("Enter");
        assert.equal(await aviso.count(), 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(consultas(estado, "produtos").length, 0);
        await busca.fill(" "); assert.equal(await aviso.count(), 1);
        await busca.press("Enter"); await aviso.waitFor();
        await busca.fill(""); assert.equal(await aviso.count(), 1);
        await busca.press("Enter"); await aviso.waitFor();
        await busca.fill("Produto"); assert.equal(await aviso.count(), 0);
        await page.getByRole("listbox").getByRole("option").waitFor();
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
    } finally { await page.close(); }
});

test("Enter antes da resposta por nome exibe resultados sem adicionar match nao destacado", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("Produto"); await busca.press("Enter");
        await page.getByRole("listbox").getByRole("option").waitFor();
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        assert.equal(consultas(estado, "produtos").length, 1);
    } finally { await page.close(); }
});

test("erro de busca remota limpa com novo termo sem afetar erros de outras operacoes", async () => {
    const { page, busca } = await abrir();
    try {
        await page.route("http://localhost:8080/produtos/buscar?termo=Falha", route => route.fulfill({
            status: 503, headers: cors, contentType: "application/json", body: JSON.stringify({ detail: "Busca indisponível." }),
        }));
        await busca.fill("Falha"); await busca.press("Enter");
        const erro = page.getByRole("alert").filter({ hasText: "Busca indisponível." });
        await erro.waitFor(); assert.equal(await erro.count(), 1);
        await busca.fill(""); assert.equal(await erro.count(), 0);
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").waitFor();
        await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
    } finally { await page.close(); }
});

test("codigo exato em memoria nao repete request; limpar cancela busca antiga", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("P1"); await page.getByRole("listbox").getByRole("option").waitFor();
        await busca.press("Enter"); await page.getByLabel("Quantidade de Produto remoto").waitFor();
        assert.equal(consultas(estado, "produtos").length, 1);
        estado.atrasar = true;
        await busca.fill("antiga"); await esperar(() => consultas(estado, "produtos").some(r => r.termo === "antiga"));
        await busca.fill(""); await page.waitForTimeout(1200);
        assert.equal(await page.locator('#pdv-resultados [role="option"]').count(), 0);
        assert.equal(consultas(estado, "produtos").some(r => r.termo === ""), false);
    } finally { await page.close(); }
});

test("resposta antiga e scanner cancelado nao sobrescrevem nova busca nem adicionam item", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.atrasar = true;
        await busca.fill("antiga"); await esperar(() => consultas(estado, "produtos").some(r => r.termo === "antiga"));
        await busca.fill("atual"); await page.getByRole("listbox").getByRole("option").waitFor(); await page.waitForTimeout(1000);
        assert.equal(await page.getByText("Resposta antiga", { exact: true }).count(), 0);
        estado.atrasarScanner = true;
        await busca.fill("7890001"); await busca.press("Enter");
        await esperar(() => consultas(estado, "produtos").some(r => r.termo === "7890001"));
        await busca.press("Enter"); await busca.fill("atual"); await page.waitForTimeout(1000);
        assert.equal(consultas(estado, "produtos").filter(r => r.termo === "7890001").length, 1);
        assert.equal(await page.getByRole("table").getByRole("row").count(), 1);
    } finally { await page.close(); }
});

test("Cliente opcional usa busca remota, preserva matches de documento/fantasia, seleciona e limpa", async () => {
    const { page, estado } = await abrir();
    try {
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
        await campo.fill("Lo"); await page.waitForTimeout(100); await campo.fill("Loja");
        await page.waitForTimeout(100); assert.equal(consultas(estado, "clientes").length, 0);
        await page.getByRole("listbox").getByRole("option").click();
        await page.getByText("Cliente: Cliente remoto").waitFor();
        assert.deepEqual(consultas(estado, "clientes").map(r => r.termo), ["Loja"]);
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        await page.getByRole("button", { name: "Clear" }).click();
        assert.equal(await page.getByText("Cliente: Cliente remoto").count(), 0);
        assert.equal(estado.requests.some(r => r.path === "/clientes/opcoes"), false);
    } finally { await page.close(); }
});

test("Cliente descarta resposta antiga e cancela ao fechar; venda sem cliente continua valida", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.atrasar = true;
        await page.getByRole("button", { name: "F8 Cliente" }).click();
        const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
        await campo.fill("antiga"); await esperar(() => consultas(estado, "clientes").some(r => r.termo === "antiga"));
        await campo.fill("023.606"); await page.getByRole("listbox").getByRole("option").waitFor(); await page.waitForTimeout(1000);
        assert.equal(await page.getByText("Cliente antigo", { exact: true }).count(), 0);
        await campo.press("Escape");
        if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
        await busca.fill("P1"); await busca.press("Enter"); await page.getByLabel("Quantidade de Produto remoto").waitFor();
        await abrirPagamento(page);
        await page.getByLabel("Valor de Dinheiro (R$)").fill("10"); await confirmarPagamento(page);
        await esperar(() => estado.requests.some(r => r.path === "/vendas" && r.method === "POST"));
        const pedido = JSON.parse(estado.requests.find(r => r.path === "/vendas").body);
        assert.equal(pedido.clienteId, null); assert.equal(pedido.empresaId, undefined); assert.equal(pedido.tenantId, undefined);
    } finally { await page.close(); }
});

test("slice do PDV nao usa catalogo nem filtro/paginacao local como autocomplete", async () => {
    const pagina = await readFile(new URL("../src/pages/Vendas/Vendas.tsx", import.meta.url), "utf8");
    const helper = await readFile(new URL("../src/pages/Vendas/pdv.ts", import.meta.url), "utf8");
    assert.doesNotMatch(pagina + helper, /listarProdutos\(|listarClientes\(|buscarProdutosPDV\(|size\s*:\s*(100|500)\b/);
    assert.doesNotMatch(pagina, /produtos\.filter\(|clientes\.filter\(/);
    assert.match(pagina, /useRemoteSearch/); assert.match(pagina, /AbortController/);
});

async function abrirPagamento(page, selecionarDinheiro = true) {
    const dialogo = page.getByRole("dialog", { name: "Pagamento da venda" });
    if (!await dialogo.isVisible()) await page.getByRole("button", { name: "Finalizar venda · F2", exact: true }).click();
    await dialogo.waitFor();
    await page.waitForFunction(el => getComputedStyle(el.parentElement).opacity === "1", await dialogo.elementHandle());
    const dinheiro = dialogo.getByRole("button", { name: "Usar Dinheiro", exact: true });
    if (selecionarDinheiro && await dinheiro.count() && await dinheiro.isEnabled()
        && !await dialogo.getByLabel("Valor de Dinheiro (R$)").inputValue()
        && await dialogo.getByLabel("Valor aplicado", { exact: true }).innerText() === "R$\u00a00,00") await dinheiro.click();
    return dialogo;
}
async function confirmarPagamento(page) {
    const dialogo = await abrirPagamento(page);
    await dialogo.getByRole("button", { name: "Concluir pagamento \u00b7 F2", exact: true }).click();
}
async function adicionarCem(page, busca) {
    await busca.fill("7890001"); await busca.press("Enter");
    await page.getByLabel("Quantidade de Produto remoto").fill("10");
    await abrirPagamento(page);
}

test("comandos operacionais preservam quantidade, desconto, cliente, remocao e confirmacao sem enviar venda", async () => {
    const { page, busca, estado } = await abrir();
    try {
        await esperarFoco(page, busca);
        await busca.fill("7890001"); await busca.press("Enter");
        const quantidade = page.getByLabel("Quantidade de Produto remoto");
        await quantidade.waitFor();
        await quantidade.fill("2"); await quantidade.press("Enter"); await esperarFoco(page, busca);
        await busca.press("F3"); await esperarFoco(page, quantidade);
        await quantidade.press("F5"); await esperarFoco(page, busca);
        await busca.press("F7");
        const desconto = page.getByLabel("Desconto em R$");
        await desconto.fill("1"); await desconto.press("Enter"); await esperarFoco(page, busca);
        assert.match(await page.getByLabel("Total da venda", { exact: true }).innerText(), /19,00/);
        await busca.press("F8");
        await page.getByRole("combobox", { name: "Cliente (opcional)" }).press("Escape"); await esperarFoco(page, busca);
        await busca.press("F9");
        await page.getByRole("textbox", { name: "Observações", exact: true }).fill("Sem sacola");
        await page.getByRole("textbox", { name: "Observações", exact: true }).press("Escape"); await esperarFoco(page, busca);
        await busca.press("F6"); await page.getByRole("dialog", { name: "Limpar esta venda?" }).waitFor();
        await page.keyboard.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "2");
        await busca.press("F4"); await esperarFoco(page, busca);
        assert.equal(await quantidade.count(), 0);
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
        await busca.fill("7890001"); await busca.press("Enter"); await quantidade.waitFor();
        await quantidade.press("F6");
        await page.getByRole("dialog").getByRole("button", { name: "Limpar venda", exact: true }).click();
        await esperarFoco(page, busca); assert.equal(await quantidade.count(), 0);
    } finally { await page.close(); }
});

test("frente de caixa mantem busca, itens, total e comandos visiveis em desktop e resumo em mobile", async () => {
    const { page, busca, estado } = await abrir();
    try {
        estado.produtos = [
            { ...produto("Café torrado 500g", "CAFE"), id: 1, precoVenda: 24.9 },
            { ...produto("Pão de queijo tradicional", "PAO"), id: 2, precoVenda: 6.5, codigoBarras: "7890002" },
            { ...produto("Leite integral 1L", "LEITE"), id: 3, precoVenda: 5.9, codigoBarras: "7890003" },
        ];
        for (const codigo of ["7890001", "7890002", "7890003"]) {
            await busca.fill(codigo); await busca.press("Enter");
            await esperarFoco(page, page.getByLabel(`Quantidade de ${estado.produtos.find(p => p.codigoBarras === codigo).nome}`));
        }
        for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            await page.keyboard.press("F5");
            const elementos = [busca, page.getByLabel("Total da venda", { exact: true }), page.getByRole("button", { name: "Finalizar venda · F2", exact: true })];
            if (viewport.width >= 900) elementos.push(page.getByRole("table", { name: "Itens da venda" }), page.getByRole("group", { name: "Comandos do PDV" }));
            const caixas = await Promise.all(elementos.map(el => el.boundingBox()));
            for (const caixa of caixas) assert.ok(caixa && caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= viewport.width && caixa.y + caixa.height <= viewport.height);
            for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
                const a = caixas[i], b = caixas[j];
                assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, "Regioes operacionais nao devem se sobrepor");
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const comandos = page.getByRole("group", { name: "Comandos do PDV" });
            assert.equal(await comandos.getByRole("button").count(), 9);
            if (viewport.width >= 900) {
                const topo = await page.getByRole("banner", { name: "Topo operacional" }).boundingBox();
                const faixa = await comandos.boundingBox();
                const inclusao = await page.getByRole("group", { name: "Inclusão de produto" }).boundingBox();
                assert.ok(topo.y + topo.height <= faixa.y && faixa.y + faixa.height <= inclusao.y, "Comandos devem ficar acima da inclusao");
                const linha = await Promise.all([
                    busca, page.getByLabel("Quantidade do item selecionado"), page.getByLabel("Unitário do item selecionado"), page.getByRole("button", { name: "Adicionar", exact: true }),
                ].map(el => el.boundingBox()));
                assert.ok(linha.every(caixa => Math.abs(caixa.y - linha[0].y) < 2), "Inclusao deve ficar em uma linha no desktop");
                const altura = await page.getByRole("row").filter({ hasText: "Leite integral" }).boundingBox();
                assert.ok(altura.height <= 48, "Linha do carrinho deve ser compacta");
            }
            assert.equal(await page.getByRole("row").filter({ hasText: "Leite integral" }).getAttribute("class").then(c => c.includes("Mui-selected")), true);
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/pdv-operacional-${viewport.width}.png`, fullPage: true });
        }
        await page.setViewportSize({ width: 1366, height: 768 });
        for (let id = 4; id <= 16; id++) {
            estado.produtos = [{ ...produto(`Produto ${id}`, `P${id}`), id, codigoBarras: `78900${id}` }];
            await busca.fill(`78900${id}`); await busca.press("Enter");
            await esperarFoco(page, page.getByLabel(`Quantidade de Produto ${id}`, { exact: true }));
        }
        const itens = page.getByRole("table", { name: "Itens da venda" });
        assert.equal(await itens.evaluate(el => el.parentElement.scrollHeight > el.parentElement.clientHeight), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
        const faixa = await page.getByRole("group", { name: "Comandos do PDV" }).boundingBox();
        assert.ok(faixa.y >= 0 && faixa.y + faixa.height < 120);
        await page.screenshot({ path: "node_modules/.vite-pdv-buscas-tests/pdv-console-lista-1366.png" });
    } finally { await page.close(); }
});
test("total e pagar permanecem acessiveis em notebook e mobile baixo ao rolar a venda", async () => {
    const { page, busca, estado } = await abrir();
    try {
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 600 }, { width: 390, height: 844 }, { width: 390, height: 480 }]) {
            await page.setViewportSize(viewport);
            for (const extremo of [0, 10000]) {
                await page.evaluate(y => window.scrollTo(0, y), extremo);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                for (const el of [page.getByLabel("Total da venda", { exact: true }), page.getByRole("button", { name: "Finalizar venda · F2", exact: true })]) {
                    const caixa = await el.boundingBox();
                    assert.ok(caixa && caixa.y >= 0 && caixa.y + caixa.height <= viewport.height, `Total e Pagar visiveis em ${viewport.width}x${viewport.height}`);
                }
            }
            await page.keyboard.press("F5"); await esperarFoco(page, busca);
            await page.waitForFunction(() => {
                const campo = document.activeElement.getBoundingClientRect();
                return campo.y >= 0 && campo.bottom <= innerHeight;
            });
            const campo = await busca.boundingBox();
            const total = await page.getByLabel("Total da venda", { exact: true }).boundingBox();
            assert.ok(campo && campo.y >= 0 && campo.y + campo.height <= viewport.height);
            assert.ok(viewport.width >= 900 || campo.y + campo.height < total.y, "Rodape nao deve cobrir busca focada");
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/pdv-responsivo-${viewport.width}x${viewport.height}.png` });
        }
        assert.equal(estado.requests.some(r => r.method !== "GET"), false);
    } finally { await page.close(); }
});

test("controles de quantidade e inclusao em linha reutilizam o item selecionado sem editar preco ou enviar venda", async () => {
    const { page, busca, estado } = await abrir();
    try {
        await busca.fill("7890001"); await page.getByRole("button", { name: "Adicionar", exact: true }).click();
        const quantidade = page.getByLabel("Quantidade de Produto remoto", { exact: true });
        await esperarFoco(page, quantidade);
        const diminuir = page.getByRole("button", { name: "Diminuir uma unidade: Produto remoto" });
        const aumentar = page.getByRole("button", { name: "Aumentar uma unidade: Produto remoto" });
        assert.equal(await diminuir.isDisabled(), true);
        await aumentar.click(); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "2");
        await diminuir.click(); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "1");
        const linha = page.getByLabel("Quantidade do item selecionado");
        await linha.fill("1,25"); await linha.press("Enter"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "1,25");
        await diminuir.click();
        assert.equal(await quantidade.inputValue(), "0.25");
        assert.equal(await diminuir.isDisabled(), true);
        assert.match(await page.getByLabel("Total da venda", { exact: true }).innerText(), /2,50/);
        await linha.fill("3"); await linha.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "0.25");
        assert.equal(await page.getByLabel("Unitário do item selecionado").getAttribute("readonly"), "");
        estado.produtos = [{ ...produto("Outro produto", "P2"), id: 2, precoVenda: 15, codigoBarras: "7890002" }];
        await busca.fill("7890002"); await page.getByRole("listbox").getByRole("option").waitFor();
        assert.equal(await linha.inputValue(), "1");
        assert.equal(await linha.getAttribute("readonly"), "");
        assert.match(await page.getByLabel("Unitário do item selecionado").inputValue(), /15,00/);
        assert.equal(await quantidade.inputValue(), "0.25");
        assert.equal(estado.requests.some(r => r.method === "POST"), false);
    } finally { await page.close(); }
});
async function selecionarClientePrazo(page) {
    const campo = page.getByRole("combobox", { name: "Cliente (opcional)" });
    if (!await campo.count()) await page.getByRole("button", { name: "Selecionar cliente do pagamento" }).click();
    await campo.fill("Cliente"); await page.getByRole("listbox").getByRole("option", { name: /Cliente remoto/ }).click();
}

test("carrinho mobile mostra item completo sem scroll horizontal, preserva teclado e pagamento simples", async () => {
    const { page, estado, busca } = await abrir({ hasTouch: true });
    try {
        await page.setViewportSize({ width: 390, height: 844 });
        await esperarFoco(page, busca);
        await busca.fill("7890001"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, "Produto remoto", "1");
        const carrinho = page.getByRole("table", { name: "Itens da venda" });
        const item = carrinho.getByRole("row").filter({ hasText: "Produto remoto" });
        assert.match(await item.innerText(), /Quantidade[\s\S]*Unitário[\s\S]*Subtotal/);
        await quantidade.press("3"); await quantidade.press("Enter"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "3");
        assert.match(await item.innerText(), /30,00/);
        const remover = page.getByRole("button", { name: "Remover Produto remoto", exact: true });
        const alvo = await remover.boundingBox();
        assert.ok(alvo.width >= 44 && alvo.height >= 44);
        assert.equal(await carrinho.evaluate(el => el.scrollWidth <= el.clientWidth), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: "node_modules/.vite-pdv-buscas-tests/carrinho-mobile-390.png", fullPage: true });
        await remover.tap(); await esperarFoco(page, busca);
        assert.equal(await quantidade.count(), 0);
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        await quantidade.press("Control+Delete"); await esperarFoco(page, busca);
        assert.equal(await quantidade.count(), 0);
        await busca.fill("7890001"); await busca.press("Enter");
        await conferirQuantidade(page, "Produto remoto", "1");
        await quantidade.press("8"); await quantidade.press("Escape"); await esperarFoco(page, busca);
        assert.equal(await quantidade.inputValue(), "1");
        await quantidade.tap(); await quantidade.press("Tab"); await esperarFoco(page, remover);
        await confirmarPagamento(page);
        await esperar(() => estado.requests.some(r => r.method === "POST" && r.path === "/vendas"));
        const pedido = JSON.parse(estado.requests.find(r => r.method === "POST" && r.path === "/vendas").body);
        assert.equal(pedido.itens[0].quantidade, 1);
        assert.equal(pedido.pagamentos[0].valor, 10);
    } finally { await page.close(); }
});

test("carrinho adapta nomes longos em mobile e mantem tabela estruturada em desktop sem duplicar campos", async () => {
    const { page, estado, busca } = await abrir();
    try {
        const nome = "Produto com nome extenso para testar quebra de linha " + "X".repeat(65);
        estado.produtos = [produto(nome)];
        await busca.fill("7890001"); await busca.press("Enter");
        const quantidade = await conferirQuantidade(page, nome, "1");
        const carrinho = page.getByRole("table", { name: "Itens da venda" });
        const item = carrinho.getByRole("row").filter({ hasText: nome });
        for (const width of [390, 1024, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await item.evaluate(el => getComputedStyle(el).display), width === 390 ? "grid" : "table-row");
            assert.equal(await quantidade.count(), 1);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await carrinho.evaluate(el => el.scrollWidth <= el.clientWidth), true);
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/carrinho-responsivo-${width}.png`, fullPage: true });
        }
    } finally { await page.close(); }
});

test("busca vazia mostra feedback contextual e saldo zero exige confirmação autorizada no servidor", async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.semResultados = true; await busca.fill("Inexistente");
        await page.getByText("Nenhum produto encontrado para esta busca.", { exact: true }).waitFor();
        await page.screenshot({ path: "node_modules/.vite-pdv-buscas-tests/busca-sem-resultados.png", fullPage: true });
        await busca.fill(""); assert.equal(await page.getByText("Nenhum produto encontrado para esta busca.", { exact: true }).count(), 0);
        estado.semResultados = false; estado.estoqueAtual = 0;
        await busca.fill("Produto"); await page.getByRole("listbox").getByRole("option").click();
        await page.getByLabel("Quantidade de Produto remoto").waitFor();
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "1");
        estado.estoqueInsuficiente = true;
        await confirmarPagamento(page);
        const dialog = page.getByRole("dialog", { name: "Estoque insuficiente" });
        await dialog.waitFor();
        assert.match(await dialog.innerText(), /Disponível: 0 · Solicitado: 1/);
        assert.equal(estado.requests.filter(r => r.path === "/vendas").length, 1);
        await dialog.getByRole("button", { name: "Voltar e revisar" }).click();
        await page.getByRole("dialog", { name: "Pagamento da venda" }).waitFor();
        assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "1");
        await confirmarPagamento(page);
        await dialog.getByRole("button", { name: "Autorizar estoque insuficiente" }).click();
        await page.getByRole("dialog", { name: "Pagamento da venda" }).waitFor();
        await confirmarPagamento(page);
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        const pedidos = estado.requests.filter(r => r.path === "/vendas").map(r => JSON.parse(r.body));
        assert.equal(pedidos.at(-1).confirmarEstoqueInsuficiente, true);
        assert.equal(pedidos[0].confirmarEstoqueInsuficiente, undefined);
    } finally { await page.close(); }
});

test("erros reais de PIX e estoque recebem mensagem acionavel sem inventar conflito generico", async () => {
    for (const [detail, mensagem] of [
        ["Pagamento sem destino financeiro historico.", "Esta forma de pagamento PIX não possui uma conta de destino configurada."],
        ["Saldo insuficiente. Estoque atual: 0, quantidade solicitada: 10", "Estoque insuficiente para concluir a venda. Confira as quantidades dos produtos."],
        ["Venda já faturada com outra requisição.", "Venda já faturada com outra requisição."],
    ]) {
        const { page, estado, busca } = await abrir();
        try {
            await adicionarCem(page, busca); estado.erroVenda = 409; estado.mensagemErro = detail;
            await confirmarPagamento(page);
            await page.getByRole("dialog", { name: "Não foi possível concluir" }).getByText(mensagem, { exact: true }).waitFor();
            await page.getByRole("button", { name: "Voltar à venda" }).click();
            assert.equal(await page.getByLabel("Quantidade de Produto remoto").inputValue(), "10");
        } finally { await page.close(); }
    }
});

const valorMeio = (page, nome) => page.getByLabel(`Valor de ${nome} (R$)`, { exact: true });
test("quantidade do PDV rejeita letras e colagem inválida nos dois editores, preservando fracionados", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        for (const campo of [page.getByLabel("Quantidade de Produto remoto", { exact: true }), page.getByLabel("Quantidade do item selecionado", { exact: true })]) {
            await campo.fill("2,5"); await campo.press("End"); await campo.pressSequentially("abc");
            assert.equal(await campo.inputValue(), "2,5");
            for (const invalido of ["abc", "1e3", "-2", "1,2345", "1.2.3"]) { await campo.fill(invalido); assert.equal(await campo.inputValue(), "2,5"); }
            await page.evaluate(() => navigator.clipboard.writeText("3x4"));
            await campo.focus(); await campo.press("Control+a"); await campo.press("Control+v");
            assert.equal(await campo.inputValue(), "2,5");
            await campo.fill("1.234"); assert.equal(await campo.inputValue(), "1.234");
            await campo.fill(""); assert.equal(await campo.inputValue(), "");
            await campo.fill("3"); await campo.press("Enter"); await esperarFoco(page, busca);
            assert.equal(await page.getByLabel("Quantidade de Produto remoto", { exact: true }).inputValue(), "3");
        }
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});
const concluir = page => page.getByRole("button", { name: "Concluir pagamento \u00b7 F2", exact: true });
const gravacoes = estado => estado.requests.filter(r => r.path === "/vendas" && r.method === "POST");

for (const width of [1440, 390]) test(`crédito 3x preserva parcelas no rascunho e envia valor integral em ${width}px`, async () => {
    const { page, estado, busca } = await abrir({ configuracoesPagamento: [
        {id: 4, tipo: "CREDITO", nomeExibicao: "Crédito Loja", ativo: true, maximoParcelasConsumidor: 3},
    ] });
    try {
        await page.setViewportSize({width, height: 900});
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await abrirPagamento(page, false);
        const parcelas = page.getByRole("combobox", {name: "Parcelas do consumidor — Crédito Loja"});
        await parcelas.click(); await page.getByRole("option", {name: "3x", exact: true}).click();
        await page.getByLabel("Valor de Crédito Loja (R$)").fill("10");
        assert.match(await parcelas.innerText(), /3x/);
        await page.getByRole("button", {name: "Fechar pagamento", exact: true}).click();
        await page.reload(); await abrirPagamento(page, false);
        assert.match(await parcelas.innerText(), /3x/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await concluir(page).click(); await esperar(() => gravacoes(estado).length === 1);
        const pedido = JSON.parse(gravacoes(estado)[0].body);
        assert.deepEqual(pedido.pagamentos, [{configuracaoFormaPagamentoId: 4, valor: 10, parcelasConsumidor: 3}]);
        assert.equal(pedido.parcelasPrazo, undefined);
    } finally { await page.close(); }
});

async function meio(page, nome, valor) {
    await page.getByRole("button", { name: `Usar ${nome}`, exact: true }).click();
    if (valor !== undefined) { await valorMeio(page, nome).fill(valor); await valorMeio(page, nome).press("Tab"); }
}

for (const [nome, id] of [["Dinheiro", 1], ["PIX Loja", 2], ["Débito Loja", 3], ["Crédito Loja", 4]]) {
    test(`lista direta: pagamento integral por ${nome} preserva configuração e envio único`, async () => {
        const { page, estado, busca } = await abrir();
        try {
            await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
            await abrirPagamento(page, false);
            assert.equal(await page.getByRole("combobox", { name: /Forma de pagamento/ }).count(), 0);
            assert.equal(await page.getByRole("button", { name: "Adicionar forma", exact: true }).count(), 0);
            for (const indisponivel of ["Cartão inativo", "PIX sem destino", "PIX destino inativo", "PIX destino incompatível"]) assert.equal(await page.getByRole("button", { name: `Usar ${indisponivel}`, exact: true }).count(), 0);
            assert.equal(await concluir(page).isEnabled(), true); assert.equal(gravacoes(estado).length, 0);
            if (nome !== "Dinheiro") await valorMeio(page, "Dinheiro").fill("");
            await meio(page, nome); await valorMeio(page, nome).press("Tab");
            assert.equal(await valorMeio(page, nome).inputValue(), "10,00");
            estado.atrasarVenda = true;
            await concluir(page).evaluate(el => { el.click(); el.click(); });
            await page.getByText("Venda concluída", { exact: true }).waitFor();
            assert.equal(gravacoes(estado).length, 1);
            assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [{ configuracaoFormaPagamentoId: id, valor: 10, ...(id === 1 ? { valorRecebido: 10 } : {}) }]);
        } finally { await page.close(); }
    });
}

for (const [nome, id] of [["PIX Loja", 2], ["Débito Loja", 3], ["Crédito Loja", 4]]) test(`lista direta: 6,90 em dinheiro e 1,00 em ${nome}, Enter não grava`, async () => {
    const { page, estado, busca } = await abrir();
    try {
        estado.produtos = [{ ...produto(), precoVenda: 7.9 }];
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await abrirPagamento(page, false); await meio(page, "Dinheiro", "6,90");
        assert.match(await page.getByLabel("Falta a pagar", { exact: true }).innerText(), /1,00/);
        await meio(page, nome); await valorMeio(page, nome).press("Tab");
        assert.equal(await valorMeio(page, nome).inputValue(), "1,00");
        await valorMeio(page, nome).press("Enter"); await esperarFoco(page, concluir(page));
        assert.equal(gravacoes(estado).length, 0);
        await page.keyboard.press("Enter"); await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [{ configuracaoFormaPagamentoId: 1, valor: 6.9, valorRecebido: 6.9 }, { configuracaoFormaPagamentoId: id, valor: 1 }]);
    } finally { await page.close(); }
});

test("lista direta: dinheiro entregue deriva aplicação e troco, preservando outros meios e reload", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await meio(page, "Dinheiro", "50"); await meio(page, "PIX Loja", "30"); await meio(page, "Crédito Loja");
        await page.getByLabel("Valor de Dinheiro (R$)").fill("60");
        assert.match(await page.getByLabel("Troco em Dinheiro").innerText(), /10,00/);
        assert.match(await page.getByLabel("Valor aplicado", { exact: true }).innerText(), /100,00/);
        assert.equal(await valorMeio(page, "PIX Loja").inputValue(), "30,00");
        assert.equal(await valorMeio(page, "Crédito Loja").inputValue(), "20,00");
        await page.reload(); await esperarFoco(page, busca); await abrirPagamento(page);
        assert.equal(await page.getByLabel("Valor de Dinheiro (R$)").inputValue(), "60,00");
        await confirmarPagamento(page); await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [{ configuracaoFormaPagamentoId: 1, valor: 50, valorRecebido: 60 }, { configuracaoFormaPagamentoId: 2, valor: 30 }, { configuracaoFormaPagamentoId: 4, valor: 20 }]);
    } finally { await page.close(); }
});

test("valor selecionado acompanha as setas entre meios e Enter confirma sem duplicar", async () => {
    const configuracoesPagamento = [
        { id: 4, tipo: "CREDITO", nomeExibicao: "Crédito primeiro", ativo: true },
        { id: 3, tipo: "DEBITO", nomeExibicao: "Débito segundo", ativo: true },
        { id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true },
        { id: 2, tipo: "PIX", nomeExibicao: "PIX Loja", ativo: true, contaFinanceiraDestino: { id: 3, ativo: true, tipo: "BANCO" } },
    ];
    const { page, estado, busca } = await abrir({ configuracoesPagamento, adiarRender: true });
    try {
        estado.produtos = [{ ...produto(), precoVenda: 2.5 }];
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await abrirPagamento(page, false);
        const credito = valorMeio(page, "Crédito primeiro"), debito = valorMeio(page, "Débito segundo"), dinheiro = valorMeio(page, "Dinheiro"), pix = valorMeio(page, "PIX Loja");
        await esperarFoco(page, credito);
        assert.equal(await credito.inputValue(), "2,50");
        assert.deepEqual(await credito.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 4]);
        for (const [origem, destino] of [[credito, debito], [debito, dinheiro], [dinheiro, pix]]) {
            await origem.press("ArrowDown"); await esperarFoco(page, destino);
            assert.equal(await origem.inputValue(), ""); assert.equal(await destino.inputValue(), "2,50");
            assert.deepEqual(await destino.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 4]);
            assert.match(await page.getByLabel("Valor aplicado", { exact: true }).innerText(), /2,50/);
            assert.equal(gravacoes(estado).length, 0);
        }
        await pix.press("ArrowUp"); await esperarFoco(page, dinheiro);
        assert.equal(await pix.inputValue(), ""); assert.equal(await dinheiro.inputValue(), "2,50");
        await dinheiro.press("Enter"); await esperarFoco(page, concluir(page));
        assert.equal(await dinheiro.inputValue(), "2,50"); assert.equal(gravacoes(estado).length, 0);
        estado.atrasarVenda = true;
        await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.equal(gravacoes(estado).length, 1);
        assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [{ configuracaoFormaPagamentoId: 1, valor: 2.5, valorRecebido: 2.5 }]);
    } finally { await page.close(); }
});

test("Enter preserva dinheiro parcial e seta transfere somente o complemento selecionado", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        const dinheiro = valorMeio(page, "Dinheiro"), pix = valorMeio(page, "PIX Loja"), debito = valorMeio(page, "Débito Loja");
        await dinheiro.fill("30"); await dinheiro.press("Control+a"); await dinheiro.press("Enter"); await esperarFoco(page, pix);
        assert.equal(await dinheiro.inputValue(), "30,00"); assert.equal(await pix.inputValue(), "70,00");
        await pix.press("ArrowDown"); await esperarFoco(page, debito);
        assert.equal(await dinheiro.inputValue(), "30,00"); assert.equal(await pix.inputValue(), ""); assert.equal(await debito.inputValue(), "70,00");
        await debito.press("Enter"); await esperarFoco(page, concluir(page));
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});

test("seta para baixo preenche o restante antes de focar mesmo com render adiado", async () => {
    const { page, estado, busca } = await abrir({ adiarRender: true });
    try {
        await adicionarCem(page, busca);
        const dinheiro = valorMeio(page, "Dinheiro"), pix = valorMeio(page, "PIX Loja");
        await dinheiro.fill("30");
        await page.getByLabel("Falta a pagar", { exact: true }).filter({ hasText: "70,00" }).waitFor();
        // Força o callback de foco antes do commit para reproduzir a corrida de renderização.
        await page.evaluate(() => {
            const original = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => { window.requestAnimationFrame = original; callback(performance.now()); return 0; };
        });
        await dinheiro.press("ArrowDown"); await esperarFoco(page, pix);
        assert.equal(await pix.inputValue(), "70,00");
        await page.waitForTimeout(250);
        assert.equal(await pix.inputValue(), "70,00");
        assert.deepEqual(await pix.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 5]);
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});

test("correção pagamento: foco numérico, setas e Enter completam misto sem sobrescrever ou duplicar", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        const dinheiro = valorMeio(page, "Dinheiro"), pix = valorMeio(page, "PIX Loja"), debito = valorMeio(page, "Débito Loja");
        await esperarFoco(page, dinheiro);
        await dinheiro.fill("30"); await dinheiro.press("ArrowDown"); await esperarFoco(page, pix);
        assert.equal(await pix.inputValue(), "70,00");
        assert.deepEqual(await pix.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 5]);
        await pix.fill("20"); await pix.press("Enter"); await esperarFoco(page, debito);
        assert.equal(await debito.inputValue(), "50,00");
        await debito.press("ArrowUp"); await esperarFoco(page, pix); assert.equal(await pix.inputValue(), "20,00");
        await pix.press("ArrowDown"); await esperarFoco(page, debito); assert.equal(await debito.inputValue(), "50,00");
        await debito.press("Enter"); await esperarFoco(page, concluir(page));
        assert.equal(gravacoes(estado).length, 0);
        estado.atrasarVenda = true;
        await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
        await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.equal(gravacoes(estado).length, 1);
        assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [
            { configuracaoFormaPagamentoId: 1, valor: 30, valorRecebido: 30 },
            { configuracaoFormaPagamentoId: 2, valor: 20 }, { configuracaoFormaPagamentoId: 3, valor: 50 }]);
    } finally { await page.close(); }
});

for (const [total, entregue, cartao, aplicado, troco, falta] of [[2.5, 4, 0, 2.5, 1.5, 0], [100, 50, 60, 40, 10, 0], [100, 30, 0, 30, 0, 70], [100, 100, 40, 60, 40, 0]]) {
    test(`correção pagamento: dinheiro ${entregue}, cartão ${cartao}, total ${total}`, async () => {
        const { page, estado, busca } = await abrir();
        try {
            estado.produtos = [{ ...produto(), precoVenda: total }];
            await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
            await abrirPagamento(page, false);
            const dinheiro = valorMeio(page, "Dinheiro"); await esperarFoco(page, dinheiro);
            await dinheiro.fill(String(entregue));
            if (cartao) await meio(page, "Crédito Loja", String(cartao));
            assert.equal(await page.getByText("Recebimento em dinheiro", { exact: true }).count(), 0);
            assert.match(await page.getByLabel("Valor aplicado", { exact: true }).innerText(), new RegExp((aplicado + cartao).toFixed(2).replace(".", ",")));
            assert.match(await page.getByLabel("Falta a pagar", { exact: true }).innerText(), new RegExp(falta.toFixed(2).replace(".", ",")));
            if (troco) assert.match(await page.getByLabel("Troco em Dinheiro").innerText(), new RegExp(troco.toFixed(2).replace(".", ",")));
            else assert.equal(await page.getByLabel("Troco em Dinheiro").count(), 0);
            assert.equal(await concluir(page).isEnabled(), falta === 0);
            assert.equal(gravacoes(estado).length, 0);
        } finally { await page.close(); }
    });
}

test("correção pagamento: foco inicial respeita a ordem recebida de configurações", async () => {
    const configuracoesPagamento = [{ id: 4, tipo: "CREDITO", nomeExibicao: "Crédito primeiro", ativo: true }, { id: 1, tipo: "DINHEIRO", nomeExibicao: "Dinheiro", ativo: true }];
    const { page, busca } = await abrir({ configuracoesPagamento });
    try {
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await abrirPagamento(page, false); const credito = valorMeio(page, "Crédito primeiro"); await esperarFoco(page, credito);
        await credito.fill("3"); await credito.press("ArrowDown"); await esperarFoco(page, valorMeio(page, "Dinheiro"));
        assert.equal(await valorMeio(page, "Dinheiro").inputValue(), "7,00");
        await page.waitForTimeout(350); await esperarFoco(page, valorMeio(page, "Dinheiro"));
    } finally { await page.close(); }
});

test("lista direta: editar, zerar e limpar remove somente o meio escolhido; inválidos e excesso bloqueiam", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await meio(page, "Dinheiro", "40"); await meio(page, "PIX Loja");
        assert.equal(await concluir(page).isEnabled(), true);
        const pix = valorMeio(page, "PIX Loja");
        await pix.fill("61"); assert.equal(await concluir(page).isEnabled(), true);
        assert.match(await page.getByLabel("Troco em Dinheiro").innerText(), /1,00/);
        await pix.fill("101"); assert.equal(await concluir(page).isDisabled(), true);
        for (const invalido of ["-1", "2,501", "texto"]) { await pix.fill(invalido); assert.equal(await pix.inputValue(), "101"); }
        await pix.fill("0"); await pix.press("Tab"); assert.match(await page.getByLabel("Falta a pagar", { exact: true }).innerText(), /60,00/);
        await meio(page, "PIX Loja"); assert.equal(await pix.inputValue(), "60,00");
        await pix.fill(""); await pix.press("Tab"); assert.equal(await concluir(page).isDisabled(), true);
        assert.equal(await valorMeio(page, "Dinheiro").inputValue(), "40,00");
        await meio(page, "PIX Loja"); await pix.press("Tab"); assert.equal(await concluir(page).isEnabled(), true);
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});

test("lista direta: valor entregue insuficiente bloqueia; troco zero e positivo usam o mesmo contrato", async () => {
    const { page, busca } = await abrir();
    try {
        await adicionarCem(page, busca);
        const entregue = page.getByLabel("Valor de Dinheiro (R$)");
        await entregue.fill("99"); assert.equal(await concluir(page).isDisabled(), true);
        await entregue.fill("100"); assert.equal(await concluir(page).isEnabled(), true); assert.equal(await page.getByLabel("Troco em Dinheiro").count(), 0);
        await entregue.fill("130"); assert.equal(await concluir(page).isEnabled(), true); assert.match(await page.getByLabel("Troco em Dinheiro").innerText(), /30,00/);
        await entregue.press("Tab"); assert.equal(await valorMeio(page, "Dinheiro").inputValue(), "130,00");
    } finally { await page.close(); }
});

test("lista direta: máscara brasileira, colagem, cursor e precisão monetária existentes", async () => {
    const { page, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await valorMeio(page, "Dinheiro").fill(""); await meio(page, "PIX Loja");
        const campo = valorMeio(page, "PIX Loja");
        for (const [entrada, exibido] of [["1", "1,00"], ["2,5", "2,50"], ["3.50", "3,50"], ["1.000,50", "1.000,50"]]) {
            await campo.fill(""); await campo.pressSequentially(entrada); assert.equal(await campo.inputValue(), entrada);
            await campo.press("Tab"); assert.equal(await campo.inputValue(), exibido);
        }
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await page.evaluate(() => navigator.clipboard.writeText("100,00"));
        await campo.focus(); await campo.press("Control+a"); await campo.press("Control+v"); await campo.press("Tab");
        assert.equal(await campo.inputValue(), "100,00"); assert.equal(await concluir(page).isEnabled(), true);
        await campo.focus(); assert.deepEqual(await campo.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 6]);
    } finally { await page.close(); }
});

for (const imediato of [null, "Dinheiro", "PIX Loja", "Crédito Loja"]) test(`lista direta: prazo com ${imediato ?? "nenhum imediato"}, cliente e parcelas reutilizados`, async () => {
    const { page, estado, busca } = await abrir();
    try {
        await adicionarCem(page, busca); await valorMeio(page, "Dinheiro").fill("");
        if (imediato) await meio(page, imediato, "40");
        await page.getByRole("button", { name: "A prazo", exact: true }).click(); await selecionarClientePrazo(page);
        assert.equal(await concluir(page).isDisabled(), true);
        await page.getByLabel("Vencimento 1", { exact: true }).fill("2026-11-15");
        const valor = imediato ? "30" : "50";
        await page.getByLabel("Valor da parcela 1 (R$)").fill(valor); await page.getByRole("button", { name: "Adicionar parcela", exact: true }).click();
        await page.getByLabel("Vencimento 2", { exact: true }).fill("2026-12-15");
        assert.equal(await concluir(page).isEnabled(), true);
        if (imediato === "Dinheiro") await page.getByLabel("Valor de Dinheiro (R$)").fill("50");
        await confirmarPagamento(page); await page.getByText("Venda concluída", { exact: true }).waitFor();
        const pedido = JSON.parse(gravacoes(estado)[0].body);
        assert.equal(pedido.clienteId, 8); assert.deepEqual(pedido.parcelasPrazo, [{ valor: Number(valor), vencimento: "2026-11-15" }, { valor: Number(valor), vencimento: "2026-12-15" }]);
        assert.equal(pedido.pagamentos.length, imediato ? 1 : 0);
    } finally { await page.close(); }
});

test("lista direta: duas configurações do mesmo tipo, filtros de ativos/destino e nenhuma forma fictícia", async () => {
    const configuracoesPagamento = [1, 2].map(id => ({ id: id + 10, nomeExibicao: `PIX Banco ${id}`, tipo: "PIX", ativo: true, contaFinanceiraDestino: { id, ativo: true, tipo: "BANCO" } }));
    const { page, estado, busca } = await abrir({ configuracoesPagamento });
    try {
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1"); await abrirPagamento(page, false);
        await meio(page, "PIX Banco 1", "3"); await meio(page, "PIX Banco 2");
        await confirmarPagamento(page); await page.getByText("Venda concluída", { exact: true }).waitFor();
        assert.deepEqual(JSON.parse(gravacoes(estado)[0].body).pagamentos, [{ configuracaoFormaPagamentoId: 11, valor: 3 }, { configuracaoFormaPagamentoId: 12, valor: 7 }]);
    } finally { await page.close(); }
});

test("lista direta: teclado, F2, Escape, retorno e rascunho sem confirmação antecipada", async () => {
    const { page, estado, busca } = await abrir();
    try {
        await busca.press("F2"); assert.equal(await page.getByRole("dialog", { name: "Pagamento da venda" }).count(), 0);
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1");
        await page.keyboard.press("F2"); const dialogo = await abrirPagamento(page, false);
        const dinheiro = valorMeio(page, "Dinheiro"); await esperarFoco(page, dinheiro);
        await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab"); await esperarFoco(page, dinheiro);
        await page.getByLabel("Valor de Dinheiro (R$)").fill("20");
        await page.keyboard.press("Escape"); await dialogo.waitFor({ state: "hidden" }); assert.equal(gravacoes(estado).length, 0);
        await abrirPagamento(page, false); assert.equal(await page.getByLabel("Valor de Dinheiro (R$)").inputValue(), "20,00");
        await dialogo.getByRole("button", { name: "Voltar para a venda", exact: true }).click(); await dialogo.waitFor({ state: "hidden" }); assert.equal(gravacoes(estado).length, 0);
        await page.keyboard.press("F2"); await abrirPagamento(page, false); estado.atrasarVenda = true;
        await page.keyboard.press("F2"); await page.keyboard.press("F2");
        await page.getByText("Venda concluída", { exact: true }).waitFor(); assert.equal(gravacoes(estado).length, 1);
    } finally { await page.close(); }
});

test("lista direta: muitas configurações e itens rolam internamente, total e conclusão ficam visíveis", async () => {
    const configuracoesPagamento = Array.from({ length: 35 }, (_, i) => ({ id: i + 1, tipo: "CREDITO", nomeExibicao: `Crédito Operadora ${i + 1}`, ativo: true }));
    const { page, estado, busca } = await abrir({ configuracoesPagamento });
    try {
        await busca.fill("P1"); await busca.press("Enter"); await conferirQuantidade(page, "Produto remoto", "1"); await abrirPagamento(page, false);
        await page.evaluate(() => {
            const chave = "novexa-pdv:1:1:10", r = JSON.parse(sessionStorage.getItem(chave));
            const item = r.itens[0];
            r.itens = Array.from({ length: 30 }, (_, i) => ({ ...item, produto: { ...item.produto, id: i + 1, nome: `Produto de teste ${i + 1}` } }));
            sessionStorage.setItem(chave, JSON.stringify(r));
        });
        await page.reload(); await esperarFoco(page, busca); await abrirPagamento(page, false);
        for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 600 }]) {
            await page.setViewportSize(viewport); await meio(page, "Crédito Operadora 35");
            assert.equal(await page.getByRole("list", { name: "Produtos da venda" }).evaluate(el => el.scrollHeight > el.clientHeight), true);
            assert.equal(await page.getByRole("group", { name: "Crédito Operadora 35", exact: true }).locator("..").evaluate(el => el.scrollHeight > el.clientHeight), true);
            for (const el of [page.getByLabel("Total a pagar"), concluir(page)]) { const box = await el.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height); }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});

for (const tema of ["light", "dark", "auto"]) test(`lista direta: visual desktop/notebook/mobile em ${tema}`, async () => {
    const { page, estado, busca } = await abrir({ tema, colorScheme: "dark" });
    try {
        await adicionarCem(page, busca); await meio(page, "Dinheiro", "50"); await meio(page, "PIX Loja"); await page.getByLabel("Valor de Dinheiro (R$)").fill("60"); await page.getByLabel("Valor de Dinheiro (R$)").press("Tab");
        for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 600 }, { width: 390, height: 844 }, { width: 390, height: 480 }]) {
            await page.setViewportSize(viewport); const dialogo = page.getByRole("dialog", { name: "Pagamento da venda" });
            await page.waitForTimeout(200);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await dialogo.evaluate(el => el.scrollWidth <= el.clientWidth), true);
            for (const el of [concluir(page), dialogo.getByRole("button", { name: "Voltar para a venda", exact: true })]) { const box = await el.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height); }
            await page.screenshot({ path: `node_modules/.vite-pdv-buscas-tests/lista-pagamentos-${tema}-${viewport.width}-${viewport.height}.png`, fullPage: true });
        }
        assert.equal(gravacoes(estado).length, 0);
    } finally { await page.close(); }
});
