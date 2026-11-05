-- Principal é amortização; valor_pago continua sendo o desembolso acumulado vigente.
ALTER TABLE contas_pagar ADD COLUMN principal_quitado NUMERIC(19,2) NOT NULL DEFAULT 0;
UPDATE contas_pagar SET principal_quitado = valor WHERE status = 'PAGA';
ALTER TABLE contas_pagar DROP CONSTRAINT chk_conta_pagar_status;
ALTER TABLE contas_pagar DROP CONSTRAINT chk_conta_pagar_pagamento;
ALTER TABLE contas_pagar ADD CONSTRAINT chk_conta_pagar_status
    CHECK(status IN ('ABERTA','PARCIALMENTE_PAGA','PAGA','CANCELADA'));
ALTER TABLE contas_pagar ADD CONSTRAINT chk_conta_pagar_principal CHECK(
    principal_quitado >= 0 AND principal_quitado <= valor AND (
        (status IN ('ABERTA','CANCELADA') AND principal_quitado=0 AND data_pagamento IS NULL AND valor_pago IS NULL)
        OR (status='PARCIALMENTE_PAGA' AND principal_quitado>0 AND principal_quitado<valor
            AND data_pagamento IS NOT NULL AND valor_pago IS NOT NULL AND valor_pago>0)
        OR (status='PAGA' AND principal_quitado=valor AND data_pagamento IS NOT NULL AND valor_pago IS NOT NULL AND valor_pago>0)
    ));
-- O lock da obrigação serializa amortização e estorno; UUID continua único por empresa.
DROP INDEX uk_pagamento_pagar_ativo;
CREATE INDEX idx_pagamento_pagar_confirmado ON pagamentos_conta_pagar(empresa_id,conta_pagar_id,id DESC)
    WHERE estado='CONFIRMADO';
