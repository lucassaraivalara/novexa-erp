export type StatusContaPagar = "ABERTA" | "PAGA" | "CANCELADA";

export type ContaPagar = {
    id: number;
    descricao: string;
    documento: string | null;
    fornecedorId: number | null;
    fornecedorNome: string | null;
    categoria: string | null;
    dataEmissao: string | null;
    dataVencimento: string;
    valor: number;
    status: StatusContaPagar;
    dataPagamento: string | null;
    valorPago: number | null;
    movimentacaoFinanceiraId?: number;
    observacao: string | null;
    entradaMercadoriaId?: number | null;
    origemVinculoEntrada?: "GERADA" | "PREEXISTENTE" | null;
};

export type ContaPagarInput = Pick<ContaPagar, "descricao" | "documento" | "fornecedorId" | "categoria" |
    "dataEmissao" | "dataVencimento" | "valor" | "observacao">;

export type PagamentoContaPagarInput = {
    contaFinanceiraId: number;
    dataPagamento: string;
    valorPago: number;
};
