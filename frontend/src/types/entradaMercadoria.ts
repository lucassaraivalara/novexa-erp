import type { Fornecedor } from "./fornecedor";
import type { Produto } from "./produto";

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

export type FornecedorXml = Pick<Fornecedor, "cpfCnpj" | "razaoSocial" | "nomeFantasia">;
export type ProdutoMatch = Pick<Produto, "id" | "nome" | "codigoBarras">;
export type EntradaXmlPreviewItem = Omit<ItemEntradaMercadoriaInput, "produtoId"> & {
    valorTotal: number;
    produtoMatch: ProdutoMatch | null;
};
export type EntradaXmlPreview = {
    fornecedorXml: FornecedorXml;
    fornecedorMatch: Pick<Fornecedor, "id" | "razaoSocial" | "ativo"> | null;
    numeroNota: string;
    serie: string;
    chaveAcessoNfe: string;
    dataEmissao: string;
    valorProdutos: number;
    valorTotal: number;
    itens: EntradaXmlPreviewItem[];
};
export type EntradaXmlInput = EntradaMercadoriaInput & { chaveAcessoNfe: string };
