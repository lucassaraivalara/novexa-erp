import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { ContaFinanceira, ContaFinanceiraInput, MovimentacaoFinanceira,
    MovimentacaoFinanceiraInput, TransferenciaFinanceira, TransferenciaFinanceiraInput } from "../types/contaFinanceira";

const contasUrl = "/financeiro/contas-financeiras";
const movimentosUrl = "/financeiro/movimentacoes-financeiras";
const transferenciasUrl = "/financeiro/transferencias";

export const criarTransferenciaFinanceira = async (dados: TransferenciaFinanceiraInput) =>
    (await api.post<TransferenciaFinanceira>(transferenciasUrl, dados)).data;

export type FiltrosTransferencia = {
    page?: number; size?: number; sort?: string; contaOrigemId?: number; contaDestinoId?: number;
    status?: string; dataInicial?: string; dataFinal?: string;
};
export const listarTransferenciasFinanceiras = async (params: FiltrosTransferencia = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<TransferenciaFinanceira>>(transferenciasUrl, { params, signal })).data;

export const estornarTransferenciaFinanceira = async (id: number, motivoEstorno: string) =>
    (await api.post<TransferenciaFinanceira>(`${transferenciasUrl}/${id}/estornar`, { motivoEstorno })).data;

export const listarContasFinanceiras = async (signal?: AbortSignal) =>
    (await api.get<ContaFinanceira[]>(contasUrl, { signal })).data;

export const salvarContaFinanceira = async (dados: ContaFinanceiraInput, id?: number) =>
    (await api.request<ContaFinanceira>({ method: id ? "PUT" : "POST",
        url: id ? `${contasUrl}/${id}` : contasUrl, data: dados })).data;

export const alterarSituacaoContaFinanceira = async (id: number, ativo: boolean) =>
    (await api.patch<ContaFinanceira>(`${contasUrl}/${id}/situacao`, { ativo })).data;

export type FiltrosMovimentacaoFinanceira = {
    page?: number; size?: number; sort?: string; contaFinanceiraId?: number; tipo?: string;
    origem?: string; dataInicial?: string; dataFinal?: string; estornada?: boolean;
};
export const listarMovimentacoesFinanceiras = async (params: FiltrosMovimentacaoFinanceira = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<MovimentacaoFinanceira>>(movimentosUrl, { params, signal })).data;

export const criarMovimentacaoFinanceira = async (dados: MovimentacaoFinanceiraInput) =>
    (await api.post<MovimentacaoFinanceira>(movimentosUrl, dados)).data;

export const estornarMovimentacaoFinanceira = async (id: number, motivoEstorno: string) =>
    (await api.patch<MovimentacaoFinanceira>(`${movimentosUrl}/${id}/estorno`, { motivoEstorno })).data;

export function mensagemContaFinanceira(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
