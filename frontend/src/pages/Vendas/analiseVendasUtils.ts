import { hojeBrasilia, somarDias } from "../../utils/dataHora";
import type { PeriodoAnalise } from "../../services/analiseVendasService";

export function periodoAnalise(dias: number, hoje = hojeBrasilia()): PeriodoAnalise {
    return { dataInicial: somarDias(hoje, 1 - dias), dataFinal: hoje };
}

export function erroPeriodo(periodo: PeriodoAnalise, hoje = hojeBrasilia()) {
    const valida = (data: string) => /^\d{4}-\d{2}-\d{2}$/.test(data)
        && !Number.isNaN(Date.parse(`${data}T12:00:00Z`)) && somarDias(data, 0) === data;
    if (!valida(periodo.dataInicial) || !valida(periodo.dataFinal) || periodo.dataInicial > periodo.dataFinal)
        return "Informe um período válido, com data inicial anterior ou igual à final.";
    if (periodo.dataFinal > hoje || periodo.dataInicial < "1901-01-01" || somarDias(periodo.dataInicial, 365) < periodo.dataFinal)
        return "Selecione até 366 dias, sem datas futuras.";
    return "";
}

export function variacao(atual: number, anterior: number) {
    if (anterior <= 0) return atual === 0 ? "Sem variação · base anterior zero" : "Sem base anterior para comparação percentual";
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format((atual - anterior) / anterior * 100)}% em relação ao período anterior`;
}
