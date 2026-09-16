export type TipoContaBancaria = "CORRENTE" | "POUPANCA";

export type BancoResumo = {
    id: number;
    numero: string;
    nome: string;
    cnab: string | null;
    ativo: boolean;
};

export type BancoInput = {
    numero: string;
    nome: string;
    cnab: string | null;
    ativo: boolean;
};

export type AgenciaResumo = {
    id: number;
    bancoId: number;
    bancoNumero: string;
    bancoNome: string;
    numero: string;
    digito: string | null;
    contato: string | null;
    telefone: string | null;
    cidade: string | null;
    ativo: boolean;
};

export type AgenciaInput = {
    bancoId: number;
    numero: string;
    digito: string | null;
    contato: string | null;
    telefone: string | null;
    cidade: string | null;
    ativo: boolean;
};

export type ContaBancariaResumo = {
    id: number;
    bancoId: number;
    bancoNumero: string;
    bancoNome: string;
    agenciaId: number;
    agenciaNumero: string;
    agenciaDigito: string | null;
    numero: string;
    digito: string | null;
    titular: string | null;
    tipo: TipoContaBancaria;
    ativo: boolean;
};

export type ContaBancariaInput = {
    agenciaId: number;
    numero: string;
    digito: string | null;
    titular: string | null;
    tipo: TipoContaBancaria;
    ativo: boolean;
};
