ALTER TABLE formas_pagamento ADD CONSTRAINT uk_forma_id_tipo UNIQUE (id, tipo);

CREATE TABLE configuracoes_formas_pagamento_empresa (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    forma_pagamento_id BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    nome_exibicao VARCHAR(150) NOT NULL CHECK (length(trim(nome_exibicao)) > 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    conta_financeira_destino_id BIGINT,
    data_criacao TIMESTAMP NOT NULL,
    data_atualizacao TIMESTAMP NOT NULL,
    CONSTRAINT uk_config_forma_id_empresa UNIQUE (id, empresa_id),
    CONSTRAINT fk_config_forma_tipo FOREIGN KEY (forma_pagamento_id, tipo)
        REFERENCES formas_pagamento(id, tipo),
    CONSTRAINT fk_config_forma_destino_empresa FOREIGN KEY (conta_financeira_destino_id, empresa_id)
        REFERENCES contas_financeiras(id, empresa_id),
    CONSTRAINT chk_config_forma_destino CHECK (
        (tipo IN ('PIX', 'TRANSFERENCIA') AND conta_financeira_destino_id IS NOT NULL)
        OR (tipo IN ('DINHEIRO', 'DEBITO', 'CREDITO', 'BOLETO') AND conta_financeira_destino_id IS NULL)
    )
);
CREATE UNIQUE INDEX uk_config_forma_empresa_nome
    ON configuracoes_formas_pagamento_empresa(empresa_id, lower(trim(nome_exibicao)));
CREATE INDEX idx_config_forma_empresa_ativo ON configuracoes_formas_pagamento_empresa(empresa_id, ativo);
CREATE INDEX idx_config_forma_global ON configuracoes_formas_pagamento_empresa(forma_pagamento_id, tipo);
CREATE INDEX idx_config_forma_destino ON configuracoes_formas_pagamento_empresa(conta_financeira_destino_id, empresa_id);
