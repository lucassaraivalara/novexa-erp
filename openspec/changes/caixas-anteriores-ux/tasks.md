# Tasks

## 1. Grid de Caixas Anteriores

- [x] 1.1 Ajustar hierarquia, alinhamento e apresentação das colunas do histórico usando `AppTable` e padrões financeiros existentes; verificar que campos, paginação, acesso a detalhes e recursos de consulta atuais permanecem disponíveis e que nenhum filtro ou contrato novo foi introduzido.
- [x] 1.2 Validar estados de carregamento, erro e lista vazia do grid sem alterar a consulta de sessões fechadas; confirmar por teste direcionado ou inspeção de comportamento local.

## 2. Detalhes da sessão

- [x] 2.1 Substituir o Drawer por `Dialog` centralizado e responsivo com abas acessíveis Resumo, Conferência e Movimentações; verificar que cada aba mostra os dados existentes e preserva carregamento, erros e cancelamento da chamada atual.
- [x] 2.2 Conferir que a Conferência mantém diferenças e avisos legados, e que Movimentações mantém ordenação e informações disponíveis; validar sem novas chamadas por aba nem recálculos.

## 3. Validação integrada da aba

- [x] 3.1 Validar visualmente a aba Caixas Anteriores em desktop e mobile, incluindo rolagem, navegação das abas do modal e acesso a todos os dados; confirmar que Caixa Atual e abertura/fechamento não foram alterados.

Validação visual aprovada pelo Product Owner na autorização de RELEASE. Smoke automatizado anterior em desktop e 390 px aprovado; Caixa Atual preservado na composição sobre a main remota.
