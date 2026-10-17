import axios from "axios";
import api from "./api";
import type { Usuario, UsuarioInput, UsuarioSenhaInput, UsuarioSituacaoInput } from "../types/usuario";
import type { PaginaResponse } from "../types/paginacao";

export async function listarUsuariosPagina(params: { termo?: string; ativo?: boolean; page: number; size: number; sort: string }, signal?: AbortSignal) {
    return (await api.get<PaginaResponse<Usuario>>("/usuarios/pagina", { params, signal })).data;
}

export async function listarUsuarios(signal?: AbortSignal) {
    return (await api.get<Usuario[]>("/usuarios", { signal })).data;
}

export async function salvarUsuario(dados: UsuarioInput, id?: number) {
    return id
        ? (await api.put<Usuario>(`/usuarios/${id}`, dados)).data
        : (await api.post<Usuario>("/usuarios", dados)).data;
}

export async function alterarSituacaoUsuario(id: number, dados: UsuarioSituacaoInput) {
    return (await api.patch<Usuario>(`/usuarios/${id}/situacao`, dados)).data;
}

export async function redefinirSenhaUsuario(id: number, dados: UsuarioSenhaInput) {
    return (await api.patch<Usuario>(`/usuarios/${id}/senha`, dados)).data;
}

export function mensagemUsuario(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (erro.response?.status === 401) return "Sessão expirada. Entre novamente para continuar.";
    if (erro.response?.status === 403) return "Somente ADMIN pode gerenciar usuários.";
    if (typeof erro.response?.data === "string") return erro.response.data;
    return !erro.response ? "Não foi possível comunicar com o servidor. Tente novamente." : padrao;
}
