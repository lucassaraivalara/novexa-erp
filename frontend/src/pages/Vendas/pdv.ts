import type { Produto } from "../../types/produto";
import type { Cliente } from "../../types/cliente";
import type { FormaPagamento, VendaInput } from "../../services/vendaService";
import type { SessaoCaixaAberta } from "../../types/caixa";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";

export type ItemPDV = { produto: Produto; quantidade: string };
export type PagamentoPDV = {
    configuracaoFormaPagamentoId: number | null;
    nomeExibicao: string | null;
    formaPagamento: FormaPagamento | "A_PRAZO";
    valor: string;
    recebido: string;
};
export type ParcelaPrazoPDV = { valor: string; vencimento: string };
export type RascunhoPDV = {
    itens: ItemPDV[]; desconto: string; cliente: Cliente | null; entrega: string; observacoes: string;
    formaPagamento: FormaPagamento; recebido: string; pendente: VendaInput | null;
    sessaoCaixaId: number | null;
    configuracaoFormaPagamentoId: number | null;
    configuracaoNomeExibicao: string | null;
    configuracaoTipo: ConfiguracaoFormaPagamento["tipo"] | null;
    pagamentos?: PagamentoPDV[];
    parcelasPrazo?: ParcelaPrazoPDV[];
};
export function novoRascunho(sessaoCaixaId: number | null = null): RascunhoPDV {
    return { itens: [], desconto: "0", cliente: null, entrega: "", observacoes: "",
        formaPagamento: "DINHEIRO", recebido: "", pendente: null, sessaoCaixaId,
        configuracaoFormaPagamentoId: null, configuracaoNomeExibicao: null, configuracaoTipo: null };
}

export function carregarRascunhoSalvo(chave: string, sessaoCaixaId: number, chaveLegada?: string): RascunhoPDV {
    try {
        const salvo = JSON.parse(sessionStorage.getItem(chave) ?? (chaveLegada ? sessionStorage.getItem(chaveLegada) : null) ?? "null");
        if (chaveLegada) sessionStorage.removeItem(chaveLegada);
        if (salvo?.sessaoCaixaId === sessaoCaixaId && Array.isArray(salvo.itens) && salvo.itens.length
            && (!salvo.pendente || salvo.pendente.sessaoCaixaId === sessaoCaixaId))
            return { ...novoRascunho(sessaoCaixaId), ...salvo };
    } catch { /* Rascunho invalido nao impede iniciar uma venda. */ }
    return novoRascunho(sessaoCaixaId);
}

export function salvarRascunho(chave: string, rascunho: RascunhoPDV): void {
    if (rascunho.itens.length || rascunho.pendente) sessionStorage.setItem(chave, JSON.stringify(rascunho));
    else sessionStorage.removeItem(chave);
}

export type DecisaoSessaoCaixa =
    | { fluxo: "ABRIR" }
    | { fluxo: "USAR_UNICA"; sessao: SessaoCaixaAberta }
    | { fluxo: "SELECIONAR"; sessoes: SessaoCaixaAberta[] };

export function decidirSessaoCaixa(sessoes: SessaoCaixaAberta[], usuarioId: number | undefined): DecisaoSessaoCaixa {
    const proprias = sessoes.filter(sessao => usuarioId !== undefined && sessao.operadorAbertura?.id === usuarioId);
    if (proprias.length === 0) return { fluxo: "ABRIR" };
    if (proprias.length === 1) return { fluxo: "USAR_UNICA", sessao: proprias[0] };
    return { fluxo: "SELECIONAR", sessoes: proprias };
}
export function decimal(valor: string, casas: number): number | null {
    const texto = valor.trim().replace(",", ".");
    if (!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${casas}})?$`).test(texto)) return null;
    const [inteiro, fracao = ""] = texto.split(".");
    return Number(inteiro) * 10 ** casas + Number(fracao.padEnd(casas, "0"));
}
export function normalizarValorMonetario(valor: string): string | null {
    let texto = valor.trim();
    if (!texto) return "";
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d{0,2})?$/.test(texto)) texto = texto.replaceAll(".", "");
    const partes = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(texto.replace(",", "."));
    return partes ? `${partes[1]}.${(partes[2] ?? "").padEnd(2, "0")}` : null;
}
export function formatarValorMonetario(valor: string): string {
    const normalizado = normalizarValorMonetario(valor);
    if (!normalizado) return valor;
    return Number(normalizado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const usaPrazo = pagamentos.some(p => p.formaPagamento === "A_PRAZO");
    const parcelasPrazo = usaPrazo ? (r.parcelasPrazo ?? []).map(p => ({ ...p,
        valorCentavos: p.valor === "" && pagamentos.length === 1 && r.parcelasPrazo?.length === 1 ? Math.max(0, total) : decimal(p.valor, 2),
    })) : [];
    const totalPrazo = parcelasPrazo.reduce((soma, p) => soma + (p.valorCentavos ?? 0), 0);
    const valoresAplicados = pagamentos.map(p => p.formaPagamento === "A_PRAZO" ? totalPrazo
        : p.valor === "" && pagamentos.length === 1 ? Math.max(0, total) : decimal(p.valor, 2));
    let saldoParaDinheiro = Math.max(0, total - pagamentos.reduce((soma, p, i) =>
        soma + (p.formaPagamento !== "DINHEIRO" ? valoresAplicados[i] ?? 0 : 0), 0));
    const parcelas = pagamentos.map((p, i) => {
        let valor = valoresAplicados[i];
        const recebido = p.formaPagamento === "DINHEIRO" && p.recebido !== "" ? decimal(p.recebido, 2) : valor;
        if (p.formaPagamento === "DINHEIRO") {
            // Outras formas mantem seus valores; dinheiro cobre o saldo e devolve o excedente como troco.
            valor = recebido === null ? null : Math.min(recebido, saldoParaDinheiro);
            saldoParaDinheiro -= valor ?? 0;
        }
        return { ...p, valorCentavos: valor, recebidoCentavos: recebido, troco: Math.max(0, (recebido ?? 0) - (valor ?? 0)) };
    });
    const totalInformado = parcelas.reduce((soma, p) => soma + (p.valorCentavos ?? 0), 0);
    const troco = parcelas.reduce((soma, p) => soma + p.troco, 0);
    const imediatos = parcelas.filter(p => p.formaPagamento !== "A_PRAZO");
    const prazoValido = !usaPrazo || (!!r.cliente && parcelasPrazo.length > 0 && parcelasPrazo.length <= 120
        && parcelasPrazo.every(p => p.valorCentavos !== null && p.valorCentavos > 0
            && /^\d{4}-\d{2}-\d{2}$/.test(p.vencimento) && !Number.isNaN(Date.parse(p.vencimento))))
        && parcelas.filter(p => p.formaPagamento === "A_PRAZO").length === 1;
    const pagamentosValidos = parcelas.length > 0 && prazoValido && imediatos.every(p => p.configuracaoFormaPagamentoId !== null
        && p.valorCentavos !== null && p.valorCentavos > 0 && p.recebidoCentavos !== null && p.recebidoCentavos >= p.valorCentavos)
        && new Set(imediatos.map(p => p.configuracaoFormaPagamentoId)).size === imediatos.length;
    return { subtotal, desconto, total, totalInformado, totalPrazo, usaPrazo, parcelasPrazo,
        totalImediato: totalInformado - totalPrazo, restante: total - totalInformado, parcelas, pagamentosValidos,
        recebido: totalInformado - totalPrazo + troco, troco,
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
    if (t.usaPrazo && !r.cliente) throw new Error("Selecione um cliente para vender a prazo.");
    if (t.parcelas.some(p => p.formaPagamento !== "A_PRAZO" && p.configuracaoFormaPagamentoId === null)) throw new Error("Selecione uma forma de pagamento valida para cada parcela.");
    if (t.parcelas.some(p => p.recebidoCentavos === null || p.recebidoCentavos < (p.valorCentavos ?? 0)))
        throw new Error("Informe um valor recebido igual ou maior que a parcela em dinheiro.");
    if (!t.pagamentosValidos) throw new Error("Revise os valores e nao repita a mesma configuracao de pagamento.");
    if (t.restante !== 0) throw new Error("A soma dos pagamentos deve corresponder ao total da venda.");
    return { chaveRequisicao: chave,
        itens: r.itens.map(i => ({ produtoId: i.produto.id, quantidade: decimal(i.quantidade, 3)! / 1000,
            precoUnitarioEsperado: i.produto.precoVenda })),
        clienteId: r.cliente?.id ?? null, desconto: t.desconto! / 100, totalEsperado: t.total / 100,
        pagamentos: t.parcelas.filter(p => p.formaPagamento !== "A_PRAZO").map(p => ({ configuracaoFormaPagamentoId: p.configuracaoFormaPagamentoId!,
            valor: p.valorCentavos! / 100,
            ...(p.formaPagamento === "DINHEIRO" ? { valorRecebido: p.recebidoCentavos! / 100 } : {}) })),
        ...(t.usaPrazo ? { parcelasPrazo: t.parcelasPrazo.map(p => ({ valor: p.valorCentavos! / 100, vencimento: p.vencimento })) } : {}),
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
