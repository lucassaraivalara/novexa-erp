import api from "./api";
import axios from "axios";
import type { PaginaResponse } from "../types/paginacao";

export type PeriodoAnalise = { dataInicial: string; dataFinal: string };
export type IndicadoresVendas = { faturamento: number; quantidadeVendas: number; ticketMedio: number; descontos: number };
export type ResumoAnaliseVendas = {
    periodo: PeriodoAnalise & { incompleto: boolean; geradoEm: string };
    vendasSemDataFaturamento: number;
    atual: IndicadoresVendas;
    periodoAnterior: PeriodoAnalise;
    anterior: IndicadoresVendas;
    evolucao: { data: string; faturamento: number }[];
    evolucaoAnterior: { data: string; faturamento: number }[];
};

export const consultarResumoVendas = async (periodo: PeriodoAnalise, signal?: AbortSignal) =>
    (await api.get<ResumoAnaliseVendas>("/vendas/analise/resumo", { params: periodo, signal })).data;

export type CriterioRanking = { ordem: "valor" | "quantidade"; unidade: string };
export type ProdutoAnalise = { produtoId: number; nome: string; unidade: string | null; quantidade: number | null; valorVendido: number; participacao: number; categoria: string };
export type RankingAnalise = { itensSemUnidade: number; pagina: PaginaResponse<ProdutoAnalise>; unidades: string[]; faturamentoPeriodo: number };
export type CategoriasAnalise = { items: { categoriaId: number | null; nome: string; valorVendido: number; participacao: number }[]; faturamentoPeriodo: number };
export type SecaoExportacao = "resumo" | "evolucao" | "produtos" | "categorias";

export const consultarProdutosAnalise = async (periodo: PeriodoAnalise, criterio: CriterioRanking, page: number, signal?: AbortSignal) =>
    (await api.get<RankingAnalise>("/vendas/analise/produtos", { params: { ...periodo, ...criterio, unidade: criterio.unidade || undefined, page, size: 5 }, signal })).data;
export const consultarCategoriasAnalise = async (periodo: PeriodoAnalise, signal?: AbortSignal) =>
    (await api.get<CategoriasAnalise>("/vendas/analise/categorias", { params: periodo, signal })).data;

export async function exportarAnalise(periodo: PeriodoAnalise, secao: SecaoExportacao, criterio: CriterioRanking) {
    try {
        return (await api.get<Blob>("/vendas/analise/exportar", { params: { ...periodo, secao, ordem: criterio.ordem, unidade: criterio.unidade || undefined }, responseType: "blob" })).data;
    } catch (erro) {
        if (axios.isAxiosError(erro) && erro.response?.data instanceof Blob) {
            const texto = await erro.response.data.text();
            try { erro.response.data = JSON.parse(texto); } catch { erro.response.data = texto; }
        }
        throw erro;
    }
}
