-- Vinculos adicionais produto <-> fornecedor, com codigo de referencia/fabricante por fornecedor.
-- O fornecedor principal permanece em produtos.fornecedor_principal_id (V40).
-- Nomes com sufixo _vinc para nao colidir com as constraints de V40 (fk_produto_fornecedor_empresa).
CREATE TABLE produto_fornecedor (
 id BIGSERIAL PRIMARY KEY,
 empresa_id BIGINT NOT NULL,
 produto_id BIGINT NOT NULL,
 fornecedor_id BIGINT NOT NULL,
 codigo_referencia VARCHAR(60),
 CONSTRAINT uk_produto_fornecedor_vinc_par UNIQUE (produto_id,fornecedor_id),
 CONSTRAINT uk_produto_fornecedor_vinc_empresa UNIQUE (id,empresa_id),
 CONSTRAINT fk_produto_fornecedor_vinc_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
 CONSTRAINT fk_produto_fornecedor_vinc_produto FOREIGN KEY (produto_id,empresa_id) REFERENCES produtos(id,empresa_id),
 CONSTRAINT fk_produto_fornecedor_vinc_fornecedor FOREIGN KEY (fornecedor_id,empresa_id) REFERENCES fornecedores(id,empresa_id)
);
CREATE INDEX idx_produto_fornecedor_vinc_empresa ON produto_fornecedor(empresa_id,fornecedor_id);
