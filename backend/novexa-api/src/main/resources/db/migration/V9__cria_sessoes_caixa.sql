-- Sessao operacional de dinheiro fisico; saldos declarados, sem movimentacoes financeiras.
ALTER TABLE caixas ADD CONSTRAINT uk_caixa_id_empresa UNIQUE (id, empresa_id);

CREATE TABLE sessoes_caixa (
    id BIGSERIAL PRIMARY KEY,
    caixa_id BIGINT NOT NULL,
    empresa_id BIGINT NOT NULL,
    usuario_abertura_id BIGINT NOT NULL,
    usuario_fechamento_id BIGINT,
    saldo_inicial NUMERIC(19,2) NOT NULL,
    saldo_final NUMERIC(19,2),
    data_abertura TIMESTAMP NOT NULL,
    data_fechamento TIMESTAMP,
    status VARCHAR(10) NOT NULL,
    CONSTRAINT fk_sessao_caixa_empresa FOREIGN KEY (caixa_id, empresa_id) REFERENCES caixas(id, empresa_id),
    CONSTRAINT fk_sessao_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    CONSTRAINT fk_sessao_abertura_empresa FOREIGN KEY (usuario_abertura_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_sessao_fechamento_empresa FOREIGN KEY (usuario_fechamento_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT chk_sessao_saldos CHECK (saldo_inicial >= 0 AND (saldo_final IS NULL OR saldo_final >= 0)),
    CONSTRAINT chk_sessao_estado CHECK (
        (status = 'ABERTO' AND saldo_final IS NULL AND data_fechamento IS NULL AND usuario_fechamento_id IS NULL)
        OR (status = 'FECHADO' AND saldo_final IS NOT NULL AND data_fechamento IS NOT NULL
            AND usuario_fechamento_id IS NOT NULL AND data_fechamento >= data_abertura)
    )
);
CREATE UNIQUE INDEX uk_sessao_caixa_aberta ON sessoes_caixa(caixa_id) WHERE status = 'ABERTO';
CREATE INDEX idx_sessao_empresa_caixa ON sessoes_caixa(empresa_id, caixa_id);
COMMENT ON TABLE sessoes_caixa IS 'Abertura e fechamento do Caixa; saldo final declarado, sem conciliacao';
