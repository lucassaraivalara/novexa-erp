package br.com.novexa.erp.util;

import br.com.novexa.erp.exception.EmpresaInvalidaException;
import java.util.Locale;

public final class DocumentoEmpresaUtils {
    private DocumentoEmpresaUtils() { }

    public static String normalizar(String valor) {
        return valor == null ? "" : valor.toUpperCase(Locale.ROOT).replaceAll("[.\\-/\\s]", "");
    }

    public static String validar(String valor, boolean permiteCpf) {
        String documento = normalizar(valor);
        if (permiteCpf && documento.matches("[0-9]{11}")) {
            return DocumentoUtils.normalizarEValidarCpfCnpj(documento);
        }
        // Módulo 11, com caracteres alfanuméricos convertidos por ASCII - 48.
        if (!documento.matches("[A-Z0-9]{12}[0-9]{2}") || documento.matches("(.)\\1{13}")
                || digito(documento, 12) != documento.charAt(12) - '0'
                || digito(documento, 13) != documento.charAt(13) - '0') {
            throw new EmpresaInvalidaException(permiteCpf ? "CPF/CNPJ inválido." : "Informe um CNPJ válido. CPF é permitido para produtor rural.");
        }
        return documento;
    }

    private static int digito(String documento, int tamanho) {
        int soma = 0, peso = 2;
        for (int i = tamanho - 1; i >= 0; i--) {
            soma += (documento.charAt(i) - 48) * peso;
            peso = peso == 9 ? 2 : peso + 1;
        }
        return soma % 11 < 2 ? 0 : 11 - soma % 11;
    }
}
