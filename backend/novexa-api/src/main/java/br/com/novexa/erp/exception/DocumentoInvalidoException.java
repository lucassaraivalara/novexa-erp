package br.com.novexa.erp.exception;

public class DocumentoInvalidoException extends RuntimeException {

    public DocumentoInvalidoException(String mensagem) {
        super(mensagem);
    }
}
