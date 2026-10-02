-- Evolves the existing V1 table; preserves historical suppliers and the V17 tenant-safe FK.
ALTER TABLE fornecedores
    ADD COLUMN tipo_pessoa VARCHAR(20),
    ADD COLUMN cep VARCHAR(8),
    ADD COLUMN logradouro VARCHAR(150),
    ADD COLUMN numero VARCHAR(20),
    ADD COLUMN complemento VARCHAR(100),
    ADD COLUMN bairro VARCHAR(100),
    ADD COLUMN cidade VARCHAR(100),
    ADD COLUMN uf VARCHAR(2),
    ADD COLUMN observacao VARCHAR(2000),
    ADD COLUMN data_atualizacao TIMESTAMP,
    ADD CONSTRAINT ck_fornecedor_tipo_pessoa CHECK (tipo_pessoa IN ('FISICA', 'JURIDICA'));

-- No backfill/deduplication. Conflicting legacy documents require explicit regularization.
CREATE UNIQUE INDEX uk_fornecedor_empresa_documento_normalizado
    ON fornecedores (empresa_id, (regexp_replace(cpf_cnpj, '[^0-9]', '', 'g')))
    WHERE cpf_cnpj IS NOT NULL AND regexp_replace(cpf_cnpj, '[^0-9]', '', 'g') <> '';
