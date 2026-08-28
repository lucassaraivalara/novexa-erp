export type LoginRequest = {
    cpf: string;
    senha: string;
};

export type LoginResponse = {
    id: number;
    nomeUsuario: string;
    cpf: string;
    email: string;
};

const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:8080";

export async function realizarLogin({
    cpf,
    senha,
}: LoginRequest): Promise<LoginResponse> {
    const resposta = await fetch(
        `${apiBase.replace(/\/$/, "")}/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ cpf, senha }),
        }
    );

    if (!resposta.ok) {
        const mensagem = await resposta.text();
        throw new Error(mensagem || "CPF ou senha inválidos.");
    }

    return resposta.json() as Promise<LoginResponse>;
}
