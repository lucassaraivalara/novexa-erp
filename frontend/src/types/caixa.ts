export type CaixaResumo = {
    id: number;
    descricao: string;
    ativo: boolean;
};

export type CaixaCompleta = CaixaResumo;

export type VendaSessaoCaixa = {
    id: number;
    dataHora: string;
    total: number;
    formaPagamento: "DINHEIRO" | "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO" | null;
    usuarioNome: string | null;
};

export type PainelSessaoCaixa = {
    resumo: ResumoSessaoCaixa;
    movimentacoes: MovimentacaoCaixa[];
    vendas: VendaSessaoCaixa[];
};

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
    totaisPorConfiguracao?: { configuracaoId: number | null; formaPagamentoId: number; descricao: string; tipo: string; total: number }[];
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

export type ComposicaoAbertura = {
    valorTrocoHerdado: number;
    sessaoOrigemTrocoId: number | null;
    dataFechamentoOrigem: string | null;
    valorRetiradoCofre: number;
    contaCofreId: number | null;
    contaCofreNome: string | null;
    movimentoFinanceiroId: number | null;
    valorAporteExterno: number;
    observacaoAporte: string | null;
    operadorAbertura: string;
    dataCriacao: string;
};

export type SessaoCaixaDetalhe = {
    sessao: SessaoCaixaHistorico;
    resumo: ResumoSessaoCaixa;
    modalidadeConferencia: "LEGADA" | "POR_FORMA" | "POR_CONFIGURACAO" | "TOTAL_MEIOS" | null;
    observacaoFechamento: string | null;
    conferencias: {
        escopo: "DINHEIRO_FISICO" | "FORMA_PAGAMENTO" | "CONFIGURACAO" | "TOTAL_MEIOS";
        formaPagamentoId: number | null;
        descricao: string;
        configuracaoId?: number | null;
        tipo: string | null;
        valorEsperado: number;
        valorInformado: number | null;
        diferenca: number | null;
    }[];
    movimentacoes: {
        tipo: "ABERTURA" | "VENDA" | "VENDA_CANCELADA" | "SUPRIMENTO" | "SANGRIA" | "ESTORNO_VENDA" | "FECHAMENTO";
        dataHora: string;
        valor: number;
        vendaId: number | null;
        observacao: string | null;
        usuarioNome: string | null;
        origemAutomatica: boolean;
    }[];
    composicaoAbertura?: ComposicaoAbertura | null;
};

export type MovimentacaoCaixa = {
    id: number;
    sessaoId: number;
    vendaId: number | null;
    usuarioId: number;
    usuarioNome: string | null;
    chaveRequisicao: string;
    tipo: "VENDA" | "SUPRIMENTO" | "SANGRIA" | "ESTORNO_VENDA";
    valor: number;
    observacao: string | null;
    dataHora: string;
};

export type MovimentacaoCaixaInput = {
    chaveRequisicao: string;
    cofre?: import("../services/cofreService").EntregaCofre;
    tipo: "SUPRIMENTO" | "SANGRIA";
    valor: number;
    observacao?: string | null;
};

export type AberturaCaixaInput = {
    saldoInicial: number;
    chaveRequisicao?: string;
    confirmarTroco?: boolean;
    valorRetiradoCofre?: number;
    contaCofreId?: number | null;
    valorAporteExterno?: number;
    observacaoAporte?: string | null;
};

export type TrocoAnteriorContexto = {
    sessaoId: number;
    valor: number;
    dataFechamento: string;
    operadorFechamento: string | null;
};

export type CofreOpcao = {
    id: number;
    nome: string;
    saldoAtual: number;
};

export type AberturaContexto = {
    caixaId: number;
    descricaoCaixa: string;
    caixaAtivo: boolean;
    sessaoAberta: boolean;
    sessaoAbertaId: number | null;
    trocoAnterior: TrocoAnteriorContexto | null;
    cofres: CofreOpcao[];
    saldoSugerido: number;
    podeMovimentarCofre: boolean;
};

export type ConferenciaFechamentoInput = {
    formas: { formaPagamentoId: number; valorInformado: number }[];
    observacao?: string | null;
};

export type FechamentoCaixaInput = {
    cofre?: import("../services/cofreService").EntregaCofre;
    saldoFinal: number;
    conferencia?: ConferenciaFechamentoInput;
    conferenciaMeios?: {
        modo: "POR_FORMA_PAGAMENTO" | "TOTAL";
        meios: { configuracaoId: number | null; formaPagamentoId: number | null; valorInformado: number | null }[];
        totalInformado?: number | null;
        observacao?: string | null;
    };
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
