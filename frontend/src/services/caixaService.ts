import axios from "axios";
import api from "./api";
import type { CaixaCompleta, CaixaInput, CaixaResumo } from "../types/caixa";

export const listarCaixas = async (signal?: AbortSignal) =>
    (await api.get<CaixaResumo[]>("/financeiro/caixas", { signal })).data;

export const buscarCaixa = async (id: number, signal?: AbortSignal) =>
    (await api.get<CaixaCompleta>(`/financeiro/caixas/${id}`, { signal })).data;

export const salvarCaixa = async (dados: CaixaInput, id?: number) =>
    (await api.request<CaixaCompleta>({ method: id ? "PUT" : "POST", url: id ? `/financeiro/caixas/${id}` : "/financeiro/caixas", data: dados })).data;

export const inativarCaixa = async (id: number) =>
    (await api.delete(`/financeiro/caixas/${id}`)).status === 204;

export function mensagemCaixa(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" ? dados : dados?.detail ?? padrao;
}