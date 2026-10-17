ALTER TABLE produtos ADD COLUMN categoria_id BIGINT;
ALTER TABLE produtos ADD COLUMN subcategoria_id BIGINT;
ALTER TABLE subcategorias_produtos ADD CONSTRAINT uk_subcategoria_id_categoria_empresa
    UNIQUE (id, categoria_id, empresa_id);
ALTER TABLE produtos ADD CONSTRAINT fk_produto_categoria_empresa
    FOREIGN KEY (categoria_id, empresa_id) REFERENCES categorias_produtos (id, empresa_id);
ALTER TABLE produtos ADD CONSTRAINT fk_produto_subcategoria_empresa
    FOREIGN KEY (subcategoria_id, categoria_id, empresa_id)
    REFERENCES subcategorias_produtos (id, categoria_id, empresa_id);
ALTER TABLE produtos ADD CONSTRAINT ck_produto_subcategoria_categoria
    CHECK (subcategoria_id IS NULL OR categoria_id IS NOT NULL);
CREATE INDEX idx_produto_categoria_empresa ON produtos (empresa_id, categoria_id);
CREATE INDEX idx_produto_subcategoria_empresa ON produtos (empresa_id, subcategoria_id);
