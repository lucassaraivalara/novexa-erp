import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarContasPagar, salvarContaPagar, pagarConta, cancelarConta, estornarConta } =
    await server.ssrLoadModule("/src/services/contaPagarService.ts");
const { emAberto, filtrarContas, resumirContas } =
    await server.ssrLoadModule("/src/pages/Financeiro/contaPagarCalculos.ts");
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
    const dados = { descricao: "Aluguel", documento: "NF-42", fornecedorId: null, categoria: null, dataEmissao: null,
        dataVencimento: "2026-10-10", valor: 200, observacao: null };

    await listarContasPagar();
    await salvarContaPagar(dados);
    await salvarContaPagar(dados, 42);
    await pagarConta(42, { contaFinanceiraId: 1, dataPagamento: "2026-10-01", valorPago: 200 });
    await cancelarConta(42);
    await estornarConta(42);

    assert.deepEqual(chamadas.map(({ method, url }) => [method, url]), [
        ["get", "/financeiro/contas-pagar"], ["post", "/financeiro/contas-pagar"],
        ["put", "/financeiro/contas-pagar/42"], ["post", "/financeiro/contas-pagar/42/pagar"],
        ["post", "/financeiro/contas-pagar/42/cancelar"], ["post", "/financeiro/contas-pagar/42/estornar"],
    ]);
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-financeiro"));
    assert.deepEqual(JSON.parse(chamadas[1].data), dados);
    assert.deepEqual(JSON.parse(chamadas[3].data), { contaFinanceiraId: 1, dataPagamento: "2026-10-01", valorPago: 200 });
    assert.ok(chamadas.every(({ data }) => !data || !Object.hasOwn(JSON.parse(data), "empresaId")));
});

test("resumos, saldo e filtros financeiros respeitam datas e estados", () => {
    const base = { fornecedorId: 10, fornecedorNome: "Aço Sul", categoria: "Insumos",
        dataEmissao: "2026-09-01", valorPago: null, dataPagamento: null, status: "ABERTA" };
    const contas = [
        { ...base, id: 1, descricao: "Aço", documento: "NF-01", dataVencimento: "2026-09-28", valor: 100 },
        { ...base, id: 2, descricao: "Frete", documento: "DOC-2", dataVencimento: "2026-10-06", valor: 200 },
        { ...base, id: 3, descricao: "Serviço", documento: null, dataEmissao: null, dataVencimento: "2026-10-29", valor: 300 },
        { ...base, id: 4, descricao: "Quitada", documento: "NF-04", dataVencimento: "2026-09-01",
            valor: 400, status: "PAGA", valorPago: 400, dataPagamento: "2026-09-20" },
        { ...base, id: 5, descricao: "Cancelada", documento: null, dataVencimento: "2026-09-01",
            valor: 500, status: "CANCELADA" },
    ];
    assert.deepEqual(resumirContas(contas, "2026-09-29"), {
        vencidas: { total: 100, quantidade: 1 }, seteDias: { total: 200, quantidade: 1 },
        trintaDias: { total: 500, quantidade: 2 }, emAberto: { total: 600, quantidade: 3 },
        pagasMes: { total: 400, quantidade: 1 },
    });
    assert.equal(emAberto(contas[4]), 0);
    const filtros = { busca: "nf-01", status: "ABERTA", fornecedor: "10", categoria: "Insumos",
        vencimentoDe: "2026-09-28", vencimentoAte: "2026-09-28", emissaoDe: "2026-09-01", emissaoAte: "2026-09-01" };
    assert.deepEqual(filtrarContas(contas, filtros).map((conta) => conta.id), [1]);
    assert.deepEqual(filtrarContas(contas, { ...filtros, busca: "serviço", vencimentoAte: "2026-10-30",
        emissaoDe: "", emissaoAte: "" }).map((conta) => conta.id), [3]);
});
