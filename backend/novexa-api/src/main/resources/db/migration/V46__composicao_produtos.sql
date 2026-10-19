-- Composicoes versionadas; estoque fisico permanece exclusivamente nos componentes.
ALTER TABLE produtos ADD COLUMN composto BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE produtos ADD COLUMN composicao_versao BIGINT NOT NULL DEFAULT 0;
ALTER TABLE produtos ADD CONSTRAINT ck_composto_sem_saldo CHECK (NOT composto OR estoque_atual = 0);
CREATE TABLE componentes_produto (
 id BIGSERIAL PRIMARY KEY,
 empresa_id BIGINT NOT NULL REFERENCES empresas(id),
 produto_id BIGINT NOT NULL,
 versao BIGINT NOT NULL CHECK (versao > 0),
 componente_id BIGINT NOT NULL,
 quantidade NUMERIC(19,3) NOT NULL CHECK (quantidade > 0),
 fator NUMERIC(19,6) NOT NULL CHECK (fator > 0),
 unidade VARCHAR(10) NOT NULL,
 unidade_estoque VARCHAR(10) NOT NULL,
 nome_componente VARCHAR(150) NOT NULL,
 usuario_id BIGINT NOT NULL,
 data_criacao TIMESTAMP NOT NULL,
 UNIQUE (produto_id,versao,componente_id),
 UNIQUE (id,empresa_id),
 FOREIGN KEY (produto_id,empresa_id) REFERENCES produtos(id,empresa_id),
 FOREIGN KEY (componente_id,empresa_id) REFERENCES produtos(id,empresa_id),
 FOREIGN KEY (usuario_id,empresa_id) REFERENCES usuario(id,empresa_id),
 CHECK (produto_id <> componente_id)
);
CREATE INDEX idx_componente_produto ON componentes_produto(empresa_id,componente_id);
ALTER TABLE itens_venda ADD CONSTRAINT uk_item_venda_origem UNIQUE (id,venda_id);
ALTER TABLE itens_venda ADD COLUMN composicao_versao BIGINT NOT NULL DEFAULT 0;
CREATE TABLE consumos_kit_venda (
 id BIGSERIAL PRIMARY KEY,
 empresa_id BIGINT NOT NULL,
 venda_id BIGINT NOT NULL,
 item_id BIGINT NOT NULL,
 composicao_id BIGINT NOT NULL,
 componente_id BIGINT NOT NULL,
 nome VARCHAR(150) NOT NULL,
 unidade VARCHAR(10) NOT NULL,
 quantidade NUMERIC(19,3) NOT NULL CHECK (quantidade > 0),
 custo_unitario NUMERIC(19,2) NOT NULL CHECK (custo_unitario >= 0),
 movimento_id BIGINT NOT NULL UNIQUE REFERENCES movimentacoes_estoque(id),
 reversao_id BIGINT UNIQUE REFERENCES movimentacoes_estoque(id),
 UNIQUE (item_id,componente_id),
 FOREIGN KEY (venda_id,empresa_id) REFERENCES vendas(id,empresa_id),
 FOREIGN KEY (item_id,venda_id) REFERENCES itens_venda(id,venda_id),
 FOREIGN KEY (composicao_id,empresa_id) REFERENCES componentes_produto(id,empresa_id),
 FOREIGN KEY (componente_id,empresa_id) REFERENCES produtos(id,empresa_id)
);
