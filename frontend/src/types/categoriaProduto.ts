export type CategoriaProduto = { id: number; nome: string; ativo: boolean };
export type SubcategoriaProduto = CategoriaProduto & { categoria: CategoriaProduto };
export type CategoriaProdutoInput = { nome: string; ativo: boolean };
export type SubcategoriaProdutoInput = CategoriaProdutoInput & { categoriaId: number };
