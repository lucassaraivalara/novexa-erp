export type Fornecedor = {
    id: number;
    razaoSocial: string;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
    telefone: string | null;
    ativo: boolean;
};

// Resposta enxuta de GET /fornecedores/buscar (somente ativos).
export type FornecedorBusca = Omit<Fornecedor, "ativo">;
