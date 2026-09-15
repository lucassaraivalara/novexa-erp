-- Catalogo global: nao pertence a Empresa. IDs 1-6 sao identidades estaveis do seed.
CREATE TABLE formas_pagamento (
    id BIGSERIAL PRIMARY KEY,
    descricao VARCHAR(150) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_forma_descricao CHECK (length(trim(descricao)) > 0),
    CONSTRAINT chk_forma_tipo CHECK (tipo IN ('DINHEIRO','PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA'))
);
CREATE UNIQUE INDEX uk_forma_descricao_normalizada ON formas_pagamento (lower(trim(descricao)));

INSERT INTO formas_pagamento (id,descricao,tipo,ativo) VALUES
    (1,'Dinheiro','DINHEIRO',true), (2,'PIX','PIX',true),
    (3,'Débito','DEBITO',true), (4,'Crédito','CREDITO',true),
    (5,'Boleto','BOLETO',true), (6,'Transferência','TRANSFERENCIA',true);
ALTER SEQUENCE formas_pagamento_id_seq RESTART WITH 7;

ALTER TABLE pagamentos ADD COLUMN forma_pagamento_id BIGINT;
UPDATE pagamentos SET forma_pagamento_id = CASE forma_pagamento
    WHEN 'DINHEIRO' THEN 1 WHEN 'PIX' THEN 2
    WHEN 'CARTAO_DEBITO' THEN 3 WHEN 'CARTAO_CREDITO' THEN 4 END;
ALTER TABLE pagamentos ALTER COLUMN forma_pagamento_id SET NOT NULL;
ALTER TABLE pagamentos ADD CONSTRAINT fk_pagamento_forma
    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id);
CREATE INDEX idx_pagamento_forma ON pagamentos(forma_pagamento_id);

COMMENT ON TABLE formas_pagamento IS 'Catalogo global de formas de pagamento, sem tenant ou destino financeiro';
COMMENT ON COLUMN pagamentos.forma_pagamento IS 'Snapshot legado do fechamento; catalogo oficial referenciado por forma_pagamento_id';
