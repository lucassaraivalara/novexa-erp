import axios from "axios";
import api from "./api";
import type { Cliente, ClienteInput } from "../types/cliente";
import type { PaginaResponse } from "../types/paginacao";

export type FiltrosCliente = {
    busca?: string;
    campoBusca?: "id" | "nome" | "nomeFantasia" | "cpfCnpj" | "cidadeUf" | "telefone";
    situacao?: "ativos" | "inativos" | "todos";
};

export async function listarClientes(signal?: AbortSignal) {
    return (await api.get<Cliente[]>("/clientes/opcoes", { signal })).data;
}

export async function listarClientesPaginado(filtros: FiltrosCliente, page: number, size: number, sort: string, signal?: AbortSignal) {
    const params = { ...filtros, page, size, sort };
    return (await api.get<PaginaResponse<Cliente>>("/clientes", { params, signal })).data;
}

export async function buscarCliente(id: number) {
    return (await api.get<Cliente>(`/clientes/${id}`)).data;
}

export async function salvarCliente(dados: ClienteInput, id?: number) {
    return id
        ? (await api.put<Cliente>(`/clientes/${id}`, dados)).data
        : (await api.post<Cliente>("/clientes", dados)).data;
}

export function mensagemCliente(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (erro.response?.status === 401) return "Não foi possível autorizar a operação em Clientes. Tente novamente ou contate o suporte.";
    if (typeof erro.response?.data === "string") return erro.response.data;
    return !erro.response ? "Não foi possível comunicar com o servidor. Tente novamente." : padrao;
}
