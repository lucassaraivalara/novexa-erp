import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { Marca, MarcaInput } from "../types/marca";

export type FiltrosMarca = { termo?: string; ativo?: boolean; page?: number; size?: number; sort?: string };
export const listarMarcas = async (params: FiltrosMarca = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<Marca>>("/produtos/marcas", { params, signal })).data;
export const salvarMarca = async (id: number | null, dados: MarcaInput) =>
    (id === null ? await api.post<Marca>("/produtos/marcas", dados)
        : await api.put<Marca>(`/produtos/marcas/${id}`, dados)).data;
export const excluirMarca = async (id: number) => { await api.delete(`/produtos/marcas/${id}`); };

export function mensagemMarca(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
