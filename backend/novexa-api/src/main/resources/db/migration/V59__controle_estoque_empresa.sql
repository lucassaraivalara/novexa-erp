-- Preserva o comportamento das empresas existentes e das novas por padrao.
ALTER TABLE empresas ADD COLUMN controla_estoque BOOLEAN NOT NULL DEFAULT TRUE;
-- NULL identifica historico anterior/rascunho: nao inventar a politica aplicada no passado.
ALTER TABLE itens_venda ADD COLUMN controle_estoque_aplicado BOOLEAN;
ALTER TABLE itens_venda ADD CONSTRAINT ck_item_sem_controle_sem_baixa
 CHECK (controle_estoque_aplicado IS DISTINCT FROM FALSE OR movimentacao_estoque_id IS NULL);
