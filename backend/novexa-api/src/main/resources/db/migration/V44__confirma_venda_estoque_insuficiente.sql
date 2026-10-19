-- Existing companies keep blocking sales without stock until explicitly configured.
ALTER TABLE empresas ADD COLUMN permitir_venda_estoque_negativo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE movimentacoes_estoque ADD COLUMN estoque_insuficiente_confirmado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE movimentacoes_estoque ADD CONSTRAINT ck_confirmacao_estoque_venda
    CHECK (NOT estoque_insuficiente_confirmado OR
           (tipo = 'SAIDA' AND origem = 'VENDA' AND saldo_posterior < 0));
