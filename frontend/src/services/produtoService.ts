import axios from "axios";
import type { Produto, ProdutoInput } from "../types/produto";
import api from "./api";

export async function listarProdutos(signal?: AbortSignal): Promise<Produto[]> {
    const resposta = await api.get<Produto[]>("/produtos", { signal });

    return resposta.data;
}

export async function pesquisarProdutos(
    termo: string,
    signal?: AbortSignal,
): Promise<Produto[]> {
    const resposta = await api.get<Produto[]>("/produtos/buscar", {
        params: { termo },
        signal,
    });

    return resposta.data;
}

export async function buscarProdutoPorId(
    id: number,
): Promise<Produto> {
    const resposta = await api.get<Produto>(`/produtos/${id}`);

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

export async function enviarImagemProduto(id: number, arquivo: File): Promise<Produto> {
    const formulario = new FormData();
    formulario.append("arquivo", arquivo);
    const resposta = await api.post<Produto>(`/produtos/${id}/imagem`, formulario);
    return resposta.data;
}

export async function removerImagemProduto(id: number): Promise<Produto> {
    const resposta = await api.delete<Produto>(`/produtos/${id}/imagem`);
    return resposta.data;
}

function dadosSemSaldo(dados: ProdutoInput): ProdutoInput {
    const dadosProduto = { ...dados } as ProdutoInput & { estoqueAtual?: number };
    delete dadosProduto.estoqueAtual;
    return dadosProduto;
}

export async function excluirProduto(id: number): Promise<void> {
    await api.delete(`/produtos/${id}`);
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

    if (erro.response?.data && typeof erro.response.data === "object") {
        const dados = erro.response.data as { message?: unknown; detail?: unknown };
        const mensagem = typeof dados.message === "string"
            ? dados.message
            : typeof dados.detail === "string"
                ? dados.detail
                : null;

        if (mensagem?.trim()) {
            return mensagem;
        }
    }

    if (!erro.response) {
        return "Não foi possível comunicar com o backend. Verifique se a API está em execução.";
    }

    return mensagemPadrao;
}
