import axios from "axios";
import api from "./api";
import type { CoordenadaEmpresa, EmpresaCompleta, EmpresaInput, EmpresaResumo } from "../types/empresa";

export const listarEmpresas = async (signal?: AbortSignal) =>
    (await api.get<EmpresaResumo[]>("/empresas", { signal })).data;
export const buscarEmpresa = async (id: number, signal?: AbortSignal) =>
    (await api.get<EmpresaCompleta>(`/empresas/${id}`, { signal })).data;
export const salvarEmpresa = async (dados: EmpresaInput, id?: number) =>
    (await api.request<EmpresaCompleta>({ method: id ? "PUT" : "POST", url: id ? `/empresas/${id}` : "/empresas", data: dados })).data;
export const consultarGeocodificacao = async (signal?: AbortSignal) =>
    (await api.get<{ configurado: boolean }>("/empresas/geocodificacao/status", { signal })).data;
export const buscarCoordenadas = async (endereco: string, signal?: AbortSignal) =>
    (await api.post<CoordenadaEmpresa[]>("/empresas/geocodificacao", { endereco }, { signal, timeout: 20000 })).data;

export function mensagemEmpresa(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" ? dados : dados?.detail ?? padrao;
}
