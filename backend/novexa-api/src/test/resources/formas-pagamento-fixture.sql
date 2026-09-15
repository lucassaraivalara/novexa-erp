-- Equivalente ao seed V8 para testes com schema H2 criado pelo Hibernate.
INSERT INTO formas_pagamento (id,descricao,tipo,ativo) VALUES
    (1,'Dinheiro','DINHEIRO',true),(2,'PIX','PIX',true),
    (3,'Débito','DEBITO',true),(4,'Crédito','CREDITO',true),
    (5,'Boleto','BOLETO',true),(6,'Transferência','TRANSFERENCIA',true);
ALTER TABLE formas_pagamento ALTER COLUMN id RESTART WITH 7;
