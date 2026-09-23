import axios from "axios";
import { obterToken, removerSessao } from "../utils/auth/sessao";

const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:8080";

const api = axios.create({
    baseURL: apiBase.replace(/\/$/, ""),
});

api.interceptors.request.use(
    (config) => {
        const token = obterToken();
        if (token && config.url !== "/auth/login") {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            const isLoginRequest = error.config?.url === "/auth/login";

            const token = obterToken();
            const tokenEnviado = error.config?.headers.Authorization;
            const desafio = String(error.response.headers["www-authenticate"] ?? "");
            // Apenas a rejeição explícita do token atual encerra a sessão.
            // Uma resposta atrasada de uma sessão anterior não afeta um novo login.
            const tokenInvalido = /^Bearer\s+.*\berror="invalid_token"/i.test(desafio);

            if (!isLoginRequest && token && tokenEnviado === `Bearer ${token}` && tokenInvalido) {
                removerSessao();
                window.location.assign("/login");
            }
        }
        return Promise.reject(error);
    }
);

export default api;
