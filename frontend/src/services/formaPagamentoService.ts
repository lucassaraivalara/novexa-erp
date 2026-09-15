import axios from "axios";
import api from "./api";
import type { FormaPagamentoResumo } from "../types/formaPagamento";

export async function listarFormasPagamento(signal?: AbortSignal): Promise<FormaPagamentoResumo[]> {
    return (await api.get<FormaPagamentoResumo[]>("/financeiro/formas-pagamento", { signal })).data;
}

export function mensagemFormaPagamento(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" && dados.trim() ? dados : padrao;
}
