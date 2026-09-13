export type CaixaResumo = {
    id: number;
    descricao: string;
    ativo: boolean;
};

export type CaixaCompleta = CaixaResumo;

export type CaixaInput = {
    descricao: string;
};