-- Garante unicidade de CPF/CNPJ normalizado por empresa no cadastro de clientes.
-- Espelha o padrão já aplicado a fornecedores (V33).
-- ATENÇÃO: esta migration FALHA se existirem documentos duplicados na base.
-- Antes de aplicar em produção, executar diagnóstico de duplicados e fundir
-- os registros afetados (operação excepcional de dados, fora do Flyway).
CREATE UNIQUE INDEX uk_cliente_empresa_documento_normalizado
    ON clientes (empresa_id, (regexp_replace(cpf_cnpj, '[^0-9]', '', 'g')))
    WHERE cpf_cnpj IS NOT NULL AND regexp_replace(cpf_cnpj, '[^0-9]', '', 'g') <> '';
