-- Cartoes legados sem destino permanecem legiveis; o backend exige regularizacao para novas vendas.
ALTER TABLE configuracoes_formas_pagamento_empresa DROP CONSTRAINT chk_config_forma_destino;
ALTER TABLE configuracoes_formas_pagamento_empresa ADD CONSTRAINT chk_config_forma_destino CHECK (
    (tipo IN ('PIX', 'TRANSFERENCIA') AND conta_financeira_destino_id IS NOT NULL)
    OR tipo IN ('DEBITO', 'CREDITO')
    OR (tipo IN ('DINHEIRO', 'BOLETO') AND conta_financeira_destino_id IS NULL)
);

ALTER TABLE recebiveis ADD CONSTRAINT uk_recebivel_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE recebiveis
    ADD COLUMN data_liquidacao TIMESTAMP,
    ADD COLUMN valor_liquido_recebido NUMERIC(19,2),
    ADD COLUMN usuario_liquidacao_id BIGINT,
    ADD COLUMN data_cancelamento TIMESTAMP,
    ADD COLUMN usuario_cancelamento_id BIGINT;
ALTER TABLE recebiveis ADD CONSTRAINT fk_recebivel_liquidacao_usuario_empresa
    FOREIGN KEY (usuario_liquidacao_id, empresa_id) REFERENCES usuario(id, empresa_id);
ALTER TABLE recebiveis ADD CONSTRAINT fk_recebivel_cancelamento_usuario_empresa
    FOREIGN KEY (usuario_cancelamento_id, empresa_id) REFERENCES usuario(id, empresa_id);
ALTER TABLE recebiveis ADD CONSTRAINT chk_recebivel_liquidacao CHECK (
    (data_liquidacao IS NULL AND valor_liquido_recebido IS NULL AND usuario_liquidacao_id IS NULL AND status <> 'LIQUIDADO')
    OR (data_liquidacao IS NOT NULL AND valor_liquido_recebido IS NOT NULL AND valor_liquido_previsto IS NOT NULL
        AND valor_liquido_recebido > 0 AND usuario_liquidacao_id IS NOT NULL
        AND valor_liquido_recebido = valor_liquido_previsto AND status IN ('LIQUIDADO', 'CANCELADO'))
);
ALTER TABLE recebiveis ADD CONSTRAINT chk_recebivel_cancelamento CHECK (
    (data_cancelamento IS NULL AND usuario_cancelamento_id IS NULL)
    OR (data_cancelamento IS NOT NULL AND usuario_cancelamento_id IS NOT NULL AND status = 'CANCELADO')
);

ALTER TABLE movimentacoes_financeiras ADD COLUMN recebivel_id BIGINT;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fk_mov_fin_recebivel_empresa
    FOREIGN KEY (recebivel_id, empresa_id) REFERENCES recebiveis(id, empresa_id);
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT uk_mov_fin_recebivel UNIQUE (recebivel_id);
ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR', 'SALDO_INICIAL', 'TRANSFERENCIA', 'PAGAMENTO_PIX', 'RECEBIVEL_LIQUIDACAO'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_recebivel CHECK (
    (origem = 'RECEBIVEL_LIQUIDACAO' AND recebivel_id IS NOT NULL AND tipo = 'ENTRADA')
    OR (origem <> 'RECEBIVEL_LIQUIDACAO' AND recebivel_id IS NULL)
);
