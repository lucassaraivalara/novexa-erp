import type { CategoriaProduto, SubcategoriaProduto } from "./categoriaProduto";
import type { Marca } from "./marca";
export type Produto = {
    composto?: boolean;
    composicaoVersao?: number;
    componentes?: { produtoId: number; nome: string; unidade: string; quantidadePorKit: number; estoqueAtual: number }[];
    id: number;
    empresaId: number;
    ncm?: string | null;
    cest?: string | null;
    codigoInterno: string | null;
    codigoBarras: string | null;
    nome: string;
    descricao: string | null;
    unidadeMedida: string;
    precoCusto: number;
    precoVenda: number;
    estoqueAtual: number;
    estoqueMinimo: number;
    controlaEstoque: boolean;
    imagemPath: string | null;
    imagemUrl: string | null;
    ativo: boolean;
    dataCadastro: string;
    categoria?: CategoriaProduto | null;
    subcategoria?: SubcategoriaProduto | null;
    marca?: Marca | null;
    fornecedor?: { id: number; razaoSocial: string; nomeFantasia: string | null; ativo: boolean } | null;
    fornecedoresAdicionais?: { fornecedor: { id: number; razaoSocial: string; nomeFantasia: string | null; ativo: boolean };
        codigoReferencia: string | null; fatorConversao: number | null }[];
};

export type ProdutoFornecedorVinculoInput = {
    fornecedorId: number;
    codigoReferencia?: string | null;
    /** 1 embalagem comprada = X unidades do produto. Nulo = sem conversão (1:1). */
    fatorConversao?: number | null;
};

export type ProdutoInput = {
    composto?: boolean;
    componentes?: { produtoId: number; quantidade: number; fator: number; unidade: string }[];
    categoriaId?: number | null;
    subcategoriaId?: number | null;
    marcaId?: number | null;
    fornecedorId?: number | null;
    fornecedoresAdicionais?: ProdutoFornecedorVinculoInput[];
    ncm?: string | null;
    cest?: string | null;
    codigoInterno: string | null;
    codigoBarras: string | null;
    nome: string;
    descricao: string | null;
    unidadeMedida: string;
    precoCusto: number;
    precoVenda: number;
    estoqueMinimo: number;
    controlaEstoque: boolean;
    ativo: boolean;
};
