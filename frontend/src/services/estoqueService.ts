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
    entradaMercadoriaId?: number | null;
    vendaId?: number | null;
    produtoCompostoId?: number | null;
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
    if (!erro.response) return "Não foi possível comunicar com a API. Verifique a conexão. Se estava confirmando uma movimentação, consulte o saldo e o histórico antes de enviar novamente.";
    const { status, data } = erro.response;
    if (status >= 500) return "A API não concluiu a resposta. Consulte o saldo e o histórico antes de repetir uma movimentação. Se o problema persistir, contate o suporte.";
    const mensagem = typeof data === "string" ? data : data?.detail ?? data?.message;
    if (typeof mensagem === "string" && mensagem.trim()) return mensagem.trim().slice(0, 500);
    return mensagemPadrao;
}
