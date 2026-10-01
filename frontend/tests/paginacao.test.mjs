import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { default: AppTable } = await server.ssrLoadModule("/src/components/ui/AppTable.tsx");
const { listarClientesPaginado } = await server.ssrLoadModule("/src/services/clienteService.ts");
const { listarProdutosPaginado } = await server.ssrLoadModule("/src/services/produtoService.ts");
const { listarVendasPaginado } = await server.ssrLoadModule("/src/services/vendaService.ts");
const { listarContasPagar } = await server.ssrLoadModule("/src/services/contaPagarService.ts");
const { listarMovimentacoesFinanceiras, listarTransferenciasFinanceiras } = await server.ssrLoadModule("/src/services/contaFinanceiraService.ts");
const { listarHistoricoProduto } = await server.ssrLoadModule("/src/services/estoqueService.ts");
await server.close();

test("sete services preservam items e totalItems e enviam parametros remotos", async () => {
    globalThis.localStorage = { getItem: () => null };
    const resposta = { items: [{ id: 7 }], page: 1, size: 10, totalItems: 35, totalPages: 4 };
    const chamadas = [];
    api.defaults.adapter = async config => {
        chamadas.push(config);
        return { config, status: 200, statusText: "OK", headers: {}, data: resposta };
    };
    const filtros = { page: 1, size: 10, sort: "id,desc" };
    for (const resultado of [
        await listarClientesPaginado({ busca: "abc", campoBusca: "nome", situacao: "ativos" }, 1, 10, "id,desc"),
        await listarProdutosPaginado({ ...filtros, campoBusca: "codigoBarras", busca: "789", situacaoEstoque: "baixo" }),
        await listarVendasPaginado({ status: "FATURADA", clienteId: 2 }, 1, 10, "id,desc"),
        await listarContasPagar({ ...filtros, fornecedor: 2, categoria: "Aluguel", vencimentoDe: "2026-10-01" }),
        await listarMovimentacoesFinanceiras({ ...filtros, contaFinanceiraId: 2, tipo: "ENTRADA", origem: "MANUAL", estornada: false }),
        await listarHistoricoProduto(2, { ...filtros, tipo: "SAIDA", origem: "VENDA" }),
        await listarTransferenciasFinanceiras({ ...filtros, contaOrigemId: 2, contaDestinoId: 3, status: "CONCLUIDA" }),
    ]) assert.deepEqual(resultado, resposta);
    for (const config of chamadas) {
        assert.equal(config.params.page, 1); assert.equal(config.params.size, 10);
        assert.equal(config.params.sort, "id,desc"); assert.equal(config.params.empresaId, undefined);
    }
    assert.equal(chamadas[6].params.contaDestinoId, 3);
});

test("tabela remota conserva ordem do banco inclusive nulos e collation", () => {
    const html = renderToStaticMarkup(React.createElement(AppTable, {
        colunas: [{ campo: "nome", cabecalho: "Nome", ordenavel: true }],
        linhas: [{ id: 1, nome: "Zulu" }, { id: 2, nome: "Alfa" }], obterChaveLinha: item => item.id,
        ordenacaoRemota: true, ordenacao: { campo: "nome", direcao: "asc", onSort() {} },
    }));
    assert.ok(html.indexOf("Zulu") < html.indexOf("Alfa"));
});

test("telas migradas nao filtram ou paginam o universo carregado", async () => {
    for (const caminho of ["Clientes/Clientes", "Produtos/Produtos", "Vendas/CentralVendas", "Estoque/Estoque",
        "Financeiro/ContasPagar", "Financeiro/ExtratoFinanceiroDrawer"]) {
        const fonte = await readFile(new URL(`../src/pages/${caminho}.tsx`, import.meta.url), "utf8");
        assert.doesNotMatch(fonte, /\.slice\(|\.sort\(/);
        assert.match(fonte, /ordenacaoRemota/); assert.match(fonte, /totalItems/);
    }
});
