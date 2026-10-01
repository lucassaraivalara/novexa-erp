ALTER TABLE movimentacoes_financeiras ADD COLUMN pagamento_id BIGINT;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fk_mov_fin_pagamento_empresa
    FOREIGN KEY (pagamento_id, empresa_id) REFERENCES pagamentos(id, empresa_id);
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT uk_mov_fin_pagamento UNIQUE (pagamento_id);

ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR', 'SALDO_INICIAL', 'TRANSFERENCIA', 'PAGAMENTO_PIX'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_pagamento
    CHECK ((origem = 'PAGAMENTO_PIX' AND pagamento_id IS NOT NULL AND tipo = 'ENTRADA')
        OR (origem <> 'PAGAMENTO_PIX' AND pagamento_id IS NULL));
