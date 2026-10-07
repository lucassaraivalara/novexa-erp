import type { Cliente } from "./cliente";
import type { MovimentacaoFinanceira } from "./contaFinanceira";

export type StatusContaReceber = "PENDENTE" | "PARCIAL" | "RECEBIDA" | "CANCELADA";
export type OrigemContaReceber = "MANUAL" | "VENDA_A_PRAZO";
export type ContaReceber = {
    id: number;
    cliente: Pick<Cliente, "id" | "nome" | "cpfCnpj" | "ativo">;
    vendaId: number | null;
    descricao: string;
    valorOriginal: number;
    valorRecebido: number;
    saldo: number;
    dataEmissao: string | null;
    dataVencimento: string;
    status: StatusContaReceber;
    origem: OrigemContaReceber;
    numeroParcela: number;
    totalParcelas: number;
    observacao: string | null;
    dataCriacao: string;
    dataAtualizacao: string;
    recebimentos: MovimentacaoFinanceira[];
};
export type ContaReceberInput = Pick<ContaReceber, "descricao" | "valorOriginal" | "dataEmissao" |
    "dataVencimento" | "numeroParcela" | "totalParcelas" | "observacao"> & { clienteId: number };
export type RecebimentoContaInput = {
    contaFinanceiraId: number;
    valor: number;
    dataRecebimento: string;
    observacao: string | null;
    chaveRequisicao: string;
};
export type ResumoContasReceber = Record<"vencidas" | "seteDias" | "trintaDias" | "emAberto" | "recebidasMes",
    { total: number; quantidade: number }>;
