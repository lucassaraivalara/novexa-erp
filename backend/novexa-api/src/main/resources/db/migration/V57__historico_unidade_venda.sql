-- data_faturamento criada pela V56 (hotfix); aqui apenas documentação e índice de apoio.
-- Sem backfill: criação/pagamentos/cadastro atual não comprovam o histórico de todas as vendas.
ALTER TABLE itens_venda ADD COLUMN unidade_medida_venda VARCHAR(10);

ALTER TABLE itens_venda ADD CONSTRAINT chk_item_unidade_venda
    CHECK (unidade_medida_venda IS NULL OR
        (length(trim(unidade_medida_venda)) > 0 AND unidade_medida_venda = upper(trim(unidade_medida_venda))));

CREATE INDEX idx_venda_empresa_faturamento ON vendas (empresa_id, data_faturamento, id)
    WHERE status = 'FATURADA' AND data_faturamento IS NOT NULL;

COMMENT ON COLUMN vendas.data_faturamento IS 'Horário civil de Brasília do faturamento efetivo; NULL no legado sem evidência universal confiável.';
COMMENT ON COLUMN itens_venda.unidade_medida_venda IS 'Unidade na inclusão do item; imutável. NULL no legado, sem conversão ou inferência pelo cadastro atual.';
