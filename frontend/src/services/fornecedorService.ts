import axios from "axios";
import api from "./api";
import type { PaginaResponse } from "../types/paginacao";
import type { FornecedorBusca, FornecedorCompleto, FornecedorInput } from "../types/fornecedor";

export type FiltrosFornecedor = { page?: number; size?: number; sort?: string; termo?: string; ativo?: boolean };

export const listarFornecedores = async (params: FiltrosFornecedor = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<FornecedorCompleto>>("/fornecedores", { params, signal })).data;

export const buscarFornecedores = async (termo: string, signal?: AbortSignal) =>
    (await api.get<FornecedorBusca[]>("/fornecedores/buscar", { params: { termo }, signal })).data;

export const buscarFornecedorPorId = async (id: number, signal?: AbortSignal) =>
    (await api.get<FornecedorCompleto>(`/fornecedores/${id}`, { signal })).data;

export const criarFornecedor = async (dados: FornecedorInput) =>
    (await api.post<FornecedorCompleto>("/fornecedores", dados)).data;

export const atualizarFornecedor = async (id: number, dados: FornecedorInput) =>
    (await api.put<FornecedorCompleto>(`/fornecedores/${id}`, dados)).data;

export const inativarFornecedor = async (id: number) => { await api.delete(`/fornecedores/${id}`); };

// PUT substitui todos os campos; por isso os dados atuais voltam no corpo.
export const fornecedorParaInput = (f: FornecedorCompleto): FornecedorInput => ({
    razaoSocial: f.razaoSocial, nomeFantasia: f.nomeFantasia, cpfCnpj: f.cpfCnpj, telefone: f.telefone,
    email: f.email, inscricaoEstadual: f.inscricaoEstadual, endereco: f.endereco, cep: f.cep,
    logradouro: f.logradouro, numero: f.numero, complemento: f.complemento, bairro: f.bairro,
    cidade: f.cidade, uf: f.uf, observacao: f.observacao, ativo: f.ativo,
});

// O backend reativa via PUT com ativo=true.
export async function reativarFornecedor(id: number) {
    const atual = await buscarFornecedorPorId(id);
    return atualizarFornecedor(id, { ...fornecedorParaInput(atual), ativo: true });
}

export function mensagemFornecedor(erro: unknown, padrao: string) {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    if (erro.response.status === 409) return "Já existe um fornecedor com este CPF/CNPJ.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
