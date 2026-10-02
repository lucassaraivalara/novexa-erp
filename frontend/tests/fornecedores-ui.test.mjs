import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server;
let browser;
let url;

const fixtures = {
    "/__area": "import ProdutosArea from '/src/pages/Produtos/ProdutosArea.tsx'; const Pagina = ProdutosArea;",
    "/__rapido": `import { useState } from 'react';
        import FornecedorForm from '/src/components/fornecedores/FornecedorForm.tsx';
        import FornecedorAutocomplete from '/src/components/fornecedores/FornecedorAutocomplete.tsx';
        function Pagina() {
            const [aberto, setAberto] = useState(false);
            const [fornecedor, setFornecedor] = useState(null);
            window.__selecionado = fornecedor;
            return React.createElement('div', null,
                React.createElement('button', { onClick: () => setAberto(true) }, 'Abrir cadastro rápido'),
                React.createElement(FornecedorAutocomplete, { value: fornecedor, onChange: setFornecedor }),
                aberto && React.createElement(FornecedorForm, { modo: 'rapido', onFechar: () => setAberto(false),
                    onSalvo: (f) => { window.__salvo = f; setFornecedor(f); setAberto(false); } }));
        }`,
};
const montagem = (corpo) => `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '/src/theme/theme.ts';
${corpo}
createRoot(document.getElementById('root')).render(
    React.createElement(ThemeProvider, { theme }, React.createElement(CssBaseline), React.createElement(Pagina)));
`;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

const completo = (id, extra = {}) => ({
    id, razaoSocial: `Fornecedor ${String(id).padStart(2, "0")}`, nomeFantasia: null, cpfCnpj: null, telefone: null, ativo: true,
    email: null, inscricaoEstadual: "123456", endereco: "Rua antiga", cep: null, logradouro: null, numero: null,
    complemento: null, bairro: null, cidade: "Curitiba", uf: "PR", observacao: null, ...extra,
});

before(async () => {
    server = await createServer({
        cacheDir: "node_modules/.vite-fornecedores-ui-tests",
        server: { host: "127.0.0.1", port: 0, hmr: false },
        plugins: [{
            name: "fornecedores-fixture",
            resolveId(id) { if (id.startsWith("/fixture-")) return `\0${id}`; },
            load(id) {
                if (id.startsWith("\0/fixture-")) {
                    const rota = `/__${id.slice("\0/fixture-".length).replace(".js", "")}`;
                    return montagem(fixtures[rota]);
                }
            },
            configureServer(vite) {
                for (const rota of Object.keys(fixtures)) {
                    vite.middlewares.use(rota, async (_req, res) => {
                        res.setHeader("Content-Type", "text/html");
                        res.end(await vite.transformIndexHtml(rota, `<div id="root"></div><script type="module" src="/fixture-${rota.slice(3)}.js"></script>`));
                    });
                }
            },
        }],
    });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

const esperar = async (condicao) => {
    for (let i = 0; i < 100 && !condicao(); i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(condicao(), "condição não atendida a tempo");
};

async function abrir(rota, estado) {
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem("novexa-auth", JSON.stringify({ token: "t", perfil: "ADMIN", empresa: { id: 1 } })));
    await page.route("http://localhost:8080/**", async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
        const responder = (status, data) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
        const corpo = req.postData() ? JSON.parse(req.postData()) : null;
        estado.chamadas.push({ metodo: req.method(), caminho: u.pathname, params: u.searchParams, corpo });
        if (u.pathname === "/fornecedores" && req.method() === "GET") {
            const termo = u.searchParams.get("termo");
            if (termo === "zz") return responder(200, { items: [completo(99, { razaoSocial: "Resultado do servidor" })], page: 0, size: 25, totalItems: 1, totalPages: 1 });
            const size = Number(u.searchParams.get("size")); const pagina = Number(u.searchParams.get("page"));
            const itens = estado.fornecedores;
            return responder(200, { items: itens.slice(pagina * size, pagina * size + size), page: pagina, size, totalItems: itens.length, totalPages: Math.ceil(itens.length / size) });
        }
        if (u.pathname === "/fornecedores" && req.method() === "POST") {
            if (estado.duplicado) return responder(409, "CPF ou CNPJ ja cadastrado para um fornecedor desta empresa.");
            return responder(201, completo(500, { ...corpo, ativo: true }));
        }
        const porId = u.pathname.match(/^\/fornecedores\/(\d+)$/);
        if (porId) {
            const atual = estado.fornecedores.find((f) => f.id === Number(porId[1]));
            if (req.method() === "GET") return responder(200, atual);
            if (req.method() === "PUT") return responder(200, { ...atual, ...corpo });
            if (req.method() === "DELETE") return route.fulfill({ status: 204, headers: cors });
        }
        if (u.pathname === "/fornecedores/buscar") return responder(200, estado.fornecedores.filter((f) => f.ativo).slice(0, 3));
        return responder(200, u.pathname === "/produtos" ? { items: [], page: 0, size: 25, totalItems: 0, totalPages: 0 } : []);
    });
    await page.goto(`${url}/__${rota}`);
    return page;
}
const novoEstado = (quantidade = 30) => ({
    chamadas: [], duplicado: false,
    fornecedores: Array.from({ length: quantidade }, (_, i) => completo(i + 1, i === 4 ? { ativo: false } : {})),
});
const listagens = (estado) => estado.chamadas.filter((c) => c.metodo === "GET" && c.caminho === "/fornecedores");

test("aba Produtos continua padrão, aba Fornecedores usa listagem paginada do backend", async () => {
    const estado = novoEstado(); const page = await abrir("area", estado);
    try {
        await page.getByRole("heading", { name: "Produtos" }).waitFor();
        assert.ok(estado.chamadas.some((c) => c.caminho === "/produtos"));
        assert.equal(listagens(estado).length, 0);
        await page.getByRole("tab", { name: "Fornecedores" }).click();
        await page.getByText("Fornecedor 01").waitFor();
        const primeira = listagens(estado)[0].params;
        assert.equal(primeira.get("page"), "0"); assert.equal(primeira.get("size"), "25");
        assert.equal(primeira.get("sort"), "razaoSocial,asc");
        assert.equal(await page.getByText("Fornecedor 26").count(), 0);
        for (const coluna of ["Nome / Razão Social", "Nome Fantasia", "CPF/CNPJ", "Telefone", "Cidade/UF", "Status"])
            assert.ok(await page.getByRole("columnheader", { name: new RegExp(coluna) }).count() > 0, coluna);
    } finally { await page.close(); }
});

test("busca, status, paginação e ordenação são enviados ao backend", async () => {
    const estado = novoEstado(); const page = await abrir("area", estado);
    try {
        await page.getByRole("tab", { name: "Fornecedores" }).click();
        await page.getByText("Fornecedor 01").waitFor();
        await page.getByRole("button", { name: "Próxima página" }).click();
        await esperar(() => listagens(estado).some((c) => c.params.get("page") === "1"));
        await page.getByRole("textbox", { name: "Buscar fornecedor…" }).fill("zz");
        await esperar(() => listagens(estado).some((c) => c.params.get("termo") === "zz" && c.params.get("page") === "0"));
        await page.getByText("Resultado do servidor").waitFor();
        await page.getByRole("textbox", { name: "Buscar fornecedor…" }).fill("");
        await page.getByLabel("Status").click();
        await page.getByRole("option", { name: "Ativos", exact: true }).click();
        await esperar(() => listagens(estado).some((c) => c.params.get("ativo") === "true" && c.params.get("page") === "0"));
        await page.getByRole("columnheader", { name: /Nome \/ Razão Social/ }).getByText("Nome / Razão Social").click();
        await esperar(() => listagens(estado).some((c) => c.params.get("sort") === "razaoSocial,desc"));
    } finally { await page.close(); }
});

test("cria fornecedor mínimo e completo, edita preservando campos ocultos", async () => {
    const estado = novoEstado(3); const page = await abrir("area", estado);
    try {
        await page.getByRole("tab", { name: "Fornecedores" }).click();
        await page.getByRole("button", { name: "Novo fornecedor" }).first().click();
        await page.getByLabel("Razão Social / Nome").fill("Só Nome");
        await page.getByRole("button", { name: "Salvar fornecedor" }).click();
        await esperar(() => estado.chamadas.some((c) => c.metodo === "POST"));
        const minimo = estado.chamadas.find((c) => c.metodo === "POST").corpo;
        assert.equal(minimo.razaoSocial, "Só Nome"); assert.equal(minimo.cpfCnpj, null); assert.equal(minimo.email, null);

        await page.getByRole("button", { name: "Novo fornecedor" }).first().click();
        await page.getByLabel("Razão Social / Nome").fill("Completo Ltda");
        await page.getByLabel("CPF/CNPJ").fill("11222333000181");
        await page.getByLabel("E-mail").fill("a@b.com");
        await page.getByLabel("Cidade").fill("Maringá");
        await page.getByLabel("UF").fill("pr");
        await page.getByLabel("Observação").fill("Entrega às terças");
        await page.getByRole("button", { name: "Salvar fornecedor" }).click();
        await esperar(() => estado.chamadas.filter((c) => c.metodo === "POST").length === 2);
        const cheio = estado.chamadas.filter((c) => c.metodo === "POST")[1].corpo;
        assert.equal(cheio.cpfCnpj, "11.222.333/0001-81"); assert.equal(cheio.uf, "PR");
        assert.equal(cheio.email, "a@b.com"); assert.equal(cheio.observacao, "Entrega às terças");

        await page.getByRole("row").filter({ hasText: "Fornecedor 02" }).getByRole("button", { name: "Editar fornecedor" }).click();
        await page.getByLabel("Razão Social / Nome").fill("Fornecedor Editado");
        await page.getByRole("button", { name: "Salvar fornecedor" }).click();
        await esperar(() => estado.chamadas.some((c) => c.metodo === "PUT"));
        const put = estado.chamadas.find((c) => c.metodo === "PUT");
        assert.equal(put.caminho, "/fornecedores/2"); assert.equal(put.corpo.razaoSocial, "Fornecedor Editado");
        assert.equal(put.corpo.inscricaoEstadual, "123456"); assert.equal(put.corpo.endereco, "Rua antiga");
    } finally { await page.close(); }
});

test("inativa com confirmação e reativa; CPF/CNPJ duplicado mostra mensagem clara", async () => {
    const estado = novoEstado(5); const page = await abrir("area", estado);
    try {
        await page.getByRole("tab", { name: "Fornecedores" }).click();
        await page.getByRole("row").filter({ hasText: "Fornecedor 01" }).getByRole("button", { name: "Inativar fornecedor" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Inativar" }).click();
        await esperar(() => estado.chamadas.some((c) => c.metodo === "DELETE" && c.caminho === "/fornecedores/1"));

        await page.getByRole("row").filter({ hasText: "Fornecedor 05" }).getByRole("button", { name: "Reativar fornecedor" }).click();
        await esperar(() => estado.chamadas.some((c) => c.metodo === "PUT" && c.caminho === "/fornecedores/5"));
        assert.equal(estado.chamadas.find((c) => c.metodo === "PUT").corpo.ativo, true);

        estado.duplicado = true;
        await page.getByRole("button", { name: "Novo fornecedor" }).first().click();
        await page.getByLabel("Razão Social / Nome").fill("Repetido");
        await page.getByLabel("CPF/CNPJ").fill("11222333000181");
        await page.getByRole("button", { name: "Salvar fornecedor" }).click();
        await page.getByText("Já existe um fornecedor com este CPF/CNPJ.").waitFor();
    } finally { await page.close(); }
});

test("cadastro rápido mostra só o essencial, devolve o criado em onSalvo e o autocomplete é remoto", async () => {
    const estado = novoEstado(); const page = await abrir("rapido", estado);
    try {
        await esperar(() => estado.chamadas.some((c) => c.caminho === "/fornecedores/buscar"));
        await page.getByRole("button", { name: "Abrir cadastro rápido" }).click();
        const dialogo = page.getByRole("dialog");
        for (const rotulo of ["Razão Social / Nome", "CPF/CNPJ", "Telefone", "Nome Fantasia"]) assert.equal(await dialogo.getByLabel(rotulo).count(), 1, rotulo);
        for (const rotulo of ["E-mail", "CEP", "Logradouro", "Observação"]) assert.equal(await dialogo.getByLabel(rotulo).count(), 0, rotulo);
        await dialogo.getByLabel("Razão Social / Nome").fill("Rápido SA");
        await dialogo.getByRole("button", { name: "Cadastrar e selecionar" }).click();
        await page.waitForFunction(() => window.__salvo?.id === 500);
        assert.equal(await page.evaluate(() => window.__selecionado?.razaoSocial), "Rápido SA");
        assert.equal(estado.chamadas.filter((c) => c.metodo === "POST")[0].corpo.razaoSocial, "Rápido SA");
        assert.equal(listagens(estado).length, 0);
    } finally { await page.close(); }
});

test("não há item de menu nem filtro local para fornecedores", async () => {
    const navegacao = await readFile(new URL("../src/routes/navigation.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(navegacao, /fornecedor/i);
    const pagina = await readFile(new URL("../src/pages/Produtos/Fornecedores.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(pagina, /(fornecedores|linhas|items)\.(filter|sort|slice)\(/);
    assert.doesNotMatch(pagina, /axios|api\./);
});
