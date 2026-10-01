import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import { listarProdutosPaginado, type FiltrosProduto } from "./produtoService";

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

export async function listarProdutosEstoque(params: FiltrosProduto = {}, signal?: AbortSignal) {
    return listarProdutosPaginado(params, signal);
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

export type FiltrosHistoricoEstoque = {
    page?: number; size?: number; sort?: string; tipo?: string; origem?: string;
    dataInicial?: string; dataFinal?: string;
};
export async function listarHistoricoProduto(produtoId: number, params: FiltrosHistoricoEstoque = {}, signal?: AbortSignal) {
    return (await api.get<PaginaResponse<MovimentacaoEstoque>>(`/estoque/movimentacoes/produto/${produtoId}`, { params, signal })).data;
}

export function obterMensagemEstoque(erro: unknown, mensagemPadrao: string): string {
    if (!axios.isAxiosError(erro)) return mensagemPadrao;
    if (typeof erro.response?.data === "string" && erro.response.data.trim()) return erro.response.data;
    if (!erro.response) return "Não foi possível comunicar com o backend. Verifique se a API está em execução.";
    return mensagemPadrao;
}
