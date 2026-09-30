import axios from "axios";
import api from "./api";
import type { ContaPagar, ContaPagarInput, FornecedorContaPagar, PagamentoContaPagarInput } from "../types/contaPagar";

const base = "/financeiro/contas-pagar";

export const listarContasPagar = async (signal?: AbortSignal) =>
    (await api.get<ContaPagar[]>(base, { signal })).data;

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
