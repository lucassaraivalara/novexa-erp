import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { novoRascunho, decimal, subtotalItem, totais, criarPedido, buscarProdutosPDV, decidirSessaoCaixa, moverIndiceProduto } = await server.ssrLoadModule("/src/pages/Vendas/pdv.ts");
await server.close();
const fontePDV = await readFile(new URL("../src/pages/Vendas/Vendas.tsx", import.meta.url), "utf8");
const fonteFinalizacao = await readFile(new URL("../src/pages/Vendas/VendaFinalizacaoDialog.tsx", import.meta.url), "utf8");
const produto = { id: 1, nome: "Café", precoVenda: 10.10, ativo: true, codigoBarras: "7890001", codigoInterno: "CAFE" };
const venda = () => ({ ...novoRascunho(), itens: [{ produto, quantidade: "2" }], recebido: "30" });

test("scanner prioriza código exato; nome ignora acentos; inativos não aparecem", () => {
    const outro = { ...produto, id: 2, nome: "7890001 oferta", codigoBarras: "outra", codigoInterno: "outro" };
    assert.equal(buscarProdutosPDV([outro, produto], "7890001")[0].id, 1);
    assert.equal(buscarProdutosPDV([produto], "cafe")[0].id, 1);
    assert.equal(buscarProdutosPDV([{ ...produto, ativo: false }], "7890001").length, 0);
    assert.deepEqual(buscarProdutosPDV([produto], ""), []);
    assert.deepEqual(buscarProdutosPDV([produto], "", true), [produto]);
});
test("setas navegam pela lista sem ultrapassar seus limites", () => {
    assert.equal(moverIndiceProduto(0, 3, "PROXIMO"), 1);
    assert.equal(moverIndiceProduto(1, 3, "PROXIMO"), 2);
    assert.equal(moverIndiceProduto(2, 3, "PROXIMO"), 2);
    assert.equal(moverIndiceProduto(2, 3, "ANTERIOR"), 1);
    assert.equal(moverIndiceProduto(0, 3, "ANTERIOR"), 0);
});
test("PDV conecta seleção, sequência de foco, Escape, F2 e F3", () => {
    assert.match(fontePDV, /if \(produto && !carregando\) adicionar\(produto\)/);
    assert.match(fontePDV, /quantidadesRef\.current\[produto\.id\]\?\.focus\(\)/);
    assert.match(fontePDV, /if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); focarBusca\(\); \}/);
    assert.match(fontePDV, /if \(listaAberta\).*setListaAberta\(false\)/s);
    assert.match(fontePDV, /if \(opcional\).*setOpcional\(null\)/s);
    assert.match(fontePDV, /navigate\("\/vendas"\)/);
    assert.match(fontePDV, /e\.key === "F2".*void finalizar\(\)/s);
    assert.match(fontePDV, /e\.key === "F3".*setOpcional\("desconto"\)/s);
});
test("finalização apresenta processamento, sucesso, erro e bloqueia envio duplicado", () => {
    assert.match(fonteFinalizacao, /"Finalizando venda"/);
    assert.match(fonteFinalizacao, /"Venda concluída"/);
    assert.match(fonteFinalizacao, /"Não foi possível concluir"/);
    assert.match(fonteFinalizacao, /CircularProgress/);
    assert.match(fonteFinalizacao, /CheckCircleRoundedIcon/);
    assert.match(fonteFinalizacao, /onTentarNovamente/);
    assert.match(fontePDV, /if \(emEnvio\.current\) return/);
    assert.match(fontePDV, /estado: "processing"/);
    assert.match(fontePDV, /estado: "success"/);
    assert.match(fontePDV, /estado: "error"/);
});
test("sucesso fecha em 1200 ms e devolve o foco somente depois do modal", () => {
    assert.match(fontePDV, /setTimeout\(\(\) => \{\s*setFinalizacao\(null\)/);
    assert.match(fontePDV, /\}, 1200\)/);
    assert.match(fontePDV, /!salvando && !finalizacao\) focarBusca\(\)/);
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

test("resolve zero, uma ou múltiplas sessões abertas conforme o fluxo do PDV", () => {
    const primeira = { sessaoId: 10, caixaId: 1, descricaoCaixa: "Caixa 1" };
    const segunda = { sessaoId: 20, caixaId: 2, descricaoCaixa: "Caixa 2" };
    assert.equal(decidirSessaoCaixa([]).fluxo, "ABRIR");
    assert.deepEqual(decidirSessaoCaixa([primeira]), { fluxo: "USAR_UNICA", sessao: primeira });
    assert.deepEqual(decidirSessaoCaixa([primeira, segunda]), {
        fluxo: "SELECIONAR", sessoes: [primeira, segunda],
    });
});

test("mantém a sessão no próximo rascunho e a envia na venda", () => {
    const rascunho = { ...venda(), sessaoCaixaId: 42 };
    assert.equal(criarPedido(rascunho, "chave").sessaoCaixaId, 42);
    assert.equal(novoRascunho(42).sessaoCaixaId, 42);
});
