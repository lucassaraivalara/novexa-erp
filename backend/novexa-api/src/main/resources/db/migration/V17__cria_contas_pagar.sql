CREATE TABLE contas_pagar (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    fornecedor_id BIGINT,
    descricao VARCHAR(200) NOT NULL,
    categoria VARCHAR(100),
    data_emissao DATE,
    data_vencimento DATE NOT NULL,
    valor NUMERIC(19, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
    data_pagamento DATE,
    valor_pago NUMERIC(19, 2),
    observacao VARCHAR(1000),
    CONSTRAINT fk_conta_pagar_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT chk_conta_pagar_descricao CHECK (length(trim(descricao)) > 0),
    CONSTRAINT chk_conta_pagar_valor CHECK (valor > 0),
    CONSTRAINT chk_conta_pagar_status CHECK (status IN ('ABERTA', 'PAGA', 'CANCELADA')),
    CONSTRAINT chk_conta_pagar_pagamento CHECK (
        (status = 'PAGA' AND data_pagamento IS NOT NULL AND valor_pago > 0)
        OR (status <> 'PAGA' AND data_pagamento IS NULL AND valor_pago IS NULL)
    )
);

ALTER TABLE fornecedores ADD CONSTRAINT uk_fornecedor_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE contas_pagar ADD CONSTRAINT fk_conta_pagar_fornecedor_empresa
    FOREIGN KEY (fornecedor_id, empresa_id) REFERENCES fornecedores (id, empresa_id);
CREATE INDEX idx_conta_pagar_empresa_vencimento ON contas_pagar (empresa_id, data_vencimento, id);
