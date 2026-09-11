CREATE TABLE vendas (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    cliente_id BIGINT REFERENCES clientes(id),
    chave_requisicao UUID NOT NULL,
    resumo_requisicao VARCHAR(64) NOT NULL,
    data_hora TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
    subtotal NUMERIC(19,2) NOT NULL CHECK (subtotal > 0),
    desconto NUMERIC(19,2) NOT NULL CHECK (desconto >= 0 AND desconto < subtotal),
    total NUMERIC(19,2) NOT NULL CHECK (total = subtotal - desconto),
    forma_pagamento VARCHAR(20) NOT NULL,
    valor_recebido NUMERIC(19,2) NOT NULL CHECK (valor_recebido >= total),
    troco NUMERIC(19,2) NOT NULL CHECK (troco = valor_recebido - total),
    entrega VARCHAR(500),
    observacoes VARCHAR(2000),
    CONSTRAINT uk_venda_requisicao UNIQUE (empresa_id, usuario_id, chave_requisicao)
);
CREATE INDEX idx_venda_empresa_data ON vendas(empresa_id, data_hora);

CREATE TABLE venda_itens (
    venda_id BIGINT NOT NULL REFERENCES vendas(id),
    ordem INTEGER NOT NULL,
    produto_id BIGINT NOT NULL REFERENCES produtos(id),
    nome_produto VARCHAR(150) NOT NULL,
    quantidade NUMERIC(19,3) NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(19,2) NOT NULL CHECK (preco_unitario >= 0),
    subtotal NUMERIC(19,2) NOT NULL CHECK (subtotal >= 0),
    movimentacao_estoque_id BIGINT UNIQUE REFERENCES movimentacoes_estoque(id),
    PRIMARY KEY (venda_id, ordem),
    UNIQUE (venda_id, produto_id)
);

CREATE TABLE itens_venda (
    id BIGSERIAL PRIMARY KEY,
    venda_id BIGINT NOT NULL REFERENCES vendas(id),
    produto_id BIGINT NOT NULL REFERENCES produtos(id),
    quantidade NUMERIC(19,3) NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(19,2) NOT NULL CHECK (preco_unitario >= 0),
    subtotal NUMERIC(19,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX idx_item_venda_venda ON itens_venda(venda_id);
CREATE INDEX idx_item_venda_produto ON itens_venda(produto_id);

CREATE TABLE lancamentos_financeiros (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    venda_id BIGINT NOT NULL UNIQUE REFERENCES vendas(id),
    forma_pagamento VARCHAR(20) NOT NULL,
    situacao VARCHAR(20) NOT NULL CHECK (situacao IN ('RECEBIDO', 'A_RECEBER')),
    valor NUMERIC(19,2) NOT NULL CHECK (valor > 0),
    data_hora TIMESTAMP NOT NULL
);
CREATE INDEX idx_lancamento_empresa_data ON lancamentos_financeiros(empresa_id, data_hora);
