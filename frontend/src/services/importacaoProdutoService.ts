import api from "./api";
import type { ImportacaoProduto } from "../types/importacaoProduto";

export async function prepararImportacaoProdutos(arquivo: File) {
    const dados = new FormData(); dados.append("arquivo", arquivo);
    return (await api.post<ImportacaoProduto>("/produtos/importacoes", dados)).data;
}
export async function confirmarImportacaoProdutos(id: string) {
    return (await api.post<ImportacaoProduto>(`/produtos/importacoes/${id}/confirmar`)).data;
}
export async function cancelarImportacaoProdutos(id: string) {
    return (await api.post<ImportacaoProduto>(`/produtos/importacoes/${id}/cancelar`)).data;
}
export async function baixarErrosImportacaoProdutos(id: string) {
    const resposta = await api.get<Blob>(`/produtos/importacoes/${id}/erros`, { responseType: "blob" });
    const url = URL.createObjectURL(resposta.data);
    const link = document.createElement("a"); link.href = url; link.download = "erros-importacao-produtos.csv";
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
