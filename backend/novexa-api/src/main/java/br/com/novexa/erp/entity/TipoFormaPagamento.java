package br.com.novexa.erp.entity;

public enum TipoFormaPagamento {
    DINHEIRO, PIX, DEBITO, CREDITO, BOLETO, TRANSFERENCIA;

    // Adaptador do fechamento atual; os demais tipos ainda não possuem fluxo de faturamento.
    public FormaPagamento contratoVenda() {
        return switch (this) {
            case DINHEIRO -> FormaPagamento.DINHEIRO;
            case PIX -> FormaPagamento.PIX;
            case DEBITO -> FormaPagamento.CARTAO_DEBITO;
            case CREDITO -> FormaPagamento.CARTAO_CREDITO;
            case BOLETO, TRANSFERENCIA -> null;
        };
    }
}
