import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { novoRascunho, carregarRascunhoSalvo, salvarRascunho, decimal, normalizarValorMonetario, formatarValorMonetario, subtotalItem, totais, criarPedido, encontrarProdutoPorCodigo, decidirSessaoCaixa, moverIndiceProduto } = await server.ssrLoadModule("/src/pages/Vendas/pdv.ts");
await server.close();
const fontePDV = await readFile(new URL("../src/pages/Vendas/Vendas.tsx", import.meta.url), "utf8");
const fonteFinalizacao = await readFile(new URL("../src/pages/Vendas/VendaFinalizacaoDialog.tsx", import.meta.url), "utf8");
const produto = { id: 1, nome: "Café", precoVenda: 10.10, ativo: true, codigoBarras: "7890001", codigoInterno: "CAFE" };
const venda = () => ({ ...novoRascunho(), itens: [{ produto, quantidade: "2" }], recebido: "30", configuracaoFormaPagamentoId: 42 });

test("storage restaura somente venda em andamento da sessao correta e elimina rascunhos vazios", () => {
    const anterior = globalThis.sessionStorage;
    const dados = new Map();
    globalThis.sessionStorage = { getItem: chave => dados.get(chave) ?? null, setItem: (chave, valor) => dados.set(chave, valor), removeItem: chave => dados.delete(chave) };
    try {
        const rascunho = { ...venda(), sessaoCaixaId: 10 };
        salvarRascunho("atual", rascunho);
        assert.deepEqual(carregarRascunhoSalvo("atual", 10), rascunho);
        assert.deepEqual(carregarRascunhoSalvo("atual", 11), novoRascunho(11));
        assert.deepEqual(carregarRascunhoSalvo("outra-empresa", 10), novoRascunho(10));
        dados.set("legada", JSON.stringify(rascunho));
        assert.deepEqual(carregarRascunhoSalvo("nova", 10, "legada"), rascunho);
        salvarRascunho("atual", novoRascunho(10));
        assert.equal(dados.has("atual"), false);
        dados.set("atual", JSON.stringify({ ...novoRascunho(10), cliente: { id: 8 }, desconto: "5" }));
        assert.deepEqual(carregarRascunhoSalvo("atual", 10), novoRascunho(10));
        dados.set("atual", JSON.stringify({ ...rascunho, pendente: { sessaoCaixaId: 11 } }));
        assert.deepEqual(carregarRascunhoSalvo("atual", 10), novoRascunho(10));
        dados.set("atual", "invalido");
        assert.deepEqual(carregarRascunhoSalvo("atual", 10), novoRascunho(10));
    } finally { if (anterior === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = anterior; }
});

test("entrada monetaria brasileira preserva reais inteiros, centavos e formato exibido", () => {
    for (const [entrada, interno, exibido] of [
        ["1", "1.00", "1,00"], ["2", "2.00", "2,00"], ["2,5", "2.50", "2,50"],
        ["2,50", "2.50", "2,50"], ["10", "10.00", "10,00"], ["1000", "1000.00", "1.000,00"],
        ["1.000,50", "1000.50", "1.000,50"], ["3", "3.00", "3,00"], ["3,5", "3.50", "3,50"],
        ["3,50", "3.50", "3,50"], ["3.50", "3.50", "3,50"], ["1.000,00", "1000.00", "1.000,00"],
        ["1.000", "1000.00", "1.000,00"], ["120", "120.00", "120,00"], ["0", "0.00", "0,00"],
        ["3,", "3.00", "3,00"], ["3.", "3.00", "3,00"], ["", "", ""],
    ]) {
        assert.equal(normalizarValorMonetario(entrada), interno);
        assert.equal(formatarValorMonetario(interno), exibido);
        if (interno) assert.equal(decimal(interno, 2), Math.round(Number(interno) * 100));
    }
    for (const entrada of ["-1", "3,501", "3.5010", "1.00,50", "1,2,3", "abc", "1000000000"])
        assert.equal(normalizarValorMonetario(entrada), null);
    assert.equal(decimal("1,125", 3), 1125);
});

test("venda totalmente a prazo exige cliente e gera parcelas sem PagamentoEntity no contrato", () => {
    const r = { ...venda(), cliente: { id: 8 }, pagamentos: [{ formaPagamento: "A_PRAZO", configuracaoFormaPagamentoId: null,
        nomeExibicao: "A prazo", valor: "", recebido: "" }], parcelasPrazo: [{ valor: "", vencimento: "2026-11-15" }] };
    const p = criarPedido(r, "chave");
    assert.deepEqual(p.pagamentos, []);
    assert.deepEqual(p.parcelasPrazo, [{ valor: 20.2, vencimento: "2026-11-15" }]);
    assert.equal(p.clienteId, 8); assert.equal(totais(r).totalImediato, 0); assert.equal(totais(r).troco, 0);
    assert.throws(() => criarPedido({ ...r, cliente: null }, "chave"), /Selecione um cliente/);
    assert.throws(() => criarPedido({ ...r, parcelasPrazo: [{ valor: "20.20", vencimento: "" }] }, "chave"));
    assert.equal("empresaId" in p, false); assert.equal("contaFinanceiraId" in p, false);
});
test("dinheiro e prazo somam alocacao sem incluir troco nem recebido na divida", () => {
    const r = { ...venda(), cliente: { id: 8 }, pagamentos: [
        { configuracaoFormaPagamentoId: 42, formaPagamento: "DINHEIRO", nomeExibicao: "Dinheiro", valor: "5", recebido: "10" },
        { configuracaoFormaPagamentoId: null, formaPagamento: "A_PRAZO", nomeExibicao: "A prazo", valor: "", recebido: "" },
    ], parcelasPrazo: [{ valor: "7.60", vencimento: "2026-11-15" }, { valor: "7.60", vencimento: "2026-12-15" }] };
    const t = totais(r), p = criarPedido(r, "chave");
    assert.equal(t.totalInformado, 2020); assert.equal(t.totalPrazo, 1520); assert.equal(t.totalImediato, 500);
    assert.equal(t.troco, 500); assert.equal(t.recebido, 1000); assert.equal(t.restante, 0);
    assert.deepEqual(p.pagamentos, [{ configuracaoFormaPagamentoId: 42, valor: 5, valorRecebido: 10 }]);
    assert.deepEqual(p.parcelasPrazo, [{ valor: 7.6, vencimento: "2026-11-15" }, { valor: 7.6, vencimento: "2026-12-15" }]);
    for (const valor of ["0", "-1", "1", "14", "1.001"]) {
        const alterado = { ...r, parcelasPrazo: [{ valor, vencimento: "2026-11-15" }, r.parcelasPrazo[1]] };
        assert.throws(() => criarPedido(alterado, "chave"));
    }
    const redistribuido = { ...r, parcelasPrazo: [{ valor: "7.61", vencimento: "2026-11-15" }, r.parcelasPrazo[1]] };
    assert.equal(totais(redistribuido).troco, 501);
    assert.equal(criarPedido(redistribuido, "chave").pagamentos[0].valor, 4.99);
});
test("retirar prazo ignora parcelas antigas e preserva o payload imediato", () => {
    const r = { ...venda(), parcelasPrazo: [{ valor: "20.20", vencimento: "2026-11-15" }] };
    const p = criarPedido(r, "chave");
    assert.equal(p.parcelasPrazo, undefined); assert.equal(p.pagamentos.length, 1);
    assert.equal(totais(r).totalPrazo, 0);
});

test("pedido envia pagamentos e preserva configuracao empresarial e troco por forma", () => {
    for (const formaPagamento of ["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"]) {
        const r = { ...venda(), formaPagamento, configuracaoFormaPagamentoId: 42 };
        const pedido = criarPedido(r, "chave");
        assert.equal(pedido.pagamentos[0].configuracaoFormaPagamentoId, 42);
        assert.equal(pedido.pagamentos[0].valor, 20.2);
        assert.equal(pedido.pagamentos[0].valorRecebido, formaPagamento === "DINHEIRO" ? 30 : undefined);
        assert.equal("formaPagamento" in pedido, false);
        assert.equal(totais(r).troco, formaPagamento === "DINHEIRO" ? 980 : 0);
    }
});

test("scanner usa somente código exato entre resultados remotos; nunca nome parcial", () => {
    const outro = { ...produto, id: 2, nome: "7890001 oferta", codigoBarras: "outra", codigoInterno: "outro" };
    assert.equal(encontrarProdutoPorCodigo([outro, produto], "7890001").id, 1);
    assert.equal(encontrarProdutoPorCodigo([produto], " cafe ").id, 1);
    assert.equal(encontrarProdutoPorCodigo([produto], "Caf"), undefined);
    assert.equal(encontrarProdutoPorCodigo([{ ...produto, ativo: false }], "7890001"), undefined);
    assert.equal(encontrarProdutoPorCodigo([produto], ""), undefined);
});
test("setas navegam pela lista sem ultrapassar seus limites", () => {
    assert.equal(moverIndiceProduto(0, 3, "PROXIMO"), 1);
    assert.equal(moverIndiceProduto(1, 3, "PROXIMO"), 2);
    assert.equal(moverIndiceProduto(2, 3, "PROXIMO"), 2);
    assert.equal(moverIndiceProduto(2, 3, "ANTERIOR"), 1);
    assert.equal(moverIndiceProduto(0, 3, "ANTERIOR"), 0);
});
test("PDV conecta seleção, sequência de foco, Escape, F2 e atalhos sem conflito com o navegador", () => {
    assert.match(fontePDV, /void adicionarPorCodigo\(\)/);
    assert.match(fontePDV, /quantidadeFocoPendenteRef\.current = produto\.id/);
    assert.match(fontePDV, /useLayoutEffect\(\(\) => \{[\s\S]*quantidadesRef\.current\[id\][\s\S]*campo\.focus\(\);\s*campo\.select\(\);[\s\S]*\}, \[rascunho\.itens\]\)/);
    assert.match(fontePDV, /if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); focarBusca\(\); \}/);
    assert.match(fontePDV, /if \(listaAberta\).*setListaAberta\(false\)/s);
    assert.match(fontePDV, /if \(opcional\).*setOpcional\(null\)/s);
    assert.match(fontePDV, /navigate\("\/vendas"\)/);
    assert.match(fontePDV, /e\.key === "F2".*void finalizar\(\)/s);
    assert.match(fontePDV, /e\.key === "F4".*setOpcional\("desconto"\)/s);
    assert.match(fontePDV, /e\.key === "F8".*setOpcional\("cliente"\)/s);
    assert.match(fontePDV, /F9: "observacoes", F7: "entrega"/);
    assert.doesNotMatch(fontePDV, /e\.key === "F3"/);
    assert.doesNotMatch(fontePDV, /e\.key === "F6"/);
    assert.doesNotMatch(fontePDV, /F10: "entrega"/);
    // Listener no window garante que os atalhos funcionem mesmo se o foco cair fora da árvore do Box (bug do F9).
    assert.match(fontePDV, /window\.addEventListener\("keydown", atalhos\)/);
    assert.match(fontePDV, /window\.removeEventListener\("keydown", atalhos\)/);
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
    assert.equal(pedido.pagamentos[0].valorRecebido, 30);
    assert.equal(pedido.itens[0].precoUnitarioEsperado, 10.1);
    assert.equal("empresaId" in pedido, false);
    assert.equal("usuarioId" in pedido, false);
    assert.equal(pedido.clienteId, null);
});
test("PIX e cartões usam o total exato e não carregam troco anterior", () => {
    for (const formaPagamento of ["PIX", "CARTAO_DEBITO", "CARTAO_CREDITO"]) {
        const r = { ...venda(), formaPagamento };
        assert.equal(totais(r).troco, 0);
        assert.equal(criarPedido(r, "chave").pagamentos[0].valor, 20.2);
        assert.equal(criarPedido(r, "chave").pagamentos[0].valorRecebido, undefined);
    }
});
test("bloqueia vazio, pagamento insuficiente, quantidade inválida e desconto excessivo", () => {
    assert.throws(() => criarPedido(novoRascunho(), "chave"), /Adicione/);
    assert.throws(() => criarPedido({ ...venda(), recebido: "1" }, "chave"), /soma/);
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
    const primeira = { sessaoId: 10, caixaId: 1, descricaoCaixa: "Caixa 1", operadorAbertura: { id: 1, nome: "Operador" } };
    const segunda = { sessaoId: 20, caixaId: 2, descricaoCaixa: "Caixa 2", operadorAbertura: { id: 1, nome: "Operador" } };
    assert.equal(decidirSessaoCaixa([], 1).fluxo, "ABRIR");
    assert.deepEqual(decidirSessaoCaixa([primeira], 1), { fluxo: "USAR_UNICA", sessao: primeira });
    assert.deepEqual(decidirSessaoCaixa([primeira, segunda], 1), {
        fluxo: "SELECIONAR", sessoes: [primeira, segunda],
    });
});

test("resolucao de Caixa ignora sessoes alheias e exige titular identificavel", () => {
    const propria = { sessaoId: 10, operadorAbertura: { id: 1, nome: "Operador" } };
    const alheia = { sessaoId: 20, operadorAbertura: { id: 2, nome: "Outro operador" } };
    const outraAlheia = { sessaoId: 30, operadorAbertura: { id: 3, nome: "Terceiro operador" } };
    assert.deepEqual(decidirSessaoCaixa([alheia], 1), { fluxo: "ABRIR" });
    assert.deepEqual(decidirSessaoCaixa([alheia, outraAlheia], 1), { fluxo: "ABRIR" });
    assert.deepEqual(decidirSessaoCaixa([alheia, propria, outraAlheia], 1), { fluxo: "USAR_UNICA", sessao: propria });
    assert.deepEqual(decidirSessaoCaixa([propria], undefined), { fluxo: "ABRIR" });
    assert.deepEqual(decidirSessaoCaixa([{ sessaoId: 40 }], 1), { fluxo: "ABRIR" });
    assert.deepEqual(decidirSessaoCaixa([{ sessaoId: 40 }], undefined), { fluxo: "ABRIR" });
});

test("mantém a sessão no próximo rascunho e a envia na venda", () => {
    const rascunho = { ...venda(), sessaoCaixaId: 42 };
    assert.equal(criarPedido(rascunho, "chave").sessaoCaixaId, 42);
    assert.equal(novoRascunho(42).sessaoCaixaId, 42);
});

const parcela = (id, formaPagamento, valor, recebido = "") => ({ configuracaoFormaPagamentoId: id,
    nomeExibicao: formaPagamento, formaPagamento, valor, recebido });

for (const [nome, total, recebido, outras, aplicado, troco, restante] of [
    ["dinheiro parcial e PIX completam venda", 14, "10", [parcela(2, "PIX", "4")], 10, 0, 0],
    ["dinheiro unico devolve excedente como troco", 14, "20", [], 14, 6, 0],
    ["dinheiro insuficiente deixa falta distribuir", 14, "10", [], 10, 0, 4],
    ["dinheiro e PIX geram troco sem excedente", 14, "10", [parcela(2, "PIX", "5")], 9, 1, 0],
    ["PIX sem troco bloqueia excedente", 14, null, [parcela(2, "PIX", "15")], 0, 0, -1],
    ["PIX e cartao sem troco bloqueiam excedente", 14, null, [parcela(2, "PIX", "10"), parcela(3, "CARTAO_DEBITO", "5")], 0, 0, -1],
    ["dinheiro e prazo alocam venda sem incluir troco na divida", 100, "40", [parcela(null, "A_PRAZO", "")], 40, 0, 0],
    ["dinheiro parcial e credito geram troco", 14, "10", [parcela(4, "CARTAO_CREDITO", "5")], 9, 1, 0],
    ["dinheiro nao absorve excedente das outras formas", 14, "10", [parcela(2, "PIX", "15")], 0, 10, -1],
]) {
    test(nome, () => {
        const r = { ...venda(), cliente: { id: 8 }, itens: [{ produto: { ...produto, precoVenda: total }, quantidade: "1" }],
            pagamentos: [...(recebido === null ? [] : [parcela(1, "DINHEIRO", "999", recebido)]), ...outras],
            parcelasPrazo: [{ valor: "60", vencimento: "2026-11-15" }] };
        const t = totais(r);
        assert.equal(t.restante, restante * 100); assert.equal(t.troco, troco * 100);
        assert.equal(t.totalImediato + t.totalPrazo, (total - restante) * 100);
        if (recebido !== null) assert.equal(t.parcelas[0].valorCentavos, aplicado * 100);
        if (restante !== 0) assert.throws(() => criarPedido(r, "chave"));
        else {
            const pedido = criarPedido(r, "chave");
            assert.deepEqual(pedido.pagamentos[0], { configuracaoFormaPagamentoId: 1, valor: aplicado, valorRecebido: Number(recebido) });
            assert.equal(t.pagamentosValidos, true);
            if (t.usaPrazo) assert.deepEqual(pedido.parcelasPrazo, [{ valor: 60, vencimento: "2026-11-15" }]);
        }
    });
}

test("editar/remover outra forma recalcula somente dinheiro; invalido/zero nunca vira pagamento valido", () => {
    const r = { ...venda(), itens: [{ produto: { ...produto, precoVenda: 14 }, quantidade: "1" }],
        pagamentos: [parcela(1, "DINHEIRO", "14", "10"), parcela(2, "PIX", "5")] };
    assert.equal(totais(r).troco, 100);
    assert.equal(totais({ ...r, pagamentos: [r.pagamentos[0], parcela(2, "PIX", "4")] }).troco, 0);
    assert.equal(totais({ ...r, pagamentos: [r.pagamentos[0]] }).restante, 400);
    for (const recebido of ["0", "-1", "NaN", "1.001"]) {
        const alterado = { ...r, pagamentos: [{ ...r.pagamentos[0], recebido }, r.pagamentos[1]] };
        assert.equal(totais(alterado).pagamentosValidos, false);
        assert.throws(() => criarPedido(alterado, "chave"));
    }
    assert.equal(r.pagamentos[0].recebido, "10"); assert.equal(r.pagamentos[1].valor, "5");
});

test("configuracoes de dinheiro distintas cobrem saldo em ordem sem duplicar alocacao", () => {
    const r = { ...venda(), itens: [{ produto: { ...produto, precoVenda: 100 }, quantidade: "1" }],
        pagamentos: [parcela(1, "DINHEIRO", "", "40"), parcela(7, "DINHEIRO", "", "50"), parcela(2, "PIX", "20")] };
    const t = totais(r);
    assert.equal(t.restante, 0); assert.equal(t.troco, 1000);
    assert.deepEqual(criarPedido(r, "chave").pagamentos, [
        { configuracaoFormaPagamentoId: 1, valor: 40, valorRecebido: 40 },
        { configuracaoFormaPagamentoId: 7, valor: 40, valorRecebido: 50 },
        { configuracaoFormaPagamentoId: 2, valor: 20 },
    ]);
});

test("pagamento misto soma somente valores aplicados, preserva troco e envia lista sem tenant", () => {
    const r = { ...venda(), itens: [{ produto: { ...produto, precoVenda: 100 }, quantidade: "1" }],
        pagamentos: [parcela(1, "DINHEIRO", "40", "50"), parcela(2, "PIX", "30"), parcela(3, "CARTAO_CREDITO", "30")] };
    const t = totais(r);
    assert.equal(t.totalInformado, 10000); assert.equal(t.restante, 0); assert.equal(t.troco, 1000);
    const pedido = criarPedido(r, "misto");
    assert.deepEqual(pedido.pagamentos, [
        { configuracaoFormaPagamentoId: 1, valor: 40, valorRecebido: 50 },
        { configuracaoFormaPagamentoId: 2, valor: 30 }, { configuracaoFormaPagamentoId: 3, valor: 30 },
    ]);
    assert.equal(pedido.valorRecebido, undefined); assert.equal(pedido.tenantId, undefined);
    assert.equal(pedido.empresaId, undefined); assert.equal(pedido.itens.length, 1);
});

test("pagamentos bloqueiam soma diferente, parcela invalida e configuracao repetida", () => {
    for (const valor of ["19", "21"]) {
        const r = { ...venda(), pagamentos: [parcela(1, "PIX", valor)] };
        assert.notEqual(totais(r).restante, 0);
        assert.throws(() => criarPedido(r, "chave"), /soma/);
    }
    for (const valor of ["0", "-1", "10.001", "NaN"]) {
        const r = { ...venda(), pagamentos: [parcela(1, "PIX", valor)] };
        assert.equal(totais(r).pagamentosValidos, false);
        assert.throws(() => criarPedido(r, "chave"));
    }
    assert.throws(() => criarPedido({ ...venda(), pagamentos: [parcela(1, "PIX", "10"), parcela(1, "PIX", "10.20")] }, "chave"), /repita/);
    assert.throws(() => criarPedido({ ...venda(), pagamentos: [parcela(null, "PIX", "20.20")] }, "chave"), /Selecione/);
});

test("pagamento unico automatico acompanha total e dinheiro sem recebido assume valor aplicado", () => {
    const r = { ...venda(), pagamentos: [parcela(1, "DINHEIRO", "")] };
    assert.equal(criarPedido(r, "chave").pagamentos[0].valorRecebido, 20.2);
    assert.equal(criarPedido({ ...r, desconto: "1.20" }, "chave").pagamentos[0].valor, 19);
    assert.equal(totais(r).troco, 0);
});
