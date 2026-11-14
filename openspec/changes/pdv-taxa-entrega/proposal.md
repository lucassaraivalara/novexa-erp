# Proposal

## Why

O PDV já registra endereço e instruções de entrega, mas não permite cobrar esse serviço. Como o total e os pagamentos consideram apenas os produtos e o desconto, a venda não representa corretamente o valor combinado com o cliente.

## What Changes

- Permitir informar uma taxa monetária de entrega no PDV, iniciada em R$ 0,00 e mantida separada dos valores dos produtos.
- Incluir a taxa no total da venda e na validação da soma dos pagamentos.
- Persistir e apresentar a taxa separadamente no histórico da venda.
- Incluir a taxa no valor da venda e nas reversões do cancelamento integral, sem criar um segundo lançamento financeiro ou qualquer movimento de estoque.
- Preservar compatibilidade com requisições existentes que não enviam taxa, tratando a ausência como R$ 0,00.
- Manter fora desta mudança regras fiscais e de reembolso parcial. O escopo fiscal aprovado é comercial: não criar classificação tributária nem fluxo fiscal novo.

## Capabilities

### New Capabilities

- `pdv-taxa-entrega`: informar, totalizar, persistir e consultar a taxa de entrega de uma venda do PDV.

### Modified Capabilities

Nenhuma. O inventário OpenSpec não possui especificações de capacidade existentes.

## Impact

- Frontend do PDV, rascunho da venda, distribuição de pagamentos e detalhe histórico.
- Contratos de criação e consulta de venda, persistência de `Venda` e cálculo autoritativo no backend.
- Migration Flyway aditiva, condicionada à reserva formal da versão pelo responsável definido no workflow.
- Testes direcionados de totalização, pagamentos, compatibilidade, persistência, histórico e cancelamento.
- Nenhum efeito novo sobre produtos, estoque, contas financeiras ou emissão fiscal.
