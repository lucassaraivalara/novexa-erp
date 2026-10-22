package br.com.novexa.erp.exception;

public class ClienteDocumentoDuplicadoException extends RuntimeException {

    public ClienteDocumentoDuplicadoException(String mensagem) {
        super(mensagem);
    }
}
