package br.com.novexa.erp.entity;

// Códigos legados de Venda/PDV e snapshots históricos, não é o catálogo oficial.
public enum FormaPagamento {
    DINHEIRO(1), PIX(2), CARTAO_DEBITO(3), CARTAO_CREDITO(4);

    private final long idPadrao;
    FormaPagamento(long idPadrao) { this.idPadrao = idPadrao; }
    // Identidades estáveis das formas básicas criadas pela V8, independentes da descrição.
    public long idPadrao() { return idPadrao; }
}
