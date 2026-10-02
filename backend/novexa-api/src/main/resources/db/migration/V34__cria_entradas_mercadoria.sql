ALTER TABLE produtos ADD CONSTRAINT uk_produto_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE movimentacoes_estoque ADD CONSTRAINT uk_mov_estoque_id_empresa_produto UNIQUE (id, empresa_id, produto_id);

CREATE TABLE entradas_mercadoria (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    fornecedor_id BIGINT NOT NULL,
    origem VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    numero_nota VARCHAR(60), serie VARCHAR(20), chave_acesso_nfe VARCHAR(44),
    data_emissao DATE, data_entrada DATE NOT NULL,
    valor_produtos NUMERIC(19,2) NOT NULL, valor_total NUMERIC(19,2) NOT NULL,
    observacao VARCHAR(2000), data_cadastro TIMESTAMP NOT NULL, data_atualizacao TIMESTAMP NOT NULL,
    usuario_cadastro_id BIGINT NOT NULL, usuario_confirmacao_id BIGINT, usuario_cancelamento_id BIGINT,
    data_confirmacao TIMESTAMP, data_cancelamento TIMESTAMP,
    chave_requisicao UUID, resumo_requisicao VARCHAR(64),
    CONSTRAINT uk_entrada_id_empresa UNIQUE(id, empresa_id),
    CONSTRAINT uk_entrada_requisicao UNIQUE(empresa_id, usuario_cadastro_id, chave_requisicao),
    CONSTRAINT fk_entrada_fornecedor_empresa FOREIGN KEY(fornecedor_id, empresa_id) REFERENCES fornecedores(id, empresa_id),
    CONSTRAINT fk_entrada_usuario_cadastro FOREIGN KEY(usuario_cadastro_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_entrada_usuario_confirmacao FOREIGN KEY(usuario_confirmacao_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT fk_entrada_usuario_cancelamento FOREIGN KEY(usuario_cancelamento_id, empresa_id) REFERENCES usuario(id, empresa_id),
    CONSTRAINT ck_entrada_origem CHECK(origem IN ('MANUAL','XML')),
    CONSTRAINT ck_entrada_status CHECK(status IN ('RASCUNHO','CONFIRMADA','CANCELADA')),
    CONSTRAINT ck_entrada_valores CHECK(valor_produtos >= 0 AND valor_total = valor_produtos),
    CONSTRAINT ck_entrada_chave CHECK(chave_acesso_nfe IS NULL OR chave_acesso_nfe ~ '^[0-9]{44}$'),
    CONSTRAINT ck_entrada_nota CHECK(numero_nota IS NULL OR length(trim(numero_nota)) > 0),
    CONSTRAINT ck_entrada_requisicao CHECK((chave_requisicao IS NULL) = (resumo_requisicao IS NULL)),
    CONSTRAINT ck_entrada_auditoria CHECK(
        (status='RASCUNHO' AND usuario_confirmacao_id IS NULL AND data_confirmacao IS NULL AND usuario_cancelamento_id IS NULL AND data_cancelamento IS NULL)
        OR (status='CONFIRMADA' AND usuario_confirmacao_id IS NOT NULL AND data_confirmacao IS NOT NULL AND usuario_cancelamento_id IS NULL AND data_cancelamento IS NULL)
        OR (status='CANCELADA' AND usuario_confirmacao_id IS NOT NULL AND data_confirmacao IS NOT NULL AND usuario_cancelamento_id IS NOT NULL AND data_cancelamento IS NOT NULL))
);
CREATE UNIQUE INDEX uk_entrada_chave_nfe ON entradas_mercadoria(empresa_id, chave_acesso_nfe) WHERE chave_acesso_nfe IS NOT NULL;
CREATE UNIQUE INDEX uk_entrada_nota_manual ON entradas_mercadoria(empresa_id, fornecedor_id, numero_nota, coalesce(serie, '')) WHERE numero_nota IS NOT NULL;
CREATE INDEX idx_entrada_empresa_data ON entradas_mercadoria(empresa_id, data_entrada, id);
CREATE INDEX idx_entrada_empresa_fornecedor ON entradas_mercadoria(empresa_id, fornecedor_id);

CREATE TABLE itens_entrada_mercadoria (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id), entrada_id BIGINT NOT NULL, produto_id BIGINT NOT NULL,
    ordem INTEGER NOT NULL, descricao_original VARCHAR(255), codigo_produto_fornecedor VARCHAR(60),
    quantidade NUMERIC(19,3) NOT NULL, valor_unitario NUMERIC(19,2) NOT NULL, valor_total NUMERIC(19,2) NOT NULL,
    gtin VARCHAR(14), ncm VARCHAR(8), cfop VARCHAR(4), unidade VARCHAR(10),
    movimentacao_estoque_id BIGINT UNIQUE, movimentacao_cancelamento_id BIGINT UNIQUE,
    CONSTRAINT uk_item_entrada_ordem UNIQUE(entrada_id, ordem),
    CONSTRAINT uk_item_entrada_produto UNIQUE(entrada_id, produto_id),
    CONSTRAINT fk_item_entrada_empresa FOREIGN KEY(entrada_id, empresa_id) REFERENCES entradas_mercadoria(id, empresa_id),
    CONSTRAINT fk_item_entrada_produto_empresa FOREIGN KEY(produto_id, empresa_id) REFERENCES produtos(id, empresa_id),
    CONSTRAINT fk_item_entrada_movimento FOREIGN KEY(movimentacao_estoque_id, empresa_id, produto_id) REFERENCES movimentacoes_estoque(id, empresa_id, produto_id),
    CONSTRAINT fk_item_entrada_cancelamento FOREIGN KEY(movimentacao_cancelamento_id, empresa_id, produto_id) REFERENCES movimentacoes_estoque(id, empresa_id, produto_id),
    CONSTRAINT ck_item_entrada_quantidade CHECK(quantidade > 0),
    CONSTRAINT ck_item_entrada_valores CHECK(valor_unitario >= 0 AND valor_total = round(quantidade * valor_unitario, 2)),
    CONSTRAINT ck_item_entrada_ordem CHECK(ordem >= 0),
    CONSTRAINT ck_item_entrada_cancelamento CHECK(movimentacao_cancelamento_id IS NULL OR movimentacao_estoque_id IS NOT NULL)
);
CREATE INDEX idx_item_entrada_produto_empresa ON itens_entrada_mercadoria(empresa_id, produto_id);
