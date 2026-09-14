-- Nao inferir equivalencia quando os dois modelos possuem itens da mesma venda.
-- Qualquer ambiguidade interrompe a migration antes de alterar os dados originais.
CREATE TEMPORARY TABLE verificacao_consolidacao_venda (
    conflitos BIGINT NOT NULL CHECK (conflitos = 0)
);
INSERT INTO verificacao_consolidacao_venda
SELECT COUNT(*) FROM venda_itens legado
WHERE EXISTS (SELECT 1 FROM itens_venda atual WHERE atual.venda_id = legado.venda_id);

-- V3 gerou este nome para o CHECK entre colunas no PostgreSQL; V5 nao o removeu.
-- Venda aberta vazia admite desconto = subtotal = zero; faturamento exige total positivo no dominio.
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_check;
ALTER TABLE vendas ADD CONSTRAINT chk_venda_desconto_aberta
    CHECK (desconto >= 0 AND desconto <= subtotal);

ALTER TABLE itens_venda ADD COLUMN nome_produto VARCHAR(150);
ALTER TABLE itens_venda ADD COLUMN movimentacao_estoque_id BIGINT;
ALTER TABLE itens_venda ADD COLUMN ordem INTEGER;

-- O modelo aberto antigo nao armazenava nome; somente nesse caso usa o cadastro atual.
UPDATE itens_venda SET nome_produto = (SELECT p.nome FROM produtos p WHERE p.id = produto_id);
UPDATE itens_venda SET ordem = (
    SELECT COUNT(*) FROM itens_venda anterior
    WHERE anterior.venda_id = itens_venda.venda_id AND anterior.id < itens_venda.id
);

INSERT INTO itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario,
                         subtotal, movimentacao_estoque_id, ordem)
SELECT venda_id, produto_id, nome_produto, quantidade, preco_unitario,
       subtotal, movimentacao_estoque_id, ordem
FROM venda_itens;

ALTER TABLE itens_venda ALTER COLUMN nome_produto SET NOT NULL;
ALTER TABLE itens_venda ALTER COLUMN ordem SET NOT NULL;
ALTER TABLE itens_venda ADD CONSTRAINT fk_item_venda_movimento
    FOREIGN KEY (movimentacao_estoque_id) REFERENCES movimentacoes_estoque(id);
ALTER TABLE itens_venda ADD CONSTRAINT uk_item_venda_movimento UNIQUE (movimentacao_estoque_id);

-- O fluxo direto antigo ja gerou efeitos definitivos. Nao faturar esses registros novamente.
UPDATE vendas SET status = 'FATURADA'
WHERE status = 'ABERTA'
  AND EXISTS (SELECT 1 FROM lancamentos_financeiros l WHERE l.venda_id = vendas.id);

-- Preserva o original para auditoria. A aplicacao passa a utilizar exclusivamente itens_venda.
ALTER TABLE venda_itens RENAME TO venda_itens_legado_v6;
