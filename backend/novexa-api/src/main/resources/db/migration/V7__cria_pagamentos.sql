-- Pagamento registra a forma e o valor aplicado a uma Venda; nao representa liquidacao financeira.
-- As chaves compostas impedem vinculos entre tenants mesmo fora da camada de servico.
ALTER TABLE vendas ADD CONSTRAINT uk_venda_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE usuario ADD CONSTRAINT uk_usuario_id_empresa UNIQUE (id, empresa_id);

CREATE TABLE pagamentos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    venda_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    sequencia INTEGER NOT NULL,
    chave_requisicao UUID NOT NULL,
    forma_pagamento VARCHAR(20) NOT NULL,
    valor NUMERIC(19,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    data_hora TIMESTAMP NOT NULL,
    valor_recebido NUMERIC(19,2),
    troco NUMERIC(19,2),
    CONSTRAINT fk_pagamento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    CONSTRAINT fk_pagamento_venda_empresa FOREIGN KEY (venda_id, empresa_id) REFERENCES vendas(id, empresa_id),
    CONSTRAINT fk_pagamento_usuario_empresa FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT uk_pagamento_venda_sequencia UNIQUE (venda_id, sequencia),
    CONSTRAINT chk_pagamento_sequencia CHECK (sequencia > 0),
    CONSTRAINT chk_pagamento_valor CHECK (valor > 0),
    CONSTRAINT chk_pagamento_forma CHECK (forma_pagamento IN ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO')),
    CONSTRAINT chk_pagamento_status CHECK (status = 'REGISTRADO'),
    CONSTRAINT chk_pagamento_troco CHECK (
        (forma_pagamento = 'DINHEIRO'
            AND valor_recebido IS NOT NULL AND troco IS NOT NULL
            AND valor_recebido >= valor AND troco = valor_recebido - valor)
        OR (forma_pagamento <> 'DINHEIRO' AND valor_recebido IS NULL AND troco IS NULL)
    )
);
CREATE INDEX idx_pagamento_empresa_venda ON pagamentos(empresa_id, venda_id);

-- Preserva o fechamento historico sem repetir estoque ou lancamento financeiro.
-- O fluxo antigo armazenava recebido/troco tambem em outras formas: esses campos operacionais
-- permanecem na Venda, mas no Pagamento sao exclusivos de dinheiro.
-- Dados faturados incompletos/inconsistentes devem interromper a migration; nao inventar valores.
INSERT INTO pagamentos (empresa_id, venda_id, usuario_id, sequencia, chave_requisicao,
                        forma_pagamento, valor, status, data_hora, valor_recebido, troco)
SELECT v.empresa_id, v.id, v.usuario_id, 1, v.chave_requisicao,
       v.forma_pagamento, v.total, 'REGISTRADO', COALESCE(l.data_hora, v.data_hora),
       CASE WHEN v.forma_pagamento = 'DINHEIRO' THEN v.valor_recebido ELSE NULL END,
       CASE WHEN v.forma_pagamento = 'DINHEIRO' THEN v.troco ELSE NULL END
FROM vendas v
LEFT JOIN lancamentos_financeiros l ON l.venda_id = v.id
WHERE v.status = 'FATURADA';

COMMENT ON TABLE pagamentos IS 'Registro de pagamento da venda, sem comprovar recebimento ou liquidacao';
COMMENT ON COLUMN pagamentos.sequencia IS 'Identidade do pagamento dentro da venda; fechamento atual usa 1';
COMMENT ON COLUMN pagamentos.data_hora IS 'Registro do faturamento; legado usa data do lancamento ou da venda';
