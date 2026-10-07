import type { ContaBancariaResumo } from "./dadosBancarios";

export type TipoContaFinanceira = "BANCO" | "CAIXA" | "COFRE" | "CARTEIRA_DIGITAL" | "ADQUIRENTE" | "OUTROS";
export const tiposContaFinanceiraFuncionais: TipoContaFinanceira[] = ["BANCO", "COFRE", "CARTEIRA_DIGITAL", "OUTROS"];
export type TipoMovimentacaoFinanceira = "ENTRADA" | "SAIDA";
export type OrigemMovimentacaoFinanceira = "MANUAL" | "CONTAS_A_PAGAR" | "SALDO_INICIAL" | "TRANSFERENCIA" | "CONTA_RECEBER";
export const rotulosOrigemMovimentacaoFinanceira: Record<OrigemMovimentacaoFinanceira, string> = {
    MANUAL: "Manual", CONTAS_A_PAGAR: "Contas a Pagar", SALDO_INICIAL: "Saldo inicial", TRANSFERENCIA: "Transferência", CONTA_RECEBER: "Conta a Receber",
};

export const rotulosTipoContaFinanceira: Record<TipoContaFinanceira, string> = {
    BANCO: "Banco", CAIXA: "Caixa (legado)", COFRE: "Cofre", CARTEIRA_DIGITAL: "Carteira digital",
    ADQUIRENTE: "Adquirente (legado)", OUTROS: "Outros",
};

export type ContaFinanceira = {
    id: number;
    nome: string;
    tipo: TipoContaFinanceira;
    saldoInicial: number;
    saldoInicialAuditado: boolean;
    saldoAtual: number;
    ativo: boolean;
    dataCriacao: string;
    dataAtualizacao: string;
    contaBancaria: ContaBancariaResumo | null;
};

export type ContaFinanceiraInput = { nome: string; tipo: TipoContaFinanceira; saldoInicial?: number; contaBancariaId: number | null };

export type ContaFinanceiraResumo = { tipo: TipoContaFinanceira; quantidade: number; saldoAtual: number };

export type MovimentacaoFinanceira = {
    contaReceberId?: number | null;
    chaveRequisicao?: string | null;
    transferenciaId: number | null;
    contaContraparteNome: string | null;
    id: number;
    contaFinanceiraId: number;
    contaFinanceiraNome: string;
    tipo: TipoMovimentacaoFinanceira;
    origem: OrigemMovimentacaoFinanceira;
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

export type TransferenciaFinanceiraInput = {
    chaveRequisicao: string;
    contaOrigemId: number;
    contaDestinoId: number;
    valor: number;
    dataMovimento: string;
    observacao: string | null;
};

export type TransferenciaFinanceira = TransferenciaFinanceiraInput & {
    id: number;
    contaOrigemNome: string;
    contaDestinoNome: string;
    status: "CONCLUIDA" | "ESTORNADA";
    usuarioId: number;
    usuarioNome: string;
    dataCriacao: string;
    dataEstorno: string | null;
    usuarioEstornoId: number | null;
    usuarioEstornoNome: string | null;
    motivoEstorno: string | null;
};

export function descricaoMovimentacaoFinanceira(item: MovimentacaoFinanceira): string {
    if (item.origem !== "TRANSFERENCIA") return item.descricao;
    const enviada = item.tipo === "SAIDA";
    const rotulo = enviada ? "Transferência enviada" : "Transferência recebida";
    return item.contaContraparteNome
        ? `${rotulo} ${enviada ? "para" : "de"} ${item.contaContraparteNome}` : rotulo;
}
