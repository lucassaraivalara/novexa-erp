import { interpretarDataHora } from "../../utils/dataHora";
import type { MovimentacaoCaixa, VendaSessaoCaixa } from "../../types/caixa";

const rotuloFormaPagamento: Record<NonNullable<VendaSessaoCaixa["formaPagamento"]>, string> = {
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
    autor: string | null;
};

export function criarTimeline(movimentos: MovimentacaoCaixa[], vendas: VendaSessaoCaixa[]): ItemTimeline[] {
    const vendasTimeline = vendas.map((venda) => ({
        chave: `venda-${venda.id}`,
        tipo: "VENDA" as const,
        dataHora: venda.dataHora,
        valor: venda.total,
        descricao: `Venda #${venda.id}`,
        sinal: "+" as const,
        formaPagamento: venda.formaPagamento ? rotuloFormaPagamento[venda.formaPagamento] : "Pagamento",
        autor: venda.usuarioNome ?? null,
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
            autor: movimento.usuarioNome ?? null,
        }));
    return [...vendasTimeline, ...movimentosTimeline].sort(
        (a, b) => (interpretarDataHora(b.dataHora)?.getTime() ?? 0) - (interpretarDataHora(a.dataHora)?.getTime() ?? 0),
    );
}
