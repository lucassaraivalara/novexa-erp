package br.com.novexa.erp.exception;

public class CaixaNotFoundException extends RuntimeException {

    public CaixaNotFoundException(String mensagem) {
        super(mensagem);
    }
}
