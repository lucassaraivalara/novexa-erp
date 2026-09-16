CREATE TABLE agencias (
    id BIGSERIAL PRIMARY KEY,
    banco_id BIGINT NOT NULL,
    numero VARCHAR(20) NOT NULL,
    digito VARCHAR(5),
    contato VARCHAR(150),
    telefone VARCHAR(20),
    cidade VARCHAR(120),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_agencia_banco FOREIGN KEY (banco_id) REFERENCES bancos (id),
    CONSTRAINT uk_agencia_banco_numero UNIQUE (banco_id, numero),
    CONSTRAINT chk_agencia_numero CHECK (length(trim(numero)) > 0)
);

COMMENT ON TABLE agencias IS 'Catalogo global de agencias vinculadas a instituicoes bancarias';
COMMENT ON COLUMN agencias.banco_id IS 'Banco ao qual a agencia pertence';
