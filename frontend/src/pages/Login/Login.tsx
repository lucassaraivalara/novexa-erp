import { useState } from "react";
import { formatarCPF } from "../../utils/masks/cpfMask";
import { validarCPF } from "../../utils/validators/cpfValidator";

function Login() {

    // Guarda o CPF digitado pelo usuário
    const [cpf, setCpf] = useState("");

    // Guarda a senha digitada pelo usuário
    const [senha, setSenha] = useState("");

    // Guarda a mensagem de erro do CPF
    const [erroCPF, setErroCPF] = useState("");

    // Executado quando o usuário clica em "Entrar"
    function handleLogin() {

        // Verifica se o CPF informado é válido
        const cpfValido = validarCPF(cpf);

        // Se o CPF for inválido, mostra a mensagem e para a execução
        if (!cpfValido) {
            setErroCPF("CPF inválido");
            return;
        }

        // Se chegou aqui, o CPF é válido
        setErroCPF("");

        console.log("CPF válido:", cpf);
        console.log("Senha:", senha);

        // Futuramente vamos chamar o backend aqui
    }

    return (
        <div>

            <h1>Login</h1>

            {/* Campo CPF */}
            <input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(evento) => {
                    const cpfFormatado = formatarCPF(evento.target.value);
                    setCpf(cpfFormatado);
                    setErroCPF("");
                }}
            />

            {/* Mensagem de CPF inválido */}
            {erroCPF && (
                <p>{erroCPF}</p>
            )}

            {/* Campo senha */}
            <input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
            />

            {/* Botão de login */}
            <button onClick={handleLogin}>
                Entrar
            </button>

        </div>
    );
}

export default Login;