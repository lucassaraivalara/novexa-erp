import { validarCPF } from "./cpfValidator";

export const normalizarDocumentoEmpresa = (valor: string) => valor.toUpperCase().replace(/[.\-/\s]/g, "");

export function formatarDocumentoEmpresa(valor: string, permiteCpf = false): string {
    const normalizado = normalizarDocumentoEmpresa(valor);
    if (permiteCpf && /^\d{0,11}$/.test(normalizado)) {
        return normalizado
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    }
    if (/^\d{0,14}$/.test(normalizado)) {
        return normalizado
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
            .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
    }
    return normalizado;
}

export function documentoEmpresaValido(valor: string, permiteCpf = false): boolean {
    const documento = normalizarDocumentoEmpresa(valor);
    if (permiteCpf && /^\d{11}$/.test(documento)) return validarCPF(documento);
    if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(documento) || /^(.)\1{13}$/.test(documento)) return false;
    const digito = (tamanho: number) => {
        let soma = 0, peso = 2;
        for (let i = tamanho - 1; i >= 0; i--) {
            soma += (documento.charCodeAt(i) - 48) * peso;
            peso = peso === 9 ? 2 : peso + 1;
        }
        return soma % 11 < 2 ? 0 : 11 - soma % 11;
    };
    return digito(12) === Number(documento[12]) && digito(13) === Number(documento[13]);
}
