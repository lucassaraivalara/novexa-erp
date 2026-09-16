import axios from "axios";
import api from "./api";
import type {
    AgenciaInput,
    AgenciaResumo,
    BancoInput,
    BancoResumo,
    ContaBancariaInput,
    ContaBancariaResumo,
    TipoContaBancaria,
} from "../types/dadosBancarios";

export const listarBancos = async (signal?: AbortSignal) =>
    (await api.get<BancoResumo[]>("/financeiro/bancos", { signal })).data;

export const salvarBanco = async (dados: BancoInput, id?: number) =>
    (await api.request<BancoResumo>({
        method: id ? "PUT" : "POST",
        url: id ? `/financeiro/bancos/${id}` : "/financeiro/bancos",
        data: dados,
    })).data;

export const listarAgencias = async (bancoId?: number, signal?: AbortSignal) =>
    (await api.get<AgenciaResumo[]>("/financeiro/agencias", {
        params: bancoId ? { bancoId } : undefined,
        signal,
    })).data;

export const salvarAgencia = async (dados: AgenciaInput, id?: number) =>
    (await api.request<AgenciaResumo>({
        method: id ? "PUT" : "POST",
        url: id ? `/financeiro/agencias/${id}` : "/financeiro/agencias",
        data: dados,
    })).data;

export const listarContasBancarias = async (
    filtros?: { agenciaId?: number; bancoId?: number; tipo?: TipoContaBancaria; ativo?: boolean },
    signal?: AbortSignal,
) =>
    (await api.get<ContaBancariaResumo[]>("/financeiro/contas-bancarias", {
        params: filtros,
        signal,
    })).data;

export const salvarContaBancaria = async (dados: ContaBancariaInput, id?: number) =>
    (await api.request<ContaBancariaResumo>({
        method: id ? "PUT" : "POST",
        url: id ? `/financeiro/contas-bancarias/${id}` : "/financeiro/contas-bancarias",
        data: dados,
    })).data;

export function mensagemDadosBancarios(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" && dados.trim() ? dados : padrao;
}
