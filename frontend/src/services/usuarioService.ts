import axios from "axios";
import api from "./api";
import type { Usuario, UsuarioInput, UsuarioSenhaInput, UsuarioSituacaoInput } from "../types/usuario";

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
    if (typeof erro.response?.data === "string") return erro.response.data;
    return !erro.response ? "Não foi possível comunicar com o servidor. Tente novamente." : padrao;
}
