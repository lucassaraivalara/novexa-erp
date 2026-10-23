# Tarefa 13 — Performance de Caixas, 2026-10-23

## Publicação e validação real — Tarefa 13B, 2026-10-23

**CAIXAS PERFORMANCE PRODUCTION READY.** Commit funcional `3d9cf78a4cafc144c758391088c8db818be6049f`, `perf(caixas): otimiza consultas e carregamento do painel`, enviado por push normal para `main`. Vinte arquivos exclusivos de Caixas, testes e documentação; somente o trecho desta tarefa de CURRENT_STATE foi incluído. README, documentação anterior de backup/recuperação, script, imagens e vídeos paralelos preservados fora do commit. Não houve alteração de código nesta publicação.

### Ordem e recuperação

- Oracle: imagem construída com o Dockerfile existente a partir de `git archive` do commit aprovado, antes do push, sem copiar secrets/configurações locais nem alterar o checkout durante o build. Primeiro build falhou por HTTP 502 do Maven Central; repetição passou, sem alterar dependências. Imagem `novexa-api:caixas-3d9cf78`, ID `sha256:8173d95b40a7c4655782ece37b73c3be971c08b5a6856613c07501296ff8524d`, com label de revisão do commit.
- Compose existente em `/home/ubuntu/novexa-erp/backend/novexa-api`: recriado somente `novexa-api`, usando `up -d --no-build --no-deps`. Início às 13:51:53 UTC; Spring iniciou em 25,528 s. Readiness/liveness HTTPS UP antes do push. Configurações, limites, destinos e serviços restantes preservados. Imagem anterior conservada como `novexa-api:rollback-before-caixas-3d9cf78`; schema inalterado, compatível com a versão anterior. Nenhuma reversão foi necessária.
- Backup diário de 23/10 às 06:00 UTC aprovado, hashes dos três dumps conferidos. Baseline restaurado de 03:00:40 UTC continua íntegro, com resultado de restauração disponível na VM. Flyway validou 57 migrations, schema V58, nenhuma migration executada; Hibernate iniciou sem erro. Não houve repair ou escrita de diagnóstico no banco.
- Vercel: integração Git automática confirmada sem alterar configurações. Push somente depois da API saudável. Deployment `4pNt36wXDMJ9nKxVDZBUuEJbmvnv`, commit `3d9cf78`, Production Ready, build 28 s, criado às 10:56:49 Brasília. Domínio `https://novexa-erp.vercel.app`, API `https://163-176-231-214.sslip.io`, ambos HTTPS. Asset publicado `/assets/index-DOMONzFc.js` contém a API correta e `/painel`. Checkout Oracle depois atualizado por fast-forward ao mesmo commit, sem novo reinício.

Um commit posterior exclusivamente documental registra estas evidências. Caso ele acione outro build Vercel, a versão funcional continua `3d9cf78`; não exige novo build ou reinício do backend.

### Medições reais

Sessão existente autorizada pelo usuário; somente consultas, navegação e renovação normal de autenticação. Nenhuma venda, fechamento, estorno ou configuração foi executada. Volume permaneceu 189 vendas, 190 pagamentos, 49 movimentos e cinco sessões. Três aberturas completas da página publicada: **1.672, 894 e 739 ms**, mediana **894 ms**, até o resumo visível. Cronometragem externa do navegador inclui navegação e espera automatizada; não é Resource Timing nem uma medição isolada de SQL. Totais, sessão atual e 85 eventos exibidos preservados. Sem alertas ou erros JavaScript nas verificações concluídas.

| Indicador em produção | Antes | Depois |
|---|---:|---:|
| Tela com dados disponíveis | Sem cronometragem comparável; erro visível na auditoria | 894 ms, mediana de três aberturas |
| Resumo individual, mesmo contrato | 5.476 ms, mediana de 11 respostas 200 | 142 ms, mediana de 16 respostas 200 |
| Novo painel agregado | Inexistente | **107 ms**, 67 respostas 200; 91–494 ms |
| Histórico fechado | 156.407,5 ms, apenas duas respostas | 99 ms, três respostas; 71–228 ms |
| GETs de dados por atualização | Três, com sobreposição observada | Um; sem sobreposição na janela isolada |
| Corpos HTTP por atualização | 60.549 bytes, soma dos três endpoints anteriores | **16.821 bytes**, painel único |
| SELECTs por painel | Não contados em produção antes | **11**, 55 SELECTs para cinco painéis |
| Tempo SQL acumulado por painel | Não isolado em produção antes | **15,79 ms em média**, na janela isolada |

Latências anteriores são as amostras históricas de produção abaixo; a coleta posterior tem outra janela de carga, não um A/B simultâneo. Os 5.598→622 ms e 507→13 comandos continuam sendo resultados sintéticos, não devem substituir a ausência de baseline cronometrado da tela em produção. Os 16.821 bytes vêm do `body_bytes_sent` do Nginx; o comparativo anterior usa 1.098 + 5.043 + 54.408 bytes dos contratos antigos, observados antes de atualizar o frontend, já na API nova. Não inclui headers/preflights ou tráfego interno PostgreSQL.

Os três carregamentos pós-deploy fizeram exatamente `/financeiro/caixas`, `/sessoes/abertas` e `/sessoes/5/painel`, sem histórico antecipado. Preflight OPTIONS não é contado como GET de dados. Histórico exibiu as quatro sessões e abriu o detalhe da sessão #1 pelo endpoint anterior, com valores coerentes. Após abrir o histórico, o polling parou; voltou ao selecionar Caixa Atual.

Janela SQL delimitada por snapshots somente leitura de `pg_stat_statements`, sem reset: 14:05:08,986–14:06:03,122 UTC. Logs da API contêm exclusivamente cinco GETs ao painel nessa janela, todos 200. Onze fingerprints SELECT tiveram incremento de cinco cada: **55 SELECTs / 78,952 ms acumulados**. Inclui autenticação e leituras da sessão; exclui controle de transações/protocolo. Não é diretamente comparável aos 13 comandos do proxy sintético. Intervalos entre fim de uma resposta e início estimado da seguinte: **2.054–2.173 ms**, comprovando ausência de sobreposição nessa sequência.

### Segurança, operação e limites

- Sem erros de aplicação, HTTP 500 ou timeout de Hikari nos logs do container novo até a coleta das 14:06 UTC; zero reinicializações automáticas. Readiness/liveness aprovados. Três snapshots durante polling às 14:09:15–17 UTC mostraram três conexões PostgreSQL JDBC ociosas, sem bloqueadores. Limite Hikari cinco preservado. Métricas internas active/idle/pending do Hikari não são expostas: o estado observado no PostgreSQL não é um contador interno do pool, nem comprova capacidade sob qualquer carga futura.
- Consultas de integridade somente leitura: zero divergências de empresa entre pagamento/venda, movimento/sessão e sessão/caixa; Flyway V58 sem falhas e contagens financeiras preservadas. Autorização da sessão real e 401 sem autenticação confirmados. Matriz completa de perfis e outro tenant reaproveitada dos 13 testes PostgreSQL, sem criar usuários ou configurações em produção.
- Evidências dos 118 testes backend, 52/56 frontend, builds/TypeScript/lint reaproveitadas após conferir hashes de todos os arquivos rastreados da entrega contra o manifesto validado. Quatro falhas estáticas antigas continuam reproduzidas no HEAD anterior; não foram corrigidas ou ignoradas nesta publicação. Os quatro novos testes de performance frontend foram repetidos: **4/4**, sem falhas. Build Docker na Oracle e build Vercel também aprovados.
- A primeira janela estendida de coleta sofreu timeout de SSH e CDP, com aba de teste branca e sem erro JavaScript capturado. Health HTTPS permaneceu UP; reload recuperou a aba. Essa janela foi descartada para contagem SQL e repetida isoladamente com sucesso. A causa da interrupção da automação não foi determinada; não há evidência para atribuí-la a falha da API. Histórico/detalhe e polling foram novamente exercitados após a recuperação.
- Não houve instrumentação adicional, aumento do pool, cache, alteração de política financeira, migration ou escrita de teste em produção. Não se mediu tráfego PostgreSQL pós-deploy nem RTT isolado. Histórico continua sem paginação server-side e bundle mantém aviso de tamanho; reavaliar se volume/carga crescerem. A validação é da base e da janela observadas, sem promessa de latência universal.

Evidências privadas da 13B: `C:\Users\lucas\AppData\Local\Temp\novexa-caixas-deploy-tma40zl7`, incluindo manifesto inicial, staged diff, commit/arquivo de build, preflight/backup, logs de build/deploy/push, probes HTTPS, requests redigidos, tamanhos Nginx, snapshots/deltas SQL, observações do pool e integridade. Nenhuma credencial incluída no Git. Os registros abaixo preservam o diagnóstico e a validação local anteriores à publicação.

## Resultado e escopo

**CAIXAS PERFORMANCE READY — implementação local, publicação pendente.** Gargalo observado em produção identificado e reproduzido com volume e tamanho de logomarca equivalentes, exclusivamente com dados sintéticos em PostgreSQL descartável. Não significa performance pós-deploy comprovada: nenhum commit, push, deploy, migration ou configuração de produção foi executado.

Baseline `main`, HEAD `55a1ec8f40088ee45955f42db4b24443e14a69de`, preservado. Alterações anteriores de execução local/backup, imagens, vídeos e demais untracked preservados. Não houve consulta ou escrita financeira real para exercitar o sistema.

## Diagnóstico comprovado em produção

Consulta somente leitura via infraestrutura existente, com TLS verificado, `default_transaction_read_only=on`, statement timeout de 5 s e lock timeout de 1 s. Apenas agregados, estado das conexões e logs limitados; sem EXPLAIN ANALYZE em produção, alteração de parâmetros, cancelamento de queries ou reinício remoto.

- Base do cliente: 1 Caixa, 5 sessões (4 fechadas/1 aberta), 189 vendas, 190 pagamentos, 49 movimentos físicos. Sessão aberta: 85 vendas/86 pagamentos.
- Logomarca da empresa: **971.611 bytes** no campo TEXT `empresas.logomarca`.
- Hibernate materializava entidades completas para cálculos e eventos. Relações EAGER entre Pagamento, Venda, sessão, Caixa, usuário e Empresa transportavam repetidamente a logomarca. O DTO HTTP pequeno ocultava um resultado SQL muito maior.
- `calcular()` carregava entidades de todos os pagamentos/movimentos. A listagem de fechadas repetia o cálculo por sessão. A timeline usava `/vendas/por-sessao/{id}`, que monta detalhe completo de cada venda, incluindo itens/contas/consumos não usados na tela.
- React aguardava abertas/cadastros/**todo histórico** em um Promise.all antes de selecionar o Caixa Atual. Depois disparava três GETs a cada **2 segundos**, mesmo quando a rodada anterior não havia terminado.
- PostgreSQL apresentou consultas ativas em `ClientWrite`, incluindo observações acima de 200 e 400 segundos, sem bloqueadores. Isso é espera para enviar dados ao cliente, não evidência de falta de índice.
- Hikari: `total=5, active=5, idle=0`, com timeouts medidos de 5.000–5.002 ms. Amostra limitada de logs continha 146 mensagens desse timeout; não é contagem de todos os incidentes.
- Snapshot Oracle: load average 0,26/0,20/0,10, aproximadamente 10,6 GiB disponíveis, container 700,5 MiB/2 GiB e CPU 9,10%. Não havia evidência de saturação de CPU/RAM da VM como causa principal naquele instante; não é dimensionamento contínuo.

Tempos reais do `RequestIdFilter`, amostra limitada dos logs de produção, anteriores à correção:

| Rota | Respostas 200 na amostra | Mediana | Máximo |
|---|---:|---:|---:|
| `/financeiro/caixas` | 1 | 131 ms | 131 ms |
| `/financeiro/caixas/sessoes/abertas` | 1 | 93 ms | 93 ms |
| `/financeiro/caixas/sessoes/fechadas` | 2 | 156.407,5 ms | 307.933 ms |
| `/financeiro/caixas/sessoes/{id}/resumo` | 11 | 5.476 ms | 547.429 ms |
| `/financeiro/caixas/sessoes/{id}/movimentacoes` | 28 | 1.700 ms | 278.708 ms |
| `/vendas/por-sessao/{id}` | 21 | 3.077 ms | 238.488 ms |

Também houve 500 nas três rotas periódicas: 14/8/6 respostas, respectivamente, na amostra. A página publicada mostrou a mensagem genérica de erro e permaneceu com dados anteriores visíveis. As duas observações de histórico não constituem uma distribuição estável de latência.

O Nginx existente não registra duração por upstream. Resource Timing do navegador assistido não estava disponível. Não foram medidos isoladamente DNS, TLS, RTT navegador–Vercel, Oracle–Supabase ou aquisição bem-sucedida de conexão Hikari. Os 5 segundos acima são espera esgotada no pool; não devem ser confundidos com tempo de SQL ou RTT.

## Reprodução e medições antes/depois

Cluster PostgreSQL 18.6 novo, em loopback, porta 65485, banco **novexa_caixas_performance_test**, Flyway V1–V58 e Hibernate validate. Nenhuma cópia de dados do cliente utilizada. Fixture principal: 189 vendas/190 pagamentos, 4 sessões fechadas e 1 aberta com 85 vendas, outro tenant isolado, pagamentos mistos, e logomarca sintética com exatamente 971.611 bytes. Movimentos da fixture são representativos, não reprodução integral da escrituração do cliente.

JAR anterior preservado e JAR posterior executados separadamente, mesma máquina/dataset/configuração. Proxy TCP privado em loopback conta bytes recebidos do PostgreSQL e execuções do protocolo; não modifica SQL nem introduz atraso artificial. Contagens incluem controle transacional/driver e **não são exclusivamente SELECTs**. Três amostras por endpoint, mediana. Proxy e banco não acessam produção.

Componente React real em Chromium headless, Vite e ThemeProvider, dados por HTTP real da API descartável; roteamento do teste altera somente destino/CORS para esse ambiente. Medições da tela são desse componente, sem layout global e sem tráfego Vercel/Oracle/Supabase. Não são tempos pós-deploy da URL publicada.

| Indicador reproduzido | Antes | Depois |
|---|---:|---:|
| Tela com resumo/timeline disponíveis, mediana | **5.598 ms** | **622 ms** |
| Primeiro conteúdo pintado, mediana | 592 ms | 364 ms |
| Requisições até disponibilizar os dados | 9 | 3 |
| Requisições por atualização periódica | 3 | 1 |
| API: resumo individual, mediana | 1.782,50 ms | 64,84 ms |
| API: movimentos individuais, mediana | 588,64 ms | 36,24 ms |
| API: histórico fechado, mediana | 2.592,24 ms | 61,67 ms |
| API: novo painel com as três informações | Não existia | 73,40 ms |
| Comandos de banco por atualização | **507** | **13** |
| Bytes PostgreSQL → API por atualização | **659.171.226** | **5.863.749** |
| JSON HTTP por atualização | **52.282 bytes**, três respostas | **16.365 bytes**, uma resposta |
| Query principal de vendas, EXPLAIN ANALYZE, 85 linhas | 0,296 ms | 0,112 ms |

Redução do tempo de dados da tela: **88,9%**, no ensaio. Redução de tráfego banco–API: aproximadamente **99,1%**. A primeira pintura é influenciada por transformações/caches do Vite e não é a principal prova da correção. Os tempos dos três endpoints antigos não devem ser somados para representar seu Promise.all; são medições individuais. A comparação de tráfego soma os três resultados necessários anteriormente e compara com o painel único.

Controle adicional com mesmo JAR anterior/volume, removendo a logomarca **somente na fixture**: resumo caiu para 179,52 ms/232.599 bytes, histórico para 203,43 ms/416.146 bytes e vendas para 130,15 ms/91.902 bytes. A logomarca foi restaurada antes de medir a correção. Isso demonstra por que comparar apenas quantidade de vendas ou localhost com empresa sem imagem seria insuficiente.

EXPLAIN ANALYZE/BUFFERS foi executado apenas na cópia sintética. A query principal antiga e a projeção nova retornaram as mesmas 85 vendas; a consulta pontual de entidade também foi analisada. Tempos de execução do banco eram pequenos diante do transporte/hidratação. As projeções preservam empresa/sessão/status e utilizam índices existentes como alternativas do planejador; scans sequenciais em tabelas pequenas não justificam índice novo. Os planos não incluem todas as consultas secundárias do ORM nem seu tráfego de resultados.

## Implementação

- Projeções escalares em `PagamentoRepository` e `MovimentacaoCaixaRepository` para o cálculo existente, com mesma ordenação, snapshots, tratamento de cancelamento e aritmética monetária. Nenhuma materialização de Venda/Empresa por pagamento ou movimento nesse cálculo.
- Movimentos retornados diretamente como o DTO existente; validação de existência/acesso por projeção curta, mantendo 404/403 e empresa do JWT.
- `VendaRepository.listarTimelineCaixa`: somente id, dataHora, total, formaPagamento e usuarioNome, ordenação data/id, FATURADA e filtro por empresa/sessão. Sem itens, contas a receber ou dados pessoais extras.
- **Novo GET `/financeiro/caixas/sessoes/{sessaoId}/painel`**: `{resumo, movimentacoes, vendas}`. Mesma autorização das leituras operacionais e **mesmo lock pessimista/refresh do resumo**, mantido até o commit da leitura agregada. Endpoints anteriores continuam disponíveis; não há alteração no contrato de detalhe de Venda/PDV.
- Frontend usa o painel único. O histórico é consultado quando a aba Caixas Anteriores é aberta, com loading, erro e retry próprios; não bloqueia Caixa Atual.
- Polling mantém 2 segundos entre a conclusão de uma rodada e a próxima, sem sobreposição periódica. Ao trocar sessão/aba ou desmontar, cancela requests/timeout. Histórico interrompe polling do Caixa Atual. Atualizações explícitas após ações continuam existentes.
- Sem cache, dependências, migrations, índices, mudanças de scheduler, estoque, liquidação, faturamento, fechamento ou política financeira.

Backend/DTOs: `CaixaOperacionalController.java`, `CaixaOperacionalService.java`, `SessaoCaixaRepository.java`, `PagamentoRepository.java`, `MovimentacaoCaixaRepository.java`, `VendaRepository.java`, `PainelSessaoCaixaDTO.java`, `VendaSessaoCaixaDTO.java`.

Frontend: `pages/Financeiro/Caixa.tsx`, `pages/Financeiro/caixaTimeline.ts`, `services/caixaService.ts`, `types/caixa.ts`. Fixtures existentes de `caixa-abertura.test.mjs` e `caixa-detalhe.test.mjs` ajustadas ao agregado, preservando suas asserções operacionais. Novos testes: `CaixaPainelPostgresTest.java` e `caixa-performance.test.mjs`.

## Validações

| Suíte/verificação | Resultado |
|---|---|
| CaixaPainelPostgresTest, HTTP real/PostgreSQL/Flyway/Hibernate | **13/13**, sem skips |
| CaixaOperacionalHttpTest | **72/72** |
| SessaoCaixaHttpTest | **14/14** |
| CaixaHttpTest | **19/19** |
| Frontend, cinco arquivos relacionados/ampliados | **52/56**; quatro falhas preexistentes detalhadas abaixo |
| Paridade exata do ensaio antes/depois | Histórico, saldos/totais, movimentos e cada campo usado na timeline idênticos |
| Oito GETs concorrentes ao painel, quatro workers | Oito 200, respostas idênticas; 94,54–246,10 ms na coleta |
| Build backend | Package aprovado; bloqueio inicial de JAR aberto resolvido encerrando somente o processo local anterior |
| Build frontend/TypeScript | Aprovados |
| ESLint global | Zero erros; dois avisos anteriores de React Hook Form |
| Revisão UI dirigida/detector e diff check | Desktop/mobile aprovados; zero achados do detector; `git diff --check` aprovado |

PostgreSQL cobre todos os perfis em sessão aberta, regra de responsável/ADMIN/GERENTE no fechamento, tenant externo 404, sem autenticação 401, estorno/suprimento/sangria e saldo inicial contado uma vez. Budget de statements/materialização permanece constante ao passar de 85 para 185 vendas, com logomarca grande. Não há teste cronometrado frágil como critério de sucesso: a regressão fixa o número de statements e entidades carregadas; o tempo real vem do ensaio separado.

Frontend cobre desktop 1440/mobile 390, três chamadas iniciais, histórico sob demanda, ausência de sobreposição em resposta lenta, suspensão do polling na aba histórica, retry isolado e preservação da tela atual. Sem erros JavaScript nesses testes.

### Falhas anteriores, não corrigidas nesta tarefa

Quatro testes de `frontend/tests/correcoes-criticas.test.mjs` falham tanto no estado atual quanto com **as mesmas asserções sobre os arquivos originais do Git HEAD**, materializados somente em memória pelo coletor temporário:

1. Modal de fechamento: exige texto literal de mapa DEBITO/CREDITO que já não estava naquele arquivo.
2. Formulários/autofocus: exige expressão antiga de ProdutoForm.
3. Campos visuais de Produtos: exige heading antigo de identificação.
4. Conferência de fechamento: exige a montagem antiga de conferência/preenchimento automático, anterior à extração e às políticas atuais.

Não são regressões desta entrega, não foram ignorados para declarar a suíte inteira verde e nenhum teste foi removido/enfraquecido. Permanecem pendências da manutenção da suíte. A validação funcional de Caixa acima passou; alterações nesses contratos/regras ficam fora desta otimização.

## Evidências, limites e publicação

Coleta privada local: `C:\Users\lucas\AppData\Local\Temp\novexa-caixas-performance-7q9g9fwv`. Principais arquivos: `production-aggregate-before.json`, `production-query-waits.json`, `production-http-timings-before.json`, `infrastructure-before.json`, `before/after-api-metrics.json`, `before/after-ui-metrics.json`, `comparison-summary.json`, respostas JSON, planos `*-explain-*.json`, `concurrent-read-proof.json`, relatórios Maven/frontend e `baseline-static-tests.log`. Tokens presentes no harness são exclusivamente sintéticos, sem valor fora do banco descartável. Não copiar dados/credenciais operacionais para o Git.

- O painel ainda carrega o necessário para o lock/refresh da sessão e a autenticação; existem bytes da empresa nessa etapa. A mudança remove o crescimento por venda/movimento, sem alterar o domínio compartilhado ou a segurança para eliminar cada byte restante.
- Histórico continua sem paginação no servidor e com cálculo por sessão, porém sob demanda e com projeções. Quatro sessões fechadas do cliente não justificaram migração/refatoração adicional; medir novamente se esse histórico crescer significativamente.
- A origem da logomarca e sua política de armazenamento não foram modificadas; comprimir/substituir a imagem do cliente seria alteração de dados, não solução para os fetches redundantes.
- Avisos anteriores de bundle grande e Mockito/JDK permanecem. Não foi executada a suíte completa de todos os módulos.
- **Publicar backend antes do frontend**, pois o frontend novo precisa de `/painel`; backend preserva endpoints antigos. Conferir smoke autorizado e métricas reais depois de publicar, sem operações financeiras de teste em empresas reais. Nenhuma migration/repair de schema é necessária; Flyway permanece V58.
- Não existem tempos “depois” de produção nesta tarefa. A reprodução equivalente, a paridade e os testes permitem integração técnica; a confirmação da melhora na URL publicada depende do deploy autorizado e da observação posterior.

Ao encerrar a coleta, somente API/proxy/cluster descartáveis foram parados, preservando os arquivos de evidência. Backend local com o JAR validado e Vite foram deixados ativos em `http://localhost:8080` e `http://localhost:5173`; não houve reinício de serviços remotos. A interrupção de oito horas do Windows entre as etapas expirou os tokens sintéticos, que foram renovados apenas no harness; não afetou usuários ou credenciais reais.
