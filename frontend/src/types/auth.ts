export type LoginRequest = {
    cpf: string;
    senha: string;
};

export type EmpresaAtiva = {
    id: number;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    inscricaoEstadual: string;
    email: string;
    telefone: string;
    endereco: string;
    ativo: boolean;
};

export type LoginResponse = {
    id: number;
    nomeUsuario: string;
    cpf: string;
    email: string;
    empresa: EmpresaAtiva;
};
