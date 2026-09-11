-- Migration V2: Cria tabela de movimentações de estoque
-- Registra o histórico de movimentações de estoque por produto/empresa

-- ============================================================
-- TABELA: movimentacoes_estoque
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    origem VARCHAR(20) NOT NULL,
    quantidade NUMERIC(19,3) NOT NULL,
    saldo_anterior NUMERIC(19,3) NOT NULL,
    saldo_posterior NUMERIC(19,3) NOT NULL,
    motivo VARCHAR(500),
    data_hora TIMESTAMP NOT NULL,
    CONSTRAINT fk_mov_estoque_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_mov_estoque_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
    CONSTRAINT fk_mov_estoque_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

CREATE INDEX IF NOT EXISTS idx_mov_estoque_empresa ON movimentacoes_estoque (empresa_id);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto ON movimentacoes_estoque (produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_data_hora ON movimentacoes_estoque (data_hora);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_empresa_produto ON movimentacoes_estoque (empresa_id, produto_id);

-- ============================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================
COMMENT ON TABLE movimentacoes_estoque IS 'Histórico de movimentações de estoque por produto/empresa';
COMMENT ON COLUMN movimentacoes_estoque.empresa_id IS 'Empresa dona da movimentação';
COMMENT ON COLUMN movimentacoes_estoque.produto_id IS 'Produto movimentado';
COMMENT ON COLUMN movimentacoes_estoque.usuario_id IS 'Usuário que realizou a movimentação';
COMMENT ON COLUMN movimentacoes_estoque.tipo IS 'Tipo da movimentação: ENTRADA, SAIDA, AJUSTE';
COMMENT ON COLUMN movimentacoes_estoque.origem IS 'Origem da movimentação: MANUAL, VENDA, COMPRA, AJUSTE, CANCELAMENTO';
COMMENT ON COLUMN movimentacoes_estoque.quantidade IS 'Quantidade movimentada';
COMMENT ON COLUMN movimentacoes_estoque.saldo_anterior IS 'Saldo do produto antes da movimentação';
COMMENT ON COLUMN movimentacoes_estoque.saldo_posterior IS 'Saldo do produto após a movimentação';
COMMENT ON COLUMN movimentacoes_estoque.motivo IS 'Motivo da movimentação (opcional)';
COMMENT ON COLUMN movimentacoes_estoque.data_hora IS 'Data e hora da movimentação';