ALTER TABLE pagamentos ADD CONSTRAINT uk_pagamento_id_venda_empresa UNIQUE (id, venda_id, empresa_id);

CREATE TABLE recebiveis (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    pagamento_id BIGINT NOT NULL,
    venda_id BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('DEBITO', 'CREDITO')),
    numero_parcela INTEGER NOT NULL CHECK (numero_parcela >= 1),
    total_parcelas INTEGER NOT NULL CHECK (total_parcelas >= 1 AND numero_parcela <= total_parcelas),
    valor_bruto NUMERIC(19,2) NOT NULL CHECK (valor_bruto > 0),
    valor_liquido_previsto NUMERIC(19,2) CHECK (valor_liquido_previsto >= 0),
    data_venda TIMESTAMP NOT NULL,
    data_prevista_recebimento DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDENTE', 'CANCELADO', 'LIQUIDADO')),
    criado_em TIMESTAMP NOT NULL,
    configuracao_forma_pagamento_id BIGINT,
    configuracao_nome_exibicao VARCHAR(150),
    configuracao_tipo VARCHAR(20) CHECK (configuracao_tipo IN ('DEBITO', 'CREDITO') AND configuracao_tipo = tipo),
    CONSTRAINT uk_recebivel_parcela UNIQUE (empresa_id, pagamento_id, numero_parcela),
    CONSTRAINT fk_recebivel_pagamento_venda_empresa FOREIGN KEY (pagamento_id, venda_id, empresa_id)
        REFERENCES pagamentos(id, venda_id, empresa_id),
    CONSTRAINT fk_recebivel_venda_empresa FOREIGN KEY (venda_id, empresa_id) REFERENCES vendas(id, empresa_id),
    CONSTRAINT fk_recebivel_configuracao_empresa FOREIGN KEY (configuracao_forma_pagamento_id, empresa_id)
        REFERENCES configuracoes_formas_pagamento_empresa(id, empresa_id)
);

COMMENT ON TABLE recebiveis IS 'Direito de receber cartao; nao comprova liquidacao nem movimenta saldo';
