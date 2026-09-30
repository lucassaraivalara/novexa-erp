CREATE TABLE transferencias_financeiras (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    conta_origem_id BIGINT NOT NULL,
    conta_destino_id BIGINT NOT NULL,
    valor NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    data_movimento DATE NOT NULL,
    observacao VARCHAR(1000),
    usuario_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('CONCLUIDA', 'ESTORNADA')),
    chave_requisicao UUID NOT NULL,
    data_criacao TIMESTAMP NOT NULL,
    data_estorno TIMESTAMP,
    usuario_estorno_id BIGINT,
    motivo_estorno VARCHAR(500),
    CONSTRAINT uk_transferencia_id_empresa UNIQUE (id, empresa_id),
    CONSTRAINT uk_transferencia_empresa_chave UNIQUE (empresa_id, chave_requisicao),
    CONSTRAINT fk_transferencia_origem_empresa FOREIGN KEY (conta_origem_id, empresa_id)
        REFERENCES contas_financeiras(id, empresa_id),
    CONSTRAINT fk_transferencia_destino_empresa FOREIGN KEY (conta_destino_id, empresa_id)
        REFERENCES contas_financeiras(id, empresa_id),
    CONSTRAINT fk_transferencia_usuario_empresa FOREIGN KEY (usuario_id, empresa_id)
        REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_transferencia_estorno_empresa FOREIGN KEY (usuario_estorno_id, empresa_id)
        REFERENCES usuario(id, empresa_id),
    CONSTRAINT chk_transferencia_contas CHECK (conta_origem_id <> conta_destino_id),
    CONSTRAINT chk_transferencia_estorno CHECK (
        (status = 'CONCLUIDA' AND data_estorno IS NULL AND usuario_estorno_id IS NULL AND motivo_estorno IS NULL)
        OR (status = 'ESTORNADA' AND data_estorno IS NOT NULL AND usuario_estorno_id IS NOT NULL
            AND motivo_estorno IS NOT NULL AND length(trim(motivo_estorno)) > 0)
    )
);
CREATE INDEX idx_transferencia_empresa_data ON transferencias_financeiras(empresa_id, data_movimento DESC, id DESC);
CREATE INDEX idx_transferencia_origem ON transferencias_financeiras(conta_origem_id, empresa_id);
CREATE INDEX idx_transferencia_destino ON transferencias_financeiras(conta_destino_id, empresa_id);

ALTER TABLE movimentacoes_financeiras ADD COLUMN transferencia_id BIGINT;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fk_mov_fin_transferencia_empresa
    FOREIGN KEY (transferencia_id, empresa_id) REFERENCES transferencias_financeiras(id, empresa_id);
ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR', 'SALDO_INICIAL', 'TRANSFERENCIA'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_transferencia
    CHECK ((origem = 'TRANSFERENCIA' AND transferencia_id IS NOT NULL)
        OR (origem <> 'TRANSFERENCIA' AND transferencia_id IS NULL));
CREATE UNIQUE INDEX uk_mov_fin_transferencia_tipo ON movimentacoes_financeiras(transferencia_id, tipo)
    WHERE transferencia_id IS NOT NULL;
