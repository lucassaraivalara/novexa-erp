export interface CaixaResumo {
    id: number;
    descricao: string;
    ativo: boolean;
}

export interface CaixaCompleta extends CaixaResumo {
}

export interface CaixaInput {
    descricao: string;
}