import type { Produto } from "../../types/produto";
import type { Cliente } from "../../types/cliente";
import type { FormaPagamento, VendaInput } from "../../services/vendaService";
import type { SessaoCaixaAberta } from "../../types/caixa";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";

export type ItemPDV = { produto: Produto; quantidade: string };
export type PagamentoPDV = {
    configuracaoFormaPagamentoId: number | null;
    nomeExibicao: string | null;
    formaPagamento: FormaPagamento;
    valor: string;
    recebido: string;
};
export type RascunhoPDV = {
    itens: ItemPDV[]; desconto: string; cliente: Cliente | null; entrega: string; observacoes: string;
    formaPagamento: FormaPagamento; recebido: string; pendente: VendaInput | null;
    sessaoCaixaId: number | null;
    configuracaoFormaPagamentoId: number | null;
    configuracaoNomeExibicao: string | null;
    configuracaoTipo: ConfiguracaoFormaPagamento["tipo"] | null;
    pagamentos?: PagamentoPDV[];
};
export function novoRascunho(sessaoCaixaId: number | null = null): RascunhoPDV {
    return { itens: [], desconto: "0", cliente: null, entrega: "", observacoes: "",
        formaPagamento: "DINHEIRO", recebido: "", pendente: null, sessaoCaixaId,
        configuracaoFormaPagamentoId: null, configuracaoNomeExibicao: null, configuracaoTipo: null };
}

export type DecisaoSessaoCaixa =
    | { fluxo: "ABRIR" }
    | { fluxo: "USAR_UNICA"; sessao: SessaoCaixaAberta }
    | { fluxo: "SELECIONAR"; sessoes: SessaoCaixaAberta[] };

export function decidirSessaoCaixa(sessoes: SessaoCaixaAberta[]): DecisaoSessaoCaixa {
    if (sessoes.length === 0) return { fluxo: "ABRIR" };
    if (sessoes.length === 1) return { fluxo: "USAR_UNICA", sessao: sessoes[0] };
    return { fluxo: "SELECIONAR", sessoes };
}
export function decimal(valor: string, casas: number): number | null {
    const texto = valor.trim().replace(",", ".");
    if (!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${casas}})?$`).test(texto)) return null;
    const [inteiro, fracao = ""] = texto.split(".");
    return Number(inteiro) * 10 ** casas + Number(fracao.padEnd(casas, "0"));
}
export function subtotalItem(item: ItemPDV): number | null {
    const quantidade = decimal(item.quantidade, 3);
    const preco = Math.round(item.produto.precoVenda * 100);
    if (quantidade === null || quantidade <= 0 || !Number.isSafeInteger(preco) || preco < 0) return null;
    // Mesmo HALF_UP por item usado pelo backend, sem erro de ponto flutuante.
    const centavos = Number((BigInt(preco) * BigInt(quantidade) + 500n) / 1000n);
    return Number.isSafeInteger(centavos) ? centavos : null;
}
export function totais(r: RascunhoPDV) {
    const valores = r.itens.map(subtotalItem);
    const subtotal = valores.reduce<number>((soma, valor) => soma + (valor ?? 0), 0);
    const desconto = decimal(r.desconto, 2);
    const total = subtotal - (desconto ?? 0);
    const pagamentos = pagamentosRascunho(r);
    const parcelas = pagamentos.map(p => {
        const valor = p.valor === "" && pagamentos.length === 1 ? Math.max(0, total) : decimal(p.valor, 2);
        const recebido = p.formaPagamento === "DINHEIRO" && p.recebido !== "" ? decimal(p.recebido, 2) : valor;
        return { ...p, valorCentavos: valor, recebidoCentavos: recebido, troco: Math.max(0, (recebido ?? 0) - (valor ?? 0)) };
    });
    const totalInformado = parcelas.reduce((soma, p) => soma + (p.valorCentavos ?? 0), 0);
    const troco = parcelas.reduce((soma, p) => soma + p.troco, 0);
    const pagamentosValidos = parcelas.length > 0 && parcelas.every(p => p.configuracaoFormaPagamentoId !== null
        && p.valorCentavos !== null && p.valorCentavos > 0 && p.recebidoCentavos !== null && p.recebidoCentavos >= p.valorCentavos)
        && new Set(parcelas.map(p => p.configuracaoFormaPagamentoId)).size === parcelas.length;
    return { subtotal, desconto, total, totalInformado, restante: total - totalInformado, parcelas, pagamentosValidos,
        recebido: totalInformado + troco, troco,
        valido: valores.every(v => v !== null) && desconto !== null && total > 0 && Number.isSafeInteger(subtotal) };
}

// Rascunhos locais anteriores continuam legiveis; novos pedidos usam sempre pagamentos[].
export function pagamentosRascunho(r: RascunhoPDV): PagamentoPDV[] {
    return r.pagamentos ?? [{ configuracaoFormaPagamentoId: r.configuracaoFormaPagamentoId,
        nomeExibicao: r.configuracaoNomeExibicao, formaPagamento: r.formaPagamento, valor: "", recebido: r.recebido }];
}
export function criarPedido(r: RascunhoPDV, chave: string): VendaInput {
    const t = totais(r);
    if (!r.itens.length) throw new Error("Adicione um produto para iniciar a venda.");
    if (!t.valido) throw new Error("Revise as quantidades e o desconto. O total deve ser maior que zero.");
    if (t.parcelas.some(p => p.configuracaoFormaPagamentoId === null)) throw new Error("Selecione uma forma de pagamento valida para cada parcela.");
    if (t.parcelas.some(p => p.recebidoCentavos === null || p.recebidoCentavos < (p.valorCentavos ?? 0)))
        throw new Error("Informe um valor recebido igual ou maior que a parcela em dinheiro.");
    if (!t.pagamentosValidos) throw new Error("Revise os valores e nao repita a mesma configuracao de pagamento.");
    if (t.restante !== 0) throw new Error("A soma dos pagamentos deve corresponder ao total da venda.");
    return { chaveRequisicao: chave,
        itens: r.itens.map(i => ({ produtoId: i.produto.id, quantidade: decimal(i.quantidade, 3)! / 1000,
            precoUnitarioEsperado: i.produto.precoVenda })),
        clienteId: r.cliente?.id ?? null, desconto: t.desconto! / 100, totalEsperado: t.total / 100,
        pagamentos: t.parcelas.map(p => ({ configuracaoFormaPagamentoId: p.configuracaoFormaPagamentoId!,
            valor: p.valorCentavos! / 100,
            ...(p.formaPagamento === "DINHEIRO" ? { valorRecebido: p.recebidoCentavos! / 100 } : {}) })),
        entrega: r.entrega.trim(), observacoes: r.observacoes.trim(),
        sessaoCaixaId: r.sessaoCaixaId ?? undefined };
}
export function encontrarProdutoPorCodigo(produtos: Produto[], termo: string): Produto | undefined {
    const codigo = termo.trim();
    if (!codigo) return undefined;
    return produtos.find(p => p.ativo && (p.codigoBarras === codigo
        || p.codigoInterno?.toLowerCase() === codigo.toLowerCase()));
}
export function moverIndiceProduto(indice: number, total: number, direcao: "PROXIMO" | "ANTERIOR"): number {
    if (total <= 0) return 0;
    const deslocamento = direcao === "PROXIMO" ? 1 : -1;
    return Math.max(0, Math.min(total - 1, indice + deslocamento));
}
export const moeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
