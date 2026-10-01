import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarContasFinanceiras, salvarContaFinanceira, alterarSituacaoContaFinanceira,
    listarMovimentacoesFinanceiras, criarMovimentacaoFinanceira, estornarMovimentacaoFinanceira,
    criarTransferenciaFinanceira, listarTransferenciasFinanceiras, estornarTransferenciaFinanceira } =
    await server.ssrLoadModule("/src/services/contaFinanceiraService.ts");
const { descricaoMovimentacaoFinanceira } = await server.ssrLoadModule("/src/types/contaFinanceira.ts");
await server.close();

test("contas financeiras e movimentos usam o token sem enviar empresa ou usuario", async () => {
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

    await listarContasFinanceiras();
    await salvarContaFinanceira({ nome: "Banco", tipo: "BANCO", saldoInicial: 100, contaBancariaId: 7 });
    await salvarContaFinanceira({ nome: "Banco novo", tipo: "BANCO", contaBancariaId: 7 }, 42);
    await alterarSituacaoContaFinanceira(42, false);
    await listarMovimentacoesFinanceiras({ contaFinanceiraId: 42, page: 1, size: 25, sort: "valor,desc" });
    await criarMovimentacaoFinanceira({ contaFinanceiraId: 42, tipo: "ENTRADA", descricao: "Aporte",
        valor: 20, dataMovimento: "2026-09-29", observacao: null });
    await estornarMovimentacaoFinanceira(9, "Lançamento incorreto");
    const transferencia = { chaveRequisicao: crypto.randomUUID(), contaOrigemId: 42, contaDestinoId: 43,
        valor: 20, dataMovimento: "2026-09-30", observacao: "Reserva" };
    await criarTransferenciaFinanceira(transferencia);
    await listarTransferenciasFinanceiras();
    await estornarTransferenciaFinanceira(10, "Correção");

    assert.deepEqual(chamadas.map(({ method, url }) => [method, url]), [
        ["get", "/financeiro/contas-financeiras"], ["post", "/financeiro/contas-financeiras"],
        ["put", "/financeiro/contas-financeiras/42"], ["patch", "/financeiro/contas-financeiras/42/situacao"],
        ["get", "/financeiro/movimentacoes-financeiras"], ["post", "/financeiro/movimentacoes-financeiras"],
        ["patch", "/financeiro/movimentacoes-financeiras/9/estorno"],
        ["post", "/financeiro/transferencias"], ["get", "/financeiro/transferencias"],
        ["post", "/financeiro/transferencias/10/estornar"],
    ]);
    assert.equal(chamadas[4].params.contaFinanceiraId, 42);
    assert.equal(chamadas[4].params.page, 1);
    assert.equal(chamadas[4].params.sort, "valor,desc");
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-financeiro"));
    assert.ok(chamadas.every(({ data }) => !data ||
        (!Object.hasOwn(JSON.parse(data), "empresaId") && !Object.hasOwn(JSON.parse(data), "usuarioId"))));
    assert.deepEqual(JSON.parse(chamadas[1].data), { nome: "Banco", tipo: "BANCO", saldoInicial: 100, contaBancariaId: 7 });
    assert.deepEqual(JSON.parse(chamadas[2].data), { nome: "Banco novo", tipo: "BANCO", contaBancariaId: 7 });
    assert.deepEqual(JSON.parse(chamadas[7].data), transferencia);
    assert.deepEqual(JSON.parse(chamadas[9].data), { motivoEstorno: "Correção" });
});

test("extrato identifica direção e contraparte da transferência", () => {
    assert.equal(descricaoMovimentacaoFinanceira({ origem: "TRANSFERENCIA", tipo: "SAIDA", contaContraparteNome: "Nubank" }),
        "Transferência enviada para Nubank");
    assert.equal(descricaoMovimentacaoFinanceira({ origem: "TRANSFERENCIA", tipo: "ENTRADA", contaContraparteNome: "Sicredi" }),
        "Transferência recebida de Sicredi");
    assert.equal(descricaoMovimentacaoFinanceira({ origem: "TRANSFERENCIA", tipo: "SAIDA" }), "Transferência enviada");
    assert.equal(descricaoMovimentacaoFinanceira({ origem: "SALDO_INICIAL", descricao: "Saldo inicial" }), "Saldo inicial");
});
