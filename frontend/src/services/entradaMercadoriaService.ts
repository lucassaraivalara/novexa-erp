import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { EntradaMercadoria, EntradaMercadoriaInput, OrigemEntradaMercadoria, StatusEntradaMercadoria } from "../types/entradaMercadoria";

export type FiltrosEntradaMercadoria = {
    page?: number; size?: number; sort?: string; termo?: string;
    status?: StatusEntradaMercadoria; origem?: OrigemEntradaMercadoria; fornecedorId?: number;
    dataInicial?: string; dataFinal?: string;
};
const caminho = "/estoque/entradas";
export const listarEntradas = async (params: FiltrosEntradaMercadoria = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<EntradaMercadoria>>(caminho, { params, signal })).data;
export const buscarEntradaPorId = async (id: number, signal?: AbortSignal) =>
    (await api.get<EntradaMercadoria>(`${caminho}/${id}`, { signal })).data;
export const criarEntrada = async (dados: EntradaMercadoriaInput) =>
    (await api.post<EntradaMercadoria>(caminho, dados)).data;
export const atualizarEntrada = async (id: number, dados: EntradaMercadoriaInput) =>
    (await api.put<EntradaMercadoria>(`${caminho}/${id}`, dados)).data;
export const confirmarEntrada = async (id: number) =>
    (await api.post<EntradaMercadoria>(`${caminho}/${id}/confirmar`)).data;
export const cancelarEntrada = async (id: number) =>
    (await api.post<EntradaMercadoria>(`${caminho}/${id}/cancelar`)).data;
