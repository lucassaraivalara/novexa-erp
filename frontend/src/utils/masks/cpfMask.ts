export function formatarCPF(valor: string): string {

    // Remove tudo que não for número
    const apenasNumeros = valor.replace(/\D/g, "");

    // Limita o CPF a 11 números
    const cpf = apenasNumeros.substring(0, 11);

    // Aplica a máscara conforme o usuário digita
    if (cpf.length <= 3) {
        return cpf;
    }

    if (cpf.length <= 6) {
        return cpf.replace(/(\d{3})(\d+)/, "$1.$2");
    }

    if (cpf.length <= 9) {
        return cpf.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    }

    return cpf.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );
}