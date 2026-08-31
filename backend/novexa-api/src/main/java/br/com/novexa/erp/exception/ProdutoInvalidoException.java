package br.com.novexa.erp.exception;

public class ProdutoInvalidoException extends RuntimeException {

    public ProdutoInvalidoException(String mensagem) {
        super(mensagem);
    }
}
