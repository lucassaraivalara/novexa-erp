import axios from "axios";
import api from "./api";
import type { ContaFinanceira, ContaFinanceiraInput, MovimentacaoFinanceira,
    MovimentacaoFinanceiraInput } from "../types/contaFinanceira";

const contasUrl = "/financeiro/contas-financeiras";
const movimentosUrl = "/financeiro/movimentacoes-financeiras";

export const listarContasFinanceiras = async (signal?: AbortSignal) =>
    (await api.get<ContaFinanceira[]>(contasUrl, { signal })).data;

export const salvarContaFinanceira = async (dados: ContaFinanceiraInput, id?: number) =>
    (await api.request<ContaFinanceira>({ method: id ? "PUT" : "POST",
        url: id ? `${contasUrl}/${id}` : contasUrl, data: dados })).data;

export const alterarSituacaoContaFinanceira = async (id: number, ativo: boolean) =>
    (await api.patch<ContaFinanceira>(`${contasUrl}/${id}/situacao`, { ativo })).data;

export const listarMovimentacoesFinanceiras = async (contaFinanceiraId: number, signal?: AbortSignal) =>
    (await api.get<MovimentacaoFinanceira[]>(movimentosUrl, { params: { contaFinanceiraId }, signal })).data;

export const criarMovimentacaoFinanceira = async (dados: MovimentacaoFinanceiraInput) =>
    (await api.post<MovimentacaoFinanceira>(movimentosUrl, dados)).data;

export const estornarMovimentacaoFinanceira = async (id: number, motivoEstorno: string) =>
    (await api.patch<MovimentacaoFinanceira>(`${movimentosUrl}/${id}/estorno`, { motivoEstorno })).data;

export function mensagemContaFinanceira(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
