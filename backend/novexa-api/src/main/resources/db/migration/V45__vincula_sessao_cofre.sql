-- Somente vinculos novos: nenhum saldo, fechamento ou movimento historico e recalculado.
ALTER TABLE movimentacoes_caixa ADD CONSTRAINT uk_mov_caixa_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE movimentacoes_financeiras DROP CONSTRAINT chk_mov_fin_origem;
ALTER TABLE movimentacoes_financeiras ADD CONSTRAINT chk_mov_fin_origem CHECK
 (origem IN ('MANUAL','CONTAS_A_PAGAR','SALDO_INICIAL','TRANSFERENCIA','PAGAMENTO_PIX','RECEBIVEL_LIQUIDACAO','CONTA_RECEBER','MOVIMENTO_COFRE'));
CREATE TABLE recolhimentos_cofre (
 id BIGSERIAL PRIMARY KEY,
 empresa_id BIGINT NOT NULL REFERENCES empresas(id),
 sessao_id BIGINT NOT NULL,
 conta_id BIGINT,
 movimento_caixa_id BIGINT UNIQUE,
 movimento_financeiro_id BIGINT UNIQUE,
 usuario_id BIGINT NOT NULL,
 usuario_confirmacao_id BIGINT,
 tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('FECHAMENTO','SANGRIA','DEVOLUCAO_TROCO')),
 chave_requisicao UUID NOT NULL,
 valor NUMERIC(19,2) NOT NULL CHECK (valor >= 0),
 valor_troco NUMERIC(19,2) NOT NULL CHECK (valor_troco >= 0),
 responsavel VARCHAR(150),
 observacao VARCHAR(500),
 data_criacao TIMESTAMP NOT NULL,
 data_confirmacao TIMESTAMP,
 CONSTRAINT uk_recolhimento_chave UNIQUE (empresa_id, chave_requisicao),
 CONSTRAINT fk_recolhimento_sessao FOREIGN KEY (sessao_id,empresa_id) REFERENCES sessoes_caixa(id,empresa_id),
 CONSTRAINT fk_recolhimento_conta FOREIGN KEY (conta_id,empresa_id) REFERENCES contas_financeiras(id,empresa_id),
 CONSTRAINT fk_recolhimento_caixa FOREIGN KEY (movimento_caixa_id,empresa_id) REFERENCES movimentacoes_caixa(id,empresa_id),
 CONSTRAINT fk_recolhimento_financeiro FOREIGN KEY (movimento_financeiro_id,empresa_id) REFERENCES movimentacoes_financeiras(id,empresa_id),
 CONSTRAINT fk_recolhimento_usuario FOREIGN KEY (usuario_id,empresa_id) REFERENCES usuario(id,empresa_id),
 CONSTRAINT fk_recolhimento_confirmador FOREIGN KEY (usuario_confirmacao_id,empresa_id) REFERENCES usuario(id,empresa_id),
 CONSTRAINT ck_recolhimento_destino CHECK (valor = 0 OR (conta_id IS NOT NULL AND responsavel IS NOT NULL AND length(trim(responsavel)) > 0)),
 CONSTRAINT ck_recolhimento_confirmacao CHECK
  ((data_confirmacao IS NULL AND usuario_confirmacao_id IS NULL AND movimento_financeiro_id IS NULL)
   OR (data_confirmacao IS NOT NULL AND usuario_confirmacao_id IS NOT NULL AND movimento_financeiro_id IS NOT NULL AND valor > 0)),
 CONSTRAINT ck_recolhimento_tipo CHECK
  ((tipo = 'FECHAMENTO' AND movimento_caixa_id IS NULL)
   OR (tipo <> 'FECHAMENTO' AND movimento_caixa_id IS NOT NULL AND valor > 0 AND valor_troco = 0))
);
CREATE UNIQUE INDEX uk_recolhimento_fechamento ON recolhimentos_cofre(sessao_id) WHERE tipo = 'FECHAMENTO';
CREATE INDEX idx_recolhimento_empresa_data ON recolhimentos_cofre(empresa_id,data_criacao DESC,id DESC);
