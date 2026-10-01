import axios from "axios";
import api from "./api";
import type { ConfiguracaoFormaPagamento, ConfiguracaoFormaPagamentoInput } from "../types/configuracaoFormaPagamento";

const base = "/financeiro/configuracoes-formas-pagamento";

export const listarConfiguracoesFormasPagamento = async (situacao: "ativas" | "inativas" | "todas" = "todas", signal?: AbortSignal) =>
    (await api.get<ConfiguracaoFormaPagamento[]>(base, { params: { situacao }, signal })).data;

export const listarConfiguracoesParaPDV = async (signal?: AbortSignal) => {
    const todas = await listarConfiguracoesFormasPagamento("ativas", signal);
    // Filtrar apenas tipos suportados operacionalmente no PDV
    const tiposSuportados: ConfiguracaoFormaPagamento["tipo"][] = ["DINHEIRO", "PIX", "DEBITO", "CREDITO"];
    return todas.filter(c => tiposSuportados.includes(c.tipo));
};

export const buscarConfiguracaoFormaPagamento = async (id: number, signal?: AbortSignal) =>
    (await api.get<ConfiguracaoFormaPagamento>(`${base}/${id}`, { signal })).data;

export const salvarConfiguracaoFormaPagamento = async (dados: ConfiguracaoFormaPagamentoInput, id?: number) =>
    (await api.request<ConfiguracaoFormaPagamento>({
        method: id ? "PUT" : "POST",
        url: id ? `${base}/${id}` : base,
        data: dados,
    })).data;

export function mensagemConfiguracaoFormaPagamento(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    const dados = erro.response.data;
    return typeof dados === "string" && dados.trim() ? dados : padrao;
}