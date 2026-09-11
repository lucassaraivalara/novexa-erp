-- Migration V1: Baseline do schema atual do Novexa ERP
-- Representa as tabelas existentes geradas pelo Hibernate (ddl-auto=update)
-- NÃO altera estrutura existente - apenas versiona o estado atual

-- ============================================================
-- TABELA: empresas
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas (
    id BIGSERIAL PRIMARY KEY,
    razao_social VARCHAR(255),
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(255) UNIQUE,
    inscricao_estadual VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(255),
    endereco VARCHAR(255),
    ativo BOOLEAN,
    logomarca TEXT,
    -- Campos do Embeddable EmpresaCadastroDados
    produtor_rural BOOLEAN DEFAULT FALSE,
    regime_tributario VARCHAR(25),
    inscricao_municipal VARCHAR(30),
    cep VARCHAR(8),
    logradouro VARCHAR(150),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    suframa VARCHAR(9),
    indicador_atividade VARCHAR(1),
    perfil_efd VARCHAR(1),
    regime_pis_cofins VARCHAR(1),
    criterio_pis_cofins VARCHAR(1),
    tipo_atividade_pis_cofins VARCHAR(1),
    dia_vencimento_icms INTEGER,
    codigo_receita_icms VARCHAR(20),
    contador_nome VARCHAR(150),
    contador_cpf VARCHAR(14),
    contador_crc VARCHAR(20),
    contador_uf_crc VARCHAR(2),
    contador_cnpj_escritorio VARCHAR(18),
    contador_razao_social VARCHAR(150),
    contador_telefone VARCHAR(30),
    contador_fax VARCHAR(30),
    contador_email VARCHAR(150),
    contador_cep VARCHAR(8),
    contador_logradouro VARCHAR(150),
    contador_numero VARCHAR(20),
    contador_complemento VARCHAR(100),
    contador_bairro VARCHAR(100),
    contador_cidade VARCHAR(100),
    contador_uf VARCHAR(2),
    contador_codigo_municipio VARCHAR(7)
);

-- ============================================================
-- TABELA: usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario (
    id BIGSERIAL PRIMARY KEY,
    nome_usuario VARCHAR(255),
    cpf VARCHAR(255),
    email VARCHAR(255),
    senha VARCHAR(255),
    ativo BOOLEAN DEFAULT TRUE,
    perfil VARCHAR(255) DEFAULT 'USUARIO',
    empresa_id BIGINT,
    CONSTRAINT fk_usuario_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

-- ============================================================
-- TABELA: produtos
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    codigo_interno VARCHAR(60),
    codigo_barras VARCHAR(60),
    nome VARCHAR(255) NOT NULL,
    descricao VARCHAR(2000),
    unidade_medida VARCHAR(10) NOT NULL,
    preco_custo NUMERIC(19,2) NOT NULL DEFAULT 0.00,
    preco_venda NUMERIC(19,2) NOT NULL,
    estoque_atual NUMERIC(19,3) NOT NULL DEFAULT 0.000,
    estoque_minimo NUMERIC(19,3) NOT NULL DEFAULT 0.000,
    controla_estoque BOOLEAN NOT NULL DEFAULT TRUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro TIMESTAMP NOT NULL,
    CONSTRAINT fk_produto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE INDEX IF NOT EXISTS idx_produto_empresa ON produtos (empresa_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_produto_empresa_codigo_interno ON produtos (empresa_id, codigo_interno);
CREATE UNIQUE INDEX IF NOT EXISTS uk_produto_empresa_codigo_barras ON produtos (empresa_id, codigo_barras);

-- ============================================================
-- TABELA: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    tipo_pessoa VARCHAR(10) NOT NULL,
    cpf_cnpj VARCHAR(14),
    email VARCHAR(255),
    telefone VARCHAR(255),
    endereco VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro TIMESTAMP NOT NULL,
    nome_fantasia VARCHAR(150),
    inscricao_estadual VARCHAR(30),
    vendedor VARCHAR(150),
    condicao_pagamento VARCHAR(150),
    limite_credito NUMERIC(15,2),
    observacoes_internas VARCHAR(4000),
    instrucoes_entrega VARCHAR(2000),
    CONSTRAINT fk_cliente_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_empresa ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cliente_empresa_cpf_cnpj ON clientes (empresa_id, cpf_cnpj);

-- ============================================================
-- TABELA: cliente_enderecos (ElementCollection)
-- ============================================================
CREATE TABLE IF NOT EXISTS cliente_enderecos (
    cliente_id BIGINT NOT NULL,
    ordem INTEGER NOT NULL,
    logradouro VARCHAR(150) NOT NULL,
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    cep VARCHAR(8),
    principal BOOLEAN NOT NULL DEFAULT FALSE,
    entrega BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (cliente_id, ordem),
    CONSTRAINT fk_cliente_enderecos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE
);

-- ============================================================
-- TABELA: cliente_contatos (ElementCollection)
-- ============================================================
CREATE TABLE IF NOT EXISTS cliente_contatos (
    cliente_id BIGINT NOT NULL,
    ordem INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cargo VARCHAR(100),
    telefone VARCHAR(30),
    email VARCHAR(150),
    PRIMARY KEY (cliente_id, ordem),
    CONSTRAINT fk_cliente_contatos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE CASCADE
);

-- ============================================================
-- TABELA: fornecedores
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cpf_cnpj VARCHAR(14),
    inscricao_estadual VARCHAR(255),
    email VARCHAR(255),
    telefone VARCHAR(255),
    endereco VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro TIMESTAMP NOT NULL,
    CONSTRAINT fk_fornecedor_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_empresa ON fornecedores (empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_empresa_cpf_cnpj ON fornecedores (empresa_id, cpf_cnpj);

-- ============================================================
-- TABELA: empresa_inscricoes_st
-- ============================================================
CREATE TABLE IF NOT EXISTS empresa_inscricoes_st (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    uf VARCHAR(2) NOT NULL,
    inscricao_estadual VARCHAR(20) NOT NULL,
    difal BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_inscricao_st_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
    CONSTRAINT uk_empresa_inscricao_uf UNIQUE (empresa_id, uf)
);

-- ============================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================
COMMENT ON TABLE empresas IS 'Empresas do sistema (multiempresa)';
COMMENT ON TABLE usuario IS 'Usuários do sistema';
COMMENT ON TABLE produtos IS 'Produtos por empresa';
COMMENT ON TABLE clientes IS 'Clientes por empresa';
COMMENT ON TABLE cliente_enderecos IS 'Endereços dos clientes (ElementCollection)';
COMMENT ON TABLE cliente_contatos IS 'Contatos dos clientes (ElementCollection)';
COMMENT ON TABLE fornecedores IS 'Fornecedores por empresa';
COMMENT ON TABLE empresa_inscricoes_st IS 'Inscrições estaduais ST por empresa/UF';

COMMENT ON COLUMN empresas.cnpj IS 'CNPJ único da empresa';
COMMENT ON COLUMN usuario.empresa_id IS 'Empresa à qual o usuário pertence';
COMMENT ON COLUMN produtos.empresa_id IS 'Empresa dona do produto';
COMMENT ON COLUMN clientes.empresa_id IS 'Empresa dona do cliente';
COMMENT ON COLUMN fornecedores.empresa_id IS 'Empresa dona do fornecedor';
COMMENT ON COLUMN empresa_inscricoes_st.empresa_id IS 'Empresa da inscrição';