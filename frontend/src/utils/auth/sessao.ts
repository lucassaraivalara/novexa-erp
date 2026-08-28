export type SessaoUsuario = {
    id: number;
    nomeUsuario: string;
    cpf: string;
    email: string;
    autenticadoEm: string;
};

const CHAVE_SESSAO = "novexa-auth";

export function salvarSessao(sessao: SessaoUsuario): void {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
}

export function possuiSessao(): boolean {
    return localStorage.getItem(CHAVE_SESSAO) !== null;
}

export function removerSessao(): void {
    localStorage.removeItem(CHAVE_SESSAO);
}
