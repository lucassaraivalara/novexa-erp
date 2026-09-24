ALTER TABLE sessoes_caixa ADD COLUMN modalidade_conferencia VARCHAR(10);
ALTER TABLE sessoes_caixa ADD COLUMN observacao_fechamento VARCHAR(500);
-- Classifica fechamentos antigos sem inventar valores conferidos.
UPDATE sessoes_caixa SET modalidade_conferencia = 'LEGADA' WHERE status = 'FECHADO';
ALTER TABLE sessoes_caixa ADD CONSTRAINT chk_sessao_conferencia CHECK (
    (status = 'ABERTO' AND modalidade_conferencia IS NULL AND observacao_fechamento IS NULL)
    OR (status = 'FECHADO' AND modalidade_conferencia IS NOT NULL
        AND modalidade_conferencia IN ('LEGADA', 'POR_FORMA')
        AND (modalidade_conferencia = 'POR_FORMA' OR observacao_fechamento IS NULL))
);
ALTER TABLE sessoes_caixa ADD CONSTRAINT chk_sessao_observacao_fechamento CHECK (
    observacao_fechamento IS NULL OR length(trim(observacao_fechamento)) > 0
);

CREATE TABLE conferencias_fechamento_caixa (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    sessao_id BIGINT NOT NULL,
    escopo VARCHAR(20) NOT NULL,
    forma_pagamento_id BIGINT REFERENCES formas_pagamento(id),
    descricao_snapshot VARCHAR(150) NOT NULL CHECK (length(trim(descricao_snapshot)) > 0),
    tipo_snapshot VARCHAR(20) NOT NULL,
    valor_esperado NUMERIC(19,2) NOT NULL,
    valor_informado NUMERIC(19,2) NOT NULL CHECK (valor_informado >= 0),
    CONSTRAINT fk_conferencia_sessao_empresa FOREIGN KEY (sessao_id, empresa_id)
        REFERENCES sessoes_caixa(id, empresa_id),
    CONSTRAINT chk_conferencia_escopo CHECK (
        (escopo = 'DINHEIRO_FISICO' AND forma_pagamento_id IS NULL AND tipo_snapshot = 'DINHEIRO')
        OR (escopo = 'FORMA_PAGAMENTO' AND forma_pagamento_id IS NOT NULL
            AND tipo_snapshot IN ('PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA') AND valor_esperado >= 0)
    )
);
CREATE UNIQUE INDEX uk_conferencia_dinheiro ON conferencias_fechamento_caixa(sessao_id)
    WHERE escopo = 'DINHEIRO_FISICO';
CREATE UNIQUE INDEX uk_conferencia_forma ON conferencias_fechamento_caixa(sessao_id, forma_pagamento_id)
    WHERE escopo = 'FORMA_PAGAMENTO';
CREATE INDEX idx_conferencia_empresa_sessao ON conferencias_fechamento_caixa(empresa_id, sessao_id);
COMMENT ON TABLE conferencias_fechamento_caixa IS
    'Snapshot operacional do fechamento; diferenca = informado - esperado, sem liquidacao financeira';
