Empresa ........ funcional
Produto ........ funcional
Cliente ........ funcional
Estoque ........ backend funcional
Venda .......... ABERTA → FATURADA consolidado
Pagamento ...... fundação backend (base aeaec2e)
Caixa .......... cadastro apenas
Dados Bancários  não iniciado
Financeiro ..... fundação parcial
Dashboard ...... placeholder

Frontend operacional de Estoque ...... implementado

- Lista produtos usando o endpoint autenticado de produtos, sem enviar empresaId ou usuarioId.
- Exibe estoque atual, estoque mínimo e situação calculada como NORMAL, BAIXO, ZERADO ou SEM CONTROLE.
- Permite ENTRADA, SAIDA e AJUSTE pelo serviço oficial de movimentações.
- AJUSTE é apresentado como novo saldo físico e não altera o saldo local como fonte definitiva.
- Consulta histórico de movimentações por produto.
- Testes frontend cobrem as classificações de estoque e os contratos HTTP da tela.
- Cadastro frontend de Produtos não edita estoqueAtual; o saldo é exibido somente para consulta e alterado pela tela de Estoque.
- ProdutoInput não envia estoqueAtual em criação ou edição; estoqueMinimo fica desabilitado quando controlaEstoque está desligado.

## Vendas: consolidação ABERTA → FATURADA (2026-09-14)

- Continuidade da branch `feat/vendas-consolidacao`, base `7521fa1`: regras de venda aberta do commit `2486696` preservadas; alterações locais anteriores em VendaEntity, ItemVendaEntity e ItemVendaDTO foram concluídas.
- Modelo ativo único: `ItemVendaEntity` / `itens_venda`, com quantidade decimal, preço aplicado, subtotal, nome histórico, ordem e referência ao movimento de estoque. `VendaItem` foi removido. A V6 copia os dados legados e conserva a tabela original como `venda_itens_legado_v6`, sem uso pela aplicação. Se a mesma venda possuir itens nos dois modelos, a migration interrompe antes de alterar dados, exigindo reconciliação explícita.
- V6 preserva preços, quantidades e movimentos existentes; preenche o nome dos itens abertos antigos com o cadastro atual, pois esse nome não era armazenado. Vendas ABERTA com lançamento financeiro existente passam para FATURADA sem repetir efeitos. Corrige também a constraint PostgreSQL `vendas_check` deixada pela V5, permitindo venda aberta vazia. V1–V5 permanecem intactas.
- Venda ABERTA permite editar itens, quantidade, desconto e cliente opcional; não gera estoque ou financeiro definitivo. Faturamento valida tenant, status, itens/produtos, valores e pagamento; usa o serviço oficial de estoque (SAIDA/VENDA), registra o lançamento financeiro temporário existente e muda para FATURADA na mesma transação.
- FATURADA rejeita todas as operações de edição. A chave e o resumo da requisição são preservados para replay; lock por Venda protege faturamentos concorrentes e edições. Produtos são bloqueados em ordem e relidos sob lock antes da baixa. Falha financeira reverte saldo, histórico, referências dos itens e status.
- API preservada: `POST /vendas` continua atendendo o PDV e agora retorna FATURADA; `GET /vendas/{id}` consulta o modelo unificado. API da venda aberta: `POST /vendas/abertas`, `POST /vendas/{id}/itens`, `PATCH /vendas/{id}/itens/{itemId}`, `DELETE /vendas/{id}/itens/{itemId}`, `PATCH /vendas/{id}/desconto`, `PUT/DELETE /vendas/{id}/cliente` e `POST /vendas/{id}/faturar`. Faturamento recebe chaveRequisicao, totalEsperado, formaPagamento e valorRecebido. Empresa/operador vêm da autenticação.
- Validação direcionada: 85 testes aprovados (55 anteriores preservados e 30 casos adicionais). Os testes da V6 também passaram em PostgreSQL 18 descartável, incluindo preservação/rejeição de dados, Hibernate `validate` e criação de venda aberta vazia. Flyway 11.7.2 aplicou V1–V6 e validou o histórico em schema separado.
- Validação final: `mvnw.cmd clean test` executou 335 testes, com zero falhas, erros ou ignorados e `BUILD SUCCESS`. `git diff --check` passou.
- O POM integrado inclui `flyway-database-postgresql` na mesma versão gerenciada de `flyway-core`, permitindo executar a aplicação com Flyway/PostgreSQL.
- Pendências deliberadas: cancelamento/estorno completo, domínio próprio de Pagamento e destinos financeiros oficiais. Atualmente formaPagamento, valorRecebido e troco ficam em Venda e deverão ser avaliados para Pagamento; o lançamento temporário continua RECEBIDO para dinheiro/PIX e A_RECEBER para cartões. Não houve alteração de frontend, Estoque, Financeiro ou autenticação.
- Integração entre branches: a proteção cadastral de estoque do commit `6979636` foi integrada abaixo.

## Estoque: consistência e concorrência (2026-09-13)

- Reproduzida e corrigida perda de saldo na edição/inativação cadastral: uma entidade carregada com saldo 10 sobrescrevia a entrada já confirmada para 15, sem movimento correspondente. As operações cadastrais agora mantêm a entidade gerenciada em transação; `ProdutoEntity` usa atualização dinâmica para gravar apenas os campos alterados. O request de Produto continua sem autoridade sobre `estoqueAtual`.
- Movimentações preservam a estratégia existente: `PESSIMISTIC_WRITE` por produto e empresa, com validação, saldo e histórico na mesma transação. ENTRADA/SAÍDA/AJUSTE foram exercitados em threads e transações independentes, inclusive nas duas ordens de AJUSTE. Duas saídas de 2 com saldo 2 permitem apenas uma; falha após envio do saldo ao banco causa rollback integral. Produtos distintos não compartilham bloqueio.
- Validação direcionada: 88 testes de Produto/Estoque aprovados, incluindo 15 novos casos de concorrência/atomicidade e proteção HTTP contra saldo/empresa forjados. Ambiente H2 com JPA/Hibernate reais; repetir a matriz em PostgreSQL continua pendente. Os testes antigos de operações sequenciais e rejeição prévia foram preservados com nomes correspondentes ao que comprovam.
- Validação final: `mvnw.cmd clean test` com 324 testes, zero falhas, erros ou ignorados e `BUILD SUCCESS`; `git diff --check` sem erros. Java 21 e Spring Boot 3.5.4 preservados.
- Limites: o DTO de uma edição concorrente pode refletir o saldo lido inicialmente, embora o saldo persistido esteja preservado; uma nova consulta obtém o estado atualizado. Na base auditada (`03153db`), `VendaService` ainda realiza baixa e histórico próprios sob lock/transação. A convergência para o domínio oficial de movimentação deve ser coordenada com o responsável por Vendas; esse módulo não foi alterado nesta correção.

Regras de negócio permanecem em [estoque.md](estoque.md), sem alteração arquitetural ou migration nesta correção.

## Pagamento: fundação backend (2026-09-14)

- Fundação entregue no commit `aeaec2e`, na branch `feat/pagamento-backend`, a partir de `d4fff37`; integração na main ainda depende da etapa de integração.
- `PagamentoEntity`, repository e service registram um pagamento no faturamento, com empresa/venda/operador, forma, valor, status REGISTRADO, data/hora, chave de requisição e sequência. Venda ABERTA não gera pagamento. O modelo permite 1:N; pagamento misto ainda não foi implementado.
- Mantidos os contratos atuais do PDV e os campos de fechamento em Venda. A nova consulta autenticada `GET /vendas/{vendaId}/pagamentos` usa empresa do JWT e retorna 404 para venda de outro tenant. Não há endpoints de criação, alteração ou exclusão de Pagamento.
- REGISTRADO não significa liquidação ou confirmação externa. Valor recebido/troco são registrados no Pagamento apenas em dinheiro. O lançamento financeiro temporário continua funcionando com suas situações anteriores, independentemente desse novo status.
- `FormaPagamento` é atualmente um enum fixo (DINHEIRO, PIX, CARTAO_DEBITO, CARTAO_CREDITO). Não existem no backend cadastros próprios de TipoFormaPagamento, Forma de Pagamento configurável, Condição de Pagamento, Banco, Agência ou Conta Bancária nesta base.
- Idempotência e locks do faturamento preservados; unicidade de venda/sequência evita duplicação do pagamento atual. Falha no pagamento ou no financeiro reverte pagamento, saldo, histórico e status da Venda.
- V7 cria `pagamentos` e preenche vendas FATURADA existentes, sem repetir efeitos. FKs compostas protegem os vínculos de tenant. O operador e o horário legados usam os dados históricos disponíveis, com limitações descritas em [financeiro.md](financeiro.md).
- Validação direcionada: 129 testes aprovados, zero falhas, erros ou ignorados; inclui 20 casos de migration e cinco novos cenários HTTP, além das verificações de Pagamento nos testes existentes de Venda.
- Validação PostgreSQL 18.6 descartável: 22 testes aprovados, incluindo Flyway V1–V7, backfill, rejeição de dados inconsistentes, rollback de DDL e Hibernate `validate`. Flyway emitiu aviso de que essa versão do PostgreSQL é posterior à sua faixa oficialmente testada; nenhuma dependência foi alterada. O cluster de teste foi encerrado.
- Validação final: `.\mvnw.cmd clean test` executou 379 testes, com zero falhas, erros ou ignorados e BUILD SUCCESS. `git diff --check` aprovado.
- CONTRACT READY para a fundação: registro automático no faturamento e consulta por venda, com DTO/endpoint estáveis. Isso não declara Caixa, bancos, recebíveis ou liquidação prontos.
- Não implementados: movimentos/saldo/abertura de Caixa, dados bancários, recebíveis, contas a receber/pagar, liquidação, pagamento misto e cancelamento completo. Nenhuma alteração de frontend, dependências ou autenticação.
