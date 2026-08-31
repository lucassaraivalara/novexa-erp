package br.com.novexa.erp.exception;

public class FornecedorNotFoundException extends RuntimeException {

    public FornecedorNotFoundException(String mensagem) {
        super(mensagem);
    }
}
