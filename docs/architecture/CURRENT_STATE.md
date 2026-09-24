Empresa ........ funcional
Produto ........ funcional
Cliente ........ funcional
Estoque ........ backend funcional
Venda .......... ABERTA → FATURADA consolidado
Pagamento ...... fundação backend (base aeaec2e)
Formas de Pagamento .... catálogo global backend (baseline integracao/formas-pagamento-ux)
Caixa .......... cadastro; backend operacional integrado à Venda, suprimento/sangria e fechamento com resumo
Dados Bancários  shell frontend com abas, sem contrato backend
Financeiro ..... fundação parcial; cadastros frontend estruturados
Dashboard ...... placeholder

## Consolidacao dos testes Caixa/PDV (2026-09-23)

- Branch `test/contrato-caixa-pdv`, base `dad70f2`, pendente de integracao. Reutiliza fixtures/helpers de CaixaOperacionalHttpTest e protege o contrato de uma forma por venda.
- Acrescentados 18 cenarios: pagamento/movimento/resumo por meio, separacao entre sessoes, suprimento/sangria, limite de dinheiro fisico, fechamento com sobra/falta/zero e cancelamento nas quatro formas com sessao aberta/fechada. Isolamento HTTP reforcado para consulta, fechamento e ambos os movimentos manuais, verificando ausencia de efeitos.
- Validacao: 115 testes aprovados, sem falhas ou ignorados (38 CaixaOperacionalHttpTest, 68 VendaHttpTest, 9 CancelamentoVendaServiceTest). Somente testes backend relacionados executados, com H2/MockMvc; suite completa e migrations nao executadas nesta tarefa.
- Nenhuma alteracao de codigo de producao ou frontend. Pagamento misto e conferencia por forma nao fazem parte desta consolidacao.

## Produtos: piloto de busca por coluna (2026-09-22)

- Implementado no worktree atual, pendente de integração: seleção de Código interno,
  Produto ou Situação no cabeçalho, chip removível e ordenação independente nas
  colunas de dados. Componentes AppTable/PageFilters possuem adesão opcional.
- A busca por coluna filtra somente os produtos já retornados; a busca geral
  remota e o filtro de situação foram preservados. Detalhes em [frontend.md](frontend.md).
- Validado com quatro testes de interação Playwright com API simulada, três testes
  de componentes, build, lint direcionado e revisão no navegador maximizado.
  Uma verificação antiga de fonte de ProdutoForm falha por formatação preexistente;
  o formulário não foi alterado. Backend e services preservados nesta tarefa.

## Caixa operacional MVP (2026-09-15)

- Implementado no diretório/branch atual, ainda pendente de commit e integração. Reaproveita SessaoCaixa; novas vendas faturadas de qualquer forma exigem sessão aberta da empresa. Uma sessão é inferida; múltiplas exigem sessaoCaixaId.
- Totais operacionais por forma separados do dinheiro físico. Apenas DINHEIRO gera entrada VENDA; SUPRIMENTO e SANGRIA manuais possuem chave de idempotência. Resumo de fechamento inclui saldo inicial, vendas/formas, suprimentos, sangrias, esperado em dinheiro, declarado e diferença.
- Consulta de sessões abertas, resumo e movimentos autenticados disponíveis. Fechamento conserva campos anteriores e adiciona resumo; replay com mesmo saldo é seguro. Contratos em [financeiro.md](financeiro.md).
- Lock por sessão e transação preservam faturamento, fechamento, idempotência, estoque e lançamento temporário. V10 preserva histórico anterior sem atribuir sessões fictícias.
- Validação: 98 testes direcionados distintos aprovados (65 Venda HTTP, 12 Sessão HTTP, 2 compatibilidade, 17 Caixa operacional, 1 criação de Venda e 1 migration PostgreSQL), zero falhas/erros/ignorados, BUILD SUCCESS. Flyway V1–V10 e Hibernate validate aprovados no PostgreSQL descartável. Suíte completa não executada por escopo. Diff da tarefa limpo; diff global contém whitespace preexistente em CaixaRequestDTO.
- Frontend operacional e demais destinos financeiros não implementados neste bloco. Alterações locais de outros trabalhos preservadas.

## Caixa: abertura e fechamento (2026-09-14)

- Branch `feat/caixa-abertura-fechamento`, base integrada `df45215`; ainda não integrada à main. Reutiliza CaixaEntity e adiciona SessaoCaixaEntity, preservando múltiplas sessões históricas com status ABERTO/FECHADO.
- Abertura registra saldoInicial, operador e data/hora; fechamento registra saldoFinal declarado, operador e data/hora. Empresa e usuário vêm da autenticação. Valores não negativos com até duas casas decimais; sem saldo calculado ou efeito automático de Venda/Pagamento.
- API autenticada: POST `/financeiro/caixas/{caixaId}/sessoes`, GET `/financeiro/caixas/{caixaId}/sessoes/aberta` e POST `/financeiro/caixas/{caixaId}/sessoes/{sessaoId}/fechar`. Regras e respostas em [financeiro.md](financeiro.md).
- Lock por Caixa e transação impedem duas aberturas simultâneas ou sobrescrita por fechamentos concorrentes. V9 adiciona histórico, unicidade parcial da sessão aberta e chaves compostas que impedem vínculos entre empresas. Nenhuma migration anterior foi alterada.
- Testes adicionados cobrem HTTP/JWT, multiempresa, usuário autenticado, valores, inatividade, reabertura, concorrência em transações independentes e rollback após flush. PostgreSQL 18.6 descartável: 29 testes de migrations aprovados, incluindo V1–V9, constraints, histórico e Hibernate validate; banco de desenvolvimento preservado.
- Frontend operacional, sangria, suprimento, movimentação de venda, conciliação e demais destinos financeiros não fazem parte desta entrega.
- Validação final: `.\mvnw.cmd clean test` com 426 testes, zero falhas, erros ou ignorados e BUILD SUCCESS; 16 casos adicionados. `git diff --check` aprovado.

## Baseline integrada: Formas de Pagamento + UX (2026-09-14)

- Branch `integracao/formas-pagamento-ux`, a partir da main `5a7a067`: integra `706e9b0` e a cadeia UX `a57d632` → `991eff9`, preservando os históricos, sem conflitos e sem alterações funcionais adicionais. Ainda não integrada à main.
- Backend de Formas de Pagamento e UX de Produtos/Empresas preservados integralmente. A implementação frontend do cadastro de Formas de Pagamento em andamento no worktree de outro agente não faz parte desta baseline.
- Validação integrada: `.\mvnw.cmd clean test` com 410 testes, zero falhas, erros ou ignorados e BUILD SUCCESS; frontend com 34 testes aprovados, build e lint aprovados. `git diff --check` aprovado. Smoke E2E ignorado por ausência de credenciais; não comprova validação funcional desta integração.
- Migrations e dependências inalteradas em relação aos commits integrados. A validação PostgreSQL/Flyway do backend permanece registrada na entrega de `706e9b0` abaixo; não foi repetida nesta integração. Avisos sem falha: chunk frontend acima de 500 kB e porta WebSocket do Vite já ocupada durante os testes.

## Formas de Pagamento: fundação global (2026-09-14)

- Entregue na branch `feat/formas-pagamento`, commit `706e9b0`, base `5a7a067`; incorporada à baseline de integração acima, ainda não à main. Catálogo global com id, descrição, tipo e ativo; sem empresaId. Tipos técnicos: DINHEIRO, PIX, DEBITO, CREDITO, BOLETO e TRANSFERENCIA.
- API autenticada: listar/criar em `/financeiro/formas-pagamento` e buscar/atualizar em `/{id}`. PUT também ativa/inativa; sem exclusão física. Descrição única normalizada e tipo imutável para preservar o comportamento histórico.
- Pagamento referencia FormaPagamento. V8 cria catálogo, seis registros iniciais e FK obrigatória nos pagamentos existentes; preserva o código legado como snapshot e não repete estoque/financeiro. Migrations aplicadas anteriores foram preservadas.
- Venda/PDV aceita o contrato antigo ou formaPagamentoId, nunca os dois juntos. Formas inativas são rejeitadas antes dos efeitos; retry de fechamento anterior continua válido após inativação. A V8 e os IDs estáveis permitem transição sem escolher formas pelo nome. Contratos e limitações em [financeiro.md](financeiro.md).
- Implementado o catálogo dos seis tipos; faturamento continua limitado a dinheiro, PIX, débito e crédito. Boleto/transferência no fechamento, frontend do cadastro, CondiçãoPagamento e demais destinos financeiros permanecem futuros.
- Validação: 31 casos adicionados; `.\mvnw.cmd clean test` executou 410 testes, zero falhas, erros ou ignorados e BUILD SUCCESS. Inclui CRUD global, formas inativas, histórico, compatibilidade do hash legado, faturamento por ID e inativação concorrente. `git diff --check` aprovado.
- PostgreSQL 18.6 descartável: 25 testes aprovados, incluindo Flyway V1–V8, seed/backfill, constraints, rollback de migration e Hibernate `validate`. A primeira tentativa falhou por memória compartilhada do processo PostgreSQL no Windows; a repetição passou após reiniciar somente o cluster descartável. Nenhum banco existente foi alterado.
- CONTRACT READY para o cadastro global e seleção por ID dos quatro tipos já suportados no faturamento. Isso não declara boleto/transferência no fechamento, CondiçãoPagamento ou destinos financeiros implementados.

## Baseline integrada: Pagamento + fundação frontend (2026-09-14)

- Branch `integracao/pagamento-frontend-baseline`, a partir da `main` em `d4fff37`: reúne `aeaec2e` e `4efddaa` com a cadeia frontend `4d3826e` → `c8734e9` → `3d5be87` → `6be4a18`. Integrada na main em `5a7a067`, base da integração mais recente acima.
- Financeiro > Cadastros reúne Caixas e Dados Bancários. Caixa possui cadastro funcional; Dados Bancários contém somente abas de Banco, Agência e Conta Bancária, sem API ou persistência desses cadastros.
- Preservados os padrões frontend de ações por ícones com Tooltip/aria-label, busca remota de Produtos com debounce de 350 ms, cancelamento e proteção contra respostas antigas, e formulários com `FormActions`, autofocus e feedback de salvamento. O debounce operacional de 300 ms está definido para consultas remotas; o PDV atual mantém busca local imediata. Regras em [frontend.md](frontend.md).
- Validação integrada: `.\mvnw.cmd clean test` com 379 testes, zero falhas, erros ou ignorados e BUILD SUCCESS. Frontend: 32 testes aprovados, build e lint aprovados. PostgreSQL 18.6 descartável: 22 testes de migrations aprovados, com Flyway V1–V7, backfill e Hibernate `validate`.
- Smoke E2E autenticado aprovado (1 teste, nenhum ignorado), com API/frontend integrados e dados sintéticos no PostgreSQL descartável: login, criação/edição de Produto, Entrada/Saída/Ajuste, histórico, saldo e criação/edição de Caixa. Ajustados somente seletores ambíguos e o título atual de Caixas no teste; nenhuma mudança funcional. Esse smoke não cobre Venda/PDV, cuja integração permanece coberta pelos testes backend e testes frontend existentes.
- Avisos sem falha: chunk frontend acima de 500 kB e PostgreSQL 18 posterior à faixa testada pelo Flyway atual. Nenhuma dependência foi atualizada.

As seções datadas abaixo preservam as evidências das entregas anteriores; os resultados da integração estão nesta seção.

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
- Pendências deliberadas de Vendas: cancelamento/estorno completo e destinos financeiros oficiais. O domínio próprio de Pagamento foi entregue posteriormente, conforme seção abaixo. FormaPagamento, valorRecebido e troco permanecem também em Venda por compatibilidade; o lançamento temporário continua RECEBIDO para dinheiro/PIX e A_RECEBER para cartões.
- Integração entre branches: a proteção cadastral de estoque do commit `6979636` foi integrada abaixo.

## Estoque: consistência e concorrência (2026-09-13)

- Reproduzida e corrigida perda de saldo na edição/inativação cadastral: uma entidade carregada com saldo 10 sobrescrevia a entrada já confirmada para 15, sem movimento correspondente. As operações cadastrais agora mantêm a entidade gerenciada em transação; `ProdutoEntity` usa atualização dinâmica para gravar apenas os campos alterados. O request de Produto continua sem autoridade sobre `estoqueAtual`.
- Movimentações preservam a estratégia existente: `PESSIMISTIC_WRITE` por produto e empresa, com validação, saldo e histórico na mesma transação. ENTRADA/SAÍDA/AJUSTE foram exercitados em threads e transações independentes, inclusive nas duas ordens de AJUSTE. Duas saídas de 2 com saldo 2 permitem apenas uma; falha após envio do saldo ao banco causa rollback integral. Produtos distintos não compartilham bloqueio.
- Validação direcionada: 88 testes de Produto/Estoque aprovados, incluindo 15 novos casos de concorrência/atomicidade e proteção HTTP contra saldo/empresa forjados. Ambiente H2 com JPA/Hibernate reais; repetir a matriz em PostgreSQL continua pendente. Os testes antigos de operações sequenciais e rejeição prévia foram preservados com nomes correspondentes ao que comprovam.
- Validação final: `mvnw.cmd clean test` com 324 testes, zero falhas, erros ou ignorados e `BUILD SUCCESS`; `git diff --check` sem erros. Java 21 e Spring Boot 3.5.4 preservados.
- Limites: o DTO de uma edição concorrente pode refletir o saldo lido inicialmente, embora o saldo persistido esteja preservado; uma nova consulta obtém o estado atualizado. Na base auditada (`03153db`), `VendaService` ainda realiza baixa e histórico próprios sob lock/transação. A convergência para o domínio oficial de movimentação deve ser coordenada com o responsável por Vendas; esse módulo não foi alterado nesta correção.

Regras de negócio permanecem em [estoque.md](estoque.md), sem alteração arquitetural ou migration nesta correção.

## Pagamento: fundação backend (2026-09-14)

- Fundação entregue no commit `aeaec2e`, na branch `feat/pagamento-backend`, a partir de `d4fff37`; reunida com o frontend na baseline de integração acima, ainda não incorporada à `main`.
- `PagamentoEntity`, repository e service registram um pagamento no faturamento, com empresa/venda/operador, forma, valor, status REGISTRADO, data/hora, chave de requisição e sequência. Venda ABERTA não gera pagamento. O modelo permite 1:N; pagamento misto ainda não foi implementado.
- Mantidos os contratos atuais do PDV e os campos de fechamento em Venda. A nova consulta autenticada `GET /vendas/{vendaId}/pagamentos` usa empresa do JWT e retorna 404 para venda de outro tenant. Não há endpoints de criação, alteração ou exclusão de Pagamento.
- REGISTRADO não significa liquidação ou confirmação externa. Valor recebido/troco são registrados no Pagamento apenas em dinheiro. O lançamento financeiro temporário continua funcionando com suas situações anteriores, independentemente desse novo status.
- Na entrega `aeaec2e`, `FormaPagamento` era apenas um enum fixo (DINHEIRO, PIX, CARTAO_DEBITO, CARTAO_CREDITO); o catálogo global foi acrescentado na fundação descrita acima. Condição de Pagamento, Banco, Agência e Conta Bancária continuam sem implementação backend.
- Idempotência e locks do faturamento preservados; unicidade de venda/sequência evita duplicação do pagamento atual. Falha no pagamento ou no financeiro reverte pagamento, saldo, histórico e status da Venda.
- V7 cria `pagamentos` e preenche vendas FATURADA existentes, sem repetir efeitos. FKs compostas protegem os vínculos de tenant. O operador e o horário legados usam os dados históricos disponíveis, com limitações descritas em [financeiro.md](financeiro.md).
- Validação direcionada: 129 testes aprovados, zero falhas, erros ou ignorados; inclui 20 casos de migration e cinco novos cenários HTTP, além das verificações de Pagamento nos testes existentes de Venda.
- Validação PostgreSQL 18.6 descartável: 22 testes aprovados, incluindo Flyway V1–V7, backfill, rejeição de dados inconsistentes, rollback de DDL e Hibernate `validate`. Flyway emitiu aviso de que essa versão do PostgreSQL é posterior à sua faixa oficialmente testada; nenhuma dependência foi alterada. O cluster de teste foi encerrado.
- Validação final: `.\mvnw.cmd clean test` executou 379 testes, com zero falhas, erros ou ignorados e BUILD SUCCESS. `git diff --check` aprovado.
- CONTRACT READY para a fundação: registro automático no faturamento e consulta por venda, com DTO/endpoint estáveis. Isso não declara Caixa, bancos, recebíveis ou liquidação prontos.
- Não implementados: movimentos/saldo/abertura de Caixa, dados bancários, recebíveis, contas a receber/pagar, liquidação, pagamento misto e cancelamento completo. Nenhuma alteração de frontend, dependências ou autenticação.
