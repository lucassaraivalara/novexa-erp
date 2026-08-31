package br.com.novexa.erp.exception;

public class ClienteNotFoundException extends RuntimeException {

    public ClienteNotFoundException(String mensagem) {
        super(mensagem);
    }
}
