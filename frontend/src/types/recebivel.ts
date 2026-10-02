import type { TipoFormaPagamento } from "./formaPagamento";

export type StatusRecebivel = "PENDENTE" | "LIQUIDADO" | "CANCELADO";
export type TipoRecebivel = Extract<TipoFormaPagamento, "DEBITO" | "CREDITO">;

export type Recebivel = {
    id: number;
    vendaId: number;
    pagamentoId: number;
    tipo: TipoRecebivel;
    numeroParcela: number;
    totalParcelas: number;
    valorBruto: number;
    valorLiquidoPrevisto: number | null;
    taxaPercentualSnapshot: number | null;
    taxaFixaSnapshot: number | null;
    valorTaxasPrevisto: number | null;
    prazoRecebimentoDiasSnapshot: number | null;
    dataVenda: string;
    dataPrevistaRecebimento: string | null;
    status: StatusRecebivel;
    configuracaoNomeExibicao: string | null;
    valorLiquidoRecebido: number | null;
    dataLiquidacao: string | null;
    usuarioLiquidacaoId: number | null;
    dataCancelamento: string | null;
    usuarioCancelamentoId: number | null;
    movimentacaoFinanceiraId: number | null;
};
