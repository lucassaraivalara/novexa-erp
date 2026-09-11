import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { novoRascunho, decimal, subtotalItem, totais, criarPedido, buscarProdutosPDV } = await server.ssrLoadModule("/src/pages/Vendas/pdv.ts");
await server.close();
const produto = { id: 1, nome: "Café", precoVenda: 10.10, ativo: true, codigoBarras: "7890001", codigoInterno: "CAFE" };
const venda = () => ({ ...novoRascunho(), itens: [{ produto, quantidade: "2" }], recebido: "30" });

test("scanner prioriza código exato; nome ignora acentos; inativos não aparecem", () => {
    const outro = { ...produto, id: 2, nome: "7890001 oferta", codigoBarras: "outra", codigoInterno: "outro" };
    assert.equal(buscarProdutosPDV([outro, produto], "7890001")[0].id, 1);
    assert.equal(buscarProdutosPDV([produto], "cafe")[0].id, 1);
    assert.equal(buscarProdutosPDV([{ ...produto, ativo: false }], "7890001").length, 0);
    assert.deepEqual(buscarProdutosPDV([produto], ""), []);
});
test("quantidade fracionada usa HALF_UP por item, inclusive meio centavo", () => {
    assert.equal(decimal("1,125", 3), 1125);
    assert.equal(subtotalItem({ produto: { ...produto, precoVenda: 0.01 }, quantidade: "0,5" }), 1);
    assert.equal(subtotalItem({ produto: { ...produto, precoVenda: 0.1 }, quantidade: "3" }), 30);
    for (const quantidade of ["", "0", "-1", "1,1234", "NaN", "1e3"]) assert.equal(subtotalItem({ produto, quantidade }), null);
});
test("desconto, total, pagamento e troco correspondem ao pedido sem empresa/preços editáveis", () => {
    const r = { ...venda(), desconto: "1,20" };
    assert.equal(totais(r).total, 1900);
    assert.equal(totais(r).troco, 1100);
    const pedido = criarPedido(r, "chave");
    assert.equal(pedido.totalEsperado, 19);
    assert.equal(pedido.valorRecebido, 30);
    assert.equal(pedido.itens[0].precoUnitarioEsperado, 10.1);
    assert.equal("empresaId" in pedido, false);
    assert.equal("usuarioId" in pedido, false);
    assert.equal(pedido.clienteId, null);
});
test("PIX e cartões usam o total exato e não carregam troco anterior", () => {
    for (const formaPagamento of ["PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"]) {
        const r = { ...venda(), formaPagamento };
        assert.equal(totais(r).troco, 0);
        assert.equal(criarPedido(r, "chave").valorRecebido, 20.2);
    }
});
test("bloqueia vazio, pagamento insuficiente, quantidade inválida e desconto excessivo", () => {
    assert.throws(() => criarPedido(novoRascunho(), "chave"), /Adicione/);
    assert.throws(() => criarPedido({ ...venda(), recebido: "1" }, "chave"), /recebido/);
    assert.throws(() => criarPedido({ ...venda(), desconto: "21" }, "chave"), /desconto/);
    assert.throws(() => criarPedido({ ...venda(), itens: [{ produto, quantidade: "0" }] }, "chave"), /quantidades/);
});
test("campos opcionais ficam no pedido somente com os valores escolhidos", () => {
    const pedido = criarPedido({ ...venda(), cliente: { id: 8 }, entrega: " Rua A ", observacoes: " Sem sacola " }, "chave");
    assert.equal(pedido.clienteId, 8);
    assert.equal(pedido.entrega, "Rua A");
    assert.equal(pedido.observacoes, "Sem sacola");
});
