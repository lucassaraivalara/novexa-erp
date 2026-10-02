import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { Recebivel, StatusRecebivel, TipoRecebivel } from "../types/recebivel";

const base = "/financeiro/recebiveis";

export type FiltrosRecebiveis = {
    page?: number;
    size?: number;
    sort?: string;
    status?: StatusRecebivel;
    tipo?: TipoRecebivel;
    dataInicial?: string;
    dataFinal?: string;
    vendaId?: number;
};

export const listarRecebiveis = async (params: FiltrosRecebiveis = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<Recebivel>>(base, { params, signal })).data;

export const liquidarRecebivel = async (id: number) =>
    (await api.post<Recebivel>(`${base}/${id}/liquidar`)).data;

export function mensagemRecebivel(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" ? dados : dados?.detail ?? dados?.message ?? padrao;
}
