# Proposal

## Why

A tela `/financeiro/contas-financeiras` reúne contas, saldos, liquidações e operações de cofre sem uma prioridade operacional clara. A evolução deve aproximar sua experiência das interfaces aprovadas de Contas a Pagar (`cb80060`) e Contas a Receber (`69f1ac6`), sem mudar o funcionamento financeiro.

## What Changes

- Organizar cabeçalho, indicadores compactos, filtros progressivos e tabela; apresentar Extrato como ação principal e ações secundárias em menu.
- Distinguir saldo registrado no ERP, valores a liquidar e dinheiro físico do PDV. Explicitar que o total global atual inclui contas inativas e tipos legados; não alterar sua agregação.
- Posicionar Cofre após a consulta, recolhido inicialmente, mantendo pendências importantes, erros e acesso à resolução visíveis fora do conteúdo recolhido.
- Apresentar criação/edição em formulário centralizado responsivo, com campos existentes agrupados e vínculo bancário compreensível.
- Preservar consultas remotas, permissões, confirmações, estados legados, histórico e atualização após ações, sem novas regras financeiras.

## Capabilities

### New Capabilities
- `contas-financeiras-operacao`: organização e apresentação da consulta, cadastro e acesso às operações financeiras existentes.

### Modified Capabilities
Nenhuma especificação consolidada existente será modificada; o inventário atual de `openspec/specs` está vazio.

## Impact

Escopo frontend: `ContasFinanceiras`, apresentação de `ContaFinanceiraDrawer`, `CofrePainel` e componentes locais relacionados, reutilizando AppTable, PageFilters, CadastroDialog e serviços atuais. Extrato, movimentação, transferência e recebimentos permanecem nos fluxos existentes; ajustes apenas de apresentação/acesso quando necessários. Sem alteração de APIs, agregações, backend, banco, migrations, dependências ou outras telas. A proposta depende de aprovação antes do APPLY; não autoriza publicação. Regras do domínio continuam em `docs/architecture/FINANCEIRO_RULES.md` e `financeiro.md`.
