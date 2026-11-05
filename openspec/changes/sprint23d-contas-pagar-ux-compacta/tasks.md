# Tasks

Base 23D: APPLY autorizado e implementação local concluída; aprovação visual/operacional do Product Owner ainda pendente. Refinamento 23D.1 aprovado como escopo e especificado abaixo, ainda não implementado; esta atualização não inicia APPLY. Nenhuma autorização de release ou arquivamento. Ownership segue agent-workflow.md; responsabilidades abaixo não solicitam execução paralela automática.

## 1. Frontend funcional — listagem e filtros

- [x] 1.1 Em ContasPagar, apresentar Descrição, Valor original, Desembolsado e Saldo pendente, preservando valores da API e situação parcial/vencida.
- [x] 1.2 Tornar Pagar textual e evidente para obrigações elegíveis, sem alterar outras tabelas ou suas permissões.
- [x] 1.3 Reorganizar filtros existentes em básicos e Mais filtros; preservar critérios recolhidos, sinalizar ativos e manter limpar/paginação/descarte de respostas obsoletas.

## 2. Frontend funcional — indicadores

- [x] 2.1 Preservar cinco indicadores globais e explicar abrangência e faixas cumulativas inclusivas de 7/30 dias.
- [x] 2.2 Separar carregamento/erro do resumo das consultas auxiliares; distinguir zero confirmado e ausência de movimento, oferecendo retry sem polling ou chamadas duplicadas.

## 3. Frontend funcional — detalhe e ações financeiras

- [x] 3.1 No drawer, organizar resumo legível e histórico paginado, mantendo cadastro/edição e informações legadas disponíveis sem inferir dados ausentes.
- [x] 3.2 Encaminhar estorno agrupado da listagem para seleção explícita da baixa no histórico; identificar operação, valores e motivo na confirmação, preservando autorização e caminho legado.
- [x] 3.3 Preservar o modal 23C: integral padrão, parcial explícito, principal/desembolso/residual, múltiplas origens e recuperação com UUID; atualizar detalhe/lista/resumo/saldos relevantes após sucesso.

## 4. Refinamento visual — componentes afetados

- [x] 4.1 Após estabilizar comportamento, ajustar somente densidade, alinhamento, hierarquia e responsividade dos componentes da tela, seguindo MUI/identidade Novexa e mantendo navegação por teclado e rótulos acessíveis.

## 5. Engenharia e validação — escopo proporcional ao risco

- [x] 5.1 Adicionar testes direcionados para nomenclatura/valores, filtros recolhidos e ativos, estados dos cinco cards, retry isolado e filtros rápidos.
- [x] 5.2 Executar regressões frontend pertinentes da 23C: integral/parcial/multiorigem, erro incerto/UUID e seleção do ID correto no estorno anterior, sem alterar regras backend. Se houver necessidade de mudar contrato/regra, interromper essa ampliação e retornar ao Product Owner.
- [x] 5.3 Conferir build/TypeScript/lint dos arquivos afetados e ausência de polling, dependências extras, histórico por linha ou regressão lazy; não repetir suíte global ou Performance Gate sem evidência de necessidade.
- [x] 5.4 Conferir desktop 1366×768 e mobile 390×844 e apresentar evidências focadas para validação do Product Owner sobre densidade, hierarquia, filtros, Pagar e histórico; registrar limitações reais.
- [x] 5.5 Atualizar somente documentação afetada com o resultado efetivo; conferir diff e preservação de staging, HEAD, worktrees e trabalhos paralelos. Não realizar commit, push ou deploy.

## Resultado da execução local

Evidências históricas da base 23D, não da 23D.1:

10 testes frontend distintos aprovados (6 UX, 3 parciais, 1 integral/multiorigem), build/TypeScript e lint dos componentes afetados aprovados. Backend e migrations não alterados ou revalidados nesta etapa exclusivamente frontend. Capturas sintéticas em docs/audits/assets/sprint23d/{lista,detalhe}-{1366,390}.png; o shell global autenticado não foi usado. Logs locais em frontend/node_modules/sprint23d-*.log. A tabela mantém rolagem horizontal contida; captura após pagamento pode exigir retorno horizontal para consultar as primeiras colunas. Conferência do Product Owner permanece necessária, sem declarar aprovação visual já obtida.

## 6. Refinamento 23D.1 — frontend visual e funcional existente

- [x] 6.1 Reorganizar os campos atuais do cadastro em grade horizontal responsiva com grupos claros; preservar validações, valores e navegação do painel, sem novos campos.
- [x] 6.2 Compactar o modal de pagamento com resumo financeiro e origens bem relacionados, residual destacado e ações acessíveis; preservar integral/parcial, encargos, UUID e recuperação de erros.
- [x] 6.3 Refinar leitura cronológica do histórico e vínculo baixa/estorno, distinguindo datas disponíveis e preservando paginação, seleção explícita e auditoria, sem endpoints ou dados inferidos.
- [x] 6.4 Refinar hierarquia, alinhamentos e ações da tabela no escopo da página, preservando indicadores/filtros e componentes Novexa, sem reproduzir funcionalidades do Athom.

## 7. Refinamento 23D.1 — validação após APPLY autorizado

- [x] 7.1 Executar testes frontend direcionados ao cadastro/pagamento/histórico/tabela alterados e regressões pertinentes 23C/23D, incluindo retry idempotente, multiorigem, parcial e estorno selecionado; verificar build/TypeScript/lint conforme alterações, sem suíte global.
- [x] 7.2 Conferir desktop 1366×768 e mobile 390×844, teclado, rolagem/foco e ausência de requisições adicionais, polling, dependências ou regressão lazy; apresentar evidências focadas ao Product Owner sem tratar aprovação anterior como validação da 23D.1.
- [x] 7.3 Registrar resultado efetivo e pendências, conferir preservação dos trabalhos paralelos e aguardar validação operacional do Product Owner; não arquivar, publicar ou iniciar outras Sprints.

## Resultado do refinamento 23D.1

Implementação local concluída em 05/11/2026, mantendo a change aberta. 14 testes frontend distintos aprovados: dez UX (incluindo quatro novos casos de cadastro/pagamento nas duas resoluções), três parciais e um integral/multiorigem. Dois casos novos falharam inicialmente por seletor exato do label obrigatório; corrigido somente o seletor para o name existente e reexecutados com sucesso. Histórico/estorno anterior tem asserts adicionais aprovados. Build/TypeScript, lint dos quatro componentes e detector visual sem achados determinísticos. Sem repetição de suítes backend ou gate geral de performance.

Capturas sintéticas em docs/audits/assets/sprint23d1/: cadastro-{1366,390}.png, pagamento-{1366,390}.png, historico-{1366,390}.png e lista/detalhe. Desktop: cadastro horizontal e pagamento em duas colunas; mobile: empilhamento, rolagem interna e rodapés acessíveis. Não houve validação produtiva nem alegação de aprovação do Product Owner. As fixtures permitem redirecionar capturas por NOVEXA_TEST_ASSETS para preservar evidências anteriores.

Arquivos de UI: ContaPagarDrawer.tsx, PagamentoContaPagarDialog.tsx, PagamentosContaPagar.tsx e ContasPagar.tsx. Formulários continuam usando os mesmos campos, cálculos, handlers e serviços. Histórico respeita dataPagamento descendente da API e mantém o estorno vinculado à baixa original; não carrega outras páginas para ordenar ou inferir saldos. Nenhuma alteração em backend, schema, dependências, rotas, timer ou requests. Logs em frontend/node_modules/sprint23d1-*.log; preservação conferida contra snapshot inicial, índice e HEAD mantidos.

Product Owner: em http://localhost:5173/financeiro/contas-pagar, conferir Nova conta, Pagar integral/parcial e múltiplas origens, hierarquia da tabela e datas/estorno no histórico. Usar somente dados locais autorizados; abertura e preenchimento podem ser avaliados sem salvar/confirmar. Aguardando avaliação visual e operacional, sem arquivar ou publicar.


## 8. Ajuste final autorizado e fechamento

- [x] 8.1 Remover a coluna Pagamento e apresentar Pagar primeiro em Ações, somente para contas elegíveis, preservando ações secundárias.
- [x] 8.2 Validar a tabela e a composição integrada 23C/23D/23D.1: 32 testes frontend e teste adicional de posição/ausência da coluna; build/TypeScript e lint aprovados. Backend: 74 casos financeiros aprovados, um opt-in não executado, mais dez HTTP aprovados. Fixtures de migração corrigidas para schema único e seleção de dados equivalentes à V62.

Product Owner aprovou a interface com este ajuste final em 05/11/2026 e autorizou VALIDATION/RELEASE condicionado aos gates. A change permanece aberta; publicação e limitações efetivas devem ser consultadas no relatório de release.
