import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { situacaoEstoque, novoSaldoEsperado } = await server.ssrLoadModule("/src/pages/Estoque/estoqueRegras.ts");
const { listarProdutosEstoque, registrarEntrada, registrarSaida, registrarAjuste, listarHistoricoProduto, obterMensagemEstoque } = await server.ssrLoadModule("/src/services/estoqueService.ts");
const apiModule = await server.ssrLoadModule("/src/services/api.ts");
const { AxiosError } = await server.ssrLoadModule("axios");
await server.close();

beforeEach(() => {
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    };
    apiModule.default.defaults.adapter = async (config) => ({
        config,
        status: 200,
        statusText: "OK",
        headers: {},
        data: config.url === "/produtos" ? [] : [],
    });
});

test("classifica estoque normal, baixo, zerado e sem controle", () => {
    assert.equal(situacaoEstoque({ controlaEstoque: true, estoqueAtual: 11, estoqueMinimo: 10 }), "NORMAL");
    assert.equal(situacaoEstoque({ controlaEstoque: true, estoqueAtual: 10, estoqueMinimo: 10 }), "BAIXO");
    assert.equal(situacaoEstoque({ controlaEstoque: true, estoqueAtual: 0, estoqueMinimo: 10 }), "ZERADO");
    assert.equal(situacaoEstoque({ controlaEstoque: false, estoqueAtual: 0, estoqueMinimo: 10 }), "SEM CONTROLE");
});

test("calcula entrada, saída e ajuste como novo saldo", () => {
    assert.equal(novoSaldoEsperado("ENTRADA", 10, 5), 15);
    assert.equal(novoSaldoEsperado("SAIDA", 10, 3), 7);
    assert.equal(novoSaldoEsperado("AJUSTE", 15, 12), 12);
});

test("serviço usa endpoints oficiais sem enviar empresa ou usuário", async () => {
    const chamadas = [];
    apiModule.default.defaults.adapter = async (config) => {
        chamadas.push({ url: config.url, method: config.method, data: config.data, params: config.params });
        return { config, status: 200, statusText: "OK", headers: {}, data: [] };
    };

    await listarProdutosEstoque();
    await registrarEntrada({ produtoId: 4, quantidade: 5, motivo: "Compra" });
    await registrarSaida({ produtoId: 4, quantidade: 2 });
    await registrarAjuste({ produtoId: 4, quantidade: 12 });
    await listarHistoricoProduto(4);

    assert.deepEqual(chamadas.map((chamada) => [chamada.method, chamada.url]), [
        ["get", "/produtos"],
        ["post", "/estoque/movimentacoes/entrada"],
        ["post", "/estoque/movimentacoes/saida"],
        ["post", "/estoque/movimentacoes/ajuste"],
        ["get", "/estoque/movimentacoes/produto/4"],
    ]);
    for (const chamada of chamadas) {
        assert.equal(chamada.params, undefined);
        if (chamada.data) {
            assert.equal(chamada.data.includes("empresaId"), false);
            assert.equal(chamada.data.includes("usuarioId"), false);
        }
    }
});

test("nova consulta de produtos retorna o saldo atualizado pela API", async () => {
    let consulta = 0;
    apiModule.default.defaults.adapter = async (config) => {
        consulta += 1;
        return {
            config, status: 200, statusText: "OK", headers: {},
            data: [{ id: 4, nome: "Produto", estoqueAtual: consulta === 1 ? 5 : 10 }],
        };
    };

    assert.equal((await listarProdutosEstoque())[0].estoqueAtual, 5);
    assert.equal((await listarProdutosEstoque())[0].estoqueAtual, 10);
    assert.equal(consulta, 2);
});

test("histórico preserva saldo, quantidade, motivo, usuário e data retornados pela API", async () => {
    const movimento = {
        id: 8, produtoId: 4, produtoNome: "Produto", tipo: "ENTRADA", origem: "MANUAL",
        quantidade: 5, saldoAnterior: 5, saldoPosterior: 10, motivo: "Compra",
        dataHora: "2026-09-14T10:00:00Z", usuarioId: 2, nomeUsuario: "Operador",
    };
    apiModule.default.defaults.adapter = async (config) => ({
        config, status: 200, statusText: "OK", headers: {}, data: [movimento],
    });

    assert.deepEqual(await listarHistoricoProduto(4), [movimento]);
});

test("erro de estoque insuficiente preserva a mensagem de negócio", () => {
    const erro = new AxiosError("Falha", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 409, statusText: "Conflict", headers: {}, data: "Estoque insuficiente: Produto.",
    });

    assert.equal(obterMensagemEstoque(erro, "Falha na movimentação."), "Estoque insuficiente: Produto.");
});