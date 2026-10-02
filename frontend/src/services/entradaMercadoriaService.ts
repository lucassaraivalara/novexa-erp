import api from "./api";
import axios from "axios";
import { obterMensagemDaApi } from "./produtoService";
import type { PaginaResponse } from "../types/paginacao";
import type { EntradaMercadoria, EntradaMercadoriaInput, EntradaXmlInput, EntradaXmlPreview, OrigemEntradaMercadoria, StatusEntradaMercadoria } from "../types/entradaMercadoria";

export type FiltrosEntradaMercadoria = {
    page?: number; size?: number; sort?: string; termo?: string;
    status?: StatusEntradaMercadoria; origem?: OrigemEntradaMercadoria; fornecedorId?: number;
    dataInicial?: string; dataFinal?: string;
};
const caminho = "/estoque/entradas";
export const listarEntradas = async (params: FiltrosEntradaMercadoria = {}, signal?: AbortSignal) =>
    (await api.get<PaginaResponse<EntradaMercadoria>>(caminho, { params, signal })).data;
export const buscarEntradaPorId = async (id: number, signal?: AbortSignal) =>
    (await api.get<EntradaMercadoria>(`${caminho}/${id}`, { signal })).data;
export const criarEntrada = async (dados: EntradaMercadoriaInput) =>
    (await api.post<EntradaMercadoria>(caminho, dados)).data;
export const atualizarEntrada = async (id: number, dados: EntradaMercadoriaInput) =>
    (await api.put<EntradaMercadoria>(`${caminho}/${id}`, dados)).data;
export const confirmarEntrada = async (id: number) =>
    (await api.post<EntradaMercadoria>(`${caminho}/${id}/confirmar`)).data;
export const cancelarEntrada = async (id: number) =>
    (await api.post<EntradaMercadoria>(`${caminho}/${id}/cancelar`)).data;

// Mesmo limite atual de spring.servlet.multipart.max-file-size; o backend valida novamente.
export const limiteArquivoXml = 2 * 1024 * 1024;
export async function importarXmlEntrada(arquivo: File): Promise<EntradaXmlPreview> {
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    return (await api.post<EntradaXmlPreview>(`${caminho}/importar-xml`, dados)).data;
}
export const criarEntradaXml = async (dados: EntradaXmlInput) =>
    (await api.post<EntradaMercadoria>(`${caminho}/from-xml`, dados)).data;

export function mensagemPreviewXml(erro: unknown): string {
    if (axios.isAxiosError(erro)) {
        switch (erro.response?.status) {
            case 400: return "Não foi possível ler este XML. Verifique o arquivo e tente novamente.";
            case 422: return "Este arquivo não contém uma NF-e válida.";
            case 409: return "Esta nota fiscal já foi importada.";
            case 413: return "O arquivo XML deve ter no máximo 2 MB.";
        }
    }
    return obterMensagemDaApi(erro, "Não foi possível importar o XML.");
}
