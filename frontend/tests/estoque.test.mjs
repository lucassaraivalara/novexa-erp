import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { situacaoEstoque, novoSaldoEsperado } = await server.ssrLoadModule("/src/pages/Estoque/estoqueRegras.ts");
const { listarProdutosEstoque, registrarEntrada, registrarSaida, registrarAjuste, listarHistoricoProduto } = await server.ssrLoadModule("/src/services/estoqueService.ts");
const apiModule = await server.ssrLoadModule("/src/services/api.ts");
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