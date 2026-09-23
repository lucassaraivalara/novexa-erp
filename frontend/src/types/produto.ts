export type Produto = {
    id: number;
    empresaId: number;
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
};

export type ProdutoInput = {
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
