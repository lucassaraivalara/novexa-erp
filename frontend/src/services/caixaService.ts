import axios from "axios";
import api from "./api";
import type {
    CaixaCompleta,
    CaixaInput,
    CaixaResumo,
    SessaoCaixaAberta,
    ResumoSessaoCaixa,
    MovimentacaoCaixa,
    MovimentacaoCaixaInput,
    AberturaCaixaInput,
    FechamentoCaixaInput,
    SessaoCaixaResponse,
    SessaoCaixaHistorico,
} from "../types/caixa";

export const listarCaixas = async (signal?: AbortSignal) =>
    (await api.get<CaixaResumo[]>("/financeiro/caixas", { signal })).data;

export const buscarCaixa = async (id: number, signal?: AbortSignal) =>
    (await api.get<CaixaCompleta>(`/financeiro/caixas/${id}`, { signal })).data;

export const salvarCaixa = async (dados: CaixaInput, id?: number) =>
    (await api.request<CaixaCompleta>({ method: id ? "PUT" : "POST", url: id ? `/financeiro/caixas/${id}` : "/financeiro/caixas", data: dados })).data;

export const inativarCaixa = async (id: number) =>
    (await api.delete(`/financeiro/caixas/${id}`)).status === 204;

export const listarSessoesAbertas = async (signal?: AbortSignal) =>
    (await api.get<SessaoCaixaAberta[]>("/financeiro/caixas/sessoes/abertas", { signal })).data;

export const listarSessoesFechadas = async (signal?: AbortSignal) =>
    (await api.get<SessaoCaixaHistorico[]>("/financeiro/caixas/sessoes/fechadas", { signal })).data;

export const abrirSessaoCaixa = async (caixaId: number, dados: AberturaCaixaInput) =>
    (await api.post<SessaoCaixaResponse>(`/financeiro/caixas/${caixaId}/sessoes`, dados)).data;

export const buscarResumoSessao = async (sessaoId: number, signal?: AbortSignal) =>
    (await api.get<ResumoSessaoCaixa>(`/financeiro/caixas/sessoes/${sessaoId}/resumo`, { signal })).data;

export const listarMovimentacoes = async (sessaoId: number, signal?: AbortSignal) =>
    (await api.get<MovimentacaoCaixa[]>(`/financeiro/caixas/sessoes/${sessaoId}/movimentacoes`, { signal })).data;

export const adicionarMovimentacao = async (sessaoId: number, dados: MovimentacaoCaixaInput) =>
    (await api.post<MovimentacaoCaixa>(`/financeiro/caixas/sessoes/${sessaoId}/movimentacoes`, dados)).data;

export const fecharSessaoCaixa = async (caixaId: number, sessaoId: number, dados: FechamentoCaixaInput) =>
    (await api.post<SessaoCaixaResponse>(`/financeiro/caixas/${caixaId}/sessoes/${sessaoId}/fechar`, dados)).data;

export function mensagemCaixa(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" ? dados : dados?.detail ?? padrao;
}