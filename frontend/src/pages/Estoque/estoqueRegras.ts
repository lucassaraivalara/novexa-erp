import type { Produto } from "../../types/produto";

export type SituacaoEstoque = "SEM CONTROLE" | "NEGATIVO" | "ZERADO" | "BAIXO" | "NORMAL";

const formatoQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export function quantidadeComUnidade(valor: number | null, unidade?: string | null): string {
    return `${valor == null ? "—" : formatoQuantidade.format(valor)} ${unidade?.trim() || "(unidade não informada)"}`;
}

export function impedimentoMovimentacao(produto: Pick<Produto, "ativo" | "composto" | "controlaEstoque">): string {
    if (produto.composto) return "Kit/Combo não recebe estoque físico. Movimente os componentes.";
    if (!produto.ativo) return "Produto inativo. Reative o cadastro para movimentar.";
    if (!produto.controlaEstoque) return "Produto sem controle de estoque. Revise o cadastro para movimentar.";
    return "";
}

export function situacaoEstoque(produto: Pick<Produto, "controlaEstoque" | "estoqueAtual" | "estoqueMinimo">): SituacaoEstoque {
    if (!produto.controlaEstoque) return "SEM CONTROLE";
    if (produto.estoqueAtual < 0) return "NEGATIVO";
    if (produto.estoqueAtual <= 0) return "ZERADO";
    if (produto.estoqueAtual <= produto.estoqueMinimo) return "BAIXO";
    return "NORMAL";
}

export function novoSaldoEsperado(tipo: "ENTRADA" | "SAIDA" | "AJUSTE", saldoAtual: number, valor: number): number {
    if (tipo === "ENTRADA") return saldoAtual + valor;
    if (tipo === "SAIDA") return saldoAtual - valor;
    return valor;
}
