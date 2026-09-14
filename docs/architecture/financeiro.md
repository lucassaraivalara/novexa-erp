FINANCEIRO NOVEXA

Forma de pagamento não é destino financeiro.

DINHEIRO
→ Caixa físico

PIX
→ Conta bancária

TRANSFERÊNCIA
→ Conta bancária

DÉBITO
→ Recebível
→ liquidação
→ Conta bancária

CRÉDITO
→ Recebível
→ parcelas
→ liquidação
→ Conta bancária

BOLETO
→ Conta a Receber
→ liquidação
→ Conta bancária

## Fundação de Pagamento

Forma de pagamento, Pagamento e destino financeiro são conceitos distintos. Os destinos descritos acima permanecem como arquitetura alvo; a fundação de Pagamento não implementa suas movimentações.

- Venda mantém cliente, itens, desconto, total, status comercial, data e operador da venda.
- Pagamento registra empresa, venda, operador do faturamento, forma, valor aplicado à venda, status, data/hora, chave da requisição e sequência dentro da venda.
- A relação é `Venda 1 → N Pagamento`. O contrato atual gera somente a sequência 1; a unicidade de venda/sequência protege esse fechamento. Pagamento misto exigirá regras explícitas de composição, valores e idempotência antes de utilizar sequências adicionais.
- O único status inicial é `REGISTRADO`: informa que a declaração de pagamento foi registrada no faturamento. Não comprova recebimento externo, conciliação ou liquidação, inclusive para PIX e cartões. Estados futuros dependerão desses fluxos reais.
- Reutiliza `FormaPagamento`: DINHEIRO, PIX, CARTAO_DEBITO e CARTAO_CREDITO. Transferência e boleto permanecem futuros.
- `valor` é o valor líquido aplicado à venda, sem incluir troco. No Pagamento, `valorRecebido` e `troco` são dados operacionais exclusivos de dinheiro; ficam nulos nas demais formas.

### Integração e compatibilidade

Venda ABERTA não possui Pagamento definitivo. Ao faturar, o serviço de Venda registra o Pagamento na mesma transação de estoque, lançamento financeiro temporário e mudança para FATURADA. Locks e chave de requisição existentes são preservados; retry não cria novos efeitos. Não existe API independente para criar, editar ou excluir Pagamento nesta etapa.

Os contratos de `POST /vendas`, `POST /vendas/{id}/faturar` e a resposta atual de Venda permanecem iguais. `formaPagamento`, `valorRecebido` e `troco` continuam em Venda por compatibilidade durante a separação gradual; o Pagamento conserva seu próprio registro do fechamento. A consulta `GET /vendas/{vendaId}/pagamentos` retorna uma lista, filtrada pela empresa autenticada; venda de outro tenant retorna 404.

`LancamentoFinanceiroEntity` continua temporariamente 1:1 com Venda. Sua convenção atual (DINHEIRO/PIX = RECEBIDO; cartões = A_RECEBER) é preservada, mas não determina o status de Pagamento nem comprova liquidação. Substituir essa fundação pelos destinos oficiais exige tarefa própria.

Caixa continua sendo cadastro de dinheiro físico, sem vínculo direto com Pagamento nesta etapa. Banco, Agência, Conta Bancária, Movimentação de Caixa/Bancária, Recebíveis e Contas a Receber/Pagar não são dependências da nova entidade.

### Persistência e histórico

A V7 cria `pagamentos`, protege os vínculos de empresa/venda/operador por chaves estrangeiras e migra as vendas FATURADA existentes sem repetir estoque ou financeiro. Dados necessários ausentes ou incompatíveis com as constraints interrompem a migration, em vez de gerar informação inventada.

Nos dados legados, o operador é o criador da Venda, pois o operador efetivo do faturamento não era armazenado separadamente. A data vem do lançamento financeiro, quando existente, ou da Venda; não permite reconstruir com precisão um horário de faturamento desconhecido. Novos pagamentos registram operador e momento efetivos.
