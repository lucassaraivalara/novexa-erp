import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { CategoriaProduto, CategoriaProdutoInput, SubcategoriaProduto, SubcategoriaProdutoInput } from "../types/categoriaProduto";

export type FiltrosCategoria = { termo?: string; ativo?: boolean; page?: number; size?: number; sort?: string };
export const listarCategorias = async (params: FiltrosCategoria = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<CategoriaProduto>>("/produtos/categorias", { params, signal })).data;
export const listarSubcategorias = async (params: FiltrosCategoria & { categoriaId?: number } = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<SubcategoriaProduto>>("/produtos/subcategorias", { params, signal })).data;
export const salvarCategoria = async (id: number | null, dados: CategoriaProdutoInput) =>
    (id === null ? await api.post<CategoriaProduto>("/produtos/categorias", dados)
        : await api.put<CategoriaProduto>(`/produtos/categorias/${id}`, dados)).data;
export const salvarSubcategoria = async (id: number | null, dados: SubcategoriaProdutoInput) =>
    (id === null ? await api.post<SubcategoriaProduto>("/produtos/subcategorias", dados)
        : await api.put<SubcategoriaProduto>(`/produtos/subcategorias/${id}`, dados)).data;
export const excluirCategoria = async (id: number) => { await api.delete(`/produtos/categorias/${id}`); };
export const excluirSubcategoria = async (id: number) => { await api.delete(`/produtos/subcategorias/${id}`); };

export function mensagemCategoria(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
