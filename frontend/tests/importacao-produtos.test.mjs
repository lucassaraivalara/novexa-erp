import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

let server, browser, url;
const fixture = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {ThemeProvider,CssBaseline} from '@mui/material'; import {BrowserRouter} from 'react-router-dom';
import AppRoutes from '/src/routes/AppRoutes.tsx'; import theme from '/src/theme/theme.ts';
createRoot(document.getElementById('root')).render(React.createElement(ThemeProvider,{theme},React.createElement(CssBaseline),React.createElement(BrowserRouter,null,React.createElement(AppRoutes))));`;
before(async () => {
    server = await createServer({ cacheDir: "node_modules/.vite-importacao-produtos-tests", server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{ name: "importacao-produtos-fixture", resolveId(id) { if (id === "/importacao-produtos-fixture.js") return "\0importacao-produtos-fixture"; },
            load(id) { if (id === "\0importacao-produtos-fixture") return fixture; },
            configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
                if (!req.url.startsWith("/produtos")) return next();
                res.setHeader("Content-Type", "text/html");
                res.end(await vite.transformIndexHtml(req.url, '<div id="root"></div><script type="module" src="/importacao-produtos-fixture.js"></script>'));
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
    await p.addInitScript(perfil => localStorage.setItem("novexa-auth", JSON.stringify({ token: "teste", perfil, nomeUsuario: "Teste", empresa: { id: 1, nomeFantasia: "Empresa teste" } })), e.perfil ?? "ADMIN");
    await p.route("http://localhost:8080/**", async route => {
        const req = route.request(), u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const body = req.postData() && req.headers()["content-type"]?.includes("application/json") ? JSON.parse(req.postData()) : null;
        e.chamadas.push({ path: u.pathname, metodo: req.method(), params: u.searchParams, body, auth: req.headers().authorization });
        const responder = (status, dados) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(dados) });
        if (u.pathname === "/produtos/importacoes") return responder(200, e.previa ?? previaImportacao());
        if (u.pathname.endsWith("/confirmar")) {
            if (e.esperar) await e.esperar;
            if (e.erroConfirmacao) return responder(409, "O catálogo mudou após a prévia. Reenvie o arquivo para revisar.");
            return responder(200, { ...(e.previa ?? previaImportacao()), estado: "CONFIRMADA", importados: 1 });
        }
        if (u.pathname.endsWith("/cancelar")) return responder(200, { ...previaImportacao(), estado: "CANCELADA" });
        if (u.pathname.endsWith("/erros")) return route.fulfill({ status: 200, headers: cors, contentType: "text/csv;charset=UTF-8", body: "Linha;Motivo\\r\\n3;Preço inválido." });
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
            salvo.categoria = categorias.find(c => c.id === body.categoriaId) ?? null; salvo.subcategoria = subcategorias.find(c => c.id === body.subcategoriaId) ?? null; salvo.marca = marcas.find(c => c.id === body.marcaId) ?? null;
            if (id) e.produtos.splice(e.produtos.findIndex(p => p.id === salvo.id), 1, salvo); else e.produtos.push(salvo);
            return responder(id ? 200 : 201, salvo);
        }
        return responder(200, []);
    });
    await p.goto(`${url}/produtos?origem=consulta`); await expect(p.getByRole("cell", { name: /Produto teste/ })).toBeVisible(); return p;
}
async function editar(p) { await p.getByRole("row").filter({ has: p.getByRole("cell", { name: /Produto teste/ }) }).getByRole("button", { name: "Editar produto", exact: true }).click(); return p.getByRole("dialog"); }
const categorias = [{ id: 10, nome: "Bebidas", ativo: true }, { id: 11, nome: "Alimentos", ativo: true }];
const subcategorias = [{ id: 20, nome: "Sucos", ativo: true, categoria: categorias[0] }, { id: 21, nome: "Massas", ativo: true, categoria: categorias[1] }];
const marcas = [{ id: 30, nome: "Marca teste", ativo: true }];
const gravacoes = e => e.chamadas.filter(c => ["POST", "PUT"].includes(c.metodo));


const previaImportacao = () => ({ id: "00000000-0000-0000-0000-000000000001", arquivo: "produtos.csv", estado: "PREVIA", validas: 1, invalidas: 1, duplicadas: 1, ignoradas: 1, importados: 0, colunasIgnoradas: ["Estoque Atual", "Kit / Combo"], linhas: [
    { linha: 2, situacao: "VALIDA", mensagem: "Pronta para criar produto, sem saldo inicial.", campos: { nome: "Café", codigoInterno: "CAFE", precoVenda: "12,50", unidadeMedida: "UN", categoria: "Bebidas", subcategoria: "Cafés", marca: "Marca teste", fornecedor: "Distribuidora", ncm: "09011110", cest: "1700100" } },
    { linha: 3, situacao: "INVALIDA", mensagem: "Preço inválido.", campos: { nome: "Inválido" } },
    { linha: 4, situacao: "DUPLICADA", mensagem: "Código já cadastrado.", campos: { nome: "Duplicado" } },
    { linha: 5, situacao: "IGNORADA", mensagem: "Linha sem campos importáveis.", campos: {} }
] });
async function enviar(p) {
    await p.getByRole("button", { name: "Importar Produtos", exact: true }).click(); const d = p.getByRole("dialog");
    await d.getByLabel("Arquivo de produtos").setInputFiles({ name: "produtos.csv", mimeType: "text/csv", buffer: Buffer.from("Nome;Preço;Unidade\nCafé;12,50;UN") });
    await d.getByRole("button", { name: "Gerar prévia", exact: true }).click(); await expect(d.getByText("Válidas: 1", { exact: true })).toBeVisible(); return d;
}
test("prévia mostra contagens, vínculos e relatório por linha; cancelar não confirma", async () => {
    const e = novoEstado(), p = await abrir(e); try { const d = await enviar(p);
        for (const texto of ["Inválidas: 1", "Duplicadas: 1", "Ignoradas: 1"]) await expect(d.getByText(texto, { exact: true })).toBeVisible();
        await expect(d.getByText("Preço inválido.", { exact: true })).toBeVisible(); await expect(d.getByText(/Colunas ignoradas: Estoque Atual/)).toBeVisible();
        await expect(d.getByRole("row").filter({ hasText: "Café" })).toContainText("09011110");
        assert.equal(e.chamadas.filter(c => c.path.endsWith("/confirmar")).length, 0);
        const download = p.waitForEvent("download"); await d.getByRole("button", { name: "Baixar relatório de erros" }).click(); assert.equal((await download).suggestedFilename(), "erros-importacao-produtos.csv");
        await d.getByRole("button", { name: "Cancelar", exact: true }).click(); await expect(d).toHaveCount(0);
        assert.equal(e.chamadas.filter(c => c.path.endsWith("/cancelar")).length, 1);
        assert.equal(new URL(p.url()).searchParams.get("origem"), "consulta"); assert.ok(e.chamadas.every(c => c.auth === "Bearer teste" && !c.params.has("empresaId")));
    } finally { await p.close(); }
});
test("confirmação explícita bloqueia cliques durante gravação e recarrega Produtos", async () => {
    let liberar; const e = novoEstado(); e.esperar = new Promise(resolve => { liberar = resolve; }); const p = await abrir(e);
    try { const d = await enviar(p); await d.getByRole("button", { name: /^Confirmar 1 produto/ }).click();
        await expect(d.getByRole("button", { name: "Aguarde…" })).toBeDisabled(); await expect(d.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled();
        liberar(); await expect(d.getByText(/Importação confirmada: 1 produto/)).toBeVisible();
        assert.equal(e.chamadas.filter(c => c.path.endsWith("/confirmar")).length, 1);
        await d.getByRole("button", { name: "Voltar aos produtos" }).click(); await expect(d).toHaveCount(0);
        assert.ok(e.chamadas.filter(c => c.path === "/produtos").length >= 2); assert.ok(!e.chamadas.some(c => c.path.startsWith("/estoque")));
    } finally { liberar(); await p.close(); }
});
test("falha de confirmação preserva prévia e retry usa o mesmo lote", async () => {
    const e = novoEstado(); e.erroConfirmacao = true; const p = await abrir(e);
    try { const d = await enviar(p); await d.getByRole("button", { name: /^Confirmar 1 produto/ }).click();
        await expect(d.getByText(/O catálogo mudou após a prévia/)).toBeVisible(); await expect(d.getByText("Válidas: 1", { exact: true })).toBeVisible();
        e.erroConfirmacao = false; await d.getByRole("button", { name: /^Confirmar 1 produto/ }).click(); await expect(d.getByText(/Importação confirmada/)).toBeVisible();
        const chamadas = e.chamadas.filter(c => c.path.endsWith("/confirmar")); assert.equal(chamadas.length, 2); assert.equal(chamadas[0].path, chamadas[1].path);
    } finally { await p.close(); }
});
test("arquivo inválido ou grande é bloqueado e operador não vê ação administrativa", async () => {
    const e = novoEstado(); e.perfil = "OPERADOR"; const operador = await abrir(e);
    try { await expect(operador.getByRole("button", { name: "Importar Produtos", exact: true })).toHaveCount(0); } finally { await operador.close(); }
    const estado = novoEstado(), p = await abrir(estado); try {
        await p.getByRole("button", { name: "Importar Produtos", exact: true }).click(); const d = p.getByRole("dialog");
        await d.getByLabel("Arquivo de produtos").setInputFiles({ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
        await expect(d.getByText("Use um arquivo XLS, XLSX ou CSV.")).toBeVisible(); await expect(d.getByRole("button", { name: "Gerar prévia" })).toBeDisabled();
        await d.getByLabel("Arquivo de produtos").setInputFiles({ name: "a.xlsx", mimeType: "application/octet-stream", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
        await expect(d.getByText("O arquivo deve ter no máximo 2 MB.")).toBeVisible(); assert.equal(estado.chamadas.filter(c => c.path === "/produtos/importacoes").length, 0);
    } finally { await p.close(); }
});
test("desktop, notebook, mobile e janela baixa preservam foco e rolagem", async () => {
    for (const [width, height] of [[1440,900],[1366,768],[390,844],[390,320]]) {
        const e = novoEstado(), p = await abrir(e, { width, height }); const erros = []; p.on("pageerror", erro => erros.push(erro.message));
        try { const d = await enviar(p); const confirmar = d.getByRole("button", { name: /^Confirmar 1 produto/ });
            await confirmar.scrollIntoViewIfNeeded(); await confirmar.focus(); await expect(confirmar).toBeFocused();
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.ok(await d.evaluate(el => el.scrollWidth <= el.getBoundingClientRect().width + 1)); assert.deepEqual(erros, []);
            await p.screenshot({ path: `node_modules/.novexa-importacao-produtos-validation/previa-${width}-${height}.png` });
        } finally { await p.close(); }
    }
});
