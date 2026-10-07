ALTER TABLE vendas ADD COLUMN valor_prazo NUMERIC(19,2) NOT NULL DEFAULT 0;

-- CHECKs entre colunas gerados pela V3 no PostgreSQL; recebido nunca inclui a divida do cliente.
ALTER TABLE vendas DROP CONSTRAINT vendas_check2;
ALTER TABLE vendas DROP CONSTRAINT vendas_check3;
ALTER TABLE vendas ADD CONSTRAINT chk_venda_valor_prazo
    CHECK (valor_prazo >= 0 AND (total IS NULL OR valor_prazo <= total));
ALTER TABLE vendas ADD CONSTRAINT chk_venda_recebido_com_prazo
    CHECK (valor_recebido >= 0 AND valor_recebido + valor_prazo >= total);
ALTER TABLE vendas ADD CONSTRAINT chk_venda_troco_com_prazo
    CHECK (troco >= 0 AND troco = valor_recebido + valor_prazo - total);
