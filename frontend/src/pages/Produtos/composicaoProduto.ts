import { numeroDecimal } from "../../utils/numeroFormulario";
export type LinhaComposicao = { produtoId: number; nome: string; unidadeEstoque: string; unidade: string; quantidade: string; fator: string };
export function prepararComposicao(linhas: LinhaComposicao[]) {
    if (!linhas.length) throw new Error("Inclua ao menos um componente físico no Kit/Combo.");
    const ids = new Set<number>();
    return linhas.map(l => {
        if (ids.has(l.produtoId)) throw new Error("O mesmo componente não pode aparecer duas vezes.");
        ids.add(l.produtoId);
        const quantidade = numeroDecimal(l.quantidade, 3);
        const fator = numeroDecimal(l.fator, 6);
        if (!/^\d+(?:[.,]\d{1,3})?$/.test(l.quantidade) || !/^\d+(?:[.,]\d{1,6})?$/.test(l.fator)
            || quantidade === null || fator === null || quantidade <= 0 || fator <= 0 || !l.unidade.trim()) throw new Error("Informe unidade, quantidade positiva (até 3 casas) e fator positivo (até 6 casas).");
        return { produtoId: l.produtoId, quantidade, fator, unidade: l.unidade.trim().toUpperCase() };
    });
}
