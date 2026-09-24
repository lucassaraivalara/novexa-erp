export type CaixaResumo = {
    id: number;
    descricao: string;
    ativo: boolean;
};

export type CaixaCompleta = CaixaResumo;

export type CaixaInput = {
    descricao: string;
    ativo: boolean;
};

export type SessaoCaixaAberta = {
    sessaoId: number;
    caixaId: number;
    descricaoCaixa: string;
    saldoInicial: number;
    dataHoraAbertura: string;
    operadorAbertura: { id: number; nome: string };
};

export type TotalFormaPagamento = {
    formaPagamentoId: number;
    descricao: string;
    tipo: string;
    total: number;
};

export type ResumoSessaoCaixa = {
    sessaoId: number;
    caixaId: number;
    status: string;
    descricaoCaixa: string;
    dataHoraAbertura: string;
    operadorAbertura: { id: number; nome: string };
    saldoInicial: number;
    totalVendas: number;
    totaisPorFormaPagamento: TotalFormaPagamento[];
    suprimentos: number;
    sangrias: number;
    saldoEsperadoDinheiro: number;
    saldoFinalInformado: number | null;
    diferenca: number | null;
};

export type SessaoCaixaHistorico = {
    sessaoId: number;
    caixaId: number;
    descricaoCaixa: string;
    status: string;
    dataHoraAbertura: string;
    operadorAbertura: { id: number; nome: string };
    dataHoraFechamento: string | null;
    operadorFechamento: { id: number; nome: string } | null;
    saldoInicial: number;
    totalVendas: number;
    dinheiroEsperado: number;
    valorInformado: number | null;
    diferenca: number | null;
};

export type MovimentacaoCaixa = {
    id: number;
    sessaoId: number;
    vendaId: number | null;
    usuarioId: number;
    chaveRequisicao: string;
    tipo: "VENDA" | "SUPRIMENTO" | "SANGRIA";
    valor: number;
    observacao: string | null;
    dataHora: string;
};

export type MovimentacaoCaixaInput = {
    chaveRequisicao: string;
    tipo: "SUPRIMENTO" | "SANGRIA";
    valor: number;
    observacao?: string | null;
};

export type AberturaCaixaInput = {
    saldoInicial: number;
};

export type ConferenciaFechamentoInput = {
    formas: { formaPagamentoId: number; valorInformado: number }[];
    observacao?: string | null;
};

export type FechamentoCaixaInput = {
    saldoFinal: number;
    conferencia?: ConferenciaFechamentoInput;
};

export type SessaoCaixaResponse = {
    id: number;
    caixaId: number;
    status: string;
    saldoInicial: number;
    saldoFinal: number | null;
    usuarioAberturaId: number;
    usuarioFechamentoId: number | null;
    dataAbertura: string;
    dataFechamento: string | null;
    resumo: ResumoSessaoCaixa | null;
};