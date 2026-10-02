export type TipoFormaPagamento = "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "BOLETO" | "TRANSFERENCIA";

export const rotulosTipoFormaPagamento: Record<TipoFormaPagamento, string> = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    DEBITO: "Débito",
    CREDITO: "Crédito",
    BOLETO: "Boleto",
    TRANSFERENCIA: "Transferência",
};

export const tiposFormaPagamentoComContaDestino: TipoFormaPagamento[] = ["PIX", "TRANSFERENCIA", "DEBITO", "CREDITO"];

export type ContaFinanceiraDestinoResumo = {
    id: number;
    nome: string;
    tipo: string;
    ativo: boolean;
};

export type ConfiguracaoFormaPagamento = {
    id: number;
    nomeExibicao: string;
    formaPagamentoId: number;
    tipo: TipoFormaPagamento;
    ativo: boolean;
    contaFinanceiraDestino: ContaFinanceiraDestinoResumo | null;
    dataCriacao: string;
    dataAtualizacao: string;
    taxaPercentual: number | null;
    taxaFixa: number | null;
    prazoRecebimentoDias: number | null;
};

export type ConfiguracaoFormaPagamentoInput = {
    nomeExibicao: string;
    formaPagamentoId: number;
    ativo: boolean;
    contaFinanceiraDestinoId?: number | null;
    taxaPercentual?: number | null;
    taxaFixa?: number | null;
    prazoRecebimentoDias?: number | null;
};

export type FormaPagamentoCatalogo = {
    id: number;
    tipo: TipoFormaPagamento;
    descricao: string;
};
