import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { buscarResumoDashboard } = await server.ssrLoadModule("/src/services/dashboardService.ts");
await server.close();

test("consulta o resumo operacional no endpoint existente", async () => {
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const esperado = {
        faturamentoHoje: 150,
        quantidadeVendasHoje: 2,
        ticketMedioHoje: 75,
        quantidadeProdutosEstoqueBaixo: 3,
        quantidadeClientesAtivos: 8,
        sessoesCaixaAbertas: [],
    };
    api.defaults.adapter = async config => {
        assert.equal(config.method, "get");
        assert.equal(config.url, "/dashboard/resumo");
        return { config, status: 200, statusText: "OK", headers: {}, data: esperado };
    };
    assert.deepEqual(await buscarResumoDashboard(), esperado);
});

test("dashboard exibe indicadores reais, caixa e no máximo cinco vendas", async () => {
    const fonte = await readFile(new URL("../src/pages/Dashboard/Dashboard.tsx", import.meta.url), "utf8");
    for (const texto of ["Faturamento hoje", "Vendas hoje", "Ticket médio hoje", "Estoque baixo", "Clientes ativos",
        "Nenhum caixa aberto", "Últimas vendas", "Ver todas"]) assert.match(fonte, new RegExp(texto));
    assert.match(fonte, /vendas\.slice\(0, 5\)/);
    assert.doesNotMatch(fonte, /será implementado|Top produtos|Contas a receber \/ pagar|Faturamento por período/);
});
