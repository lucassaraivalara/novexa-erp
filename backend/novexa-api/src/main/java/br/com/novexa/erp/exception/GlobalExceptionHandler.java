package br.com.novexa.erp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.validation.BindException.class})
    public ResponseEntity<String> tratarRequisicaoMalformada(Exception exception) {
        return ResponseEntity.badRequest().body("Requisicao invalida.");
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<String> tratarStatusFuncional(org.springframework.web.server.ResponseStatusException exception) throws Exception {
        if (exception.getStatusCode().is5xxServerError()) return tratarErroNaoPrevisto(exception);
        return ResponseEntity.status(exception.getStatusCode()).headers(exception.getHeaders())
                .body(exception.getReason() == null ? "Requisicao invalida." : exception.getReason());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> tratarErroNaoPrevisto(Exception exception) throws Exception {
        if (exception instanceof org.springframework.security.access.AccessDeniedException
                || exception instanceof org.springframework.security.core.AuthenticationException) throw exception;
        if (exception instanceof org.springframework.web.ErrorResponse error && !error.getStatusCode().is5xxServerError())
            return ResponseEntity.status(error.getStatusCode()).body("Requisicao invalida.");
        log.error("Erro nao tratado tipo={}", exception.getClass().getName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Nao foi possivel concluir a operacao. Informe o X-Request-ID ao suporte.");
    }

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
            UsuarioNotFoundException.class,
            ProdutoNotFoundException.class,
            CaixaNotFoundException.class
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
            EmpresaInvalidaException.class,
            ProdutoInvalidoException.class,
            CaixaInvalidoException.class
    })
    public ResponseEntity<String> tratarCadastroInvalido(
            RuntimeException exception) {

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(exception.getMessage());
    }

    @ExceptionHandler(CaixaDuplicadoException.class)
    public ResponseEntity<String> tratarCaixaDuplicado(
            CaixaDuplicadoException exception) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
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

    @ExceptionHandler({EstoqueInsuficienteException.class, ProdutoNaoControlaEstoqueException.class})
    public ResponseEntity<String> tratarEstoque(
            RuntimeException exception) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(exception.getMessage());
    }
}
