import type { CategoriaProduto, SubcategoriaProduto } from "../../types/categoriaProduto";
import type { Marca } from "../../types/marca";
export type ClassificacaoProduto = {
    categoria: CategoriaProduto | null; subcategoria: SubcategoriaProduto | null; marca: Marca | null;
};
export const semClassificacao: ClassificacaoProduto = { categoria: null, subcategoria: null, marca: null };

export const filtrosClassificacao = (valor: ClassificacaoProduto) => ({
    categoriaId: valor.categoria?.id, subcategoriaId: valor.subcategoria?.id, marcaId: valor.marca?.id,
});
export const descricaoClassificacao = (valor: ClassificacaoProduto) =>
    `Categoria: ${valor.categoria?.nome ?? "—"} · Subcategoria: ${valor.subcategoria?.nome ?? "—"} · Marca: ${valor.marca?.nome ?? "—"}`;
