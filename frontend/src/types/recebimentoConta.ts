export type SituacaoRecebimentoConta = "A_LIQUIDAR" | "LIQUIDADO";
export type RecebimentoConta = {
    id: number;
    vendaId: number;
    recebivelId: number | null;
    formaPagamento: "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO";
    configuracaoNome: string | null;
    contaDestinoId: number | null;
    contaDestinoNome: string | null;
    valorBruto: number;
    valorTaxas: number | null;
    valorLiquidoPrevisto: number | null;
    dataHora: string;
    dataPrevista: string | null;
    status: SituacaoRecebimentoConta;
    valorLiquidado: number | null;
    dataLiquidacao: string | null;
    movimentacaoFinanceiraId: number | null;
};
export type RecebimentoContaResumo = {
    contaDestinoId: number | null;
    aLiquidar: number;
    liquidado: number;
    quantidadeALiquidar: number;
    quantidadeSemValor: number;
};
