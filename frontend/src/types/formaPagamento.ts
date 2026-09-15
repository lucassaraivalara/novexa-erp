export type TipoFormaPagamento = "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "BOLETO" | "TRANSFERENCIA";

export type FormaPagamentoResumo = {
    id: number;
    descricao: string;
    tipo: string;
    ativo: boolean;
};

export type FormaPagamentoInput = {
    descricao: string;
    tipo: TipoFormaPagamento;
    ativo: boolean;
};
