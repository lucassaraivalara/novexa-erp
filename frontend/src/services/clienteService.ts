import axios from "axios";
import api from "./api";
import type { Cliente, ClienteInput } from "../types/cliente";

export async function listarClientes(signal?: AbortSignal) {
    return (await api.get<Cliente[]>("/clientes", { signal })).data;
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
