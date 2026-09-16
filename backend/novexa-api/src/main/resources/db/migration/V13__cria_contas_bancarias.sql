CREATE TABLE contas_bancarias (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    agencia_id BIGINT NOT NULL,
    numero VARCHAR(20) NOT NULL,
    digito VARCHAR(5),
    titular VARCHAR(150),
    tipo VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_conta_bancaria_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT fk_conta_bancaria_agencia FOREIGN KEY (agencia_id) REFERENCES agencias (id),
    CONSTRAINT chk_conta_bancaria_numero CHECK (length(trim(numero)) > 0),
    CONSTRAINT chk_conta_bancaria_tipo CHECK (tipo IN ('CORRENTE', 'POUPANCA'))
);

CREATE UNIQUE INDEX uk_conta_empresa_agencia_numero_digito
    ON contas_bancarias (empresa_id, agencia_id, numero, COALESCE(digito, ''));

COMMENT ON TABLE contas_bancarias IS 'Contas bancarias isoladas por empresa e vinculadas a uma agencia global';
COMMENT ON COLUMN contas_bancarias.empresa_id IS 'Empresa proprietaria da conta bancaria';
COMMENT ON COLUMN contas_bancarias.agencia_id IS 'Agencia da conta; o banco e derivado deste relacionamento';
