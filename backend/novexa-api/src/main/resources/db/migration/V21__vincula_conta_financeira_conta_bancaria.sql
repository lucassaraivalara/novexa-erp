ALTER TABLE contas_financeiras ADD COLUMN conta_bancaria_id BIGINT;
ALTER TABLE contas_bancarias ADD CONSTRAINT uk_conta_bancaria_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE contas_financeiras ADD CONSTRAINT fk_conta_financeira_bancaria_empresa
    FOREIGN KEY (conta_bancaria_id, empresa_id) REFERENCES contas_bancarias (id, empresa_id);
ALTER TABLE contas_financeiras ADD CONSTRAINT uk_conta_financeira_bancaria UNIQUE (conta_bancaria_id);
ALTER TABLE contas_financeiras ADD CONSTRAINT chk_conta_financeira_bancaria_tipo
    CHECK (conta_bancaria_id IS NULL OR tipo = 'BANCO');
