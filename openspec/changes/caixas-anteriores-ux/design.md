# Design

## Context

`Caixa.tsx` carrega sessões encerradas pelo serviço existente, pagina a lista no frontend e abre `buscarDetalheSessao` ao selecionar uma sessão. A tabela não expõe filtros específicos e o endpoint de listagem não recebe parâmetros de filtro; não criar filtros nem alterar esse contrato neste change. O detalhe atual reúne resumo, composição de abertura, conferência, meios de pagamento e movimentações em um Drawer.

## Goals / Non-Goals

**Goals:** reutilizar `AppTable` e padrões MUI financeiros aprovados; manter seleção, carregamento, erro e cancelamento da consulta de detalhe; agrupar os dados já disponíveis em um `Dialog` com abas acessíveis e rolagem responsiva.

**Non-Goals:** alterar Caixa Atual, endpoints, DTOs, filtros inexistentes, paginação/consulta do backend, regras de caixa, cálculos ou migrations.

## Decisions

- Manter a origem dos dados e a paginação atuais; ajustar apresentação do grid, legibilidade das colunas monetárias, status e acesso à ação já existente.
- Usar `Dialog` centralizado do MUI, com largura e altura máximas adaptáveis à viewport. Usar tabs para alternar conteúdo sem perder o contexto da sessão selecionada.
- Mapear os dados existentes: **Resumo** recebe identificação, horários, operadores, valores gerais e composição da abertura; **Conferência** recebe divergência, modalidade, observação, valores por meio e avisos legados; **Movimentações** recebe a lista cronológica existente com tipo, data, valor, observação e usuário.
- Reutilizar o detalhe carregado e o fluxo atual de erro/loading. Não adicionar chamadas por aba nem recalcular os valores.
- Deixar “Caixa Atual” e os fluxos de abertura/fechamento fora dos componentes e tarefas deste change.

## Risks / Trade-offs

- [Risco] Uma tabela ampla pode exigir rolagem horizontal em telas pequenas → preservar todos os campos e ações, com rolagem contida no grid e modal adaptado para viewport estreita.
- [Risco] Dividir o conteúdo pode ocultar informações ao usuário → usar rótulos claros nas três abas e manter todos os dados atuais acessíveis.
