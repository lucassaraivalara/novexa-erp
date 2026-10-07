ALTER TABLE clientes ADD CONSTRAINT uk_cliente_id_empresa UNIQUE (id, empresa_id);

CREATE TABLE contas_receber (
    id BIGSERIAL PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES empresas(id),
    cliente_id BIGINT NOT NULL,
    venda_id BIGINT,
    descricao VARCHAR(200) NOT NULL CHECK (length(trim(descricao)) > 0),
    valor_original NUMERIC(19,2) NOT NULL,
    valor_recebido NUMERIC(19,2) NOT NULL DEFAULT 0,
    data_emissao DATE,
    data_vencimento DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    origem VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    numero_parcela INTEGER NOT NULL DEFAULT 1,
    total_parcelas INTEGER NOT NULL DEFAULT 1,
    observacao VARCHAR(1000),
    data_criacao TIMESTAMP NOT NULL,
    data_atualizacao TIMESTAMP NOT NULL,
    CONSTRAINT uk_conta_receber_id_empresa UNIQUE (id, empresa_id),
    CONSTRAINT fk_conta_receber_cliente_empresa FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id),
    CONSTRAINT fk_conta_receber_venda_empresa FOREIGN KEY (venda_id, empresa_id) REFERENCES vendas(id, empresa_id),
    CONSTRAINT chk_conta_receber_valores CHECK (valor_original > 0 AND valor_recebido >= 0 AND valor_recebido <= valor_original),
    CONSTRAINT chk_conta_receber_parcelas CHECK (numero_parcela >= 1 AND total_parcelas >= numero_parcela),
    CONSTRAINT chk_conta_receber_origem CHECK (
        (origem = 'MANUAL' AND venda_id IS NULL) OR (origem = 'VENDA_A_PRAZO' AND venda_id IS NOT NULL)),
    CONSTRAINT chk_conta_receber_status CHECK (
        (status = 'PENDENTE' AND valor_recebido = 0)
        OR (status = 'PARCIAL' AND valor_recebido > 0 AND valor_recebido < valor_original)
        OR (status = 'RECEBIDA' AND valor_recebido = valor_original)
        OR (status = 'CANCELADA' AND valor_recebido = 0))
);
CREATE INDEX idx_conta_receber_empresa_status ON contas_receber(empresa_id, status, id);
CREATE INDEX idx_conta_receber_empresa_vencimento ON contas_receber(empresa_id, data_vencimento, id);
CREATE INDEX idx_conta_receber_empresa_cliente ON contas_receber(empresa_id, cliente_id, id);
CREATE UNIQUE INDEX uk_conta_receber_venda_parcela ON contas_receber(empresa_id, venda_id, numero_parcela) WHERE venda_id IS NOT NULL;

ALTER TABLE movimentacoes_financeiras ADD COLUMN conta_receber_id BIGINT, ADD COLUMN chave_requisicao UUID;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT fk_mov_fin_conta_receber_empresa
    FOREIGN KEY (conta_receber_id, empresa_id) REFERENCES contas_receber(id, empresa_id);
CREATE INDEX idx_mov_fin_conta_receber ON movimentacoes_financeiras(empresa_id, conta_receber_id, id) WHERE conta_receber_id IS NOT NULL;
CREATE UNIQUE INDEX uk_mov_fin_receber_chave ON movimentacoes_financeiras(empresa_id, chave_requisicao) WHERE chave_requisicao IS NOT NULL;
ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem
    CHECK (origem IN ('MANUAL', 'CONTAS_A_PAGAR', 'SALDO_INICIAL', 'TRANSFERENCIA', 'PAGAMENTO_PIX', 'RECEBIVEL_LIQUIDACAO', 'CONTA_RECEBER'));
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_conta_receber CHECK (
    (origem = 'CONTA_RECEBER' AND conta_receber_id IS NOT NULL AND chave_requisicao IS NOT NULL AND tipo = 'ENTRADA')
    OR (origem <> 'CONTA_RECEBER' AND conta_receber_id IS NULL AND chave_requisicao IS NULL)
);
