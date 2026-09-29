import type { EmpresaAtiva } from "./auth";

export type PerfilUsuario = "ADMIN" | "USUARIO";

export type Usuario = {
    id: number;
    nomeUsuario: string;
    cpf: string;
    email: string;
    perfil: PerfilUsuario;
    ativo: boolean | null;
    empresa: EmpresaAtiva;
};

export type UsuarioInput = {
    nomeUsuario: string;
    cpf: string;
    email: string;
    perfil: PerfilUsuario;
    ativo: boolean;
    senha?: string;
};
