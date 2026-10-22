-- Data de faturamento da venda, preenchida no momento do faturamento.
-- Vendas legadas permanecem NULL e são filtradas pelas consultas
-- que usam dataFaturamento (ex.: listarResumoPaginadoPorFaturamento).
ALTER TABLE vendas ADD COLUMN data_faturamento TIMESTAMP NULL;
