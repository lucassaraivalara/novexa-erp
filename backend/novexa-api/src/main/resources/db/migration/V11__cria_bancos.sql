CREATE TABLE bancos (
    id BIGSERIAL PRIMARY KEY,
    numero VARCHAR(10) NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cnab VARCHAR(10),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_banco_numero UNIQUE (numero),
    CONSTRAINT chk_banco_numero CHECK (length(trim(numero)) > 0),
    CONSTRAINT chk_banco_nome CHECK (length(trim(nome)) > 0)
);

COMMENT ON TABLE bancos IS 'Catalogo global de instituicoes bancarias, sem vinculo com empresa';
COMMENT ON COLUMN bancos.numero IS 'Numero unico da instituicao bancaria';
COMMENT ON COLUMN bancos.cnab IS 'Codigo CNAB opcional da instituicao bancaria';
