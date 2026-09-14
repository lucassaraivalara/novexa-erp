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
                erro.response?.status === 401
                    ? "CPF ou senha inválidos."
                    : erro.response
                        ? "Não foi possível realizar o login."
                        : "Não foi possível conectar ao servidor.";

            throw new Error(mensagem, { cause: erro });
        }

        throw new Error("Não foi possível entrar.", { cause: erro });
    }
}
