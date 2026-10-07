import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { ContaReceber, ContaReceberInput, OrigemContaReceber, RecebimentoContaInput,
    ResumoContasReceber, StatusContaReceber } from "../types/contaReceber";

const base = "/financeiro/contas-receber";
export type FiltrosContaReceber = {
    page: number; size: number; sort: string; termo?: string; status?: StatusContaReceber;
    clienteId?: number; origem?: OrigemContaReceber; vencimentoDe?: string; vencimentoAte?: string;
};
export const listarContasReceber = async (params: FiltrosContaReceber, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<ContaReceber>>(`${base}/pagina`, { params, signal })).data;
export const resumirContasReceber = async (signal?: AbortSignal) =>
    (await api.get<ResumoContasReceber>(`${base}/resumo`, { signal })).data;
export const buscarContaReceber = async (id: number, signal?: AbortSignal) =>
    (await api.get<ContaReceber>(`${base}/${id}`, { signal })).data;
export const salvarContaReceber = async (dados: ContaReceberInput, id?: number) =>
    (await api.request<ContaReceber>({ method: id ? "PUT" : "POST", url: id ? `${base}/${id}` : base, data: dados })).data;
export const receberConta = async (id: number, dados: RecebimentoContaInput) =>
    (await api.post<ContaReceber>(`${base}/${id}/receber`, dados)).data;
export const estornarRecebimentoConta = async (id: number, movimentoId: number, motivoEstorno: string) =>
    (await api.post<ContaReceber>(`${base}/${id}/recebimentos/${movimentoId}/estornar`, { motivoEstorno })).data;
export const cancelarContaReceber = async (id: number) =>
    (await api.post<ContaReceber>(`${base}/${id}/cancelar`)).data;

export function mensagemContaReceber(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    if (erro.response.status === 403) return "Você não tem permissão para realizar esta operação.";
    const dados = erro.response.data;
    return typeof dados === "string" ? dados : dados?.detail ?? padrao;
}
