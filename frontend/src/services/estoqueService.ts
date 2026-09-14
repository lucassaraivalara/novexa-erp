import axios from "axios";
import type { Produto } from "../types/produto";
import api from "./api";

export type TipoMovimentacaoEstoque = "ENTRADA" | "SAIDA" | "AJUSTE";

export type MovimentacaoEstoqueRequest = {
    produtoId: number;
    quantidade: number;
    motivo?: string;
};

export type MovimentacaoEstoque = {
    id: number;
    produtoId: number;
    produtoNome: string;
    tipo: TipoMovimentacaoEstoque;
    origem: string;
    quantidade: number;
    saldoAnterior: number;
    saldoPosterior: number;
    motivo: string | null;
    dataHora: string;
    usuarioId: number;
    nomeUsuario: string;
};

export async function listarProdutosEstoque(): Promise<Produto[]> {
    return (await api.get<Produto[]>("/produtos")).data;
}

export async function registrarEntrada(dados: MovimentacaoEstoqueRequest): Promise<MovimentacaoEstoque> {
    return (await api.post<MovimentacaoEstoque>("/estoque/movimentacoes/entrada", dados)).data;
}

export async function registrarSaida(dados: MovimentacaoEstoqueRequest): Promise<MovimentacaoEstoque> {
    return (await api.post<MovimentacaoEstoque>("/estoque/movimentacoes/saida", dados)).data;
}

export async function registrarAjuste(dados: MovimentacaoEstoqueRequest): Promise<MovimentacaoEstoque> {
    return (await api.post<MovimentacaoEstoque>("/estoque/movimentacoes/ajuste", dados)).data;
}

export async function listarHistoricoProduto(produtoId: number): Promise<MovimentacaoEstoque[]> {
    return (await api.get<MovimentacaoEstoque[]>(`/estoque/movimentacoes/produto/${produtoId}`)).data;
}

export function obterMensagemEstoque(erro: unknown, mensagemPadrao: string): string {
    if (!axios.isAxiosError(erro)) return mensagemPadrao;
    if (typeof erro.response?.data === "string" && erro.response.data.trim()) return erro.response.data;
    if (!erro.response) return "Não foi possível comunicar com o backend. Verifique se a API está em execução.";
    return mensagemPadrao;
}