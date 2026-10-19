# Auditoria contínua do MVP — 2026-10-18

## Baseline e limites

Auditoria local na `main`, HEAD `e940972838a85b38681276f6ce1a9e0ca3ac468d`, também confirmado por `git ls-remote origin refs/heads/main`. Nenhum commit, push, deploy, configuração, migration ou dado de negócio de produção alterado. A única alteração de teste retoma a estabilização de paginação anteriormente autorizada; não houve correção funcional nesta auditoria.

Publicados: Usuários/V43 (`d601504`), PDV (`6be9b58`), tema (`d2d146b`), Empresas (`9f15343`) e sidebar (`e940972`). Preservados os diffs locais anteriores de AGENTS, CURRENT_STATE, paginação e lockfile; testes de busca não rastreados, referências, auditorias anteriores, vídeos e capturas não foram incluídos em publicação. A matriz de busca local não publicada foi executada como evidência do worktree, sem ser apresentada como teste já publicado.

Código atual: 43 migrations, V1–V43. V42 mantém somente estrutura técnica legada de importação; a interface permanente foi removida anteriormente. A auditoria não aplicou migrations em produção. Seções antigas de roadmap/documentação ainda descrevem funcionalidades implementadas como futuras; não foram usadas como prova de ausência.

## Correção de fixture retomada

`PaginacaoHttpTest.preparar`: dez erros reproduzidos por INSERT JDBC de Venda sem `valor_prazo`. A entidade inicializa zero em Java, mas JDBC não executa esse inicializador; H2/create-drop exige o campo. A migration PostgreSQL V36 já possui default zero. Acrescentado zero explicitamente somente na fixture, sem mudar produção, contrato, schema, expectativa ou cobertura.

Classificação dos dez erros: **fixture desatualizada**, preexistente. Sete casos de paginação/tenant/validação e três de campos, filtros e ordenação passaram após a correção. Nenhum teste foi desabilitado.

## Execuções e resultados

| Execução | Resultado |
|---|---|
| Baseline `PaginacaoHttpTest` | 10 erros de preparação reproduzidos |
| `PaginacaoHttpTest` corrigido | 10 aprovados |
| Paginação PostgreSQL + VendaListagem/VendaPrazo/VendaPersistence | 185 aprovados, 2 ignorados; zero falhas/erros |
| Backend geral `clean test`, datasource H2 explicitamente isolado | **1.457 aprovados, 581 ignorados; zero falhas/erros** (2.038 casos) |
| PostgreSQL 18 descartável, resultado final por classe | **982 aprovados, 5 falhas, 27 erros, 4 ignorados** (1.018 casos) |
| Frontend completo `node --test --test-concurrency=2 tests/*.test.mjs` | **449 aprovados**, zero falhas/ignorados |
| Backend `mvnw -o -DskipTests package` após os testes | Aprovado |
| Frontend `npm run build` | Aprovado; aviso anterior de chunk acima de 500 kB |
| Frontend `npm run lint` | Zero erros; dois avisos anteriores `react-hooks/incompatible-library` |
| `git diff --check` | Aprovado |

Backend geral executado com `spring.config.import=` e datasource `jdbc:h2:mem:novexa_suite_isolada;MODE=PostgreSQL;DB_CLOSE_DELAY=-1`, usuário sintético, driver H2 e `ddl-auto=create-drop`, evitando importar configuração local externa. Os testes PostgreSQL usam exclusivamente `127.0.0.1:55443/postgres`, usuário sintético e schemas próprios. Flyway V1–V43, Hibernate validate e inicialização completa com perfil prod foram exercitados, incluindo HTTP real dos probes locais e proteção 401.

A primeira execução conjunta PostgreSQL esgotou as 100 conexões locais por retenção de contextos/pools: 537 erros de infraestrutura, inclusive limpeza. Somente classes afetadas foram repetidas com `-Dspring.test.context.cache.maxSize=3`; o esgotamento não persistiu. Os totais finais acima consideram o último resultado de cada classe, sem somar retries como novos casos. O cluster descartável foi encerrado; um schema residual da primeira limpeza interrompida ficou apenas nesse cluster local parado.

Frontend executado com API restrita a localhost e HTTP simulado pelos testes. Isso comprova interface, não integração ponta a ponta. O smoke E2E autenticado não foi executado: não havia backend descartável exposto ao navegador com credenciais sintéticas; o script existente cria registros e não foi apontado à produção. Nenhuma cobertura nova foi criada.

## Matriz dos fluxos essenciais

“Aprovado” significa evidência automatizada local no limite indicado, não homologação em produção. “Sem evidência suficiente” não significa funcionalidade ausente.

| Fluxo | Classificação | Evidência / limite |
|---|---|---|
| Autenticação e isolamento | Aprovado | JwtAuthentication (52 H2), Usuários PostgreSQL (28), permissões e tenants nos demais grupos; prod local PostgreSQL retorna 401 sem token |
| Usuários ativos/inativos | Aprovado | 28 PostgreSQL + V43 (2), hash, revogação, proteção do ADMIN, CRUD e filtros; frontend aprovado |
| Produtos, Clientes, Fornecedores | Aprovado | Administração PostgreSQL: 36 casos funcionais; Fornecedor 37, classificação 13, fornecedor principal 8; Clientes também na matriz paginada e H2 |
| Entrada de mercadorias | Aprovado | Entrada PostgreSQL 60, XML 63 e vínculo Pagar 54; confirmação, repetição, cancelamento e rollback |
| Estoque e movimentos | Aprovado | Movimentação HTTP 24 H2, concorrência H2 e efeitos/reversões dos testes PostgreSQL de Entrada/Venda; origem persistida |
| Abertura/fechamento de Caixa | Aprovado | Sessão/Caixa operacional H2 e fechamento concorrente PostgreSQL herdado em Misto/Prazo; escopo operacional existente |
| PDV e código de barras | Aprovado | Frontend: digitação, leitor como teclado, Enter, único/ambíguo, foco e rascunho; Comercial PostgreSQL 26. Leitor físico não exercitado |
| Dinheiro | Aprovado | Venda PostgreSQL: idempotência, troco, movimento físico e rollback; frontend de pagamento aprovado |
| PIX | Sem evidência suficiente para aprovação integral | Caminhos válidos exercitados nas suítes herdadas; grupo dedicado bloqueado por fixture e casos negativos violam constraints na preparação |
| Cartão | Aprovado | Recebível PostgreSQL 19 e liquidação 70; previsão separada de saldo, baixa explícita e reversão |
| Pagamento misto | Aprovado no caminho válido | Contrato existente `pagamentos[]`; Misto PostgreSQL 136 aprovados. Três testes negativos PIX herdados bloqueados por fixture |
| Venda a prazo | Sem evidência suficiente para aprovação integral | Contrato existente de parcelas; Prazo PostgreSQL 168 aprovados, 2 expectativas antigas de migration e 3 erros PIX herdados |
| Estoque após confirmação | Aprovado | Venda/Entrada PostgreSQL: transação, insuficiência, retry e reversão; sem efeito do rascunho frontend |
| Cancelamento/reversão | Sem evidência suficiente para aprovação integral | Entrada/Pagar e cartão aprovados em PostgreSQL; ciclo financeiro completo de PIX dedicado ainda bloqueado pela fixture |
| Contas a Pagar | Aprovado no escopo existente | HTTP H2 10; vínculo Entrada/Pagar PostgreSQL 54 cobre geração/vínculo/pago/desvinculação/cancelamento e falha de estoque; não há pagamento parcial |
| Contas a Receber | Sem evidência suficiente para aprovação integral | 55 PostgreSQL aprovados, incluindo concorrência/tenant; duas expectativas de migration desatualizadas impedem aprovação integral do grupo |
| Recebíveis de cartão | Aprovado | PostgreSQL 19 + liquidação 70; estados, saldo, concorrência e cancelamento; UI aprovada |
| Fechamento por forma | Aprovado em H2; sem evidência suficiente integral PostgreSQL | CaixaOperacionalHttpTest: snapshot, divergência, dinheiro físico, formas, retry, histórico e tenant. Não foi criado novo teste PostgreSQL da conferência completa |
| Dashboard | Aprovado em H2; homologação produtiva pendente | DashboardHttpTest 2 + regressão Caixa/Dashboard: abertura não duplicada, venda, suprimento, sangria e estorno; frontend aprovado |
| Listagens/buscas/paginação | Aprovado | PostgreSQL: matriz local 121, Empresas 27, Contas Financeiras 25, Paginação 10; ausência/vazio/espaços/texto, filtros, sort, páginas e tenant |

Não foram identificadas funcionalidades centrais parcialmente implementadas a partir das falhas acima: são lacunas de validação, não autorização para recriar fluxos. Gerenciamento de Acessos granular, emissão fiscal, TEF, conciliação, cobrança/boleto avançado e offline permanecem fora do recorte atual; nenhum foi implementado. Elegibilidade de um piloto que exija emissão fiscal requer decisão de produto.

## Falhas restantes e classificação

| Local | Evidência | Classificação |
|---|---|---|
| `AdministracaoPostgresTest:50` | Espera versão 32, banco migrou a 43 | Teste desatualizado, preexistente; 1 falha |
| `ContaReceberPostgresTest:35,107` | Espera 36 migrations e 2 upgrades; reais 43 e 9 | Teste desatualizado, preexistente; 2 falhas |
| `VendaPrazoPostgresTest:40,98` | Espera V36 e 1 upgrade; reais V43 e 8 | Teste desatualizado, preexistente; 2 falhas |
| `VendaHttpTest:1216–1235`, herdado em Misto/Prazo | UPDATE direto tenta valor 0/-1 ou destino de outro tenant; PostgreSQL rejeita antes do HTTP | Fixture inválida para o schema real; 6 erros (3 por classe) |
| `PagamentoPixPostgresTest:32–42` / `VendaHttpTest:84–85` | Instância manual não recebe spy `movimentosCaixa`; reset recebe null e limpeza não termina; depois DELETE de forma conflita com FK | Fixture desatualizada; 21 erros no grupo, incluindo cascata |
| Contextos PostgreSQL conjuntos | `too many clients already`; retry com cache limitado resolveu | Infraestrutura local; não é falha de produção |
| 4 casos PostgreSQL ignorados | Métodos herdados já @Disabled; subclasses também exercitam concorrência por métodos próprios | Limite existente de cobertura; não contado como aprovação |

As falhas remanescentes foram confirmadas no código de testes sem modificações nesta auditoria; nenhuma regressão funcional foi comprovada. Não foram reduzidas expectativas, removidas constraints ou desabilitados testes para liberar a etapa.

## Produção — inspeção somente leitura

| Camada | Evidência capturada |
|---|---|
| Local / GitHub | Main `e940972`, sem diferença entre HEAD e `refs/heads/main` remoto; fixture e documentação desta execução continuam locais |
| Vercel | Deployment `2cecns7sfKqgvtLY955rLAzwonjf`, **Production / Ready / Current**, source `e940972`; domínio `https://novexa-erp.vercel.app/` |
| Frontend público | HEAD `/` HTTP **200**; `X-Vercel-Id` capturado, sem X-Request-ID nessa resposta |
| VM checkout | `9f15343eaf34e7afa7af96e89652741a25759320`; diff de backend até e940972 vazio. Cinco arquivos não rastreados antigos na VM preservados |
| Imagem em execução | `sha256:c7a96ebf3cd7760754f52bed44e30c2cdce1be8717bf407cb45390ab5dc09728`, criada 18/10 14:56 UTC; sem label de revisão Git, portanto checkout não prova sozinho o hash dentro da imagem |
| Container | `novexa-api`, running, **0 reinícios**, iniciado 18/10 14:56:33 UTC; porta somente 127.0.0.1:8080 |
| Readiness na VM | GET `/actuator/health/readiness`: **HTTP 200**, `{"status":"UP"}`, X-Request-ID `017c6f5b-1499-4b12-9418-fa44a1caeb89` |
| Autenticação da API | GET `/usuarios/pagina?page=0&size=1` sem token: **401**, X-Request-ID `5f7206a2-602a-4692-8cfa-43fe1d85db26`; não valida consulta autenticada |
| Banco / Flyway | Log real de startup: 43 migrations validadas, `public` na versão 43, sem migration pendente. Nenhuma consulta SQL manual ao banco de produção |
| Hibernate | Configuração prod `ddl-auto=validate`; log de EntityManagerFactory e startup completo confirmados |
| Variáveis | DB_URL/USERNAME/PASSWORD, JWT, CORS e três variáveis de Storage presentes; nenhum valor exposto |
| Logs capturados | Últimas 3.000 linhas: zero ERROR/FATAL e zero indícios de autenticação PostgreSQL recusada. Isso não certifica todo o histórico |

A sessão do navegador redirecionou ao login. Nenhuma senha foi solicitada/enviada, nenhum usuário/caixa/sessão/venda/pagamento criado. Smoke autenticado e indicadores com dados reais permanecem pendentes. Não inferido HTTP 200 de telas abertas.

Backup local anterior à V43 disponível em `Downloads/NovexaBackups`: dump `novexa-public-pre-v43-20261017-213450.dump`, 222.767 bytes, SHA-256 `d9ffd49733d0d1926343772636bbad4d6db7a1302daa06f3fc8b103e8f3a8b77`; hash reconferido. Metadados registram catálogo e restauração descartável aprovados. Não foi repetida restauração nesta auditoria. Backup verificável não equivale a recuperação sem perda do estado atual V43: falta backup recente restaurável e procedimento compatível com schema atual antes de intervenção. Rollback não foi executado; voltar apenas o frontend não reverte banco.

## Revisão mínima de interface

Minimal Work aplicado; Impeccable e Web Design Guidelines utilizados somente na revisão, sem redesign. Referência Olist local consultada para agrupamento e seleção; não justifica novos domínios. Testes e capturas atuais exercitam Produtos, Clientes, Fornecedores, Usuários, Empresas, Configurações, Dashboard e PDV; temas claro/escuro/automático, vazio/carregamento/erro, tabelas, paginação, foco, menus e formulários. Viewports cobertos pelos testes: 1440×900, 1366×600, 1024×640, 1024×320, 390×844, 390×480 e 320×320, conforme o grupo. Não é certificação de cada tela em todas as combinações nem teste em aparelho físico.

Capturas inspecionadas: Clientes mobile baixo, Empresas desktop, Configurações notebook, PDV notebook, modal com foco e erro de consulta. Testes de tema conferem contraste mínimo 4,5:1 dos tokens e estados selecionados; não equivalem a auditoria WCAG completa. Os 449 testes incluem shell fixo/recolhido/temporário e ausência de overflow nas dimensões verificadas. Console da aba produtiva de login: nenhuma mensagem warn/error capturada; telas autenticadas não revisadas nesta sessão.

Melhorias observadas, sem correção: `frontend/src/pages/Produtos/Produtos.tsx:234,268–278` pode mostrar alerta de falha junto de “Nenhum produto encontrado”, confundindo indisponibilidade com resultado vazio; revisar em tarefa de UX. Bundle de 1.271,97 kB minificado/377,43 kB gzip merece divisão futura medida. Sem comprovação de falha de contraste ou overflow nas amostras locais verificadas.

## Decisão e próxima ordem

**Não apto para liberar homologação integral do piloto; CONTRACT READY global pendente.** O núcleo apresenta ampla evidência local favorável, mas não se deve transformar testes bloqueados em aprovação.

1. Estabilizar somente fixtures PostgreSQL identificadas (versões-alvo, cenários inválidos e limpeza PIX), preservando validações negativas e constraints; executar esses grupos novamente.
2. Completar evidência PostgreSQL da conferência de fechamento e E2E integrado em ambiente descartável, sem usar HTTP simulado como integração.
3. Com sessão autenticada disponível, concluir inspeção produtiva somente leitura; validar empresa/perfil e indicadores sem criar dados. Homologação com mutações precisa de ambiente seguro próprio.
4. Verificar backup recente restaurável/rollback compatível com V43 antes de intervenção e definir o recorte fiscal do piloto. Não há autorização para fazer backup/deploy/alterações nesta auditoria.

Futuro, sem bloquear por si só o recorte atual: permissões granulares, otimização de bundle, metadado de revisão na imagem e reconciliação pontual das descrições históricas do roadmap. Nenhuma nova funcionalidade iniciada.
