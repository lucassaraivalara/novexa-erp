package br.com.novexa.erp.exception;

import java.math.BigDecimal;
import java.util.List;

public class ConfirmacaoEstoqueException extends RuntimeException {
    public record Item(Long produtoId, String nome, BigDecimal disponivel, BigDecimal solicitada) { }
    private final boolean permitido;
    private final List<Item> itens;
    public ConfirmacaoEstoqueException(boolean permitido, List<Item> itens) {
        super("Estoque insuficiente. Confira as quantidades antes de continuar.");
        this.permitido = permitido;
        this.itens = List.copyOf(itens);
    }
    public boolean isPermitido() { return permitido; }
    public List<Item> getItens() { return itens; }
}
