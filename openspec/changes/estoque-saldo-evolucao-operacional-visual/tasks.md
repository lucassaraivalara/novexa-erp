# Tasks

APPLY autorizado pelo Product Owner em 09/11/2026, em DEV_FAST. Change mantida aberta para validação visual. Dependência comum: contratos atuais permanecem estáveis; necessidade de mudança de regra ou API retorna ao Product Owner. Responsável: agente executor do APPLY, sem edição simultânea dos mesmos arquivos.

## 1. Grid, unidades e filtros de Saldo

- [x] 1.1 Refinar `Estoque.tsx` usando PageHeader/PageFilters/AppTable e padrões de ContasFinanceiras/ContasPagar, exibindo unidade junto aos saldos, números alinhados e quatro ações identificáveis; verificar UN/KG, fração 1,250, saldo negativo, Kit/Combo e motivos de indisponibilidade em testes direcionados de `tests/estoque.test.mjs`.
- [x] 1.2 Exibir filtros ativos e limpeza, distinguir carregamento/erro/catálogo vazio/nenhum resultado e preservar paginação remota, debounce e cancelamento; verificar busca por nome/código, situações existentes e atualização da página atual sem perder filtros nos testes de Estoque.
- [x] 1.3 Atualizar somente a seção afetada de `docs/architecture/frontend.md` com a apresentação efetivamente entregue; verificar coerência com a UI e ausência de afirmações de publicação ou validação ainda pendente.

## 2. Movimentação individual e mensagens

- [x] 2.1 Simplificar o contexto somente leitura dos diálogos em `Estoque.tsx`, destacar quantidade/novo saldo, unidade e previsão, preservar motivo opcional até 255 caracteres e confirmação única; verificar entrada/saída positivas, ajuste zero/fracionado e saída insuficiente com `tests/estoque.test.mjs`, reutilizando CampoQuantidade/CampoTexto.
- [x] 2.2 Isolar erros do formulário, apresentar sucesso após resposta válida e preservar dados em recusa; melhorar `obterMensagemEstoque` apenas para formatos confirmados da API; verificar texto/detail/message, fallback seguro, rede com resultado desconhecido, foco/Enter e prevenção de envio simultâneo em testes direcionados.
- [x] 2.3 Atualizar `docs/architecture/frontend.md` para feedback e teclado entregues e `CURRENT_STATE.md` somente se houver correção funcional relevante validada; verificar que motivo, regra de saldo e controles por empresa/produto continuam descritos sem alteração.

## 3. Histórico e recuperação de consulta

- [x] 3.1 Refinar o histórico em `Estoque.tsx` com contexto de produto/unidade, filtros e limpeza, paginação, período válido e mensagens locais; verificar origem, responsável, saldos, ausência de movimentos, erro/reconsulta e vínculos de entrada/venda/componentes existentes nos testes de Estoque, sem consultas por linha.
- [x] 3.2 Aplicar a mesma apresentação às partes equivalentes do histórico de `AjusteEstoqueMassa.tsx`, reutilizando código local quando reduzir duplicação sem redesenhar componentes globais; verificar troca de produto/filtros e carregamento sob demanda em `tests/ajuste-estoque-massa.test.mjs` e documentar apenas a apresentação afetada em `frontend.md`.

## 4. Ajuste em massa e importação

- [x] 4.1 Refinar seleção e conferência existentes de `AjusteEstoqueMassa.tsx`, com unidade, saldo físico, diferença e erros claros, mantendo rascunho/prévia/retorno; verificar edição que invalida prévia, ADMIN, limite 200, motivo obrigatório, itens sem alteração e novo ajuste com `tests/ajuste-estoque-massa.test.mjs` e `tests/ajuste-massa-compacto.test.mjs`.
- [x] 4.2 Refinar instruções, mensagens e conferência de CSV/XLSX, reutilizando unidade da prévia do lote e modelo existente; verificar arquivo inválido, limites 2 MiB/200 linhas, código desconhecido/duplicado, precisão, bloqueio do conjunto inválido e resultado real nos cenários de importação de `tests/ajuste-estoque-massa.test.mjs`.
- [x] 4.3 Preservar confirmação atômica, chave/payload pendentes e recuperação de 409 sem perda do rascunho; verificar cenários existentes de perda de resposta, retry, replay idempotente e ausência de sucesso antecipado nos testes do lote. Executar testes críticos backend existentes de lote/importação/isolamento/concorrência pertinentes à confirmação, sem alterar regras nem dados reais; registrar o que passou e eventuais limitações.
- [x] 4.4 Atualizar somente trechos afetados de `frontend.md` e `CURRENT_STATE.md` com o resultado validado; consultar `estoque.md` e alterá-lo apenas se houver descrição operacional realmente desatualizada, preservando as regras oficiais e auditorias históricas.

## 5. Conferência integrada do escopo

- [x] 5.1 Conferir o fluxo Saldo → operação individual → histórico e Saldo → lote/importação → atualização, em desktop e viewport estreito com teclado, temas e foco; verificar unidades legíveis, mensagens visíveis, ações acessíveis e ausência de overflow da página, usando Impeccable/Web Design Guidelines no escopo alterado, sem auditoria geral.
- [x] 5.2 Conferir compatibilidade com os cenários existentes de `tests/empresa-estoque.test.mjs` e integridade preservada, revisar diff e executar `git diff --check`; registrar arquivos alterados, testes direcionados executados e pendências, sem repetir testes aprovados sem nova mudança, nem executar build global, commit, push ou deploy automaticamente.

## Execution Notes

- Implementação local em 09/11/2026; tarefas implementadas e verificadas, aguardando homologação visual do Product Owner. Change aberta, sem arquivamento.
- 42 testes frontend distintos aprovados: estoque (9), Saldo UI (3), ajuste/importação (24), controle empresarial (4) e densidade desktop/mobile até 200 selecionados (2). Evidências sintéticas geradas pelos testes; nenhum dado operacional usado.
- 69 testes backend direcionados aprovados: movimentação (19), concorrência (15), parser (6), lote PostgreSQL (24, incluindo expansões parametrizadas), importação PostgreSQL (4) e controle/isolamento PostgreSQL (1). Rodada inicial sem URL ignorou cenários PostgreSQL; rodada final em banco temporário local executou todos, sem skips. Banco temporário encerrado.
- TypeScript e ESLint dos quatro arquivos de implementação aprovados. Diff do escopo conferido; trabalhos locais/staging preservados.
- Documentação atualizada: frontend.md e CURRENT_STATE.md. Estoque.md revisado sem necessidade de mudar regras.
- Vite disponível em http://127.0.0.1:5173/estoque. API em localhost:8080 não respondeu à verificação; uso com backend real e aprovação visual do PO permanecem pendentes. Não foram alterados dados da Mustache, backend, contratos, migrations ou dependências.

- Isolamento autorizado pelo Product Owner: quatro commits locais em branch sem checkout, com indice temporario. Teste AjusteEstoqueLotePostgresTest passou 24/24 na composicao candidata, com medicao JDBC local e sem importar a fixture de Caixa. TypeScript aprovado; validacao visual ja aprovada pelo PO. Change permanece aberta.

## Candidata de integracao para RELEASE

Base remota reconferida: 96515367b2e6c8bc79f158ebb747c5a9b3155f49. Dois commits locais planejados: teste de lote independente e delta novo de Saldo. Nao reaplicar componentes compartilhados nem V59/V60; backend de producao, seguranca, lazy loading e V61/V62/V63 permanecem identicos ao remoto. Recuperacao local 6d299eb6 e V64 excluidas.

Composicao isolada validada: 36 testes frontend direcionados e 24 cenarios do teste backend desacoplado em PostgreSQL descartavel, sem falhas/skips. TypeScript, build frontend e lint do escopo aprovados; capturas desktop/mobile conferidas. Nenhuma suite completa repetida.

Destino Vercel consultado sem publicacao: projeto novexa-erp (prj_rtyWqjFsk91WYSoJARJ9Ssgfd594), equipe team_MF8RBDQN7Aprfw49IC0fVMtn, Vite/Node 24.x, dominio novexa-erp.vercel.app. Producao READY no SHA 96515367, origem Git/main; push em main deve ser tratado como possivel gatilho de deploy. Build publicado usa tsc -b && vite build. A CLI local sem sessao autenticada foi encerrada; evidencias obtidas pelo conector autenticado e logs do deployment. Nao houve push, deploy ou mudanca de configuracao.

Change mantida aberta, 14/14 tarefas, com aprovacao visual do Product Owner. Liberacao de publicacao depende de autorizacao especifica e nova conferencia do HEAD remoto.
