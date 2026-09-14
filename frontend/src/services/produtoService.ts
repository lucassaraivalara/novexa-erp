import axios from "axios";
import type { Produto, ProdutoInput } from "../types/produto";
import api from "./api";

export async function listarProdutos(empresaId: number): Promise<Produto[]> {
    const resposta = await api.get<Produto[]>("/produtos", {
        params: { empresaId },
    });

    return resposta.data;
}

export async function pesquisarProdutos(
    empresaId: number,
    termo: string,
): Promise<Produto[]> {
    const resposta = await api.get<Produto[]>("/produtos/buscar", {
        params: { empresaId, termo },
    });

    return resposta.data;
}

export async function buscarProdutoPorId(
    id: number,
    empresaId: number,
): Promise<Produto> {
    const resposta = await api.get<Produto>(`/produtos/${id}`, {
        params: { empresaId },
    });

    return resposta.data;
}

export async function cadastrarProduto(dados: ProdutoInput): Promise<Produto> {
    const resposta = await api.post<Produto>("/produtos", dadosSemSaldo(dados));
    return resposta.data;
}

export async function atualizarProduto(
    id: number,
    dados: ProdutoInput,
): Promise<Produto> {
    const resposta = await api.put<Produto>(`/produtos/${id}`, dadosSemSaldo(dados));
    return resposta.data;
}

function dadosSemSaldo(dados: ProdutoInput): ProdutoInput {
    const dadosProduto = { ...dados } as ProdutoInput & { estoqueAtual?: number };
    delete dadosProduto.estoqueAtual;
    return dadosProduto;
}

export async function excluirProduto(id: number, empresaId: number): Promise<void> {
    await api.delete(`/produtos/${id}`, {
        params: { empresaId },
    });
}

export function obterMensagemDaApi(
    erro: unknown,
    mensagemPadrao: string,
): string {
    if (!axios.isAxiosError(erro)) {
        return mensagemPadrao;
    }

    if (typeof erro.response?.data === "string" && erro.response.data.trim()) {
        return erro.response.data;
    }

    if (!erro.response) {
        return "Não foi possível comunicar com o backend. Verifique se a API está em execução.";
    }

    return mensagemPadrao;
}
