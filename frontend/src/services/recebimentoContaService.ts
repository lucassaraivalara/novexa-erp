import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { RecebimentoConta, RecebimentoContaResumo, SituacaoRecebimentoConta } from "../types/recebimentoConta";

const base = "/financeiro/recebimentos-contas";
export type FiltrosRecebimentoConta = {
    contaId?: number;
    semDestino?: boolean;
    status?: SituacaoRecebimentoConta;
    page?: number;
    size?: number;
    sort?: string;
};
export const listarRecebimentosContas = async (params: FiltrosRecebimentoConta, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<RecebimentoConta>>(base, { params, signal })).data;
export const resumirRecebimentosContas = async (signal?: AbortSignal) =>
    (await api.get<RecebimentoContaResumo[]>(`${base}/resumo`, { signal })).data;
