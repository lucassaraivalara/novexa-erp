-- Aditiva: não reconstrói baixas legadas nem reaplica saldos/movimentos.
CREATE TABLE pagamentos_conta_pagar (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    conta_pagar_id BIGINT NOT NULL,
    chave_requisicao UUID NOT NULL,
    resumo_requisicao VARCHAR(64) NOT NULL,
    data_pagamento DATE NOT NULL,
    valor_original NUMERIC(19,2) NOT NULL,
    principal_quitado NUMERIC(19,2) NOT NULL,
    juros NUMERIC(19,2) NOT NULL,
    multa NUMERIC(19,2) NOT NULL,
    desconto NUMERIC(19,2) NOT NULL,
    total_pago NUMERIC(19,2) NOT NULL,
    usuario_id BIGINT NOT NULL,
    data_criacao TIMESTAMP NOT NULL,
    estado VARCHAR(16) NOT NULL,
    usuario_estorno_id BIGINT,
    data_estorno TIMESTAMP,
    motivo_estorno VARCHAR(500),
    CONSTRAINT uk_pagamento_pagar_empresa UNIQUE(id, empresa_id),
    CONSTRAINT uk_pagamento_pagar_titulo UNIQUE(id, empresa_id, conta_pagar_id),
    CONSTRAINT uk_pagamento_pagar_chave UNIQUE(empresa_id, chave_requisicao),
    CONSTRAINT fk_pagamento_pagar_titulo FOREIGN KEY(conta_pagar_id, empresa_id) REFERENCES contas_pagar(id, empresa_id),
    CONSTRAINT fk_pagamento_pagar_usuario FOREIGN KEY(usuario_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_pagamento_pagar_estorno_usuario FOREIGN KEY(usuario_estorno_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT chk_pagamento_pagar_valores CHECK(valor_original > 0 AND principal_quitado > 0
        AND principal_quitado <= valor_original AND juros >= 0 AND multa >= 0 AND desconto >= 0
        AND total_pago > 0 AND total_pago = principal_quitado + juros + multa - desconto),
    CONSTRAINT chk_pagamento_pagar_estado CHECK(
        (estado='CONFIRMADO' AND usuario_estorno_id IS NULL AND data_estorno IS NULL AND motivo_estorno IS NULL)
        OR (estado='ESTORNADO' AND usuario_estorno_id IS NOT NULL AND data_estorno IS NOT NULL
            AND motivo_estorno IS NOT NULL AND length(trim(motivo_estorno)) > 0))
);
CREATE UNIQUE INDEX uk_pagamento_pagar_ativo ON pagamentos_conta_pagar(conta_pagar_id) WHERE estado='CONFIRMADO';
CREATE INDEX idx_pagamento_pagar_historico ON pagamentos_conta_pagar(empresa_id, conta_pagar_id, data_pagamento DESC, id DESC);
ALTER TABLE movimentacoes_financeiras ADD COLUMN pagamento_conta_pagar_id BIGINT;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fk_mov_pagamento_pagar_empresa
    FOREIGN KEY(pagamento_conta_pagar_id, empresa_id) REFERENCES pagamentos_conta_pagar(id, empresa_id);
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_pagamento_pagar
    CHECK(pagamento_conta_pagar_id IS NULL OR (origem='CONTAS_A_PAGAR' AND tipo='SAIDA'));
CREATE UNIQUE INDEX uk_mov_pagamento_pagar_origem ON movimentacoes_financeiras(pagamento_conta_pagar_id, conta_financeira_id)
    WHERE pagamento_conta_pagar_id IS NOT NULL;
ALTER TABLE contas_pagar ADD COLUMN pagamento_atual_id BIGINT;
ALTER TABLE contas_pagar ADD CONSTRAINT fk_conta_pagamento_atual_empresa
    FOREIGN KEY(pagamento_atual_id, empresa_id, id) REFERENCES pagamentos_conta_pagar(id, empresa_id, conta_pagar_id);
