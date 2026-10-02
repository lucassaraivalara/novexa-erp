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

// Resposta completa de GET/POST/PUT /fornecedores.
export type FornecedorCompleto = Fornecedor & {
    email: string | null;
    inscricaoEstadual: string | null;
    endereco: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    observacao: string | null;
};

export type FornecedorInput = {
    razaoSocial: string;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
    telefone: string | null;
    email: string | null;
    inscricaoEstadual: string | null;
    endereco: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    observacao: string | null;
    ativo?: boolean;
};
