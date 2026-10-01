ALTER TABLE pagamentos
    ADD COLUMN configuracao_nome_exibicao VARCHAR(150),
    ADD COLUMN configuracao_tipo VARCHAR(20),
    ADD COLUMN configuracao_conta_financeira_destino_id BIGINT,
    ADD COLUMN configuracao_conta_financeira_destino_nome VARCHAR(150);

ALTER TABLE pagamentos ADD CONSTRAINT fk_pagamento_snapshot_destino_empresa
    FOREIGN KEY (configuracao_conta_financeira_destino_id, empresa_id)
    REFERENCES contas_financeiras(id, empresa_id);

CREATE INDEX idx_pagamento_snapshot_destino
    ON pagamentos(configuracao_conta_financeira_destino_id, empresa_id);
