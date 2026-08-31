import axios from "axios";
import type { LoginRequest, LoginResponse } from "../types/auth";
import api from "./api";

export async function realizarLogin({
    cpf,
    senha,
}: LoginRequest): Promise<LoginResponse> {
    try {
        const resposta = await api.post<LoginResponse>("/auth/login", {
            cpf,
            senha,
        });

        return resposta.data;
    } catch (erro) {
        if (axios.isAxiosError(erro)) {
            const mensagem =
                typeof erro.response?.data === "string"
                    ? erro.response.data
                    : "Não foi possível entrar. Verifique se o backend está em execução.";

            throw new Error(mensagem, { cause: erro });
        }

        throw new Error("Não foi possível entrar.", { cause: erro });
    }
}
