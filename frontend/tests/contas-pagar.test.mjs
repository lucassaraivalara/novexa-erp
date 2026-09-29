import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarContasPagar, salvarContaPagar, pagarConta, cancelarConta, estornarConta } =
    await server.ssrLoadModule("/src/services/contaPagarService.ts");
await server.close();

test("contas a pagar usam o token e enviam somente os dados do título", async () => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    globalThis.window = { location: { assign() {} } };
    salvarSessao({ token: "token-financeiro", empresa: { id: 7 } });
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };
    const dados = { descricao: "Aluguel", fornecedorId: null, categoria: null, dataEmissao: null,
        dataVencimento: "2026-10-10", valor: 200, observacao: null };

    await listarContasPagar();
    await salvarContaPagar(dados);
    await salvarContaPagar(dados, 42);
    await pagarConta(42, { dataPagamento: "2026-10-01", valorPago: 200 });
    await cancelarConta(42);
    await estornarConta(42);

    assert.deepEqual(chamadas.map(({ method, url }) => [method, url]), [
        ["get", "/financeiro/contas-pagar"], ["post", "/financeiro/contas-pagar"],
        ["put", "/financeiro/contas-pagar/42"], ["post", "/financeiro/contas-pagar/42/pagar"],
        ["post", "/financeiro/contas-pagar/42/cancelar"], ["post", "/financeiro/contas-pagar/42/estornar"],
    ]);
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-financeiro"));
    assert.deepEqual(JSON.parse(chamadas[1].data), dados);
    assert.ok(chamadas.every(({ data }) => !data || !Object.hasOwn(JSON.parse(data), "empresaId")));
});
