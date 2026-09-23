import type { FiltrosVenda, StatusVenda } from "../../services/vendaService";

export type FiltrosCentralVendas = {
    status: "" | StatusVenda;
    dataInicial: string;
    dataFinal: string;
    clienteId: string;
};

export const filtrosIniciais: FiltrosCentralVendas = {
    status: "FATURADA",
    dataInicial: "",
    dataFinal: "",
    clienteId: "",
};

export function criarParametrosVenda(filtros: FiltrosCentralVendas): FiltrosVenda {
    return {
        status: filtros.status || undefined,
        dataInicial: filtros.dataInicial || undefined,
        dataFinal: filtros.dataFinal || undefined,
        clienteId: filtros.clienteId ? Number(filtros.clienteId) : undefined,
    };
}

export function podeCancelarVenda(status: StatusVenda): boolean {
    return status === "FATURADA";
}

export const rotulosStatus: Record<StatusVenda, string> = {
    ABERTA: "Aberta",
    FATURADA: "Faturada",
    CANCELADA: "Cancelada",
};

export const rotulosPagamento: Record<string, string> = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_DEBITO: "Cartão de débito",
    CARTAO_CREDITO: "Cartão de crédito",
};

export const moedaVenda = (valor: number) => valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
});

export const dataHoraVenda = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
}).format(new Date(valor));
