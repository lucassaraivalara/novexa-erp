import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { MovimentacaoFinanceira } from "../types/contaFinanceira";

export type EntregaCofre = { contaCofreId: number | null; valor: number; valorTroco: number; responsavel: string | null; observacao: string | null; confirmarEntrega: boolean };
export type Cofre = { id: number; nome: string; saldoAtual: number; ativo: boolean };
export type ResumoCofre = { saldo: number; entradas: number; saidas: number; contas: Cofre[] };
export type PendenteCofre = { sessaoId: number; operador: string; contado: number; valor: number; valorTroco: number; recolhimentoId: number | null; responsavel: string | null; data: string };
export type RegistroCofre = { id: number; sessaoId: number; tipo: string; valor: number; valorTroco: number; responsavel: string | null; observacao: string | null; operador: string; cofre: string | null; data: string; dataConfirmacao: string | null; movimentoFinanceiroId: number | null };
export const resumoCofre = async (signal?: AbortSignal) => (await api.get<ResumoCofre>("/financeiro/cofre/resumo", { signal })).data;
export const pendenciasCofre = async (page: number, signal?: AbortSignal) => (await api.get<PaginaResponse<PendenteCofre>>("/financeiro/cofre/pendencias", { params: { page }, signal })).data;
export const historicoCofre = async (page: number, signal?: AbortSignal) => (await api.get<PaginaResponse<RegistroCofre>>("/financeiro/cofre/recolhimentos", { params: { page }, signal })).data;
export const destinarCofre = async (id: number, dados: EntregaCofre) => (await api.post(`/financeiro/cofre/sessoes/${id}/recolhimento`, dados)).data;
export const confirmarCofre = async (id: number) => (await api.post(`/financeiro/cofre/recolhimentos/${id}/confirmar`, { confirmarEntrega: true })).data;
export const devolverTroco = async (chaveRequisicao: string, sessaoId: number, entrega: EntregaCofre) => (await api.post("/financeiro/cofre/devolucoes", { chaveRequisicao, sessaoId, entrega })).data;
export const extratoCofre = async (id: number, page: number, signal?: AbortSignal) => (await api.get<PaginaResponse<MovimentacaoFinanceira>>(`/financeiro/cofre/contas/${id}/movimentos`, { params: { page }, signal })).data;
