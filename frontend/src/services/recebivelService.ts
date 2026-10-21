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

export const listarAgendaRecebimentos = async (page = 0, size = 25, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<import("../types/recebivel").GrupoAgenda>>(`${base}/agenda`, { params: { page, size }, signal })).data;
export const consultarItensAgenda = async (grupo: import("../types/recebivel").GrupoAgenda, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<import("../types/recebivel").ItemAgenda>>(`${base}/agenda/itens`, { params: {
        data: grupo.dataPrevista ?? undefined, configuracaoId: grupo.configuracaoId ?? undefined, tipo: grupo.tipo,
        contaDestinoId: grupo.contaDestinoId ?? undefined, page: 0, size: 200,
    }, signal })).data;
export const liquidarLoteRecebiveis = async (recebivelIds: number[]) =>
    (await api.post<Recebivel[]>(`${base}/liquidar-lote`, { recebivelIds })).data;
