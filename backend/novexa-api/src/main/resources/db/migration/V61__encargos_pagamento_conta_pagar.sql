-- Snapshot opcional e imutável por movimento. Legado permanece sem classificação inventada.
ALTER TABLE movimentacoes_financeiras ADD COLUMN conta_pagar_valor_original NUMERIC(19,2);
ALTER TABLE movimentacoes_financeiras ADD COLUMN conta_pagar_juros NUMERIC(19,2);
ALTER TABLE movimentacoes_financeiras ADD COLUMN conta_pagar_multa NUMERIC(19,2);
ALTER TABLE movimentacoes_financeiras ADD COLUMN conta_pagar_desconto NUMERIC(19,2);
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_movimento_encargos_pagar CHECK (
    (conta_pagar_valor_original IS NULL AND conta_pagar_juros IS NULL
        AND conta_pagar_multa IS NULL AND conta_pagar_desconto IS NULL)
    OR (conta_pagar_valor_original IS NOT NULL AND conta_pagar_juros IS NOT NULL
        AND conta_pagar_multa IS NOT NULL AND conta_pagar_desconto IS NOT NULL
        AND origem = 'CONTAS_A_PAGAR' AND tipo = 'SAIDA'
        AND conta_pagar_valor_original > 0 AND conta_pagar_juros >= 0
        AND conta_pagar_multa >= 0 AND conta_pagar_desconto >= 0
        AND valor = conta_pagar_valor_original + conta_pagar_juros + conta_pagar_multa - conta_pagar_desconto)
);
