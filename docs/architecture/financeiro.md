FINANCEIRO NOVEXA

## Estágios da arquitetura

**IMPLEMENTADO** descreve a base de Pagamento entregue no commit `aeaec2e`; sua integração na main deve ser conferida em [CURRENT_STATE.md](CURRENT_STATE.md). **PRÓXIMO** identifica as fundações cadastrais planejadas. **FUTURO** depende dessas bases e não faz parte do estágio atual. A ordem de execução está no [roadmap.md](roadmap.md).

## Conceitos distintos

`TipoFormaPagamento ≠ FormaPagamento ≠ Pagamento ≠ DestinoFinanceiro`.

| Conceito | Responsabilidade | Estágio |
|---|---|---|
| TipoFormaPagamento | Classificar o comportamento: DINHEIRO, PIX, TRANSFERENCIA, DEBITO, CREDITO ou BOLETO | PRÓXIMO: separação conceitual; ainda não há estrutura própria no código |
| FormaPagamento | Cadastro configurável da empresa, associado a um tipo comportamental | PRÓXIMO: o código atual utiliza somente um enum fixo com esse nome |
| Pagamento | Registro ligado à Venda, indicando forma e valor aplicado, com status e rastreabilidade | IMPLEMENTADO: fundação descrita abaixo |
| DestinoFinanceiro | Determinar onde o efeito financeiro deverá ocorrer, conforme o tipo e a configuração válida | FUTURO: Caixa, Conta Bancária ou títulos intermediários, conforme o fluxo |
| CondiçãoPagamento | Definir prazo e distribuição dos vencimentos/parcelas | PRÓXIMO: conceito planejado, sem domínio cadastral próprio implementado |

Exemplos de formas configuráveis: **PIX Sicredi → tipo PIX**, **Cartão Stone → tipo CREDITO**, **Dinheiro → tipo DINHEIRO**. O nome comercial não muda o comportamento do tipo, não identifica sozinho uma conta de destino e não comprova recebimento.

Exemplos de condições: **À vista**, **30 dias**, **30/60**, **30/60/90**. Forma responde como pagar; condição responde quando pagar. Configurar prazos não significa criar recebíveis, conceder crédito ou executar cobrança nesta etapa.

### Transição a partir do código atual

Hoje, o enum `FormaPagamento` contém DINHEIRO, PIX, CARTAO_DEBITO e CARTAO_CREDITO e cumpre a função comportamental no código. Ele não é cadastro configurável por empresa. Os nomes DEBITO/CREDITO acima são conceitos planejados; os códigos atuais da API não foram renomeados.

A próxima implementação deve separar tipo e cadastro com a menor adaptação compatível, preservando os contratos de Venda/PDV e o significado dos pagamentos históricos. Não criar tipos duplicados apenas para reproduzir nomes deste documento. Alterar uma configuração cadastral não deve reinterpretar pagamentos já registrados.

DestinoFinanceiro é um conceito de integração; não exige criar agora uma entidade genérica, vínculos bancários no Pagamento ou uma infraestrutura de roteamento. Configuração e efeitos serão definidos nas tarefas correspondentes, respeitando o contexto da empresa autenticada.

## Destinos financeiros — FUTURO

O caminho arquitetural é `Venda → Pagamento → destino financeiro futuro`. Selecionar uma forma ou registrar um Pagamento não comprova recebimento nem liquidação.

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

## Fundação de Pagamento — IMPLEMENTADO

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

## Fundações cadastrais

| Cadastro | Papel | Estágio |
|---|---|---|
| Forma de Pagamento | Opções da empresa associadas a TipoFormaPagamento | PRÓXIMO |
| Condição de Pagamento | Prazo e parcelamento, sem política de crédito ou cobrança automática | PRÓXIMO |
| Caixa | Cadastro do local de dinheiro físico | IMPLEMENTADO; reutilizar o existente |
| Banco | Identificação da instituição bancária | PRÓXIMO |
| Agência | Identificação da agência vinculada ao Banco | PRÓXIMO, após Banco |
| Conta Bancária | Conta vinculada à Agência/Banco, respeitando o escopo da empresa | PRÓXIMO, após as bases bancárias |

Dados Bancários seguem `Banco → Agência → Conta Bancária`. Cadastrar esses dados não cria saldo nem movimentação. `Cadastro Caixa ≠ Movimentação Caixa ≠ Pagamento`: Caixa é exclusivamente dinheiro físico e não deve concentrar PIX, transferências ou liquidações de cartões.

As configurações ficam na área gerencial. A operação comum continua rápida: o operador escolhe a forma; quando a integração existir, o backend determinará o destino pela configuração válida. Não pedir novamente empresa/usuário nem exigir lançamentos manuais no PDV. Condições especiais aparecem somente quando necessárias.

## Limites da evolução — FUTURO

- Depois das fundações: integração dos destinos, MovimentacaoCaixa, MovimentacaoBancaria, Recebíveis, Contas a Receber e Contas a Pagar. Cada fluxo exige tarefa própria; pagamento misto operacional também depende de regras explícitas, embora o modelo 1:N já o permita.
- Mais tarde: Carteira de Cobrança, CNAB, boleto avançado, conciliação bancária, política de crédito, bloqueios automáticos, cobrança avançada e relatórios financeiros avançados.
- Extensões comerciais futuras: portal B2B e força de vendas; não são dependências da próxima fundação financeira.

Esses itens não estão implementados pela fundação de Pagamento. Evoluir por necessidade real, sem antecipar infraestrutura ou levar a complexidade gerencial para a operação.
