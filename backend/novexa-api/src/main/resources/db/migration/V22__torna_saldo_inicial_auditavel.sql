ALTER TABLE contas_financeiras ADD COLUMN saldo_inicial_auditado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR', 'SALDO_INICIAL'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_saldo_inicial
    CHECK (origem <> 'SALDO_INICIAL' OR (tipo = 'ENTRADA' AND estornada = FALSE));
CREATE UNIQUE INDEX uk_mov_fin_saldo_inicial ON movimentacoes_financeiras (conta_financeira_id)
    WHERE origem = 'SALDO_INICIAL';
