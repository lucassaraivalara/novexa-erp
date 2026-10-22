-- Rastreabilidade minima de alteracoes criticas de produtos (controle de estoque, ativo/inativo, versao de composicao).
-- Quem alterou, quando e valores anterior/novo; detalhe da composicao permanece no historico versionado de componentes_produto.
-- Registros nascem apenas na aplicacao (servicos transacionais); alteracoes diretas por SQL nao geram auditoria.
-- produto_id em cascata: a exclusao de um produto remove tambem o seu historico de auditoria.
CREATE TABLE produto_auditoria (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    campo VARCHAR(40) NOT NULL,
    valor_anterior VARCHAR(200) NOT NULL,
    valor_novo VARCHAR(200) NOT NULL,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    data_hora TIMESTAMP NOT NULL
);
CREATE INDEX idx_produto_auditoria_empresa_produto_data ON produto_auditoria(empresa_id, produto_id, data_hora);
