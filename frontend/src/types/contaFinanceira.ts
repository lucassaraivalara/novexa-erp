export type TipoContaFinanceira = "BANCO" | "CAIXA" | "COFRE" | "CARTEIRA_DIGITAL" | "ADQUIRENTE" | "OUTROS";
export type TipoMovimentacaoFinanceira = "ENTRADA" | "SAIDA";

export const rotulosTipoContaFinanceira: Record<TipoContaFinanceira, string> = {
    BANCO: "Banco", CAIXA: "Caixa", COFRE: "Cofre", CARTEIRA_DIGITAL: "Carteira digital",
    ADQUIRENTE: "Adquirente", OUTROS: "Outros",
};

export type ContaFinanceira = {
    id: number;
    nome: string;
    tipo: TipoContaFinanceira;
    saldoInicial: number;
    saldoAtual: number;
    ativo: boolean;
    dataCriacao: string;
    dataAtualizacao: string;
};

export type ContaFinanceiraInput = { nome: string; tipo: TipoContaFinanceira; saldoInicial?: number };

export type MovimentacaoFinanceira = {
    id: number;
    contaFinanceiraId: number;
    contaFinanceiraNome: string;
    tipo: TipoMovimentacaoFinanceira;
    origem: "MANUAL";
    descricao: string;
    valor: number;
    dataMovimento: string;
    observacao: string | null;
    usuarioId: number;
    usuarioNome: string;
    dataCriacao: string;
    estornada: boolean;
    dataEstorno: string | null;
    usuarioEstornoId: number | null;
    usuarioEstornoNome: string | null;
    motivoEstorno: string | null;
};

export type MovimentacaoFinanceiraInput = {
    contaFinanceiraId: number;
    tipo: TipoMovimentacaoFinanceira;
    descricao: string;
    valor: number;
    dataMovimento: string;
    observacao: string | null;
};
