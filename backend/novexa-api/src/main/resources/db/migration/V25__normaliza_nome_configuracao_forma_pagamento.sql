ALTER TABLE configuracoes_formas_pagamento_empresa
    ADD COLUMN nome_normalizado VARCHAR(150)
        GENERATED ALWAYS AS (lower(trim(nome_exibicao))) STORED NOT NULL;

DROP INDEX uk_config_forma_empresa_nome;
ALTER TABLE configuracoes_formas_pagamento_empresa
    ADD CONSTRAINT uk_config_forma_empresa_nome UNIQUE (empresa_id, nome_normalizado);
