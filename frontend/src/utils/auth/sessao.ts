import type { EmpresaAtiva, LoginResponse } from "../../types/auth";

export type SessaoUsuario = LoginResponse & {
    autenticadoEm: string;
};

const CHAVE_SESSAO = "novexa-auth";

export function salvarSessao(sessao: SessaoUsuario): void {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
}

export function possuiSessao(): boolean {
    const sessao = obterSessao();

    if (sessao?.empresa) {
        return true;
    }

    // Sessões criadas antes da fundação multiempresa não possuem empresa ativa.
    // Elas precisam de um novo login para receber o contexto correto da API.
    if (sessao) {
        removerSessao();
    }

    return false;
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

export function obterEmpresaAtiva(): EmpresaAtiva | null {
    return obterSessao()?.empresa ?? null;
}
