import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { ContaPagar, ContaPagarInput, FornecedorContaPagar, PagamentoContaPagarInput } from "../types/contaPagar";

const base = "/financeiro/contas-pagar";

export type FiltrosContaPagar = {
    page?: number; size?: number; sort?: string; busca?: string; status?: string;
    fornecedor?: number; categoria?: string; vencimentoDe?: string; vencimentoAte?: string;
    emissaoDe?: string; emissaoAte?: string;
};
export type ResumoContasPagar = Record<"vencidas" | "seteDias" | "trintaDias" | "emAberto" | "pagasMes",
    { total: number; quantidade: number }>;
export const listarContasPagar = async (params: FiltrosContaPagar = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<ContaPagar>>(base, { params, signal })).data;
export const resumirContasPagar = async (signal?: AbortSignal) =>
    (await api.get<ResumoContasPagar>(`${base}/resumo`, { signal })).data;
export const listarCategoriasContasPagar = async (signal?: AbortSignal) =>
    (await api.get<string[]>(`${base}/categorias`, { signal })).data;

export const listarFornecedoresContaPagar = async (signal?: AbortSignal) =>
    (await api.get<FornecedorContaPagar[]>("/fornecedores", { signal })).data;

export const salvarContaPagar = async (dados: ContaPagarInput, id?: number) =>
    (await api.request<ContaPagar>({ method: id ? "PUT" : "POST", url: id ? `${base}/${id}` : base, data: dados })).data;

export const pagarConta = async (id: number, dados: PagamentoContaPagarInput) =>
    (await api.post<ContaPagar>(`${base}/${id}/pagar`, dados)).data;

export const cancelarConta = async (id: number) =>
    (await api.post<ContaPagar>(`${base}/${id}/cancelar`)).data;

export const estornarConta = async (id: number) =>
    (await api.post<ContaPagar>(`${base}/${id}/estornar`)).data;

export function mensagemContaPagar(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
