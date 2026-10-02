import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { Fornecedor, FornecedorBusca } from "../types/fornecedor";

export type FiltrosFornecedor = { page?: number; size?: number; sort?: string; termo?: string; ativo?: boolean };

export const listarFornecedores = async (params: FiltrosFornecedor = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<Fornecedor>>("/fornecedores", { params, signal })).data;

export const buscarFornecedores = async (termo: string, signal?: AbortSignal) =>
    (await api.get<FornecedorBusca[]>("/fornecedores/buscar", { params: { termo }, signal })).data;
