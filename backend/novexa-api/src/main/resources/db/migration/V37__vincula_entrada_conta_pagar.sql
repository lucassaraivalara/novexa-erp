ALTER TABLE contas_pagar ADD CONSTRAINT uk_conta_pagar_id_empresa UNIQUE (id, empresa_id);
ALTER TABLE entradas_mercadoria
    ADD COLUMN conta_pagar_id BIGINT,
    ADD COLUMN origem_conta_pagar VARCHAR(20),
    ADD COLUMN usuario_vinculo_conta_id BIGINT,
    ADD COLUMN data_vinculo_conta TIMESTAMP,
    ADD COLUMN chave_geracao_conta UUID,
    ADD COLUMN resumo_geracao_conta VARCHAR(64),
    ADD CONSTRAINT uk_entrada_conta_pagar UNIQUE (conta_pagar_id),
    ADD CONSTRAINT fk_entrada_conta_pagar_empresa FOREIGN KEY (conta_pagar_id, empresa_id)
        REFERENCES contas_pagar (id, empresa_id),
    ADD CONSTRAINT fk_entrada_usuario_vinculo_conta FOREIGN KEY (usuario_vinculo_conta_id, empresa_id)
        REFERENCES usuario (id, empresa_id),
    ADD CONSTRAINT ck_entrada_conta_pagar CHECK (
        (conta_pagar_id IS NULL AND origem_conta_pagar IS NULL AND usuario_vinculo_conta_id IS NULL
            AND data_vinculo_conta IS NULL AND chave_geracao_conta IS NULL AND resumo_geracao_conta IS NULL)
        OR (conta_pagar_id IS NOT NULL AND origem_conta_pagar IS NOT NULL
            AND usuario_vinculo_conta_id IS NOT NULL AND data_vinculo_conta IS NOT NULL
            AND status IN ('CONFIRMADA', 'CANCELADA')
            AND ((origem_conta_pagar = 'GERADA' AND chave_geracao_conta IS NOT NULL AND resumo_geracao_conta IS NOT NULL)
                OR (origem_conta_pagar = 'PREEXISTENTE' AND chave_geracao_conta IS NULL AND resumo_geracao_conta IS NULL)))
    );
