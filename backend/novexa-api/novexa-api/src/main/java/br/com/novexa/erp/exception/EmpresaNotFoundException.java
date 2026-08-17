package br.com.novexa.erp.exception;

public class EmpresaNotFoundException extends RuntimeException {

    public EmpresaNotFoundException(String mensagem) {
        super(mensagem);
    }

}