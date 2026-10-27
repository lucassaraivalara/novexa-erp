# Tarefa 19D - Prevencao de performance e custos

Data: 27/10/2026. Escopo exclusivamente local, sem commit, push ou deploy.
Veredito: **PERFORMANCE GUARDRAILS READY** (local; nao publicado).

## Entrega

- AGENTS.md: secao unica e proporcional de performance/sustentabilidade, com regra explicita de avaliar correcao funcional, seguranca, performance e custo nas funcionalidades de alto impacto. Abrange campos grandes, EAGER/N+1, paginacao, polling, duplicacao, cache/invalidacao, recursos e multiplicacao por empresas/usuarios.
- Reaproveitadas as protecoes 19D ja presentes, sem refazer a Tarefa 19. Nenhuma regra financeira, lock de escrita, migration ou Estoque V59 alterado.
- RequestIdFilter: alerta WARN `http_lento` acima de 2.000 ms. Teste usa relogio monotonico simulado, sem sleep nem limiar global mutavel. Mantidos template de rota, status, duracao e MDC/request ID; nenhum payload/CPF/JWT registrado.
- PerformanceGuardrailsH2Test: SQL realmente executado sem logomarca/locks no painel; carregamento explicito da imagem; edicao sem sobrescrever imagem; login com imagem e contexto JWT leve. Fixture com Base64 sintetico de ~972 KB. Teto de 7 consultas na chamada de servico (6 de referencia + 1 de folga) e <128 KiB de texto JDBC; nao ha assercao de latencia absoluta.
- EgressSupabasePostgresTest: reforcada a medicao existente com orcamentos de <=8 SQL/painel HTTP (6 de referencia + 2 de folga), <=3 nas leituras individuais e <128 KiB por operacao na fixture de 85 vendas. Folga permite evolucao, mas rejeita as 10 consultas legadas e uma unica imagem de ~972 KB. Mantida verificacao zero SELECT com logomarca e recuperacao explicita. Bytes sao texto JDBC decodificado, nao bytes faturados.
- Polling: reutilizados 7 testes Playwright com relogios simulados (10s, latencia/sem sobreposicao, visibilidade/retorno, operacao com leitura pendente, retry, unmount, desktop/mobile). Sem alteracao funcional ou visual no frontend.

## Observabilidade e acompanhamento

Actuator/Micrometer existentes reutilizados. Novo teste HTTP real local comprova coleta de `http.server.requests` (contagem, duracao, status 401), sem tags de CPF/JWT/empresa/usuario, `/actuator/metrics` sem autenticacao retorna 401 e health retorna 200. Em prod, configuracao existente expoe somente health e nega acesso aos demais endpoints. Nao foi aberto endpoint administrativo nem instalado exportador.

Logs privados permitem contagem por template/status, duracao e alerta de HTTP lento; Hikari possui metricas de conexoes. Nao ha armazenamento historico de metricas, percentis configurados ou alerta automatico de polling. Consultas lentas devem ser acompanhadas no painel privado PostgreSQL/pg_stat_statements, quando disponivel, por queryid/calls/tempos/linhas, sem exportar SQL/dados pessoais. Nao ativados logs de binds nem extensoes em producao.

O procedimento operacional e o checklist de 9 pontos estao em [producao.md](../deploy/producao.md#checklist-preventivo-de-performance-e-custos-tarefas-com-impacto-operacional). Incluem N+1, concorrencia, testes, recuperacao e observacao pos-release.

Egress: acompanhamento manual diario no painel oficial por projeto/servico e total da organizacao; acumulado, dia, ciclo/fuso, tendencia e projecao explicitamente estimada. Patamares para 5 GB uncached: 2,50 GB (atencao), 3,75 GB (investigar), 4,50 GB (risco). Cache tem franquia propria. Referencia publica da Management API nao comprovou contrato suficiente para automatizar consumo faturado por servico; nenhum scraping/integracao artificial criado. Procedimento detalhado e fontes oficiais em producao.md.

## Validacoes

- `mvnw.cmd -q test -Dtest=PerformanceGuardrailsH2Test,RequestIdFilterTest`: 12 testes aprovados (5 + 7), sem falhas/skips; H2 descartavel.
- `node --test tests/caixa-performance.test.mjs`: 7 aprovados, zero falhas/skips.
- `npm run build`: TypeScript e build Vite aprovados; aviso preexistente de bundle >500 kB.
- ESLint de Caixa.tsx e caixa-performance.test.mjs: aprovado.
- `mvnw.cmd -q test -Dtest=EgressSupabasePostgresTest#medirOperacoesSemCarregarImagem`: 1 aprovado, zero falhas/skips, PostgreSQL 18.6 descartavel em loopback, encerrado apos o teste. Somente a medicao com novos orcamentos foi repetida; nao a suite anterior.
- `mvnw.cmd -q -DskipTests package`: aprovado.

Medicao local desta execucao (fixture sintetica, cinco repeticoes apos aquecimento):

| Operacao | SQL | SELECT com logo | Texto JDBC (bytes) |
|---|---:|---:|---:|
| Painel (85 vendas) | 6 | 0 | 20.351 |
| Produto | 1 | 0 | 128 |
| Cliente | 1 | 0 | 101 |
| Venda | 1 | 0 | 680 |
| Financeiro | 1 | 0 | 136 |

Mediana local do painel: 50,58 ms, informativa e sem criterio de aprovacao temporal; hardware/carga/cache diferem da medicao 19. Nao se afirma nova reducao produtiva. Total desta validacao: 13 testes backend e 7 frontend.

Logs locais em backend/novexa-api/target/tarefa19d-evidence e frontend/node_modules/tarefa19d-*.log. Nao foram repetidas suites globais. Evidencias anteriores de isolamento/concorrencia/cadastro da Tarefa 19 permanecem aplicaveis: codigo financeiro e empresarial funcional nao foi alterado nesta tarefa. H2 nao substitui prova de locks/snapshot PostgreSQL; testes PostgreSQL existentes continuam disponiveis.

Verificacao final: diff-check restrito aos 8 arquivos desta entrega aprovado. HEAD `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`, referencia local origin/main `2a663060865fc2d758e7bf764ae01d2f4d8dd33e`, staging (hash do diff binario) e inventario de worktrees permaneceram iguais ao inicio desta retomada. Nenhum fetch/sync, commit ou operacao de staging executado. Snapshots iniciais e verificacao em target/tarefa19d-evidence/initial-git.json e final-preservation.json; target e logs locais nao sao artefatos versionados.

## Arquivos da entrega

AGENTS.md; docs/deploy/producao.md; docs/architecture/CURRENT_STATE.md; este relatorio; backend/novexa-api/src/main/java/br/com/novexa/erp/config/RequestIdFilter.java; src/test/java/br/com/novexa/erp/config/RequestIdFilterTest.java; src/test/java/br/com/novexa/erp/controller/PerformanceGuardrailsH2Test.java e EgressSupabasePostgresTest.java (os tres ultimos relativos a backend/novexa-api).

## Limites e pendencias externas

565,105 GB e HTTP 402 sao evidencias historicas 19B/19C, nao medicao nova desta tarefa. A distribuicao faturada por servico e comparacao de periodos equivalentes precisam do painel oficial. Comparar rede total de container com um contrafactual sintetico nao comprova reducao faturada de 99,85%; projecao de ~1,75 GB/mes nao e garantia de cota nem de capacidade. Nao ha garantia de desbloqueio imediato do Storage ou de ausencia de bloqueio em qualquer plano.

Sem acesso a producao, mudanca de plano, dados Mustache, credenciais ou Storage. Upload paralelo preservado: nenhum arquivo de upload foi editado. Publicacao futura depende de autorizacao especifica e isolamento dos hunks, pois o worktree principal contem tarefas paralelas e esta atrasado em relacao a origin/main. Preparar artefato e recuperacao compativel com V59 antes de publicar, sem sincronizacao destrutiva. Monitoramento diario e atendimento aos patamares dependem do responsavel operacional; nao ha alertas de billing automaticos.
