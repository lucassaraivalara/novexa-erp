package br.com.novexa.erp.exception;

public class ProdutoNotFoundException extends RuntimeException {

    public ProdutoNotFoundException(String mensagem) {
        super(mensagem);
    }
}
