CREATE TABLE contas_financeiras (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    nome VARCHAR(150) NOT NULL CHECK (length(trim(nome)) > 0),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('BANCO', 'CAIXA', 'COFRE', 'CARTEIRA_DIGITAL', 'ADQUIRENTE', 'OUTROS')),
    saldo_inicial NUMERIC(19,2) NOT NULL CHECK (saldo_inicial >= 0),
    saldo_atual NUMERIC(19,2) NOT NULL CHECK (saldo_atual >= 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP NOT NULL,
    data_atualizacao TIMESTAMP NOT NULL,
    CONSTRAINT uk_conta_financeira_id_empresa UNIQUE (id, empresa_id)
);
CREATE INDEX idx_contas_financeiras_empresa ON contas_financeiras(empresa_id, id);

CREATE TABLE movimentacoes_financeiras (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    conta_financeira_id BIGINT NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    origem VARCHAR(20) NOT NULL CHECK (origem = 'MANUAL'),
    descricao VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) > 0),
    valor NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    data_movimento DATE NOT NULL,
    observacao VARCHAR(1000),
    usuario_id BIGINT NOT NULL,
    data_criacao TIMESTAMP NOT NULL,
    estornada BOOLEAN NOT NULL DEFAULT FALSE,
    data_estorno TIMESTAMP,
    usuario_estorno_id BIGINT,
    motivo_estorno VARCHAR(500),
    CONSTRAINT fk_mov_fin_conta_empresa FOREIGN KEY (conta_financeira_id, empresa_id)
        REFERENCES contas_financeiras(id, empresa_id),
    CONSTRAINT fk_mov_fin_usuario_empresa FOREIGN KEY (usuario_id, empresa_id)
        REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_mov_fin_usuario_estorno_empresa FOREIGN KEY (usuario_estorno_id, empresa_id)
        REFERENCES usuario(id, empresa_id),
    CONSTRAINT chk_mov_fin_estorno CHECK (
        (estornada = FALSE AND data_estorno IS NULL AND usuario_estorno_id IS NULL AND motivo_estorno IS NULL)
        OR (estornada = TRUE AND data_estorno IS NOT NULL AND usuario_estorno_id IS NOT NULL
            AND motivo_estorno IS NOT NULL AND length(trim(motivo_estorno)) > 0)
    )
);
CREATE INDEX idx_mov_fin_empresa_conta_data ON movimentacoes_financeiras(empresa_id, conta_financeira_id, data_movimento DESC, id DESC);
