Empresa ........ funcional
Produto ........ funcional
Cliente ........ funcional
Estoque ........ backend funcional
Venda .......... ABERTA → FATURADA consolidado
Pagamento ...... fundação backend (base aeaec2e)
Formas de Pagamento .... catálogo técnico global + configurações empresariais backend (Bloco 3A)
Caixa .......... cadastro; backend operacional integrado à Venda, suprimento/sangria e fechamento com resumo
Dados Bancários  shell frontend com abas, sem contrato backend
Financeiro ..... fundação parcial; Contas a Pagar MVP operacional
Dashboard ...... placeholder

## MVP 02: confirmacao PIX com controle de acesso (2026-10-01)

Implementado sobre 5138bd9, na mesma branch. Central de Vendas -> detalhe -> Pagamentos consulta o endpoint existente e apresenta configuracao/conta historicas, valor, situacao e auditoria. ADMIN/GERENTE confirmam com dialog e POST sem payload; OPERADOR/USUARIO nao veem a acao e recebem 403 no backend; sem autenticacao retorna 401. Feedback, recarga do detalhe e bloqueio durante a request preservam o fluxo fora do PDV. Sem redesign, migrations, fallback de destino ou alteracao das regras de confirmacao/cancelamento. Detalhes em financeiro.md e FINANCEIRO_RULES.md.

Validacao: 112 casos H2 (Venda HTTP e CancelamentoVendaService), 21 PostgreSQL PIX e 135 frontend aprovados, incluindo nove testes novos de interface com HTTP simulado. PostgreSQL 18.6 descartavel com Flyway V1..V30 e Hibernate validate; dupla confirmacao e confirmacao/cancelamento repetidos tres vezes cada. Snapshot, destino ausente, conta inativa, tenant, rollback e estorno preservados. Package backend, TypeScript/build, lint dos arquivos alterados e diff check aprovados. Sem suite backend completa; homologacao ponta a ponta com frontend conectado ao backend real permanece pendente. Restricao BANCO/CARTEIRA_DIGITAL da configuracao de cartao confirmada em frontend e backend, sem ajuste.

## MVP 01: destino financeiro nas configuracoes de cartao (2026-10-01)

Frontend implementado na branch feat/contas-pagar-integracao-backend sobre 3d98fbf. DEBITO/CREDITO permitem selecionar destino obrigatorio para novas configuracoes; legado sem destino e legivel/inativavel, mas salvar ativo/reativar exige regularizacao explicita. Lista sinaliza destino ausente; destino atual inativo pode ser preservado. Troca para DINHEIRO/BOLETO limpa destino, sem tenant no payload. Contrato POST/PUT existente e services reutilizados, sem backend/migrations ou alteracao de historico, liquidacao, PIX/PDV e design aprovado. Detalhes em frontend.md.

Validacao: 14 testes direcionados (12 novos Chromium + 2 services), suite frontend 126/126, TypeScript/build e diff check aprovados. Criacao de Debito/Credito, Dinheiro, edicao/reativacao/inativacao legada e erros exercitados com HTTP simulado; homologacao com backend real permanece pendente. Lint alterado sem erros, com warning preexistente react-hooks/incompatible-library de watch() confirmado no HEAD anterior. Erro preexistente do Dashboard react-hooks/set-state-in-effect registrado separadamente, sem correcao nesta tarefa.

## Linguagem visual ERP baseada nas referencias (2026-10-01)

Restilizacao aprovada e encerrada na branch feat/contas-pagar-integracao-backend, sobre d6061d6. Sidebar navy com marca verde, selecao clara, superficies brancas com raios moderados e sombra leve. Filtros/tabelas integrados visualmente; indicadores do Dashboard compactos, sem raios multiplicados pelo MUI. PDV responsivo, cadastros e Login coerentes com a identidade aprovada. Sem alteracoes de regras, rotas ou APIs; recuperacao/suporte e preferencia de permanencia no Login continuam indisponiveis, sem alterar a sessao existente. Detalhes em frontend.md. Validacao de consolidacao: 114 testes frontend aprovados, TypeScript/build e diff check; lint dos arquivos alterados com um unico erro preexistente de react-hooks/set-state-in-effect no Dashboard, reproduzido tambem no HEAD anterior. Screenshots desktop/mobile de Dashboard, Vendas, Clientes/cadastro, Caixa, PDV e Login com dados simulados, sem overflow horizontal da pagina ou erros JS. Design preservado; proximas etapas sao funcionais e dependem de aprovacao, sem novas iteracoes esteticas salvo bugs visuais criticos.

## Design Foundation Novexa: Theme e Tokens (2026-10-01)

Fundacao visual frontend na branch `feat/contas-pagar-integracao-backend`, sobre `dd46ca7`. Theme concentra palette neutra/verde funcional, tipografia Inter fixa, raios/sombras e overrides MUI; layoutTokens referencia o theme sem mudar suas chaves. Sem alteracoes de paginas, componentes compartilhados, backend, services/types/hooks, rotas, PDV ou Login. Sidebar escura permanece para onda posterior, sem promover seus hardcodes a tokens. Detalhes em frontend.md.

TypeScript/build, lint dos dois arquivos alterados e 86 testes frontend aprovados. Screenshots Playwright de Dashboard, Central de Vendas e Clientes em 1440px/390px, com dados simulados, sem erros JS ou overflow horizontal da pagina. Validacao visual nao substitui integracao autenticada real. Avisos nao bloqueantes de chunk Vite >500kB e colisao da porta WebSocket dos testes existentes; sem lint global ou mudanca de dependencias.

## Aposentadoria do LancamentoFinanceiro operacional (2026-10-01)

Alteracao backend consolidada na branch `feat/contas-pagar-integracao-backend` sobre `bff555f`. LancamentoFinanceiroEntity passa a LEGADO / READ-ONLY HISTORICO: novas vendas nao criam lancamentos e cancelamento nao depende nem altera os registros antigos. Entidade, repository, tabela e migrations preservados; sem DELETE/backfill/migration. Fontes atuais: Venda/Pagamento + MovimentacaoCaixa + MovimentacaoFinanceira + Recebivel, conforme pagamento. Cancelamento de Recebivel LIQUIDADO continua com reversao transacional do 5B. Detalhes em financeiro.md e FINANCEIRO_RULES.md.

Validacao direcionada: 348 testes aprovados, sem falhas/erros/ignorados (Venda HTTP/service, cancelamento, Caixa operacional/sessoes, compatibilidade de pagamento, Recebiveis e liquidacao H2/PostgreSQL, PIX PostgreSQL). PostgreSQL 18.6 com Flyway V1..V30 e Hibernate validate, incluindo concorrencia/rollback do 5B. Testes comprovam ausencia de lancamentos novos e preservacao do historico no cancelamento/retry, independentemente da situacao legada. Falhas de faturamento agora injetadas apos persistencia real de Pagamento, preservando cobertura transacional. CaixaOperacionalHttpTest atualizado somente na expectativa legada e limpeza de fixtures (Recebiveis antes de Pagamentos). Package backend e git diff --check aprovados; sem suite completa ou frontend.

## Bloco 5B: Liquidacao de Recebiveis (2026-10-01)

Implementacao backend consolidada sobre `ae4df35` (Bloco 5A). V30 concentra auditoria de liquidacao/cancelamento, entrada unica RECEBIVEL_LIQUIDACAO tenant-safe e compatibilidade cadastral de DEBITO/CREDITO; V24 a V29 intactas, sem V31 ou backfill.

POST /financeiro/recebiveis/{id}/liquidar deriva conta exclusivamente do snapshot historico do Pagamento e valor do previsto. Conta historica inativa e permitida, destino ausente/invalido retorna 409. Liquidacao idempotente e reversao no cancelamento preservam movimento/auditoria; saldo insuficiente causa rollback integral. GET continua paginado, com auditoria e ID do movimento derivado, sem relacao circular. Novas configuracoes de cartao exigem destino valido e novas vendas configuradas exigem regularizacao das legadas sem destino. Contrato de venda legado sem configuracao preservado, com liquidacao 409 se snapshot ausente.

Locks: operador -> Venda -> Pagamento -> Recebivel -> ContaFinanceira; cancelamento preserva estoque intermediario, registros/contas multiplos em ordem crescente. Sem alterar arquitetura PIX, Caixa, Contas a Pagar, frontend ou implementacao de paginacao. Pendencia real frontend: selecao de destino e regularizacao das configuracoes de cartao; sem taxas/prazos/parcelamento real ou conciliacao neste bloco. Detalhes em financeiro.md.

Validacao final direcionada: 339 casos aprovados, sem falhas/erros/ignorados. Liquidacao H2 (35) e PostgreSQL (46), upgrade V29->V30 (1), Recebiveis H2/PG (18/19), configuracoes (23), Venda HTTP/service (95/23), cancelamento (9), ContaFinanceira/extrato (14), PIX PostgreSQL (15), Transferencias (29), paginacao PostgreSQL (10) e migrations especificas V27/V28 (1 cada). PostgreSQL 18.6 descartavel com Flyway V1..V30 e Hibernate validate; cinco repeticoes reais de liquidar x liquidar e cinco de liquidar x cancelar com operadores distintos, sem deadlock, dupla entrada ou estado parcial. Rollbacks apos movimento/saldo, antes da persistencia do status e apos estorno; saldo insuficiente; snapshot/destino inativo/tenant/auditoria/estorno individual bloqueado cobertos. Upgrade preserva configuracao legada sem destino e recebivel PENDENTE sem auditoria ficticia. Maven package e git diff --check aprovados; suite completa/frontend nao executados por escopo.

## Bloco 5A: Recebiveis de cartao (2026-10-01)

Nucleo backend consolidado na branch `feat/contas-pagar-integracao-backend`, baseline `9815b40`, sem push ou integracao a main. Recebivel com snapshot historico e suporte estrutural a parcelas; DEBITO/CREDITO geram uma parcela PENDENTE na transacao da Venda/Pagamento. Liquido previsto igual ao bruto e data prevista NULL, sem taxas/prazos ficticios. Nenhum backfill. V29 adiciona FKs tenant-safe, unicidade de parcela e CHECKs; V27/V28 intactas.

CARTAO -> Pagamento -> Recebivel -> futura Liquidacao -> ContaFinanceira. Venda com cartao NAO movimenta ContaFinanceira. Cancelamento preserva historico (PENDENTE -> CANCELADO), retry usa locks/idempotencia existentes e LIQUIDADO bloqueia cancelamento com rollback. GET /financeiro/recebiveis possui DTO e consulta paginada por tenant com filtros status/tipo/periodo/venda e allowlist de sort. Detalhes em financeiro.md. Sem frontend, liquidacao, adquirentes, taxas ou parcelamento operacional; Bloco 5B pendente.

Validacao final direcionada: 189 testes aprovados, sem falhas/erros/ignorados: Recebivel HTTP H2 (18), Recebivel PostgreSQL (19), PIX PostgreSQL (15), paginacao PostgreSQL (10), Venda HTTP (95), VendaService (23) e CancelamentoVendaService (9). Os tres contextos PostgreSQL 18.6 usam schemas descartaveis com Flyway V1..V29 e Hibernate validate; constraints de duplicidade/tenant/valores, retry, snapshot, filtros/paginacao/sort e rollback apos persistencia real cobertos. Maven package e git diff --check aprovados, sem suite global. Contextos de Venda atualizados apenas para a nova dependencia e limpeza de recebiveis. Frontend, regras PIX, Caixa, Contas a Pagar, implementacao de paginacao e EstoqueConcorrenciaTest nao alterados.

Compatibilidade dos contextos PostgreSQL corrigida: PagamentoPixPostgresTest e PaginacaoPostgresTest validam o estado atual completo da aplicacao, nao uma migration isolada. Removido somente o alvo fixo V28 para aplicar todas as migrations disponiveis (atualmente V29), mantendo Hibernate validate e assertions. O erro anterior missing table [recebiveis] era causado pela nova entidade com schema incompleto; nao era preexistente nem falha de regra PIX. Testes especificos de migrations V27/V28 permanecem intactos.

## Consolidacao PIX/PDV e validacao da branch (2026-10-01)

Consolidacao sobre `7ab7f7d` na branch `feat/contas-pagar-integracao-backend`, sem integracao a main. Os nove commits de paginacao permanecem inalterados. Snapshot V27 e PDV possuem commits separados; o ciclo PIX V28 conserva confirmacao explicita, conta historica, idempotencia, cancelamento, locks, rollback e auditoria. Nenhuma V29 ou nova regra financeira.

Estado inicial: seis arquivos PIX staged, 18 unstaged (tres tambem staged) e PagamentoPixPostgresTest untracked. Mapeamento: A/V27 = migration, PagamentoEntity, PagamentoResponseDTO, PagamentoSnapshotMigrationTest, asserts snapshot de VendaHttpTest e docs; B/PDV = Vendas.tsx, pdv.ts, vendaService.ts e configuracaoFormaPagamentoService.ts; C/V28 = migration, controller/service ConfirmacaoPagamentoPix, PagamentoService/Repository, MovimentacaoFinanceiraEntity/Repository, OrigemMovimentacaoFinanceira, testes PIX/migration e docs; D/compartilhados = PagamentoEntity/DTO, VendaHttpTest, CURRENT_STATE, financeiro e FINANCEIRO_RULES. E/alteracoes alheias: nenhuma encontrada. VendaRepository/VendaService e consultas paginadas preservados; vendaService.ts conserva ambos os contratos. Staging seletivo separa os blocos sem descartar o working tree.

Analise objetiva dos 38 erros anteriores: `git archive 4d84785` em copia isolada, seguido de `mvnw.cmd -Dtest=VendaServiceTest,EstoqueConcorrenciaTest test`, reproduziu 15 erros em EstoqueConcorrenciaTest e aprovou os 23 casos de VendaServiceTest. O primeiro contexto ja importava ProdutoService sem ArquivoStorageService na baseline; permaneceu sem alteracao. Os 23 erros de Venda foram introduzidos pelo novo parametro ConfirmacaoPagamentoPixService em PagamentoService; corrigidos somente adicionando o service ao @Import de VendaServiceTest. Nenhuma regra de producao alterada para satisfazer teste.

Validacao direcionada: 211 casos aprovados (95 Venda HTTP, 23 VendaService, 4 listagem, 14 ContaFinanceira, 9 ContaPagar, 29 Transferencias, 10 paginacao H2, 10 paginacao PostgreSQL, 15 ciclo PIX PostgreSQL e migrations V27/V28). PostgreSQL 18.6 descartavel com Flyway ate V28 e Hibernate validate. Dupla confirmacao e confirmacao/cancelamento repetidos tres vezes cada; retry, conta inativa, tenant, estorno individual bloqueado e rollback cobertos. Frontend: 86 testes, build, lint PDV e quatro cenarios Playwright com HTTP simulado aprovados; select nativo e listener com estado atual corrigidos.

A suite completa apos o ajuste PIX executou 687 casos, sem falhas de assercao, com 16 erros e 22 ignorados: 15 do contexto Storage anterior e uma colisao de SKU na fixture de MovimentacaoEstoqueHttpTest. O gerador `System.currentTimeMillis()` ja existia identico em 4d84785 e podia produzir duas chaves no mesmo milissegundo. Corrigido somente o sufixo dos codigos de teste para UUID, em commit proprio. Validacao final apos esse ajuste registrada abaixo. Lint global conserva quatro erros e dois avisos fora dos arquivos PDV alterados (Dashboard, Caixa, SessaoCaixaPDVDialog e formularios).

Os blocos abaixo registram validacoes historicas anteriores a esta consolidacao, nao substituindo os resultados acima.

Validacao global final apos UUID: 687 casos, 0 falhas de assercao, 15 erros de inicializacao e 22 ignorados. Todos os erros restantes pertencem a EstoqueConcorrenciaTest, com ArquivoStorageService ausente, identicos aos 15 reproduzidos na baseline 4d84785. VendaServiceTest (23), MovimentacaoEstoqueHttpTest (17) e demais testes afetados aprovados; nao declarar suite completa verde. Testes PostgreSQL condicionais foram executados separadamente e aprovados. Commits consolidados: `3070e0a` snapshot V27, `29387db` PDV e `99876cc` ciclo PIX V28; ajuste de fixture e esta validacao em commit proprio. Segredos reais nao encontrados nos diffs revisados; apenas valores ficticios de fixtures de autenticacao.

## Paginação server-side (2026-10-01)

Implementada na branch `feat/contas-pagar-integracao-backend` sobre `4d84785`, ainda não integrada à main. Vendas, Clientes, Produtos, Contas a Pagar, Movimentações Financeiras, Histórico de Estoque e Transferências usam Page/Pageable, filtros e ordenação permitida no banco, sempre com empresa do JWT e desempate por id. Contratos, limites, exceções List e índices em [paginacao.md](paginacao.md).

Frontend de Clientes, Produtos, Central de Vendas, Estoque, Contas a Pagar e Extrato usa items/totalItems, debounce e cancelamento de consultas. Totais financeiros e filtro de situação do Estoque são globais no backend. Dashboard pede cinco vendas; Caixa consulta vendas da sessão. Transferências possui consulta/service paginados, sem nova tela de listagem. Trabalho PIX/PDV e V27/V28 preservado; nenhuma regra financeira ou migration criada/alterada nesta tarefa.

Validação direcionada: matriz de consultas aprovada em H2 e PostgreSQL 18.6 (10 casos em cada banco), Flyway até V28 e Hibernate validate; 84 testes frontend, build e seis casos Playwright aprovados. Playwright usa HTTP simulado para UI; PostgreSQL valida consultas reais. Suíte backend final: 687 casos, nenhuma falha de asserção, 38 erros de inicialização e 22 ignorados. Erros concentrados em VendaServiceTest (dependência ConfirmacaoPagamentoPixService ausente no contexto) e EstoqueConcorrenciaTest (ArquivoStorageService ausente), sem alterações desses contextos nesta tarefa. Lint das telas de paginação aprovado; lint global mantém cinco erros anteriores e três avisos em Dashboard/Caixa/PDV/formulários. Commits de paginação separados do trabalho PIX ainda não consolidado; sem push.

## Financeiro Bloco 4C-A2: ciclo financeiro PIX

Implementado no working tree sobre a Parte 1, sem alterar V27/V28 ou frontend. Cancelamento de Venda/Pagamento reverte saldo PIX na conta histórica, inclusive inativa, e estorna o movimento original com auditoria, na mesma transação dos efeitos legados. Retry não repete débito. Saldo insuficiente retorna conflito e rollback integral. Estorno individual continua bloqueado pela regra existente.

Confirmação e cancelamento seguem locks operador → Venda → Pagamento → ContaFinanceira, preservando locks intermediários de estoque no cancelamento. Dupla confirmação mantém uma entrada; confirmação concorrente ao cancelamento termina sem crédito ativo de pagamento cancelado. Fechamento do Caixa não é gatilho financeiro do PIX. Detalhes em financeiro.md.

Validação: 90 casos direcionados aprovados (21 Venda/PIX/snapshot/legado, 15 ciclo PIX em PostgreSQL 18.6, 14 ContaFinanceira, 9 ContaPagar, 29 TransferenciaFinanceira, 1 V27 e 1 V28). PostgreSQL com Flyway até V28 e Hibernate validate, concorrência com operadores distintos repetida três vezes por cenário, rollback na confirmação e no estorno. Compilação Maven aprovada; suíte completa não executada. Sem V29 ou pendências deste bloco.

## Financeiro Bloco 4C-A1: confirmação financeira PIX

Backend implementado no working tree, preservando V27. Endpoint explícito de confirmação usa somente o destino do snapshot, inclusive conta histórica posteriormente inativada. Transação com locks em Pagamento/ContaFinanceira, crédito no saldo e movimento ENTRADA/PAGAMENTO_PIX vinculado; V28 garante FK tenant-safe e unicidade por pagamento. Resposta expõe confirmação e auditoria derivadas do movimento. Retry não duplica crédito. Contrato em financeiro.md.

Validação: 30 casos direcionados aprovados (10 confirmação PIX, 5 regressões de Venda/snapshot/cancelamento, 14 ContaFinanceira e 1 V28 sobre V27 em PostgreSQL 18.6). Inclui falha após persistência do movimento com rollback total. Compilação pelo Maven test; sem suíte completa. Sem alterações de frontend nesta tarefa.

Pendências originais de cancelamento/concorrência resolvidas no Bloco 4C-A2 acima. Sem confirmação automática no faturamento/Caixa, webhook ou outros meios financeiros.

## Financeiro Bloco 4B-A: snapshot histórico da configuração no Pagamento

Implementado no working tree de feat/contas-pagar-integracao-backend sobre HEAD 4d84785, inicialmente limpo, com V26 no HEAD; sem commit/push. Pagamento captura na criação nome/tipo da configuração e ID/nome do destino opcional, na mesma transação de faturamento. Campos imutáveis pela aplicação (sem setters, updatable=false) expostos adicionalmente no DTO. Mudança cadastral, retry e cancelamento preservam o histórico; Pagamento é a fonte histórica, não Venda nem configuração atual. V27 aditiva com colunas nullable e FK composta por empresa, sem inventar snapshot para pagamentos anteriores.

Validação: 103 testes direcionados aprovados (77 Venda HTTP, 23 configuração e 2 compatibilidade, mais 1 V27 em PostgreSQL 18.6). Teste central altera configuração PIX Itaú para outro nome/destino, renomeia a conta original e confirma snapshot original após retry/cancelamento. Migration verificada sobre V26 com pagamentos legados vinculados e não vinculados, todos preservados com snapshot NULL. Compilação pelo Maven test aprovada; suíte completa não executada. Sem alterações em frontend/Caixa/saldos ou novos efeitos financeiros.

Compatibilidade resolvida: snapshot do nome de destino usa VARCHAR(150), alinhado a ContaFinanceira e ao mapeamento JPA, sem truncamento. V27 ajustada diretamente após consulta ao histórico Flyway do banco persistente local novexa_erp, que continha V26 e não V27; aplicações anteriores de V27 ocorreram somente em schemas descartáveis dos testes. Nenhuma V28 criada.

Validação do ajuste final: 9 testes direcionados aprovados (8 casos de snapshot em Venda e 1 migration V27 sobre V26 em PostgreSQL 18.6), incluindo nome integral de 150 caracteres após alteração cadastral, retry e cancelamento. Compilação Maven e git diff --check aprovados. Sem pendência de tamanho do snapshot.

## Venda/Pagamento: identificação da configuração empresarial

Backend aceita configuracaoFormaPagamentoId opcional na venda direta e faturamento de venda aberta, mantendo forma global/código legado obrigatórios conforme contrato existente. Vínculo da mesma empresa, ativo e de tipo compatível, salvo em Venda e Pagamento e devolvido como ID nas respostas. V26 aditiva com FKs compostas por empresa e índices; registros antigos permanecem sem configuração. Cancelamento conserva o vínculo. Hash legado preservado sem o campo e retries com configuração diferente rejeitados.

Identificação operacional somente: nenhum novo lançamento financeiro, Recebível ou liquidação automática. Não há snapshot de nome/destino neste bloco. Frontend, Contas a Pagar/Financeiras e Caixa/fechamento não foram alterados por esta tarefa; efeitos legados preservados. Contrato em [financeiro.md](financeiro.md).

Validação: 111 testes direcionados aprovados (76 Venda HTTP, 23 VendaService, 9 cancelamento, 2 compatibilidade e 1 migration V26 em PostgreSQL 18.6). Teste de migration aplica V1–V25, insere venda/pagamento legados, aplica V26 e verifica preservação e rejeição de vínculos entre tenants. Sem suíte completa, commit ou push.

## Financeiro Bloco 3A: configurações empresariais de formas de pagamento

Backend implementado sobre `ca0f621` (V23 no HEAD), com working tree inicialmente limpo; alterações sem commit/push. Nova API cadastral isolada pelo JWT e V24 com FK tenant-safe, coerência forma/tipo/destino e nomes únicos normalizados por empresa. Permite N configurações do mesmo tipo/forma. PIX/TRANSFERENCIA têm destino cadastral BANCO/CARTEIRA_DIGITAL; DINHEIRO/DEBITO/CREDITO/BOLETO não têm destino. Cartão não movimenta ContaFinanceira e nenhum desses cadastros gera lançamento financeiro.

Forma/tipo imutáveis; conta ativa exigida ao vincular ou trocar. Vínculos posteriores com conta inativa continuam legíveis e editáveis em nome/situação, inclusive reativação cadastral mantendo o destino. A V25 acrescenta nomeNormalizado gerado/armazenado e UNIQUE por empresa/nome, sem alterar V24 ou migrations anteriores. Catálogo global permanece legível, com escrita HTTP bloqueada para usuários empresariais. Frontend/PDV, Pagamento, snapshots e fluxos financeiros existentes não foram alterados por esta tarefa; a tela antiga de catálogo dependerá de adaptação em tarefa frontend. Contrato detalhado em [financeiro.md](financeiro.md).

Validação: 46 testes direcionados aprovados (22 da configuração, 14 de ContaFinanceira, 6 de acesso ao catálogo, 3 regressões de Venda afetadas pela preparação interna do catálogo e 1 migration). V24 validada em PostgreSQL 18.6 temporário, com Flyway V1–V23 seguido de V24 e schema descartado; preservação do catálogo/saldos, nomes normalizados, múltiplas configurações, FKs e CHECK de destino verificados. Suíte backend completa e frontend não executados por escopo. `git diff --check` aprovado.

Complemento do contrato: 38 testes direcionados aprovados nesta retomada (23 da configuração, 14 de ContaFinanceira e 1 migration V24/V25 no PostgreSQL 18.6 temporário). Inclui nomeNormalizado persistido/atualizado pelo banco, preservação de configuração anterior à V25 e edição de situação com destino inativado. Trabalho paralelo de frontend/Contas a Pagar preservado, sem alterações desta tarefa nesses arquivos; sem suíte completa, commit ou push.

## Financeiro Bloco 2B: transferências entre Contas Financeiras

Implementado no working tree de `feat/contas-pagar-integracao-backend`, sobre o Bloco 2A commitado em `18ddea8`; sem commit/push deste bloco. TransferenciaFinanceira é uma operação atômica e idempotente, com exatamente dois movimentos TRANSFERENCIA vinculados, locks de contas por ID crescente e isolamento por empresa no serviço e nas FKs da V23. Estorno próprio restaura saldos e marca agregado/dois movimentos com auditoria, sem novas movimentações; permite contas inativadas e recusa destino sem saldo, repetição e estorno individual. CAIXA/ADQUIRENTE não são aceitos. Contrato e regras: [financeiro.md](financeiro.md) e [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md).

Frontend: ação Transferir na linha, drawer com origem pré-selecionada, destinos ativos funcionais, saldo disponível, UUID preservado em retry e bloqueio durante envio. Sucesso recarrega o backend; extrato mostra direção/contraparte e estorna a transferência inteira pelo endpoint próprio.

Validação: 29 cenários backend de transferência aprovados em H2 e PostgreSQL 18.6, incluindo concorrência em direções opostas, retries concorrentes e rollback por falha intermediária. Flyway V1–V23 e Hibernate validate aprovados no banco temporário, com os mesmos 29 cenários; testes específicos V23 e regressão V22 aprovados sobre fixture com histórico anterior. Regressões de Conta Financeira, vínculo bancário e Contas a Pagar aprovadas. Frontend: 80 testes, build, lint direcionado e 10 cenários Playwright (5 novos e 5 regressões) aprovados, incluindo viewport móvel.

A suíte backend completa executou 618 testes, sem falhas de asserção, com 15 erros em EstoqueConcorrenciaTest por ausência do bean ArquivoStorageService e 5 testes ignorados. A falha de contexto de Estoque já constava no estado anterior; não foi alterada neste bloco. Os testes PostgreSQL condicionais de V22/V23 foram executados separadamente e passaram. Sem integração com PIX, Recebíveis, PDV/Caixa ou Pagamento.

## Financeiro Bloco 2A: saldo inicial auditável

Sobre o baseline 602f1fe, novas contas recebem saldoInicialAuditado=true e uma ENTRADA/SALDO_INICIAL quando o valor inicial é positivo, sem duplicar saldoAtual; saldo zero não gera movimento. A V22 preserva contas antigas com flag false e não inventa histórico. Saldo inicial não é editável nem estornável individualmente. O extrato apresenta a origem e uma indicação discreta de legado; regularização histórica fica pendente. Alterações no working tree, sem commit automático.

Validação direcionada: 27 testes backend relacionados aprovados, incluindo Contas a Pagar; teste adicional da V22 aprovado em PostgreSQL 18 temporário, aplicando V19–V22 sobre fixture com histórico existente; 3 testes frontend e 2 cenários Playwright aprovados, além de build e lint direcionado. A suíte backend completa não foi repetida neste bloco.

## Financeiro Bloco 1: identidade bancária

ContaFinanceira BANCO passa a exigir ContaBancaria da mesma empresa em novos cadastros/edições; V21 protege tenant, unicidade e tipo sem invalidar legados. A identidade bancária é devolvida no DTO e exibida no formulário/listagem. CAIXA/ADQUIRENTE são restritos ao legado e permanecem no total geral. Saldo, extrato e baixa/estorno de Contas a Pagar mantêm a mesma fonte. Regras e estratégia para legado: [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md). Alterações deste bloco permanecem no working tree para revisão.

Validação: 25 testes backend relacionados aprovados, V21 testada em H2 e PostgreSQL 18 temporário sobre schema anterior com dados legados; 3 testes de service/cálculos frontend, 3 cenários Playwright, build e lint direcionado aprovados. A suíte backend completa executou 585 testes, com 16 erros em Estoque (15 por bean ArquivoStorageService ausente no contexto e um por SKU duplicado) e 3 ignorados; esses módulos não foram alterados.

## Contas a Pagar + Contas Financeiras (Fase 3A backend)

- V20 vincula a Conta a Pagar à movimentação financeira da baixa, preservando contas pagas antigas sem vínculo. `POST /financeiro/contas-pagar/{id}/pagar` exige `contaFinanceiraId`, data e valor integral; a conta financeira ativa deve ser da empresa do JWT e ter saldo suficiente. A baixa cria SAIDA de origem CONTAS_A_PAGAR e reduz o saldo na mesma transação.
- O estorno da baixa estorna a movimentação vinculada, restaura o saldo e reabre a conta; baixas legadas sem movimentação continuam estornáveis. A movimentação automática não aceita estorno pela API manual. O vínculo com a última movimentação é mantido para consulta após estorno e substituído em nova baixa.
- Frontend não alterado nesta fase: a ação de pagamento da tela atual ainda não envia `contaFinanceiraId` e receberá 400 até a integração da interface. Caixa/PDV e banco não são movimentados. PostgreSQL/Flyway real ainda não validado nesta branch.

## Contas Financeiras — base manual (branch `feat/contas-financeiras-base`)

- `/financeiro/contas-financeiras` mostra saldos por tipo, contas da empresa, cadastro/edição, situação, movimentação manual e extrato com estorno motivado. Tipo CAIXA é gerencial e não altera o Caixa/PDV operacional.
- V19 cria contas e movimentos financeiros com empresa do JWT, vínculos de tenant no banco e saldo não negativo. Entrada/saída e estorno atualizam saldo sob lock na mesma transação; movimentos não são excluídos. Conta inativa não aceita novo movimento, mas permite consulta e correção do histórico.
- Nenhuma integração automática com PDV, Caixa, Contas a Pagar ou banco foi adicionada. Validação direcionada: 10 testes backend HTTP/migration, teste de service frontend, lint direcionado e build; PostgreSQL/Flyway real não executado nesta branch.

## Contas a Pagar MVP (branch `feat/contas-a-pagar-mvp`)

- `/financeiro/contas-pagar` permite buscar, filtrar, paginar, cadastrar e editar contas abertas em drawer; pagamento, cancelamento e estorno têm ações próprias. Fornecedor é opcional e selecionado do cadastro existente; categoria é texto opcional.
- `GET/POST /financeiro/contas-pagar`, `PUT /{id}` e `POST /{id}/pagar`, `/cancelar`, `/estornar` usam exclusivamente a empresa do JWT. V17 cria `contas_pagar` e protege o vínculo opcional com fornecedor da mesma empresa. Estados: ABERTA, PAGA e CANCELADA; o estorno reabre e limpa data/valor pagos.
- A baixa é registro operacional da conta, sem movimentação bancária ou de Caixa. Recorrência, parcelamento, conciliação e DRE não fazem parte deste MVP.
- Validação direcionada: 7 testes backend (HTTP e migration), teste de contrato frontend e build aprovados.

Evolução operacional na branch `feat/contas-pagar-operacional`: V18 adiciona documento opcional; a listagem calcula indicadores, saldo e filtros financeiros localmente. Baixa exige data e valor integral para não produzir conta PAGA com saldo residual sem suporte a pagamento parcial. A condição vencida é calculada, não persistida. Validação: 8 testes backend, 2 testes frontend, lint direcionado e build aprovados; PostgreSQL/Flyway real não foi executado nesta branch.

## Detalhe operacional de sessão fechada (branch `feat/detalhe-sessao-caixa`)

- `Caixas anteriores` abre um drawer com identificação, operadores, saldos, conferência por forma e eventos operacionais da sessão, inclusive venda cancelada e estorno físico quando existente. Fechamentos legados exibem ausência de conferência por forma sem inventar valores.
- `GET /financeiro/caixas/sessoes/{id}/detalhe` reúne histórico, resumo, snapshots e eventos. `OPERADOR`/`USUARIO` legado veem apenas suas sessões fechadas; `GERENTE`/`ADMIN` veem as da empresa. O filtro também se aplica à lista e às leituras antigas de resumo/movimentações de sessões fechadas. Empresa vem do JWT.
- O contrato atual não registra horário específico de cancelamento para vendas sem estorno de dinheiro; a linha da venda cancelada usa o horário original da venda. Sem migration ou mudança de fechamento.
- Validação: 70 testes HTTP da classe CaixaOperacionalHttpTest, 75 testes frontend existentes, 1 teste frontend novo do contrato, build frontend aprovados. O lint direcionado mantém dois erros preexistentes em efeitos de `Caixa.tsx`.

## Usuários e Acessos — Fase 2 (branch `feat/perfis-operacionais`, pendente de integração)

- Novos usuários recebem `OPERADOR` por padrão. `ADMIN` gerencia usuários; `ADMIN` e `GERENTE` cancelam vendas e registram sangria/suprimento. `OPERADOR` abre Caixa e fecha apenas a sessão que abriu; gerentes e administradores podem fechar sessões de outros operadores.
- O valor persistido `USUARIO` continua aceito como operador legado, sem migration. O frontend oculta ações incompatíveis e mantém a autorização decisiva no backend. Permissões por menu não foram implementadas.
- O perfil é carregado no JWT no login; uma alteração de perfil passa a valer para o token do usuário após novo login ou expiração do token atual (padrão de 15 minutos).
- Validação direcionada: 223 testes backend e 75 testes frontend aprovados; build frontend aprovado. O lint direcionado das novas áreas passou, enquanto Caixa e Central de Vendas mantêm quatro erros de lint anteriores nas chamadas de efeitos.

## Usuários: lista e drawer (branch `feat/usuarios-drawer`, pendente de integração)

- `/usuarios` lista usuários da empresa autenticada em `AppTable` e abre drawer para cadastro, edição e redefinição de senha, com dados, perfil e situação. A lista permite ativar/inativar com confirmação.
- `POST /usuarios` exige senha; `PUT /usuarios/{id}` aceita senha ausente ou vazia para preservá-la e permite alterar `ativo`. A resposta inclui `ativo`. A empresa continua vindo do JWT; nenhuma migration foi necessária.
- `ADMIN` e `USUARIO` são os únicos perfis atuais. O backend ainda não restringe rotas ou ações por perfil; a seção Acesso da interface informa essa limitação. Não há permissões granulares ou módulo separado.
- Validação direcionada: 31 testes backend de usuários/isolamento, 70 testes frontend, build frontend e lint dos arquivos de usuários aprovados. Lint global segue com seis erros fora deste escopo.
- Correção pendente de integração na branch atual: a edição não exibe nem envia senha; a redefinição usa `PATCH /usuarios/{id}/senha` com somente a nova senha; e a situação usa `PATCH /usuarios/{id}/situacao`. A inativação do próprio usuário é bloqueada no frontend e backend, sempre no tenant do JWT.

## Fechamento de Caixa: conferência por forma de pagamento — Fase 2 frontend (2026-09-24)

- Aplicada na branch `feat/conferencia-fechamento-backend`, sobre `0da945a`, junto ao contrato da Fase 1. Somente os tres arquivos frontend da Fase 2 e este registro foram integrados; alteracoes locais do checkout principal preservadas.
- Frontend do modal "Fechar Caixa" ([Caixa.tsx](../../frontend/src/pages/Financeiro/Caixa.tsx)) confere cada forma nao dinheiro do resumo, pre-preenchida com o esperado e ajustavel pelo operador, alem do dinheiro fisico. Exibe esperado/informado/diferenca por linha e exige observacao quando ha divergencia.
- Envio usa `{saldoFinal, conferencia: {formas: [{formaPagamentoId, valorInformado}], observacao?}}`. Sessoes somente em dinheiro enviam `formas: []`, preservando snapshot e observacao no modo POR_FORMA. O tipo opcional em [caixa.ts](../../frontend/src/types/caixa.ts) mantem chamadas legadas validas.
- Erro 409 exibe a mensagem do backend, tenta atualizar o resumo e preserva os valores digitados para reconferencia.
- Ajustes de integracao restritos ao modal: envio de conferencia tambem em sessoes somente em dinheiro e uso de `sx.display` em Typography para compatibilidade com o MUI instalado. Teste de regressao atualizado em [correcoes-criticas.test.mjs](../../frontend/tests/correcoes-criticas.test.mjs).
- Validacao combinada: 24 testes frontend relacionados e suite completa de 70 testes aprovados; `npm run build` (TypeScript + Vite) aprovado; 155 testes backend relacionados aprovados (66 CaixaOperacionalHttpTest, 12 SessaoCaixaHttpTest, 68 VendaHttpTest, 9 CancelamentoVendaServiceTest). Nenhuma alteracao no backend da Fase 1.
- Lint direcionado aponta dois `react-hooks/set-state-in-effect` preexistentes em Caixa.tsx, reproduzidos no baseline `0da945a`; E2E autenticado nao executado. Alteracoes originais da Fase 2 permanecem no checkout principal, junto das demais alteracoes locais.

## Conferencia do fechamento por forma — Fase 1 backend (2026-09-24)

- Branch `feat/conferencia-fechamento-backend`, atualizada com o baseline `1b313df`; implementado na branch, pendente de integracao.
- V16 aditiva: modalidade/observacao na sessao e snapshots em conferencias_fechamento_caixa, com FK de tenant e unicidade. Fechamentos antigos classificados LEGADA sem valores conferidos inventados.
- POST de fechamento aceita conferencia opcional. LEGADA preserva saldoFinal; POR_FORMA exige dinheiro fisico e todas as formas nao dinheiro da sessao, com observacao em qualquer divergencia. Recalculo sob lock, persistencia atomica e retry equivalente sem duplicacao; alteracao retorna 409.
- Resposta inclui modalidade, observacao e linhas persistidas. Cancelamento de venda em sessao fechada permanece bloqueado para todos os meios. Contrato detalhado em [financeiro.md](financeiro.md).
- Validacao atualizada: 156 testes relacionados aprovados (66 CaixaOperacionalHttpTest, 12 SessaoCaixaHttpTest, 68 VendaHttpTest, 9 CancelamentoVendaServiceTest e 1 ConferenciaFechamentoCaixaMigrationTest). V1-V16, constraints e Hibernate validate verificados em schema temporario no PostgreSQL 18 de testes. Cobertura comprova recalculo dos esperados e desconsideracao de valores esperados forjados pelo cliente; limpeza das fixtures de sessao ajustada para respeitar as FKs.
- Suite backend completa (`mvn test`): 542 cenarios, 525 aprovados, 2 ignorados (migrations antigas condicionais) e 15 erros em EstoqueConcorrenciaTest por bean ArquivoStorageService ausente. Mesmos 15 erros reproduzidos no checkout principal `1b313df`; correcao fora deste escopo. `clean` nao executado para preservar o cluster PostgreSQL local existente em target.
- Frontend, historico detalhado, relatorios e revisao do resumo do modal permanecem fora desta fase. Nenhuma alteracao de frontend ou de configuracao de deploy.

## Consolidacao dos testes Caixa/PDV (2026-09-23)

- Branch `test/contrato-caixa-pdv`, base `dad70f2`, integrada no checkout principal por `1b313df`. Reutiliza fixtures/helpers de CaixaOperacionalHttpTest e protege o contrato de uma forma por venda.
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
