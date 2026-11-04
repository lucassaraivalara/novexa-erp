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
    juros?: number | null;
    multa?: number | null;
    desconto?: number | null;
    movimentacaoFinanceiraId?: number;
    pagamentoAtualId?: number | null;
    observacao: string | null;
    entradaMercadoriaId?: number | null;
    origemVinculoEntrada?: "GERADA" | "PREEXISTENTE" | null;
};

export type ContaPagarInput = Pick<ContaPagar, "descricao" | "documento" | "fornecedorId" | "categoria" |
    "dataEmissao" | "dataVencimento" | "valor" | "observacao">;

export type PagamentoContaPagarInput = {
    contaFinanceiraId: number;
    dataPagamento: string;
    valorPago: number | string;
    juros?: string;
    multa?: string;
    desconto?: string;
};

export type PagamentoMultiorigemInput = {
    chaveRequisicao: string;
    dataPagamento: string;
    valorPago: string;
    juros: string;
    multa: string;
    desconto: string;
    origens: { contaFinanceiraId: number; valor: string }[];
};

export type PagamentoContaPagar = {
    id: number;
    contaPagarId: number;
    chaveRequisicao: string;
    dataPagamento: string;
    valorOriginal: number;
    principalQuitado: number;
    juros: number;
    multa: number;
    desconto: number;
    totalPago: number;
    estado: "CONFIRMADO" | "ESTORNADO";
    usuarioId: number;
    usuarioNome: string;
    dataCriacao: string;
    usuarioEstornoId: number | null;
    usuarioEstornoNome: string | null;
    dataEstorno: string | null;
    motivoEstorno: string | null;
    origens: { pagamentoId: number; movimentoId: number; contaFinanceiraId: number;
        contaFinanceiraNome: string; valor: number; estornada: boolean }[];
};
