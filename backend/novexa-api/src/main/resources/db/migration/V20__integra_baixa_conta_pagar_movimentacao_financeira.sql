ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT movimentacoes_financeiras_origem_check;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT uk_mov_fin_id_empresa UNIQUE (id, empresa_id);

ALTER TABLE contas_pagar ADD COLUMN movimentacao_financeira_id BIGINT;
ALTER TABLE contas_pagar ADD CONSTRAINT uk_conta_pagar_mov_fin UNIQUE (movimentacao_financeira_id);
ALTER TABLE contas_pagar ADD CONSTRAINT fk_conta_pagar_mov_fin_empresa
    FOREIGN KEY (movimentacao_financeira_id, empresa_id)
    REFERENCES movimentacoes_financeiras (id, empresa_id);
