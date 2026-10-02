import type { Produto } from "../../types/produto";
import type { ItemEntradaMercadoriaInput } from "../../types/entradaMercadoria";

export type ProdutoEntrada = Pick<Produto, "id" | "nome"> & Partial<Pick<Produto, "precoCusto" | "ativo" | "controlaEstoque">>;
export type ItemFormularioEntrada = {
    chave: string; produto: ProdutoEntrada | null; quantidade: string; custo: string;
    historico?: ItemEntradaMercadoriaInput;
};
export const novoItemEntrada = (): ItemFormularioEntrada => ({ chave: crypto.randomUUID(), produto: null, quantidade: "1", custo: "" });
export const numeroEntrada = (valor: string) => valor.trim() ? Number(valor.replace(",", ".")) : NaN;
export const totalPreviewEntrada = (itens: ItemFormularioEntrada[]) => itens.reduce((total, item) => {
    const valor = numeroEntrada(item.quantidade) * numeroEntrada(item.custo);
    return total + (Number.isFinite(valor) && valor >= 0 ? Math.round((valor + Number.EPSILON) * 100) / 100 : 0);
}, 0);

export function validarItensEntrada(itens: ItemFormularioEntrada[]): string | null {
    if (!itens.length || itens.length > 200) return "Informe de 1 a 200 itens.";
    const ids = new Set<number>();
    for (const item of itens) {
        if (!item.produto) return "Selecione o produto de cada item.";
        if (ids.has(item.produto.id)) return "Agrupe as quantidades do mesmo produto.";
        ids.add(item.produto.id);
        if (!/^\d+(?:[.,]\d{1,3})?$/.test(item.quantidade.trim()) || numeroEntrada(item.quantidade) <= 0
            || numeroEntrada(item.quantidade) >= 1000000000) return "Informe quantidades positivas com até 3 casas decimais.";
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(item.custo.trim()) || numeroEntrada(item.custo) < 0
            || numeroEntrada(item.custo) >= 1000000000000) return "Informe custos não negativos com até 2 casas decimais.";
    }
    return null;
}
