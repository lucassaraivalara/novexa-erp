import api from "./api";
import axios from "axios";

export type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO";
export type StatusVenda = "ABERTA" | "FATURADA" | "CANCELADA";
export type VendaInput = {
    chaveRequisicao: string;
    itens: { produtoId: number; quantidade: number; precoUnitarioEsperado: number }[];
    clienteId: number | null; desconto: number; totalEsperado: number; formaPagamento: FormaPagamento;
    valorRecebido: number; entrega: string; observacoes: string;
    formaPagamentoId?: number;
    sessaoCaixaId?: number;
};
export type Venda = { id: number; total: number; troco: number; dataHora: string };
export type VendaResumo = {
    id: number;
    dataHora: string;
    clienteId: number | null;
    nomeCliente: string | null;
    total: number;
    status: StatusVenda;
    sessaoCaixaId: number | null;
};
export type ItemVenda = {
    id: number;
    produtoId: number;
    nomeProduto: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    movimentacaoEstoqueId: number | null;
    ordem: number;
};
export type VendaDetalhe = {
    id: number;
    dataHora: string;
    subtotal: number;
    desconto: number;
    total: number;
    formaPagamento: FormaPagamento | null;
    valorRecebido: number | null;
    troco: number | null;
    clienteId: number | null;
    entrega: string | null;
    observacoes: string | null;
    itens: ItemVenda[];
    status: StatusVenda;
    sessaoCaixaId: number | null;
};
export type FiltrosVenda = {
    status?: StatusVenda;
    dataInicial?: string;
    dataFinal?: string;
    clienteId?: number;
};

export async function finalizarVenda(pedido: VendaInput): Promise<Venda> {
    return (await api.post<Venda>("/vendas", pedido, { timeout: 15000 })).data;
}

export async function listarVendas(filtros: FiltrosVenda, signal?: AbortSignal): Promise<VendaResumo[]> {
    return (await api.get<VendaResumo[]>("/vendas", { params: filtros, signal })).data;
}

export async function buscarVenda(id: number, signal?: AbortSignal): Promise<VendaDetalhe> {
    return (await api.get<VendaDetalhe>(`/vendas/${id}`, { signal })).data;
}

export async function cancelarVenda(id: number): Promise<VendaDetalhe> {
    return (await api.post<VendaDetalhe>(`/vendas/${id}/cancelar`)).data;
}

export function mensagemVenda(erro: unknown, padrao: string): string {
    if (!axios.isAxiosError(erro)) return padrao;
    if (!erro.response) return "Não foi possível comunicar com o servidor. Tente novamente.";
    return typeof erro.response.data === "string" ? erro.response.data : erro.response.data?.detail ?? padrao;
}
