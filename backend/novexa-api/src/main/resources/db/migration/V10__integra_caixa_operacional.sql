-- Vendas anteriores permanecem sem sessao; nao inventar historico nem repetir efeitos.
ALTER TABLE sessoes_caixa ADD CONSTRAINT uk_sessao_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE vendas ADD COLUMN sessao_caixa_id BIGINT;
ALTER TABLE vendas ADD CONSTRAINT fk_venda_sessao_empresa
    FOREIGN KEY (sessao_caixa_id, empresa_id) REFERENCES sessoes_caixa(id, empresa_id);
CREATE INDEX idx_venda_empresa_sessao ON vendas(empresa_id, sessao_caixa_id);
ALTER TABLE pagamentos ADD CONSTRAINT uk_pagamento_id_empresa UNIQUE (id, empresa_id);

CREATE TABLE movimentacoes_caixa (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    sessao_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    pagamento_id BIGINT,
    chave_requisicao UUID NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    valor NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    observacao VARCHAR(500),
    data_hora TIMESTAMP NOT NULL,
    CONSTRAINT fk_mov_caixa_sessao_empresa FOREIGN KEY (sessao_id, empresa_id) REFERENCES sessoes_caixa(id, empresa_id),
    CONSTRAINT fk_mov_caixa_usuario_empresa FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_mov_caixa_pagamento_empresa FOREIGN KEY (pagamento_id, empresa_id) REFERENCES pagamentos(id, empresa_id),
    CONSTRAINT uk_mov_caixa_requisicao UNIQUE (sessao_id, chave_requisicao),
    CONSTRAINT uk_mov_caixa_pagamento UNIQUE (pagamento_id),
    CONSTRAINT chk_mov_caixa_origem CHECK (
        (tipo = 'VENDA' AND pagamento_id IS NOT NULL)
        OR (tipo IN ('SUPRIMENTO', 'SANGRIA') AND pagamento_id IS NULL)
    )
);
CREATE INDEX idx_mov_caixa_empresa_sessao ON movimentacoes_caixa(empresa_id, sessao_id);
COMMENT ON TABLE movimentacoes_caixa IS 'Dinheiro fisico: venda em dinheiro, suprimento e sangria; pagamentos nao monetarios apenas compoem o resumo da sessao';
