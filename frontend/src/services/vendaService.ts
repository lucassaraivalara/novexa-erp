import api from "./api";

export type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO";
export type VendaInput = {
    chaveRequisicao: string;
    itens: { produtoId: number; quantidade: number; precoUnitarioEsperado: number }[];
    clienteId: number | null; desconto: number; totalEsperado: number; formaPagamento: FormaPagamento;
    valorRecebido: number; entrega: string; observacoes: string;
};
export type Venda = { id: number; total: number; troco: number; dataHora: string };
export async function finalizarVenda(pedido: VendaInput): Promise<Venda> {
    return (await api.post<Venda>("/vendas", pedido, { timeout: 15000 })).data;
}
