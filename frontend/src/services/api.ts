import axios from "axios";
import { obterToken, removerSessao } from "../utils/auth/sessao";

const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:8080";

const api = axios.create({
    baseURL: apiBase.replace(/\/$/, ""),
    headers: {
        "Content-Type": "application/json",
    },
});

let isRefreshing = false;

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

            if (!isLoginRequest && !isRefreshing) {
                isRefreshing = true;
                removerSessao();
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;