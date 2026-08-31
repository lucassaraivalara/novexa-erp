package br.com.novexa.erp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
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

    // Trata falhas de autenticação.
    @ExceptionHandler(AutenticacaoException.class)
    public ResponseEntity<String> tratarAutenticacao(
            AutenticacaoException exception) {

        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(exception.getMessage());
    }

    @ExceptionHandler({
            ClienteNotFoundException.class,
            FornecedorNotFoundException.class,
            ProdutoNotFoundException.class
    })
    public ResponseEntity<String> tratarCadastroNaoEncontrado(
            RuntimeException exception) {

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(exception.getMessage());
    }

    @ExceptionHandler(ProdutoCodigoDuplicadoException.class)
    public ResponseEntity<String> tratarCodigoDeProdutoDuplicado(
            ProdutoCodigoDuplicadoException exception) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(exception.getMessage());
    }

    @ExceptionHandler({
            DocumentoInvalidoException.class,
            ProdutoInvalidoException.class
    })
    public ResponseEntity<String> tratarCadastroInvalido(
            RuntimeException exception) {

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<String> tratarValidacao(
            MethodArgumentNotValidException exception) {

        String mensagem = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .findFirst()
                .map(erro -> erro.getDefaultMessage())
                .orElse("Dados inválidos.");

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(mensagem);
    }
}
