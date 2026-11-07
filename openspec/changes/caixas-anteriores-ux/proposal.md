# Proposal

## Why

A aba **Caixas Anteriores** concentra sessões encerradas em uma tabela de leitura difícil e apresenta todos os detalhes em um Drawer longo. Reorganizar a consulta e separar o detalhe em áreas nomeadas deve facilitar localizar sessões e conferir seus registros, sem alterar dados ou cálculos.

## What Changes

- Padronizar visualmente o grid de sessões encerradas com os padrões existentes de Contas a Pagar/Receber, preservando os dados, a paginação e as ações disponíveis.
- Preservar os recursos de consulta já existentes, incluindo paginação e ação de detalhes; não criar filtros ou alterar contratos.
- Substituir o Drawer de detalhes por um modal centralizado e responsivo com as abas **Resumo**, **Conferência** e **Movimentações**.
- Manter os dados e cálculos atuais, organizando-os nas respectivas abas.

## Capabilities

### New Capabilities

- `historico-caixas`: consulta visual de sessões encerradas e leitura de seus detalhes nas três abas.

### Modified Capabilities

Nenhuma.

## Impact

- Frontend da aba Caixas Anteriores em `frontend/src/pages/Financeiro/Caixa.tsx` e componentes MUI reutilizáveis, se necessários.
- Sem alterações em Caixa Atual, APIs, filtros/contratos do backend, abertura ou fechamento, regras financeiras ou migrations.
