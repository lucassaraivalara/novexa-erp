-- Parcelamento do consumidor no credito: limite por configuracao da empresa
-- e parcelas escolhidas por pagamento no PDV. Aditiva e nullable, sem backfill;
-- Configuração legada NULL permite apenas 1x; pagamento legado NULL é desconhecido.
ALTER TABLE configuracoes_formas_pagamento_empresa ADD COLUMN maximo_parcelas_consumidor INTEGER;

ALTER TABLE configuracoes_formas_pagamento_empresa ADD CONSTRAINT chk_cfg_max_parcelas_consumidor
    CHECK (maximo_parcelas_consumidor IS NULL
        OR (tipo = 'CREDITO' AND maximo_parcelas_consumidor BETWEEN 1 AND 12));

ALTER TABLE pagamentos ADD COLUMN parcelas_consumidor INTEGER;

ALTER TABLE pagamentos ADD CONSTRAINT chk_pag_parcelas_consumidor
    CHECK (parcelas_consumidor IS NULL
        OR (forma_pagamento = 'CARTAO_CREDITO' AND parcelas_consumidor BETWEEN 1 AND 12));

COMMENT ON COLUMN configuracoes_formas_pagamento_empresa.maximo_parcelas_consumidor IS 'Limite de parcelas oferecidas ao consumidor no credito; exclusivo de CREDITO. NULL no legado (equivale a 1x).';
COMMENT ON COLUMN pagamentos.parcelas_consumidor IS 'Parcelas escolhidas no PDV para credito; imutavel. NULL para demais formas e no legado.';
