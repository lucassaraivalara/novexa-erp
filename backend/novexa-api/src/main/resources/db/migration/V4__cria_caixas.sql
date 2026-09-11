CREATE TABLE caixas (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    descricao VARCHAR(150) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_caixa_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE INDEX idx_caixa_empresa ON caixas (empresa_id);
CREATE UNIQUE INDEX uk_caixa_empresa_descricao
    ON caixas (empresa_id, lower(trim(descricao)));

COMMENT ON TABLE caixas IS 'Caixas financeiros vinculados a uma empresa';
COMMENT ON COLUMN caixas.empresa_id IS 'Empresa dona do caixa';
COMMENT ON COLUMN caixas.descricao IS 'Nome operacional do caixa';
COMMENT ON COLUMN caixas.ativo IS 'Indica se o caixa está ativo';
