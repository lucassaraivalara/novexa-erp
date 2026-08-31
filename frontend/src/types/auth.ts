export type LoginRequest = {
    cpf: string;
    senha: string;
};

export type LoginResponse = {
    id: number;
    nomeUsuario: string;
    cpf: string;
    email: string;
};
