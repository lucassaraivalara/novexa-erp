ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS chk_pagamento_status;
ALTER TABLE pagamentos ADD CONSTRAINT chk_pagamento_status
    CHECK (status IN ('REGISTRADO', 'CANCELADO'));

ALTER TABLE lancamentos_financeiros
    DROP CONSTRAINT IF EXISTS lancamentos_financeiros_situacao_check;
ALTER TABLE lancamentos_financeiros
    ADD CONSTRAINT chk_lancamento_situacao
    CHECK (situacao IN ('RECEBIDO', 'A_RECEBER', 'CANCELADO'));

ALTER TABLE movimentacoes_caixa DROP CONSTRAINT IF EXISTS uk_mov_caixa_pagamento;
ALTER TABLE movimentacoes_caixa ADD CONSTRAINT uk_mov_caixa_pagamento_tipo
    UNIQUE (pagamento_id, tipo);

ALTER TABLE movimentacoes_caixa DROP CONSTRAINT IF EXISTS chk_mov_caixa_origem;
ALTER TABLE movimentacoes_caixa ADD CONSTRAINT chk_mov_caixa_origem CHECK (
    (tipo IN ('VENDA', 'ESTORNO_VENDA') AND pagamento_id IS NOT NULL)
    OR (tipo IN ('SUPRIMENTO', 'SANGRIA') AND pagamento_id IS NULL)
);
