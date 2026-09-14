import type { Produto } from "../../types/produto";

export type SituacaoEstoque = "SEM CONTROLE" | "ZERADO" | "BAIXO" | "NORMAL";

export function situacaoEstoque(produto: Pick<Produto, "controlaEstoque" | "estoqueAtual" | "estoqueMinimo">): SituacaoEstoque {
    if (!produto.controlaEstoque) return "SEM CONTROLE";
    if (produto.estoqueAtual <= 0) return "ZERADO";
    if (produto.estoqueAtual <= produto.estoqueMinimo) return "BAIXO";
    return "NORMAL";
}

export function novoSaldoEsperado(tipo: "ENTRADA" | "SAIDA" | "AJUSTE", saldoAtual: number, valor: number): number {
    if (tipo === "ENTRADA") return saldoAtual + valor;
    if (tipo === "SAIDA") return saldoAtual - valor;
    return valor;
}