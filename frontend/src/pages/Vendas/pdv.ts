import type { Produto } from "../../types/produto";
import type { Cliente } from "../../types/cliente";
import type { FormaPagamento, VendaInput } from "../../services/vendaService";

export type ItemPDV = { produto: Produto; quantidade: string };
export type RascunhoPDV = {
    itens: ItemPDV[]; desconto: string; cliente: Cliente | null; entrega: string; observacoes: string;
    formaPagamento: FormaPagamento; recebido: string; pendente: VendaInput | null;
    sessaoCaixaId: number | null;
};
export function novoRascunho(): RascunhoPDV {
    return { itens: [], desconto: "0", cliente: null, entrega: "", observacoes: "",
        formaPagamento: "DINHEIRO", recebido: "", pendente: null, sessaoCaixaId: null };
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
    const recebido = r.formaPagamento === "DINHEIRO" ? decimal(r.recebido, 2) : total;
    return { subtotal, desconto, total, recebido, troco: Math.max(0, (recebido ?? 0) - total),
        valido: valores.every(v => v !== null) && desconto !== null && total > 0 && Number.isSafeInteger(subtotal) };
}
export function criarPedido(r: RascunhoPDV, chave: string): VendaInput {
    const t = totais(r);
    if (!r.itens.length) throw new Error("Adicione um produto para iniciar a venda.");
    if (!t.valido) throw new Error("Revise as quantidades e o desconto. O total deve ser maior que zero.");
    if (t.recebido === null || t.recebido < t.total) throw new Error("Informe um valor recebido igual ou maior que o total.");
    return { chaveRequisicao: chave,
        itens: r.itens.map(i => ({ produtoId: i.produto.id, quantidade: decimal(i.quantidade, 3)! / 1000,
            precoUnitarioEsperado: i.produto.precoVenda })),
        clienteId: r.cliente?.id ?? null, desconto: t.desconto! / 100, totalEsperado: t.total / 100,
        formaPagamento: r.formaPagamento, valorRecebido: t.recebido / 100,
        entrega: r.entrega.trim(), observacoes: r.observacoes.trim(),
        sessaoCaixaId: r.sessaoCaixaId };
}
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function buscarProdutosPDV(produtos: Produto[], termo: string): Produto[] {
    const busca = normalizar(termo.trim());
    if (!busca) return [];
    const ativos = produtos.filter(p => p.ativo);
    const exatos = ativos.filter(p => p.codigoBarras === termo.trim() || normalizar(p.codigoInterno ?? "") === busca);
    return [...exatos, ...ativos.filter(p => !exatos.includes(p) && normalizar(p.nome).includes(busca))].slice(0, 8);
}
export const moeda = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });