import axios from "axios";
import api from "./api";

export type SessaoCaixaDashboard = {
    sessaoId: number;
    caixaId: number;
    descricaoCaixa: string;
    saldoInicial: number;
    saldoEsperadoDinheiro: number;
};

export type DashboardResumo = {
    faturamentoHoje: number;
    quantidadeVendasHoje: number;
    ticketMedioHoje: number;
    quantidadeProdutosEstoqueBaixo: number;
    quantidadeClientesAtivos: number;
    sessoesCaixaAbertas: SessaoCaixaDashboard[];
};

export async function buscarResumoDashboard(signal?: AbortSignal): Promise<DashboardResumo> {
    return (await api.get<DashboardResumo>("/dashboard/resumo", { signal })).data;
}

export function mensagemDashboard(erro: unknown): string {
    if (!axios.isAxiosError(erro)) return "Não foi possível carregar o resumo operacional.";
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string"
        ? erro.response.data
        : erro.response.data?.detail ?? "Não foi possível carregar o resumo operacional.";
}
