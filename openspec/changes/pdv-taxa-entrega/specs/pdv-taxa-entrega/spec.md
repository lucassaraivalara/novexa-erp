# Spec Delta

## Purpose

Define como o PDV informa, totaliza e registra a taxa de entrega de uma venda sem misturá-la aos valores dos produtos ou criar efeitos financeiros e de estoque duplicados.

## ADDED Requirements

### Requirement: Informar e preservar a taxa de entrega no rascunho
O sistema SHALL permitir informar uma taxa de entrega monetária não negativa, iniciada em R$ 0,00, em centavos e com no máximo duas casas decimais. O valor SHALL permanecer no rascunho ao fechar e reabrir o diálogo de entrega e SHALL permanecer separado do endereço e dos itens.

#### Scenario: Informar valores em centavos
- **WHEN** o operador digita `1`, `15` ou `150` no campo da taxa
- **THEN** o PDV interpreta os valores como R$ 0,01, R$ 0,15 e R$ 1,50, respectivamente

#### Scenario: Entrega gratuita
- **WHEN** o operador mantém a taxa em zero
- **THEN** o PDV aceita a venda sem adicionar valor ao total

#### Scenario: Reabrir o diálogo
- **WHEN** o operador fecha e reabre o diálogo de entrega antes de finalizar
- **THEN** o endereço e a taxa informada continuam no rascunho, cada um em seu próprio campo

### Requirement: Totalizar a taxa junto à venda
O sistema SHALL calcular o total comercial como subtotal dos itens menos o desconto, mais a taxa de entrega, preservando as regras existentes de desconto e arredondamento por item.

#### Scenario: Recalcular total com taxa
- **WHEN** o operador altera a taxa ou os itens de uma venda
- **THEN** o resumo e a etapa de pagamento apresentam o subtotal menos o desconto mais a taxa

#### Scenario: Distribuir o pagamento do total
- **WHEN** o operador distribui o pagamento entre dinheiro, PIX, cartão ou prazo
- **THEN** o saldo a distribuir e a validação da soma consideram o total completo, incluindo a taxa

### Requirement: Validar e registrar a taxa no backend
O backend SHALL validar a taxa como valor monetário não negativo, recalcular o total a partir dos dados da venda e persistir a taxa separadamente. A ausência do campo em requisições existentes SHALL equivaler a R$ 0,00.

#### Scenario: Requisição compatível sem taxa
- **WHEN** uma requisição de venda existente não informa taxa de entrega
- **THEN** o backend processa a venda com taxa igual a zero

#### Scenario: Total enviado inconsistente
- **WHEN** o total esperado não corresponde ao subtotal menos desconto mais taxa
- **THEN** o backend rejeita a finalização sem criar venda faturada, pagamento, movimento financeiro ou baixa de estoque

#### Scenario: Taxa inválida
- **WHEN** a taxa é negativa ou possui precisão monetária inválida
- **THEN** o backend rejeita a requisição conforme o contrato de validação da venda

### Requirement: Preservar a taxa no histórico e no cancelamento integral
O sistema SHALL apresentar a taxa separadamente no detalhe histórico da venda e incluí-la no total persistido. O cancelamento integral SHALL reverter os efeitos existentes sobre o valor total da venda sem criar pagamento, lançamento financeiro ou movimento de estoque adicional para a taxa.

#### Scenario: Consultar venda faturada
- **WHEN** o usuário consulta o detalhe histórico de uma venda com taxa
- **THEN** a resposta e a interface mostram a taxa separada, o total da venda e os pagamentos existentes sem recalcular o histórico

#### Scenario: Cancelar venda com taxa
- **WHEN** uma venda faturada com taxa é cancelada integralmente
- **THEN** as reversões financeiras existentes cobrem o total da venda, incluindo a taxa, sem gerar uma reversão independente de frete

#### Scenario: Preservar estoque
- **WHEN** a taxa é cobrada ou a venda é cancelada integralmente
- **THEN** a taxa não cria produto fictício nem altera saldos ou históricos de estoque
