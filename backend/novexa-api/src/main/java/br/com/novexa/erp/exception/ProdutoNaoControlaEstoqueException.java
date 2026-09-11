package br.com.novexa.erp.exception;

public class ProdutoNaoControlaEstoqueException extends RuntimeException {

    public ProdutoNaoControlaEstoqueException(String mensagem) {
        super(mensagem);
    }
}