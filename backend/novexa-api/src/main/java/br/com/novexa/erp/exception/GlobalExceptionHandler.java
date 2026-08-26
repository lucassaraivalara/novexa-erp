package br.com.novexa.erp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // Trata quando uma empresa não é encontrada.
    @ExceptionHandler(EmpresaNotFoundException.class)
    public ResponseEntity<String> tratarEmpresaNaoEncontrada(
            EmpresaNotFoundException exception) {

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(exception.getMessage());
    }

    // Trata quando o CNPJ já está cadastrado.
    @ExceptionHandler(CnpjDuplicadoException.class)
    public ResponseEntity<String> tratarCnpjDuplicado(
            CnpjDuplicadoException exception) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(exception.getMessage());
    }
}