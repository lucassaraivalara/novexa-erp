-- NULL identifica condicoes historicas desconhecidas; nenhum backfill economico.
ALTER TABLE configuracoes_formas_pagamento_empresa
    ADD COLUMN taxa_percentual NUMERIC(7,4),
    ADD COLUMN taxa_fixa NUMERIC(19,2),
    ADD COLUMN prazo_recebimento_dias INTEGER,
    ADD CONSTRAINT chk_config_condicoes_cartao CHECK (
        (taxa_percentual IS NULL OR taxa_percentual BETWEEN 0 AND 100)
        AND (taxa_fixa IS NULL OR taxa_fixa >= 0)
        AND (prazo_recebimento_dias IS NULL OR prazo_recebimento_dias >= 0)
        AND (tipo IN ('DEBITO','CREDITO') OR
            (taxa_percentual IS NULL AND taxa_fixa IS NULL AND prazo_recebimento_dias IS NULL))
    );

ALTER TABLE pagamentos
    ADD COLUMN taxa_percentual_snapshot NUMERIC(7,4),
    ADD COLUMN taxa_fixa_snapshot NUMERIC(19,2),
    ADD COLUMN prazo_recebimento_dias_snapshot INTEGER,
    ADD CONSTRAINT chk_pagamento_condicoes_cartao CHECK (
        (taxa_percentual_snapshot IS NULL AND taxa_fixa_snapshot IS NULL AND prazo_recebimento_dias_snapshot IS NULL)
        OR (forma_pagamento IN ('CARTAO_DEBITO','CARTAO_CREDITO')
            AND taxa_percentual_snapshot IS NOT NULL AND taxa_percentual_snapshot BETWEEN 0 AND 100
            AND taxa_fixa_snapshot IS NOT NULL AND taxa_fixa_snapshot >= 0
            AND prazo_recebimento_dias_snapshot IS NOT NULL AND prazo_recebimento_dias_snapshot >= 0)
    );

ALTER TABLE recebiveis
    ADD COLUMN taxa_percentual_snapshot NUMERIC(7,4),
    ADD COLUMN taxa_fixa_snapshot NUMERIC(19,2),
    ADD COLUMN valor_taxas_previsto NUMERIC(19,2),
    ADD COLUMN prazo_recebimento_dias_snapshot INTEGER,
    ADD CONSTRAINT chk_recebivel_condicoes_cartao CHECK (
        (taxa_percentual_snapshot IS NULL AND taxa_fixa_snapshot IS NULL
            AND valor_taxas_previsto IS NULL AND prazo_recebimento_dias_snapshot IS NULL)
        OR (taxa_percentual_snapshot IS NOT NULL AND taxa_percentual_snapshot BETWEEN 0 AND 100
            AND taxa_fixa_snapshot IS NOT NULL AND taxa_fixa_snapshot >= 0
            AND valor_taxas_previsto IS NOT NULL AND valor_taxas_previsto >= 0
            AND prazo_recebimento_dias_snapshot IS NOT NULL AND prazo_recebimento_dias_snapshot >= 0
            AND valor_liquido_previsto IS NOT NULL AND valor_liquido_previsto > 0
            AND valor_liquido_previsto = valor_bruto - valor_taxas_previsto
            AND data_prevista_recebimento IS NOT NULL)
    );
