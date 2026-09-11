import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@mui/material";
import { AxiosError } from "axios";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { default: PageHeader } = await server.ssrLoadModule("/src/components/ui/PageHeader.tsx");
const { salvarSessao, obterToken } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarClientes, salvarCliente, buscarCliente, mensagemCliente } = await server.ssrLoadModule("/src/services/clienteService.ts");
await server.close();

let redirecionamentos;
beforeEach(() => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    redirecionamentos = [];
    globalThis.window = { location: { assign: (url) => redirecionamentos.push(url) } };
    salvarSessao({ token: "token-atual", empresa: { id: 7 } });
});

function rejeitar(config, status, headers = {}) {
    throw new AxiosError("Falha da rota", "ERR_BAD_RESPONSE", config, undefined,
        { status, statusText: "Erro", config, headers, data: "Falha da rota" });
}

test("PageHeader renderiza apenas o botão recebido e preserva sua ação", () => {
    let cliques = 0;
    const acao = createElement(Button, { onClick: () => cliques++, variant: "contained" }, "Novo produto");
    const elemento = PageHeader({ titulo: "Produtos", acaoPrincipal: acao });
    const html = renderToStaticMarkup(elemento);
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    assert.equal((html.match(/<\/button>/g) ?? []).length, 1);
    assert.match(html, /Novo produto/);
    // A ação recebida continua sendo a instância renderizada pelo cabeçalho.
    const acoes = elemento.props.children[1].props.children;
    assert.ok(acoes.includes(acao));
    acoes.find((filho) => filho === acao).props.onClick();
    assert.equal(cliques, 1);
});

for (const status of [401, 403, 500]) {
    test(`falha pontual ${status} é propagada à tela sem encerrar a sessão`, async () => {
        api.defaults.adapter = async (config) => rejeitar(config, status, { "www-authenticate": "Bearer" });
        await assert.rejects(listarClientes(7), (erro) => {
            assert.equal(erro.response.status, status);
            assert.ok(mensagemCliente(erro, "Não foi possível carregar os clientes."));
            if (status === 401) assert.match(mensagemCliente(erro, ""), /operação em Clientes/);
            return true;
        });
        assert.equal(obterToken(), "token-atual");
        assert.deepEqual(redirecionamentos, []);
    });
}

test("rejeição explícita do token atual encerra a sessão", async () => {
    api.defaults.adapter = async (config) => rejeitar(config, 401,
        { "www-authenticate": 'Bearer error="invalid_token"' });
    await assert.rejects(api.get("/clientes"));
    assert.equal(obterToken(), null);
    assert.deepEqual(redirecionamentos, ["/login"]);
});

test("resposta atrasada de um token antigo não encerra um novo login", async () => {
    api.defaults.adapter = async (config) => {
        salvarSessao({ token: "token-novo", empresa: { id: 7 } });
        return rejeitar(config, 401, { "www-authenticate": 'Bearer error="invalid_token"' });
    };
    await assert.rejects(api.get("/clientes"));
    assert.equal(obterToken(), "token-novo");
    assert.deepEqual(redirecionamentos, []);
});

test("401 do login não dispara logout global", async () => {
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.Authorization, undefined);
        return rejeitar(config, 401, { "www-authenticate": 'Bearer error="invalid_token"' });
    };
    await assert.rejects(api.post("/auth/login", {}));
    assert.equal(obterToken(), "token-atual");
    assert.deepEqual(redirecionamentos, []);
});

test("listar, criar, buscar e editar clientes enviam o mesmo Bearer e preservam a sessão", async () => {
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.Authorization, "Bearer token-atual");
        chamadas.push(`${config.method} ${config.url}`);
        const dados = config.data ? JSON.parse(config.data) : {};
        return { config, status: config.method === "post" ? 201 : 200, statusText: "OK", headers: {},
            data: config.url === "/clientes" && config.method === "get" ? [] : { id: 1, ...dados } };
    };
    assert.deepEqual(await listarClientes(7), []);
    const novo = await salvarCliente({ nome: "Cliente", tipoPessoa: "FISICA" });
    await buscarCliente(novo.id, 7);
    assert.equal((await salvarCliente({ nome: "Cliente editado" }, novo.id)).nome, "Cliente editado");
    assert.deepEqual(chamadas, ["get /clientes", "post /clientes", "get /clientes/1", "put /clientes/1"]);
    assert.equal(obterToken(), "token-atual");
    assert.deepEqual(redirecionamentos, []);
});
