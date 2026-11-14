ALTER TABLE vendas
    ADD COLUMN taxa_entrega NUMERIC(19, 2) NOT NULL DEFAULT 0;

ALTER TABLE vendas
    ADD CONSTRAINT ck_vendas_taxa_entrega_nao_negativa CHECK (taxa_entrega >= 0);

ALTER TABLE vendas
    DROP CONSTRAINT vendas_check1;

ALTER TABLE vendas
    ADD CONSTRAINT ck_vendas_total_com_taxa_entrega
    CHECK (total = subtotal - desconto + taxa_entrega);
