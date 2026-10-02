export type StatusEntradaMercadoria = "RASCUNHO" | "CONFIRMADA" | "CANCELADA";
export type OrigemEntradaMercadoria = "MANUAL" | "XML";

export type ItemEntradaMercadoriaInput = {
    produtoId: number;
    quantidade: number;
    valorUnitario: number;
    descricaoOriginal?: string | null;
    codigoProdutoFornecedor?: string | null;
    gtin?: string | null;
    ncm?: string | null;
    cfop?: string | null;
    unidade?: string | null;
};

export type ItemEntradaMercadoria = ItemEntradaMercadoriaInput & {
    id: number;
    produtoNome: string;
    valorTotal: number;
    movimentacaoEstoqueId: number | null;
    movimentacaoCancelamentoId: number | null;
};

export type EntradaMercadoria = {
    id: number;
    fornecedorId: number;
    fornecedorNome: string;
    origem: OrigemEntradaMercadoria;
    status: StatusEntradaMercadoria;
    numeroNota: string | null;
    serie: string | null;
    chaveAcessoNfe: string | null;
    dataEmissao: string | null;
    dataEntrada: string;
    valorProdutos: number;
    valorTotal: number;
    observacao: string | null;
    dataCadastro: string;
    dataAtualizacao: string;
    usuarioCadastroId: number;
    usuarioConfirmacaoId: number | null;
    usuarioCancelamentoId: number | null;
    dataConfirmacao: string | null;
    dataCancelamento: string | null;
    itens: ItemEntradaMercadoria[] | null;
};

export type EntradaMercadoriaInput = {
    fornecedorId: number;
    numeroNota: string | null;
    serie: string | null;
    dataEmissao: string | null;
    dataEntrada?: string;
    observacao: string | null;
    itens: ItemEntradaMercadoriaInput[];
    chaveRequisicao?: string;
    chaveAcessoNfe?: string | null;
};
