import type { LoginResponse } from "../../types/auth";

export type SessaoUsuario = LoginResponse & {
    autenticadoEm: string;
};

const CHAVE_SESSAO = "novexa-auth";

export function salvarSessao(sessao: SessaoUsuario): void {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
}

export function possuiSessao(): boolean {
    return obterSessao() !== null;
}

export function obterSessao(): SessaoUsuario | null {
    const sessaoArmazenada = localStorage.getItem(CHAVE_SESSAO);

    if (!sessaoArmazenada) {
        return null;
    }

    try {
        return JSON.parse(sessaoArmazenada) as SessaoUsuario;
    } catch {
        removerSessao();
        return null;
    }
}

export function removerSessao(): void {
    localStorage.removeItem(CHAVE_SESSAO);
}
