ALTER TABLE vendas ADD COLUMN configuracao_forma_pagamento_id BIGINT;
ALTER TABLE pagamentos ADD COLUMN configuracao_forma_pagamento_id BIGINT;

ALTER TABLE vendas ADD CONSTRAINT fk_venda_config_forma_empresa
    FOREIGN KEY (configuracao_forma_pagamento_id, empresa_id)
    REFERENCES configuracoes_formas_pagamento_empresa(id, empresa_id);
ALTER TABLE pagamentos ADD CONSTRAINT fk_pagamento_config_forma_empresa
    FOREIGN KEY (configuracao_forma_pagamento_id, empresa_id)
    REFERENCES configuracoes_formas_pagamento_empresa(id, empresa_id);

CREATE INDEX idx_venda_config_forma ON vendas(configuracao_forma_pagamento_id, empresa_id);
CREATE INDEX idx_pagamento_config_forma ON pagamentos(configuracao_forma_pagamento_id, empresa_id);
