import type { PerfilUsuario } from "../../types/usuario";

export function podeGerenciarUsuarios(perfil?: PerfilUsuario): boolean {
    return perfil === "ADMIN";
}

export function podeExecutarAcaoGerencial(perfil?: PerfilUsuario): boolean {
    return perfil === "ADMIN" || perfil === "GERENTE";
}

export function podeFecharSessao(perfil: PerfilUsuario | undefined, usuarioId: number | undefined, aberturaId: number): boolean {
    return podeExecutarAcaoGerencial(perfil)
        || ((perfil === "OPERADOR" || perfil === "USUARIO") && usuarioId !== undefined && usuarioId === aberturaId);
}
