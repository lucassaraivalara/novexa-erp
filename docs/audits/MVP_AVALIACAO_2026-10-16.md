# Avaliação do MVP e preparação da limpeza — 2026-10-16

Baseline: `main`, commit `a9164aa`. Avaliação sem alteração de código, dependências, contratos, migrations ou dados de produção. Alterações locais preexistentes em `AGENTS.md`, `frontend/package-lock.json`, `docs/references/` e `videos_referencias/` foram preservadas. Sem commit, push ou deploy nesta avaliação.

Retomada posterior com sessão autenticada: [homologação de produção e bloqueios da inspeção do banco](HOMOLOGACAO_PRODUCAO_2026-10-16.md). O registro abaixo descreve a primeira tentativa; a retomada constatou divergência de dinheiro esperado entre Dashboard e Caixa, sem correção ou limpeza.

**Resultado: avaliação local executada; homologação autenticada em produção incompleta. Limpeza não iniciada.** Não há aprovação global do MVP; as condições de segurança exigidas para executar a exclusão ainda não foram cumpridas.

## Evidências e limites

- Lidos AGENTS, SYSTEM_CONTEXT e agent-workflow; consultados frontend, estoque, financeiro, entradas, arquitetura e produção. Vendas e Caixa estão documentados em financeiro/arquitetura; não há documentos separados com esses nomes.
- Comparação com `docs/references/olist/{codex-prompt,analise-funcional,analise-visual,transcricao}.md` e frames 0001, 0021, 0025, 0030, 0037 e 0045. Os textos do analisador são hipóteses de referência, não contratos do Novexa.
- `https://erp.olist.com/` redirecionou para login. Não houve acesso autenticado à Olist. A comparação visual usa os frames locais.
- Revisados navegação, rotas, central, shell, tema, apresentação dos domínios e pontos críticos de vínculo, autenticação e isolamento. Os testes existentes exercitam os demais caminhos listados abaixo; aprovação automatizada não equivale a uso real em produção.
- Frontend: testes de componentes/fluxos com HTTP simulado. Backend: testes locais selecionados com H2 e serviços de teste; não foi executada nesta avaliação a bateria condicional PostgreSQL/Flyway.
- Produção: a abertura do Dashboard mostrou o shell autenticado inicialmente, mas a sessão expirou antes da resposta final. A aba redirecionou ao login. Solicitado novo login pelo usuário, sem solicitar senha ou extrair tokens.
- Login de produção inspecionado. Em viewport solicitado de 390×844, o DOM mediu 375 px de conteúdo/área útil, sem excesso horizontal; formulário de 297 px, dentro da tela e antes do painel institucional. Isso não homologa as demais páginas em mobile.
- Readiness público: `GET /actuator/health/readiness`, HTTP 200, `{"status":"UP"}`. `GET /financeiro/contas-financeiras/pagina?page=0&size=10&sort=nome,asc` sem token retornou HTTP 401 com `WWW-Authenticate: Bearer`. Nenhum desses resultados comprova o funcionamento da consulta autenticada.
- Console capturado na tela de login: sem erros/avisos. Não representa avaliação do console das telas autenticadas. A ferramenta disponível não expõe captura de Network nem requisição autenticada direta; status/payload dessas consultas continuam pendentes.

## Achados por domínio

“Aprovado” nesta tabela identifica somente o código/testes locais citados. Homologação de produção depende da retomada da sessão.

| Domínio | Classificação | Evidência e conclusão |
|---|---|---|
| Navegação e central | Aprovado — local | Seis áreas: Visão geral, Cadastros, Estoque, Vendas, Financeiro e Configurações no rodapé. Dashboard direto; Vender/PDV usa `/pdv`; abas por URL preservadas. Configurações destaca a área também nas URLs financeiras administrativas, sem duplicar telas. Testes de layout/rotas passaram. |
| Menu responsivo e teclado | Aprovado — local | Faixa compacta, rolagem em baixa altura, nomes acessíveis, Escape/setas e retorno de foco existentes, cobertos pelos testes. Conferência manual autenticada em notebook/mobile ainda pendente. |
| Tema automático/claro/escuro | Melhoria de UX/UI | Preferência persistida e modo automático seguem `prefers-color-scheme`. Há fundos claros fixos combinados com texto do tema escuro, e a escolha de tema não é apresentada no mobile. Ver locais abaixo. Não considerar o modo escuro integralmente aprovado. |
| Login e permissões | Aprovado — local e proteção pública | Inputs nomeados/autocomplete, bloqueio de duplo submit e erros cobertos no frontend. Segurança backend valida JWT e vínculo atual usuário/empresa/perfil. ADMIN gerencia usuários; ações gerenciais e fechamento respeitam regras existentes. Login novo e perfis em produção não homologados. |
| Dashboard | Aprovado — local | Resumo operacional real, últimas vendas e atalhos existentes; testes HTTP verificam tenant, zeros sem vendas e autenticação. Não é apenas placeholder, apesar do resumo histórico no início de CURRENT_STATE. Resposta final em produção pendente. |
| Produtos | Aprovado — local | Cadastro, busca por coluna, paginação remota, situação e relatório fixo de preços existentes. Impressão percorre todas as páginas, com bloqueio/erro em resultado incompleto, sem alterar preços/estoque. Testes passaram; impressão em produção pendente. |
| Clientes e Fornecedores | Aprovado — local | Domínios separados, manutenção e busca remota, situação e proteção por tenant. Cadastro rápido de fornecedor reutilizado. Não unificar os domínios para imitar a referência. |
| Entradas de mercadoria | Aprovado — local | Manual/XML revisado, rascunho, confirmação/cancelamento e consulta de cadastros em nova aba. Obrigação financeira explícita distingue GERADA/PREEXISTENTE, protege repetição e bloqueia efeitos indevidos; geração não baixa saldo. Testes HTTP/H2 passaram. Concorrência PostgreSQL e operação em produção não reexecutadas nesta rodada. |
| Estoque e histórico | Aprovado — local | Entrada/saída/ajuste, histórico, baixa pela venda e reversão transacional. `entradaMercadoriaId` vem dos IDs persistidos de movimento original/inverso, em lote por empresa/produto; sem interpretação do motivo. Testes de isolamento, concorrência local e rollback passaram. |
| PDV e velocidade operacional | Aprovado — local | Busca/scanner/teclado, foco, quantidade, cliente opcional, rascunho e retry preservados. Sessão própria, dinheiro/troco, misto, PIX e prazo exercitados pelos testes. Não foi medido tempo real de atendimento nem faturada venda de produção nesta avaliação. |
| Central de Vendas | Aprovado — local | Situação comercial separada de pagamentos/parcelas. Detalhe consulta vínculos financeiros sem consulta por linha; links levam à origem/filtro correspondente. Cancelamento tem confirmação e regras gerenciais. |
| Caixa e fechamento | Aprovado — local | Sessão aberta e histórico priorizados; cadastro físico secundário. Dinheiro físico separado de Contas e saldos; abertura, suprimento/sangria e conferência existentes, com testes HTTP/serviços. Nenhuma sessão produtiva aberta/fechada nesta avaliação. |
| Contas a Pagar | Aprovado — local | Vencimento, aberto e ações de manutenção/pagamento/estorno diferenciados. Baixa integral na conta financeira e origem Entrada preservadas. Não há pagamento parcial neste contrato. |
| Contas a Receber | Aprovado — local | Saldo restante, baixa parcial/total, histórico e estorno individual; origem Venda preservada. Conta a Receber não é recebível de cartão ou confirmação de PIX. |
| Contas e saldos | Aprovado — local; produção pendente | Paginação, resumo, extrato, movimentos e transferência existentes. Correção de busca nula tipada como texto está em `a9164aa`; este ensaio H2 não substitui os testes PostgreSQL anteriores nem comprova que a API Oracle implantou essa versão. |
| Erro anterior de Contas e saldos | Erro de configuração — hipótese ainda a confirmar | A implantação Java na Oracle é independente do Vercel. CURRENT_STATE registra a implantação/conferência pendente após o ajuste SQL. Sem sessão e logs da instância, não é possível afirmar nesta rodada se o HTTP 500 persiste ou se a causa é a versão implantada. Conferir imagem/commit e requisição autenticada antes de nova correção. |
| Mensagens de erro | Melhoria de UX/UI | Em Contas e saldos, erro de listagem pode coexistir com “Nenhuma conta financeira encontrada / Cadastre a primeira conta”. Após uma busca anterior, linhas antigas também permanecem sob erro. Separar indisponibilidade de resultado vazio na próxima correção autorizada. Resumo já apresenta indisponibilidade por traços, sem inventar saldo. |
| Isolamento entre empresas | Aprovado — testes locais | Suítes de usuário, empresa, produto/consulta, cliente, fornecedor, estoque, venda e financeiro exercitam tenants distintos. JWT valida existência/atividade do usuário e empresa a cada requisição. Não foi feita conferência com duas sessões de empresas reais em produção. |
| Suíte backend | Bug funcional — fixture de teste | Dez erros em `PaginacaoHttpTest.preparar:54`: INSERT de Venda omite `valor_prazo` obrigatório. Impedem a aprovação da seleção de testes. Não comprovam defeito de faturamento, não foram corrigidos e já estavam registrados no baseline. |
| Recuperação de acesso e suporte | Pendência de produto | Login informa recuperação de senha indisponível e suporte não configurado, com ações desabilitadas. Definir necessidade para o piloto, sem criar implementação nesta auditoria. |
| Documentação histórica | Pendência de produto/documentação | CURRENT_STATE começa com “Dashboard placeholder”; arquitetura/trechos antigos do financeiro ainda dizem que cancelamento, bancos, recebíveis e operação frontend são futuros, contrariando seções atuais e código. Evitar usá-los como backlog de implementação. Revisão editorial pontual permanece pendente. |

## Locais das melhorias de UX/UI

- `frontend/src/components/layout/layoutTokens.ts:51` e `frontend/src/components/ui/AppTable.tsx:257`: cabeçalho captura o fundo do tema claro na importação, enquanto o texto acompanha `text.secondary` do tema ativo. Cores definidas no código resultam em contraste aproximado 1,68:1 no modo escuro (`#B8C4D1` sobre `#F7F9FB`).
- `frontend/src/pages/Dashboard/Dashboard.tsx:107`: painel claro fixo `#F2F6F8` herda texto primário escuro-tema `#F3F6FA`, contraste aproximado 1,00:1; fundos similares em 114/180 também precisam revisão. Evidência estática; conferência visual autenticada pendente.
- `frontend/src/components/layout/Sidebar.tsx:14`: hover claro fixo sobre texto secundário do modo escuro, contraste aproximado 1,61:1.
- `frontend/src/components/layout/Sidebar.tsx:87`: preferências só existem na coluna `!mobile`; não há outro seletor no AppHeader. Disponibilizar a preferência sem acrescentar faixa de navegação.
- `frontend/src/pages/Financeiro/ContasFinanceiras.tsx:59` e `:168`: falha da consulta termina o carregamento e mantém tabela/empty state. Mensagem de ausência de dados não deve ser usada como comprovação de consulta bem-sucedida.
- `frontend/src/components/layout/MainLayout.tsx:33`: há região main, mas não foi encontrado link para pular o menu; `Sidebar.tsx:53` anima largura sem variante de movimento reduzido. Melhorias de teclado/acessibilidade secundárias, sem alterar o fluxo do PDV.

Referência adicional de acessibilidade: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), consultada nesta data. Avaliação baseada na skill local web-design-guidelines; nenhuma recomendação foi implementada.

## Comparação com a Olist

A referência mostra menu por responsabilidade, seleção visível, configurações em lista de seções e busca/filtros próximos de tabelas densas. O Novexa já reaproveita esses princípios com shell navy/verde, acesso direto a Vender, central compacta e distinção entre consulta, cadastro e operação. Relatório de preços está acessível no domínio de Produtos, sem exigir uma central genérica de relatórios.

Priorizar legibilidade do tema, disponibilidade de preferências no mobile e feedback de falha antes de mudanças decorativas. Manter ações secundárias discretas e os vínculos contextuais em nova aba. Não copiar marca/azul da Olist, banners comerciais, categorias vazias, Cliente/Fornecedor unificados, kits/variações, fiscal, compras avançadas, antecipação/conciliação ou relatório personalizável. A presença dessas opções nos frames não aprova novos módulos/regras.

## Comandos e resultados desta avaliação

| Comando | Resultado |
|---|---|
| `node --test --test-concurrency=2 tests/*.test.mjs` (frontend) | 388 aprovados, zero falhas/ignorados; aproximadamente 406 s. Não alterado o script nem o timeout dos testes. |
| Maven `-Dtest=*HttpTest,*IsolamentoTest,JwtAuthenticationTest,EstoqueConcorrenciaTest,VendaServiceTest,CancelamentoVendaServiceTest,MovimentacaoEstoqueServiceTest test` | 1.089 casos: 1.075 aprovados, dez erros de fixture, quatro ignorados; aproximadamente 4 min 13 s. |
| `npm run build` | Aprovado. Aviso de chunk acima de 500 kB: aproximadamente 1,24 MB minificado / 369 kB gzip. O aviso não mede latência de produção. |
| Maven `-DskipTests package` | Aprovado. Compilação/empacotamento independentes do resultado da suíte; não significa aprovação dos testes. |
| `npm run lint` | Zero erros, dois avisos preexistentes `react-hooks/incompatible-library` em ConfiguracaoFormaPagamentoForm e ContaBancariaForm. Não há linter Java configurado no pom. |
| `npm run test:e2e` | Um smoke ignorado por ausência de `E2E_USER_CPF`/`E2E_USER_PASSWORD`. Não conta como homologação. Não solicitadas nem registradas credenciais. |
| `git diff --check` | Aprovado. Repetido após a documentação. |

Maven executado pela distribuição 3.9.16 já instalada e com `-Dmaven.repo.local=C:/Users/lucas/.m2/repository`, sem alteração do wrapper ou dependências. Logs locais ignorados em `frontend/node_modules/.novexa-mvp-audit/`. Artefato rastreado `.last-run.json` produzido pelo smoke foi restaurado ao estado inicial, sem tocar alterações preexistentes. Manifests mantêm os hashes iniciais.

## Fase 2 — condições para a limpeza (não executada)

Não foi possível identificar no banco o usuário do CPF informado nem sua empresa. Nome mostrado pelo frontend não é prova desse vínculo. Não há acesso administrativo confirmado à VM/banco, inventário de registros de produção, dump ou restauração validada. Não foi executado DELETE, TRUNCATE, DROP, alteração de sequência ou mudança de configuração.

| Condição obrigatória | Situação |
|---|---|
| Homologação autenticada encerrada e achados apresentados | Pendente; sessão expirou e não houve retomada. Correções somente após decisão do usuário. |
| CPF normalizado corresponde a exatamente um usuário e uma empresa ativa | Não verificado. Interromper em caso de zero/múltiplos resultados ou vínculo duvidoso; não reproduzir CPF completo em documentação versionada. |
| Inventário de todos os usuários, empresas, tabelas, contagens e dependências | Não realizado em produção; manter detalhes pessoais em ambiente administrativo restrito, nunca nos logs de entrega. |
| Schema real, versão Flyway e FKs confirmados | Não confirmado em produção. As migrations V34/V35/V37 evidenciam vínculos compostos entre Entrada, itens, estoque, Conta a Pagar, Conta a Receber, Venda e usuários; não substituem `pg_catalog` do banco real. |
| Backup completo e restauração comprovada | Não criado. Nenhum arquivo ou tamanho de backup pode ser informado como existente. |
| Plano de exclusão revisado e ensaiado na restauração | Pendente do inventário/FKs e do backup. Não há ordem de exclusão aprovada ainda. |

Procedimento para a retomada, sem SQL destrutivo preparado antecipadamente:

1. Obter alias SSH/caminho de configuração segura já existente, sem enviar secrets na conversa. Conferir host, banco, schema e dedicação desse banco ao Novexa; não incluir dados de outros sistemas numa limpeza.
2. Concluir homologação com usuário autorizado e dados de teste inequivocamente identificados. Registrar saldo/estoque/caixa antes e depois do fluxo, sem confundir simulação HTTP com produção.
3. Inventariar usuário preservado por CPF normalizado, empresa e vínculo; proteger os IDs encontrados com verificações de unicidade/atividade. Inventariar demais usuários/empresas e contagens por tabela/empresa em saída restrita.
4. Consultar FKs, dependências, triggers, schemas e Flyway reais. Distinguir catálogo técnico/global e configuração mínima de dados operacionais. Não eliminar catálogo necessário ao funcionamento nem `flyway_schema_history`. Mapear referências opcionais e ciclos financeiros antes de definir qualquer sequência de exclusão; não desabilitar constraints para contorná-los.
5. Em janela controlada de escrita, fazer backup completo do banco de produção fora do checkout, com acesso restrito, checksum e proteção apropriada. Credenciais devem vir de mecanismo seguro, nunca argumento literal/log. Verificar roles/extensões necessárias à restauração e não registrar seus secrets.
6. Restaurar o backup em ambiente isolado, sem apontar para produção, sem enviar notificações ou executar tarefas externas. Conferir schema, constraints, Flyway, contagens, vínculo preservado e consultas do sistema. Apenas listar o conteúdo do dump não comprova restauração. Backup do banco não cobre arquivos de Storage; não apagar objetos sem escopo/backup específico.
7. Ensaiar a limpeza na restauração usando as FKs reais: registros dependentes e vínculos auditados antes de seus pais; cadastros operacionais depois de histórico e vínculos; usuários/empresas descartáveis por último. Proteger explicitamente usuário/empresa/vínculo preservados e configurações mínimas identificadas. Não resetar IDs nem alterar migrations. Qualquer divergência exige rollback e revisão.
8. Só então executar o procedimento revisado em produção, em transação controlada e sem concorrência de gravações. Conferir invariantes e contagens antes de COMMIT; em erro/ambiguidade, ROLLBACK. Não restaurar/apagar produção por improviso nem usar DROP DATABASE.

## Fase 3 — validação pós-limpeza (não executada)

Após eventual execução autorizada e comprovada: login do usuário preservado, empresa correta, vínculo ativo e ausência dos demais usuários/empresas; Produtos, Clientes, Fornecedores, Estoque/histórico, Entradas, Vendas/pagamentos, Caixa/sessões e Financeiro sem dados operacionais; Dashboard sem resíduos. Requisitar readiness e testar frontend com nova sessão. Conferir rejeição de acesso dos usuários removidos, inclusive token anterior em ambiente de teste controlado, sem registrar o token. O filtro atual consulta usuário/empresa no banco a cada requisição; essa inspeção não substitui a validação pós-limpeza.

Registros removidos nesta avaliação: **zero**. Nenhum usuário, empresa ou registro operacional foi alterado. Preservação seletiva ainda não executada nem verificada; toda a base permanece como estava.

## Próxima decisão

Retomar sessão autenticada e obter o acesso administrativo seguro para concluir a avaliação e preparar inventário/backup. Apresentar os achados antes de implementar correções. Prioridades: confirmar a versão da API/consulta autenticada de Contas e saldos; corrigir contraste/tema mobile e feedback de indisponibilidade em tarefa autorizada; tratar a fixture de paginação separadamente. Limpeza e aprovação do MVP permanecem pendentes.
