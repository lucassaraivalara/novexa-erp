import axios from "axios";
import api from "./api";
import { expirarSessao, obterSessao, salvarSessao } from "../utils/auth/sessao";

export function expiracaoToken(token: string): number | null {
    try {
        const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const exp = JSON.parse(atob(base)).exp;
        return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
    } catch { return null; }
}

// Atividade real de teclado, leitor ou toque renova o JWT; polling sozinho não renova a sessão.
export function iniciarRenovacaoSessao(): () => void {
    let emAndamento = false;
    let proximaTentativa = 0;
    let encerrado = false;
    const verificar = () => {
        const sessao = obterSessao();
        const expiracao = sessao && expiracaoToken(sessao.token);
        if (sessao && expiracao && expiracao <= Date.now()) expirarSessao();
    };
    const atividade = async () => {
        const sessao = obterSessao();
        if (!sessao || emAndamento || Date.now() < proximaTentativa) return;
        const expiracao = expiracaoToken(sessao.token);
        if (!expiracao) return;
        if (expiracao <= Date.now()) { expirarSessao(); return; }
        if (expiracao - Date.now() > 55 * 60_000) return;
        emAndamento = true;
        proximaTentativa = Date.now() + 60_000;
        try {
            const resposta = await api.post<{ token: string }>("/auth/renovar", undefined, { timeout: 10000 });
            if (!encerrado && obterSessao()?.token === sessao.token) salvarSessao({ ...sessao, token: resposta.data.token });
        } catch (e) {
            if (!encerrado && obterSessao()?.token === sessao.token && axios.isAxiosError(e) && e.response?.status === 401)
                expirarSessao();
        } finally { emAndamento = false; }
    };
    const eventos = ["keydown", "pointerdown", "wheel"] as const;
    eventos.forEach(evento => window.addEventListener(evento, atividade, { passive: true }));
    window.addEventListener("focus", verificar);
    const timer = window.setInterval(verificar, 15000);
    verificar();
    return () => {
        encerrado = true;
        eventos.forEach(evento => window.removeEventListener(evento, atividade));
        window.removeEventListener("focus", verificar);
        window.clearInterval(timer);
    };
}
