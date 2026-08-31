import axios from "axios";

const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:8080";

const api = axios.create({
    baseURL: apiBase.replace(/\/$/, ""),
    headers: {
        "Content-Type": "application/json",
    },
});

export default api;
