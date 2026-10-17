ALTER TABLE produtos ADD COLUMN fornecedor_principal_id BIGINT;
ALTER TABLE produtos ADD CONSTRAINT fk_produto_fornecedor_empresa
    FOREIGN KEY (fornecedor_principal_id, empresa_id) REFERENCES fornecedores (id, empresa_id);
CREATE INDEX idx_produto_fornecedor_empresa ON produtos (empresa_id, fornecedor_principal_id);
