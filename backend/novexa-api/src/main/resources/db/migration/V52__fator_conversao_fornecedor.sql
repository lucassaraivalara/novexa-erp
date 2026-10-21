-- Fator de conversao por vinculo produto <-> fornecedor (1 embalagem comprada = X unidades do produto).
-- NULL = sem conversao (1:1). O item de entrada guarda o fator aplicado para creditar estoque e reverter com exatidao.
ALTER TABLE produto_fornecedor ADD COLUMN fator_conversao NUMERIC(12,3);
ALTER TABLE produto_fornecedor ADD CONSTRAINT chk_produto_fornecedor_vinc_fator
 CHECK (fator_conversao IS NULL OR fator_conversao > 0);
ALTER TABLE itens_entrada_mercadoria ADD COLUMN fator_conversao NUMERIC(12,3) NOT NULL DEFAULT 1;
