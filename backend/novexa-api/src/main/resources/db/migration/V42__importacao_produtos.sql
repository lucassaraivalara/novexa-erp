ALTER TABLE produtos ADD COLUMN ncm VARCHAR(8);
ALTER TABLE produtos ADD COLUMN cest VARCHAR(7);
ALTER TABLE produtos ADD CONSTRAINT ck_produto_ncm CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$');
ALTER TABLE produtos ADD CONSTRAINT ck_produto_cest CHECK (cest IS NULL OR cest ~ '^[0-9]{7}$');

CREATE TABLE importacoes_produtos (
    id UUID PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    hash_arquivo VARCHAR(64) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    estado VARCHAR(12) NOT NULL CHECK (estado IN ('PREVIA','CONFIRMADA','CANCELADA')),
    previa_json TEXT NOT NULL,
    importados INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL,
    confirmado_em TIMESTAMP,
    CONSTRAINT uk_importacao_produto_empresa_hash UNIQUE (empresa_id, hash_arquivo)
);
