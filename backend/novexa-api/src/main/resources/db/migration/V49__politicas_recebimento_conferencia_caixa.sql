ALTER TABLE empresas ADD COLUMN modo_recebimento_financeiro VARCHAR(20) NOT NULL DEFAULT 'CONTROLADO'
    CHECK (modo_recebimento_financeiro IN ('CONTROLADO','SIMPLIFICADO'));
ALTER TABLE empresas ADD COLUMN modo_conferencia_fechamento VARCHAR(30) NOT NULL DEFAULT 'POR_FORMA_PAGAMENTO'
    CHECK (modo_conferencia_fechamento IN ('POR_FORMA_PAGAMENTO','TOTAL'));
ALTER TABLE empresas ADD COLUMN exigir_valores_informados_no_fechamento BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pagamentos ADD COLUMN modo_recebimento_snapshot VARCHAR(20)
    CHECK (modo_recebimento_snapshot IS NULL OR modo_recebimento_snapshot IN ('CONTROLADO','SIMPLIFICADO'));

ALTER TABLE sessoes_caixa ALTER COLUMN modalidade_conferencia TYPE VARCHAR(20);
ALTER TABLE sessoes_caixa DROP CONSTRAINT chk_sessao_conferencia;
ALTER TABLE sessoes_caixa ADD CONSTRAINT chk_sessao_conferencia CHECK (
    (status='ABERTO' AND modalidade_conferencia IS NULL AND observacao_fechamento IS NULL)
    OR (status='FECHADO' AND modalidade_conferencia IS NOT NULL
        AND modalidade_conferencia IN ('LEGADA','POR_FORMA','POR_CONFIGURACAO','TOTAL_MEIOS')
        AND (modalidade_conferencia<>'LEGADA' OR observacao_fechamento IS NULL)));
ALTER TABLE conferencias_fechamento_caixa ADD COLUMN configuracao_forma_pagamento_id BIGINT;
ALTER TABLE conferencias_fechamento_caixa ADD CONSTRAINT fk_conferencia_config_empresa
    FOREIGN KEY (configuracao_forma_pagamento_id,empresa_id) REFERENCES configuracoes_formas_pagamento_empresa(id,empresa_id);
ALTER TABLE conferencias_fechamento_caixa ALTER COLUMN valor_informado DROP NOT NULL;
ALTER TABLE conferencias_fechamento_caixa ALTER COLUMN tipo_snapshot DROP NOT NULL;
ALTER TABLE conferencias_fechamento_caixa DROP CONSTRAINT chk_conferencia_escopo;
ALTER TABLE conferencias_fechamento_caixa ADD CONSTRAINT chk_conferencia_escopo CHECK (
    (escopo='DINHEIRO_FISICO' AND forma_pagamento_id IS NULL AND configuracao_forma_pagamento_id IS NULL
        AND tipo_snapshot='DINHEIRO' AND valor_informado IS NOT NULL)
    OR (escopo='FORMA_PAGAMENTO' AND forma_pagamento_id IS NOT NULL AND configuracao_forma_pagamento_id IS NULL
        AND tipo_snapshot IN ('PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA') AND valor_esperado>=0)
    OR (escopo='CONFIGURACAO' AND configuracao_forma_pagamento_id IS NOT NULL AND forma_pagamento_id IS NULL
        AND tipo_snapshot IN ('PIX','DEBITO','CREDITO','BOLETO','TRANSFERENCIA') AND valor_esperado>=0)
    OR (escopo='TOTAL_MEIOS' AND forma_pagamento_id IS NULL AND configuracao_forma_pagamento_id IS NULL
        AND tipo_snapshot IS NULL AND valor_esperado>=0));
CREATE UNIQUE INDEX uk_conferencia_configuracao ON conferencias_fechamento_caixa(sessao_id,configuracao_forma_pagamento_id)
    WHERE escopo='CONFIGURACAO';
CREATE UNIQUE INDEX uk_conferencia_total_meios ON conferencias_fechamento_caixa(sessao_id) WHERE escopo='TOTAL_MEIOS';
CREATE INDEX idx_recebiveis_agenda ON recebiveis(empresa_id,status,data_prevista_recebimento,configuracao_forma_pagamento_id,tipo);
COMMENT ON COLUMN pagamentos.modo_recebimento_snapshot IS 'Política no faturamento; NULL no legado. Registro operacional não é conciliação bancária.';

ALTER TABLE conferencias_fechamento_caixa ADD CONSTRAINT chk_conferencia_tipo_presente CHECK (escopo='TOTAL_MEIOS' OR tipo_snapshot IS NOT NULL);
