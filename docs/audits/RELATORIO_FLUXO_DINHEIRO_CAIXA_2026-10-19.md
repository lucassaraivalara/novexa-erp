# Fluxo do dinheiro e destino após fechamento do Caixa

Data: 19/10/2026. Código inspecionado: `main`, commit `746cd3f`.

Escopo: análise da implementação e das regras documentadas. Sem acesso a banco, VM ou produção; sem leitura de secrets, execução de venda, fechamento, movimentação ou novos testes. Os exemplos abaixo são ilustrativos. Este documento não é uma auditoria dos valores de uma sessão específica.

## Conclusão

O Novexa registra a entrada e a saída de dinheiro durante a sessão e salva a conferência do fechamento. Ainda não há uma operação vinculada que identifique o destino do numerário após o encerramento: cofre, depósito bancário, responsável pela guarda ou próxima sessão.

Fechar a sessão grava o valor contado, operador, horário, situação e conferência. Não retira automaticamente o dinheiro, não credita uma Conta Financeira e não comprova entrega ou depósito. O valor continua registrado no histórico da sessão encerrada; a localização física posterior não pode ser deduzida desses registros.

## Fluxo implementado

| Etapa | Efeito atual | Limite de rastreabilidade |
|---|---|---|
| Abertura | Salva saldo inicial e operador; saldo positivo também registra evento de abertura como SUPRIMENTO. O cálculo reconhece esse evento e não soma a abertura duas vezes. | Não debita automaticamente uma origem, como cofre ou banco. |
| Venda em dinheiro | Registra Pagamento e movimento VENDA na sessão, pelo valor aplicado na venda. | Dinheiro entregue acima da compra gera troco; não deve inflar o saldo pelo valor bruto entregue. |
| Suprimento manual | Aumenta o dinheiro esperado e registra usuário, horário, valor e observação opcional. | Não possui origem financeira vinculada. |
| Sangria | Diminui o dinheiro esperado e registra usuário, horário, valor e observação opcional. | Não possui destino vinculado nem comprovante de recebimento; registrar a sangria não credita cofre ou banco. |
| Cancelamento de venda em dinheiro | Cria ESTORNO_VENDA compensatório na sessão e preserva o histórico. | O fluxo exige sessão aberta; não é uma operação de destinação do fechamento. |
| Fechamento | Salva dinheiro contado, conferência por forma, diferenças, eventual justificativa, operador e horário; encerra a sessão. | Não gera transferência, sangria final, entrega de valores ou crédito bancário. |
| Nova abertura | Recebe um novo saldo inicial informado pelo usuário. | Não há transferência vinculada do saldo final da sessão anterior. |

## Como o dinheiro esperado é calculado

`Esperado = saldo inicial + vendas em dinheiro − estornos em dinheiro + suprimentos manuais − sangrias`

`Diferença = dinheiro contado − dinheiro esperado`

Exemplo ilustrativo:

| Componente | Valor |
|---|---:|
| Saldo inicial para troco | R$ 100,00 |
| Vendas em dinheiro | R$ 500,00 |
| Suprimentos manuais | R$ 50,00 |
| Sangrias | − R$ 200,00 |
| Estornos | R$ 0,00 |
| Dinheiro esperado no fechamento | **R$ 450,00** |

Se forem contados R$ 450,00, a conferência fecha sem diferença. Isso não identifica o destino dos R$ 450,00, nem o destino dos R$ 200,00 retirados por sangria. Para estes últimos, uma observação eventualmente preenchida pode oferecer informação textual, mas não equivale a vínculo financeiro ou confirmação de recebimento.

Informar zero como dinheiro contado para representar uma retirada não cria essa retirada: no exemplo, registraria falta de R$ 450,00. A conferência deve representar a contagem; destinação é outro fato a registrar.

## Onde consultar hoje

**Financeiro → Caixas → Histórico de sessões → Ver detalhes.**

A consulta existente apresenta identificação da sessão, operadores, datas, saldo inicial, vendas, suprimentos, sangrias, esperado, informado, diferença, conferência por forma e eventos/movimentações. O acesso segue as permissões existentes. Sessões antigas no formato LEGADA não possuem a mesma conferência detalhada dos meios não dinheiro.

O Dashboard consulta somente sessões ABERTAS. Após o fechamento, a sessão deixa esse painel, embora seu histórico permaneça. Esse comportamento não é evidência de transferência, desaparecimento de registro ou perda efetiva de dinheiro.

## Separação entre dinheiro físico e os outros meios

| Meio | Fluxo atual relacionado | Efeito do fechamento do Caixa |
|---|---|---|
| Dinheiro | Movimento no Caixa físico. | Conferência e encerramento; sem depósito automático. |
| PIX | Pagamento registrado; confirmação financeira explícita gera entrada na Conta Financeira configurada. | Não confirma o recebimento automaticamente. |
| Débito/crédito | Gera recebível; liquidação explícita credita a conta de destino conforme o contrato. | Não liquida o cartão. |
| A prazo | Gera Conta a Receber; a baixa posterior produz o efeito financeiro. | Não recebe nem baixa a dívida. |

Não confundir venda total, total de pagamentos registrados, dinheiro físico contado e saldo bancário disponível. A arquitetura cita transferência e boleto, mas o faturamento atual não oferece esses dois tipos como fluxos próprios completos; não os tratar como funcionalidades homologadas nesta análise.

Contas e saldos já permite transferências entre Contas Financeiras funcionais. Essa operação não inclui a sessão do Caixa físico como origem. Uma Conta Financeira COFRE não recebe o dinheiro da gaveta só por existir; o tipo financeiro legado CAIXA também não é a sessão operacional. Criar lançamentos manuais independentes não estabeleceria uma ligação verificável com o fechamento.

## Lacuna funcional confirmada

O sistema responde quanto deveria existir, quanto foi informado e quem encerrou a sessão. Não responde de forma estruturada:

- quanto foi entregue após fechar e a quem;
- quanto ficou na gaveta para troco;
- quanto foi guardado no cofre;
- quanto foi efetivamente depositado no banco;
- qual operação recebeu cada valor e se houve confirmação do recebimento;
- quanto de uma sessão encerrada ainda aguarda destinação.

Portanto, acrescentar somente um relatório visual não recuperaria os destinos históricos ausentes. Esses destinos não devem ser inferidos por data, coincidência de valor ou texto de observação.

## Próxima entrega recomendada — proposta, não implementada

Definir uma operação pequena de destinação/recolhimento vinculada à sessão, aproveitando os domínios existentes. A regra precisa distinguir dinheiro contado, dinheiro mantido para troco, dinheiro entregue e depósito efetivamente confirmado.

Um relatório posterior poderia exibir: sessão, operador, dinheiro esperado, contado, diferença, sangrias, valor destinado, destino, responsável pelo recebimento, data, situação e valor ainda sem destinação. A ligação financeira deve impedir duplicidade e preservar estorno e histórico, sem recriar receita de venda.

Decisões essenciais antes de implementar:

1. O dinheiro normalmente vai para cofre, fica para o próximo turno ou é entregue a um responsável?
2. A entrega será registrada junto ao fechamento ou depois, mantendo uma situação pendente até a confirmação?
3. Quem pode registrar e confirmar a entrega? Depósito bancário será confirmado em uma etapa distinta da retirada física?

Enquanto essas regras não forem aprovadas, preservar o funcionamento existente e usar o histórico para conferência, sem considerar o fechamento como comprovante de destino.

## Evidências no código

- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/SessaoCaixaService.java`: abertura e fechamento; grava sessão e conferências, sem operação de destino.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/CaixaOperacionalService.java`: registro do dinheiro de venda, suprimento, sangria, estorno, fórmula de saldo e detalhe histórico.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/dto/FechamentoCaixaDTO.java`: saldoFinal e conferência; nenhum campo de destino.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/dto/MovimentacaoCaixaRequestDTO.java`: chave, tipo, valor e observação; nenhum vínculo de origem/destino financeiro.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/entity/MovimentacaoCaixaEntity.java`: auditoria de usuário/horário/sessão/pagamento, sem recebedor ou conta de destino.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/DashboardService.java`: consulta de sessões ABERTAS.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/TransferenciaFinanceiraService.java`: transferências entre Contas Financeiras; sem integração com sessão do Caixa físico.
- `frontend/src/pages/Financeiro/Caixa.tsx`: Histórico de sessões, detalhes e formulário de conferência.
- `backend/novexa-api/src/test/java/br/com/novexa/erp/controller/CaixaOperacionalHttpTest.java`: testes existentes de conferência e detalhe histórico inspecionados, não executados nesta tarefa.

Documentos consultados: `AGENTS.md`, `SYSTEM_CONTEXT.md`, `agent-workflow.md`, `FINANCEIRO_RULES.md` e trechos pertinentes de `financeiro.md`. Referências históricas de frontend no documento financeiro não foram tratadas como prova de ausência: a tela atual já possui histórico e detalhe de sessões.
