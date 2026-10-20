-- Origem e rastreabilidade da abertura de sessao de caixa fisico;
-- Vincula troco herdado, retirada de cofre e aporte externo com continuidade de custodia.

ALTER TABLE sessoes_caixa ADD CONSTRAINT uk_sessao_caixa_empresa_caixa UNIQUE (id, empresa_id, caixa_id);

CREATE TABLE aberturas_caixa_origem (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    sessao_id BIGINT NOT NULL UNIQUE,
    caixa_id BIGINT NOT NULL,
    sessao_origem_troco_id BIGINT,
    conta_cofre_id BIGINT,
    movimento_financeiro_id BIGINT UNIQUE,
    usuario_id BIGINT NOT NULL,
    chave_requisicao UUID NOT NULL,
    valor_troco_herdado NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (valor_troco_herdado >= 0),
    valor_retirado_cofre NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (valor_retirado_cofre >= 0),
    valor_aporte_externo NUMERIC(19,2) NOT NULL DEFAULT 0 CHECK (valor_aporte_externo >= 0),
    observacao_aporte VARCHAR(500),
    data_criacao TIMESTAMP NOT NULL,
    CONSTRAINT uk_abertura_origem_chave UNIQUE (empresa_id, chave_requisicao),
    CONSTRAINT fk_abertura_origem_sessao FOREIGN KEY (sessao_id, empresa_id, caixa_id) REFERENCES sessoes_caixa(id, empresa_id, caixa_id),
    CONSTRAINT fk_abertura_origem_troco FOREIGN KEY (sessao_origem_troco_id, empresa_id, caixa_id) REFERENCES sessoes_caixa(id, empresa_id, caixa_id),
    CONSTRAINT fk_abertura_origem_cofre FOREIGN KEY (conta_cofre_id, empresa_id) REFERENCES contas_financeiras(id, empresa_id),
    CONSTRAINT fk_abertura_origem_financeiro FOREIGN KEY (movimento_financeiro_id, empresa_id) REFERENCES movimentacoes_financeiras(id, empresa_id),
    CONSTRAINT fk_abertura_origem_usuario FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT ck_abertura_origem_sessoes CHECK (sessao_origem_troco_id IS NULL OR sessao_origem_troco_id <> sessao_id),
    CONSTRAINT ck_abertura_origem_cofre CHECK (
        (valor_retirado_cofre = 0 AND conta_cofre_id IS NULL AND movimento_financeiro_id IS NULL)
        OR (valor_retirado_cofre > 0 AND conta_cofre_id IS NOT NULL AND movimento_financeiro_id IS NOT NULL)
    ),
    CONSTRAINT ck_abertura_origem_troco CHECK (
        (valor_troco_herdado = 0 AND sessao_origem_troco_id IS NULL)
        OR (valor_troco_herdado > 0 AND sessao_origem_troco_id IS NOT NULL)
    ),
    CONSTRAINT ck_abertura_origem_aporte CHECK (
        (valor_aporte_externo = 0)
        OR (valor_aporte_externo > 0 AND observacao_aporte IS NOT NULL AND length(trim(observacao_aporte)) > 0)
    )
);

CREATE UNIQUE INDEX uk_abertura_origem_troco ON aberturas_caixa_origem (sessao_origem_troco_id);

CREATE INDEX idx_abertura_origem_empresa ON aberturas_caixa_origem (empresa_id, sessao_id);
