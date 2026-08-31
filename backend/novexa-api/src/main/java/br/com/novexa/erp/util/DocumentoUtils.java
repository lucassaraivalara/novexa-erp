package br.com.novexa.erp.util;

import br.com.novexa.erp.exception.DocumentoInvalidoException;

public final class DocumentoUtils {

    private DocumentoUtils() {
    }

    public static String normalizarEValidarCpfCnpj(String documento) {
        if (documento == null || documento.isBlank()) {
            return null;
        }

        String documentoNormalizado = documento.replaceAll("\\D", "");

        boolean documentoValido = documentoNormalizado.length() == 11
                ? cpfValido(documentoNormalizado)
                : documentoNormalizado.length() == 14 && cnpjValido(documentoNormalizado);

        if (!documentoValido) {
            throw new DocumentoInvalidoException("CPF ou CNPJ inválido.");
        }

        return documentoNormalizado;
    }

    private static boolean cpfValido(String cpf) {
        if (possuiTodosDigitosIguais(cpf)) {
            return false;
        }

        int primeiroDigito = calcularDigitoCpf(cpf, 9);
        int segundoDigito = calcularDigitoCpf(cpf, 10);

        return primeiroDigito == Character.getNumericValue(cpf.charAt(9))
                && segundoDigito == Character.getNumericValue(cpf.charAt(10));
    }

    private static int calcularDigitoCpf(String cpf, int quantidadeDigitos) {
        int soma = 0;

        for (int indice = 0; indice < quantidadeDigitos; indice++) {
            soma += Character.getNumericValue(cpf.charAt(indice))
                    * (quantidadeDigitos + 1 - indice);
        }

        int resto = (soma * 10) % 11;
        return resto == 10 ? 0 : resto;
    }

    private static boolean cnpjValido(String cnpj) {
        if (possuiTodosDigitosIguais(cnpj)) {
            return false;
        }

        int primeiroDigito = calcularDigitoCnpj(
                cnpj,
                new int[]{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
        );
        int segundoDigito = calcularDigitoCnpj(
                cnpj,
                new int[]{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
        );

        return primeiroDigito == Character.getNumericValue(cnpj.charAt(12))
                && segundoDigito == Character.getNumericValue(cnpj.charAt(13));
    }

    private static int calcularDigitoCnpj(String cnpj, int[] pesos) {
        int soma = 0;

        for (int indice = 0; indice < pesos.length; indice++) {
            soma += Character.getNumericValue(cnpj.charAt(indice)) * pesos[indice];
        }

        int resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    private static boolean possuiTodosDigitosIguais(String documento) {
        char primeiroDigito = documento.charAt(0);

        for (int indice = 1; indice < documento.length(); indice++) {
            if (documento.charAt(indice) != primeiroDigito) {
                return false;
            }
        }

        return true;
    }
}
