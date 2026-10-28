import api from "./api";

export type ItemAjusteLote = {
    produtoId: number; valor: string;
    saldoEsperado?: number | string; ultimaMovimentacaoIdEsperada?: number | null;
};
export type PedidoAjusteLote = {
    modo: "SALDO_FINAL"; motivo: string; chaveRequisicao?: string; itens: ItemAjusteLote[];
};
export type LinhaAjusteLote = {
    produtoId: number; codigoInterno: string | null; nome: string | null; unidade: string | null;
    saldoAnterior: number | null; saldoFinal: number; diferenca: number | null;
    ultimaMovimentacaoId: number | null; status: "INVALIDO" | "VALIDO" | "APLICADO" | "SEM_ALTERACAO";
    erros: string[]; movimentacaoId: number | null;
};
export type ResultadoAjusteLote = { chaveRequisicao: string | null; itens: LinhaAjusteLote[]; alterados: number; semAlteracao: number };
export type LinhaImportacaoEstoque = {
    linha: number; codigo: string; descricaoPlanilha: string; produtoId: number | null; produto: string | null;
    saldoAtual: string | null; quantidade: string | null; diferenca: string | null; ultimaMovimentacaoId: number | null;
    situacao: "INVALIDO" | "VALIDO" | "SEM_ALTERACAO"; erros: string[];
};
export type PreviaImportacaoEstoque = {
    linhas: LinhaImportacaoEstoque[];
    totais: { linhas: number; identificados: number; validos: number; invalidos: number; comDiferenca: number; semAlteracao: number };
    lote: ResultadoAjusteLote;
};
export async function previaAjusteLote(pedido: PedidoAjusteLote) {
    return (await api.post<ResultadoAjusteLote>("/estoque/ajustes-lote/previa", pedido)).data;
}
export async function previaImportacaoEstoque(arquivo: File, motivo: string) {
    const form = new FormData(); form.append("arquivo", arquivo); form.append("motivo", motivo);
    return (await api.post<PreviaImportacaoEstoque>("/estoque/ajustes-lote/importacao/previa", form)).data;
}
export async function confirmarAjusteLote(pedido: PedidoAjusteLote) {
    return (await api.post<ResultadoAjusteLote>("/estoque/ajustes-lote/confirmar", pedido)).data;
}
