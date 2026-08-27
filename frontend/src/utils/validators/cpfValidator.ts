export function validarCPF(cpf: string): boolean {

    // Remove pontos e hífen, deixando somente números
    const cpfNumeros = cpf.replace(/\D/g, "");

    // CPF precisa ter exatamente 11 números
    if (cpfNumeros.length !== 11) {
        return false;
    }

    // Impede CPFs com todos os números iguais
    if (/^(\d)\1{10}$/.test(cpfNumeros)) {
        return false;
    }

    // Calcula o primeiro dígito verificador
    let soma = 0;

    for (let i = 0; i < 9; i++) {
        soma += Number(cpfNumeros.charAt(i)) * (10 - i);
    }

    let resto = soma % 11;

    const primeiroDigito = resto < 2 ? 0 : 11 - resto;

    // Verifica o primeiro dígito
    if (primeiroDigito !== Number(cpfNumeros.charAt(9))) {
        return false;
    }

    // Calcula o segundo dígito verificador
    soma = 0;

    for (let i = 0; i < 10; i++) {
        soma += Number(cpfNumeros.charAt(i)) * (11 - i);
    }

    resto = soma % 11;

    const segundoDigito = resto < 2 ? 0 : 11 - resto;

    // Verifica o segundo dígito
    if (segundoDigito !== Number(cpfNumeros.charAt(10))) {
        return false;
    }

    return true;
}