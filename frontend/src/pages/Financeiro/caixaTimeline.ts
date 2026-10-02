import type { MovimentacaoCaixa } from "../../types/caixa";
import type { VendaDetalhe } from "../../services/vendaService";

const rotuloFormaPagamento: Record<NonNullable<VendaDetalhe["formaPagamento"]>, string> = {
    DINHEIRO: "Dinheiro", PIX: "PIX", CARTAO_DEBITO: "Débito", CARTAO_CREDITO: "Crédito",
};

export type ItemTimeline = {
    chave: string;
    tipo: "VENDA" | "SUPRIMENTO" | "SANGRIA" | "ESTORNO_VENDA";
    dataHora: string;
    valor: number;
    descricao: string;
    sinal: "+" | "−";
    formaPagamento: string | null;
};

export function criarTimeline(movimentos: MovimentacaoCaixa[], vendas: VendaDetalhe[]): ItemTimeline[] {
    const vendasTimeline = vendas.map((venda) => ({
        chave: `venda-${venda.id}`,
        tipo: "VENDA" as const,
        dataHora: venda.dataHora,
        valor: venda.total,
        descricao: `Venda #${venda.id}`,
        sinal: "+" as const,
        formaPagamento: venda.formaPagamento ? rotuloFormaPagamento[venda.formaPagamento] : "Pagamento",
    }));
    const movimentosTimeline = movimentos
        .filter((movimento) => movimento.tipo !== "VENDA")
        .map((movimento) => ({
            chave: `movimento-${movimento.id}`,
            tipo: movimento.tipo,
            dataHora: movimento.dataHora,
            valor: movimento.valor,
            descricao: movimento.tipo === "SUPRIMENTO" ? "Suprimento"
                : movimento.tipo === "SANGRIA" ? "Sangria" : "Cancelamento de venda",
            sinal: movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA" ? "−" as const : "+" as const,
            formaPagamento: null,
        }));
    return [...vendasTimeline, ...movimentosTimeline].sort(
        (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime(),
    );
}
