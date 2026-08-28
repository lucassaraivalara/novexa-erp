import { useState } from "react";

// Componentes visuais do MUI
import {
    Box,
    Button,
    Paper,
    TextField,
    Typography,
} from "@mui/material";

// Função responsável por formatar o CPF enquanto o usuário digita
import { formatarCPF } from "../../utils/masks/cpfMask";

// Função responsável por validar o CPF
import { validarCPF } from "../../utils/validators/cpfValidator";


function Login() {

    // Guarda o CPF digitado pelo usuário
    const [cpf, setCpf] = useState("");

    // Guarda a senha digitada pelo usuário
    const [senha, setSenha] = useState("");

    // Guarda a mensagem de erro do CPF
    const [erroCPF, setErroCPF] = useState("");

    // Indica quando o login está sendo processado
    const [carregando, setCarregando] = useState(false);

    // Guarda a mensagem de erro geral do login
    const [erroLogin, setErroLogin] = useState("");


    // Executado quando o usuário clica no botão "Entrar"
    async function handleLogin() {

        // Evita duplo clique enquanto o login está em andamento.
        if (carregando) {
            return;
        }

        // Verifica se o CPF informado é válido
        const cpfValido = validarCPF(cpf);

        // Se o CPF for inválido, mostra a mensagem de erro
        // e interrompe a execução da função.
        if (!cpfValido) {
            setErroCPF("CPF inválido");
            return;
        }

        // Validação básica da senha antes de tentar sincronizar.
        if (!senha.trim()) {
            setErroLogin("Informe a senha.");
            return;
        }

        // Se chegou aqui, significa que o CPF é válido.
        setErroCPF("");
        setErroLogin("");
        setCarregando(true);

        try {
            // Em desenvolvimento, o Spring Boot utiliza a porta 8080 por padrão.
            // VITE_API_URL continua podendo sobrescrever este valor em outros ambientes.
            const apiBase =
                (import.meta.env.VITE_API_URL as string | undefined) ??
                "http://localhost:8080";

            const resposta = await fetch(`${apiBase.replace(/\/$/, "")}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    cpf: cpf.replace(/\D/g, ""),
                    senha,
                }),
            });

            if (!resposta.ok) {
                const mensagem = await resposta.text();
                throw new Error(mensagem || "CPF ou senha inválidos.");
            }

            const dados = await resposta.json();

            localStorage.setItem(
                "novexa-auth",
                JSON.stringify({
                    id: dados.id,
                    nomeUsuario: dados.nomeUsuario,
                    cpf: dados.cpf,
                    email: dados.email,
                    token: dados.token,
                    autenticadoEm: new Date().toISOString(),
                })
            );

            console.log("Login sincronizado com o backend.");
        } catch (erro) {
            console.error("Falha no login:", erro);
            const mensagem =
                erro instanceof Error
                    ? erro.message
                    : "Não foi possível entrar.";

            setErroLogin(mensagem);
        } finally {
            setCarregando(false);
        }
    }


    return (

        /*
         * Box
         *
         * O Box é um dos principais componentes do MUI.
         *
         * Ele funciona como um container e permite utilizar
         * as propriedades do sistema de estilos do MUI através
         * da propriedade "sx".
         */
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f5f7fa",
                padding: 3,
            }}
        >

            {/*
             * Paper
             *
             * O Paper representa uma superfície elevada.
             *
             * É muito utilizado para:
             * - cards
             * - formulários
             * - painéis
             * - caixas de conteúdo
             */}
            <Paper
                elevation={4}
                sx={{
                    width: "100%",
                    maxWidth: 420,
                    padding: 4,
                    borderRadius: 3,
                }}
            >

                {/*
                 * Typography
                 *
                 * É o componente do MUI utilizado para textos.
                 *
                 * Em vez de usar:
                 *
                 * <h1>Login</h1>
                 *
                 * usamos Typography.
                 */}
                <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                        fontWeight: 600,
                        marginBottom: 3,
                    }}
                >
                    Login
                </Typography>


                {/*
                 * Campo CPF
                 *
                 * TextField é o componente de campo de texto
                 * do MUI.
                 */}
                <TextField
                    fullWidth
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={cpf}
                    error={Boolean(erroCPF)}
                    helperText={erroCPF}
                    margin="normal"

                    /*
                     * Executado sempre que o usuário altera
                     * o conteúdo do campo.
                     */
                    onChange={(evento) => {

                        // Pega o valor digitado
                        const valorDigitado = evento.target.value;

                        // Formata o CPF utilizando a função
                        // que já criamos anteriormente.
                        const cpfFormatado = formatarCPF(valorDigitado);

                        // Guarda o CPF formatado no estado.
                        setCpf(cpfFormatado);

                        // Remove a mensagem de erro enquanto
                        // o usuário estiver corrigindo o campo.
                        setErroCPF("");
                    }}
                />


                {/*
                 * Campo de senha
                 */}
                <TextField
                    fullWidth
                    label="Senha"
                    type="password"
                    value={senha}
                    margin="normal"
                    error={Boolean(erroLogin)}
                    helperText={erroLogin}

                    onChange={(evento) => {

                        // Guarda a senha digitada no estado.
                        setSenha(evento.target.value);
                    }}
                />


                {/*
                 * Button
                 *
                 * Botão padrão do MUI.
                 *
                 * O "variant" define o estilo visual.
                 *
                 * "contained" cria um botão preenchido.
                 */}
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleLogin}
                    disabled={carregando}
                    sx={{
                        marginTop: 3,
                    }}
                >
                    {carregando ? "Entrando..." : "Entrar"}
                </Button>

            </Paper>

        </Box>
    );
}


export default Login;
