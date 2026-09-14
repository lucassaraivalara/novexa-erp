Empresa ........ funcional
Produto ........ funcional
Cliente ........ funcional
Estoque ........ backend funcional
Venda .......... ABERTA → FATURADA consolidado
Caixa .......... cadastro apenas
Dados Bancários  não iniciado
Financeiro ..... fundação parcial
Dashboard ...... placeholder

## Vendas: consolidação ABERTA → FATURADA (2026-09-14)

- Continuidade da branch `feat/vendas-consolidacao`, base `7521fa1`: regras de venda aberta do commit `2486696` preservadas; alterações locais anteriores em VendaEntity, ItemVendaEntity e ItemVendaDTO foram concluídas.
- Modelo ativo único: `ItemVendaEntity` / `itens_venda`, com quantidade decimal, preço aplicado, subtotal, nome histórico, ordem e referência ao movimento de estoque. `VendaItem` foi removido. A V6 copia os dados legados e conserva a tabela original como `venda_itens_legado_v6`, sem uso pela aplicação. Se a mesma venda possuir itens nos dois modelos, a migration interrompe antes de alterar dados, exigindo reconciliação explícita.
- V6 preserva preços, quantidades e movimentos existentes; preenche o nome dos itens abertos antigos com o cadastro atual, pois esse nome não era armazenado. Vendas ABERTA com lançamento financeiro existente passam para FATURADA sem repetir efeitos. Corrige também a constraint PostgreSQL `vendas_check` deixada pela V5, permitindo venda aberta vazia. V1–V5 permanecem intactas.
- Venda ABERTA permite editar itens, quantidade, desconto e cliente opcional; não gera estoque ou financeiro definitivo. Faturamento valida tenant, status, itens/produtos, valores e pagamento; usa o serviço oficial de estoque (SAIDA/VENDA), registra o lançamento financeiro temporário existente e muda para FATURADA na mesma transação.
- FATURADA rejeita todas as operações de edição. A chave e o resumo da requisição são preservados para replay; lock por Venda protege faturamentos concorrentes e edições. Produtos são bloqueados em ordem e relidos sob lock antes da baixa. Falha financeira reverte saldo, histórico, referências dos itens e status.
- API preservada: `POST /vendas` continua atendendo o PDV e agora retorna FATURADA; `GET /vendas/{id}` consulta o modelo unificado. API da venda aberta: `POST /vendas/abertas`, `POST /vendas/{id}/itens`, `PATCH /vendas/{id}/itens/{itemId}`, `DELETE /vendas/{id}/itens/{itemId}`, `PATCH /vendas/{id}/desconto`, `PUT/DELETE /vendas/{id}/cliente` e `POST /vendas/{id}/faturar`. Faturamento recebe chaveRequisicao, totalEsperado, formaPagamento e valorRecebido. Empresa/operador vêm da autenticação.
- Validação direcionada: 85 testes aprovados (55 anteriores preservados e 30 casos adicionais). Os testes da V6 também passaram em PostgreSQL 18 descartável, incluindo preservação/rejeição de dados, Hibernate `validate` e criação de venda aberta vazia. Flyway 11.7.2 aplicou V1–V6 e validou o histórico em schema separado.
- Validação final: `mvnw.cmd clean test` executou 335 testes, com zero falhas, erros ou ignorados e `BUILD SUCCESS`. `git diff --check` passou.
- Limite de execução já existente: o POM desta branch não inclui `flyway-database-postgresql`. A validação Flyway isolada utilizou o JAR 11.7.2 já disponível no cache, sem modificar dependências; com o classpath original, foi confirmado erro de plugin PostgreSQL ausente. A inclusão preparada no diretório compartilhado deve ser integrada pelo responsável antes de executar a aplicação com Flyway/PostgreSQL.
- Pendências deliberadas: cancelamento/estorno completo, domínio próprio de Pagamento e destinos financeiros oficiais. Atualmente formaPagamento, valorRecebido e troco ficam em Venda e deverão ser avaliados para Pagamento; o lançamento temporário continua RECEBIDO para dinheiro/PIX e A_RECEBER para cartões. Não houve alteração de frontend, Estoque, Financeiro ou autenticação.
- Integração entre branches: a proteção cadastral de estoque do commit `6979636` permanece na branch `fix/estoque-concorrencia`; não foi duplicada nesta implementação.
