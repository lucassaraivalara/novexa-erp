package br.com.novexa.erp.exception;

public class ProdutoCodigoDuplicadoException extends RuntimeException {

    public ProdutoCodigoDuplicadoException(String mensagem) {
        super(mensagem);
    }
}
