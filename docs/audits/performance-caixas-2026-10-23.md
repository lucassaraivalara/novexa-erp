# Tarefa 13 — Performance de Caixas, 2026-10-23

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
