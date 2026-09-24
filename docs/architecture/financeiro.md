FINANCEIRO NOVEXA

## Estágios da arquitetura

**IMPLEMENTADO** descreve Pagamento e a fundação backend de Formas de Pagamento global; os commits/baselines e sua integração na main devem ser conferidos em [CURRENT_STATE.md](CURRENT_STATE.md). **PRÓXIMO** identifica as fundações cadastrais planejadas. **FUTURO** depende dessas bases e não faz parte do estágio atual. A ordem de execução está no [roadmap.md](roadmap.md).

## Conceitos distintos

`TipoFormaPagamento ≠ FormaPagamento ≠ Pagamento ≠ DestinoFinanceiro`.

| Conceito | Responsabilidade | Estágio |
|---|---|---|
| TipoFormaPagamento | Classificar o comportamento: DINHEIRO, PIX, TRANSFERENCIA, DEBITO, CREDITO ou BOLETO | IMPLEMENTADO: enum técnico, não é cadastro administrado pelo usuário |
| FormaPagamento | Cadastro global compartilhado, associado a um tipo comportamental | IMPLEMENTADO no backend: descrição, tipo e ativo; sem empresaId |
| Pagamento | Registro ligado à Venda, indicando forma e valor aplicado, com status e rastreabilidade | IMPLEMENTADO: fundação descrita abaixo |
| DestinoFinanceiro | Determinar onde o efeito financeiro deverá ocorrer, conforme o tipo e a configuração válida | FUTURO: Caixa, Conta Bancária ou títulos intermediários, conforme o fluxo |
| CondiçãoPagamento | Definir prazo e distribuição dos vencimentos/parcelas | PRÓXIMO: conceito planejado, sem domínio cadastral próprio implementado |

Exemplos de formas configuráveis: **PIX Sicredi → tipo PIX**, **Cartão Stone → tipo CREDITO**, **Dinheiro → tipo DINHEIRO**. O nome comercial não muda o comportamento do tipo, não identifica sozinho uma conta de destino e não comprova recebimento.

Exemplos de condições: **À vista**, **30 dias**, **30/60**, **30/60/90**. Forma responde como pagar; condição responde quando pagar. Configurar prazos não significa criar recebíveis, conceder crédito ou executar cobrança nesta etapa.

### Transição a partir do código atual

O catálogo oficial é `FormaPagamentoEntity`, global e sem vínculo com Empresa. O enum `TipoFormaPagamento` define os seis tipos. O antigo enum `FormaPagamento` permanece apenas como adaptador dos quatro códigos de Venda/PDV e como representação dos snapshots históricos; não é um segundo catálogo.

`POST /vendas` e `POST /vendas/{id}/faturar` aceitam exatamente uma opção: `formaPagamentoId` ou o campo legado `formaPagamento`. Os códigos antigos resolvem as formas básicas de IDs estáveis 1–4 da V8, independentemente da descrição. A nova forma precisa estar ativa. Boleto e transferência podem ser cadastrados, mas seu faturamento retorna 409 até a definição dos respectivos fluxos; não são tratados como PIX ou cartão.

O tipo é imutável após o cadastro: para outro comportamento, criar outra forma. Descrição e ativo podem ser atualizados; pagamentos antigos continuam consultáveis. Descrições são únicas globalmente ignorando caixa e espaços nas extremidades. A descrição exibida na consulta é a atual do catálogo; o código legado do fechamento permanece preservado no Pagamento.

O catálogo não fornece endpoints de exclusão física. API autenticada: `GET/POST /financeiro/formas-pagamento` e `GET/PUT /financeiro/formas-pagamento/{id}`. Payload: `descricao` obrigatória (até 150 caracteres), `tipo` obrigatório e `ativo` opcional; criação assume ativo e atualização preserva o estado quando omitido. Ativação/inativação usam o mesmo PUT. As operações são globais para usuários autenticados; não foi criada uma matriz de permissões nesta fundação.

Quando todos os clientes migrarem para ID, retirar a entrada legada em uma tarefa de contrato coordenada. Os snapshots persistidos não são fonte cadastral e devem continuar preservados. Os formatos anteriores usados no hash de idempotência foram mantidos para não invalidar retries históricos.

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
- Referencia o catálogo por `forma_pagamento_id`. O faturamento atual suporta tipos DINHEIRO, PIX, DEBITO e CREDITO; transferência e boleto permanecem futuros no fechamento.
- `valor` é o valor líquido aplicado à venda, sem incluir troco. No Pagamento, `valorRecebido` e `troco` são dados operacionais exclusivos de dinheiro; ficam nulos nas demais formas.

### Integração e compatibilidade

Venda ABERTA não possui Pagamento definitivo. Ao faturar, o serviço de Venda registra o Pagamento na mesma transação de estoque, lançamento financeiro temporário e mudança para FATURADA. Locks e chave de requisição existentes são preservados; retry não cria novos efeitos. Não existe API independente para criar, editar ou excluir Pagamento nesta etapa.

Os payloads antigos de Venda continuam válidos, com a alternativa por ID descrita acima. `formaPagamento`, `valorRecebido` e `troco` continuam em Venda por compatibilidade; o Pagamento conserva seu registro do fechamento. A consulta `GET /vendas/{vendaId}/pagamentos` mantém os campos anteriores e acrescenta `formaPagamentoId`, `descricaoFormaPagamento` e `tipoFormaPagamento`. Pagamento e Venda continuam isolados pela empresa autenticada; venda de outro tenant retorna 404, embora o catálogo seja global.

A forma é validada sob lock compartilhado até o commit do faturamento. Atualização/inativação usa lock exclusivo da mesma forma. O lock de Venda, os efeitos transacionais e o replay de uma venda já faturada permanecem preservados, inclusive se a forma for inativada depois do fechamento.

`LancamentoFinanceiroEntity` continua temporariamente 1:1 com Venda. Sua convenção atual (DINHEIRO/PIX = RECEBIDO; cartões = A_RECEBER) é preservada, mas não determina o status de Pagamento nem comprova liquidação. Substituir essa fundação pelos destinos oficiais exige tarefa própria.

Caixa possui cadastro e sessões operacionais. A venda faturada vincula-se à sessão e o Pagamento em DINHEIRO gera uma MovimentacaoCaixa. PIX e cartões compõem apenas totais operacionais da sessão; não são dinheiro físico nem comprovação de liquidação. Banco, Agência, Conta Bancária, Movimentação Bancária, Recebíveis e Contas a Receber/Pagar permanecem futuros.

## Sessões operacionais de Caixa — IMPLEMENTADO no backend

- Reutiliza CaixaEntity: um Caixa possui várias SessaoCaixaEntity históricas, no máximo uma ABERTO. FECHADO é definitivo; reabrir cria outra sessão.
- Abertura informa saldoInicial; fechamento informa saldoFinal. Ambos são valores declarados de dinheiro físico, não negativos e com até duas casas decimais. O fechamento retorna o resumo calculado descrito abaixo; não há conciliação bancária.
- Empresa e operadores vêm da autenticação, horários do backend. São registrados usuários e datas da abertura e do fechamento; qualquer operador ativo da mesma empresa pode fechar, sem permissões por perfil nesta etapa.
- Caixa inativo não abre nova sessão. A consulta e o fechamento de sessão existente continuam permitidos mesmo após inativação cadastral.
- POST `/financeiro/caixas/{caixaId}/sessoes` abre (201, corpo `{saldoInicial}`); GET `/financeiro/caixas/{caixaId}/sessoes/aberta` consulta; POST `/financeiro/caixas/{caixaId}/sessoes/{sessaoId}/fechar` fecha (200, corpo `{saldoFinal}`). Respostas incluem ID da sessão, Caixa, status, saldos, operadores e horários.
- Sem sessão aberta ou recurso de outra empresa: 404. Segunda abertura: 409. Repetir fechamento com o mesmo saldo retorna o resultado anterior; outro saldo retorna 409. O ID da sessão evita que um fechamento antigo atinja uma nova abertura; não há replay idempotente de abertura nesta etapa.
- Transação e PESSIMISTIC_WRITE no Caixa serializam abertura/fechamento por Caixa. Venda, resumo, movimentações e fechamento também adquirem o lock da SessaoCaixa até o commit, impedindo efeitos após o fechamento. V9 adiciona índice único parcial para sessões abertas e chaves compostas de Caixa/operadores/empresa. Não modifica migrations anteriores nem cria sessões fictícias para cadastros existentes.
- Frontend operacional e relatórios avançados permanecem futuros.

### Caixa operacional integrado à Venda — backend MVP

- Toda nova venda FATURADA possui sessão ABERTO da empresa autenticada, inclusive PIX/débito/crédito. `POST /vendas` e `POST /vendas/{id}/faturar` aceitam `sessaoCaixaId` opcional: a única sessão aberta é inferida; várias exigem seleção explícita e nenhuma retorna 409. IDs externos ao tenant retornam 404. Não há vínculo fixo Caixa–Usuário.
- Venda ABERTA não produz efeitos. Faturamento associa sessão, baixa estoque, registra Pagamento e lançamento temporário na mesma transação. Apenas DINHEIRO cria movimento VENDA, vinculado ao Pagamento (e à Venda), pelo valor líquido aplicado: recebido menos troco. Retry do fechamento não repete nenhum desses efeitos, inclusive após fechar a sessão.
- `GET /financeiro/caixas/sessoes/abertas`: lista somente sessões ABERTO da empresa, de todos os operadores. Campos: sessaoId, caixaId, descricaoCaixa, saldoInicial, dataHoraAbertura, operadorAbertura {id, nome}.
- `GET /financeiro/caixas/sessoes/{sessaoId}/resumo`: saldoInicial, totalVendas, totaisPorFormaPagamento [{formaPagamentoId, descricao, tipo, total}], suprimentos, sangrias, saldoEsperadoDinheiro, saldoFinalInformado e diferenca, além dos IDs/status. Totais usam os pagamentos registrados; tipos não monetários não entram no saldo físico. Ausência de venda de uma forma não cria linha com valor zero.
- `GET/POST /financeiro/caixas/sessoes/{sessaoId}/movimentacoes`: histórico de dinheiro e registro manual. POST recebe {chaveRequisicao: UUID, tipo: SUPRIMENTO|SANGRIA, valor, observacao?}, retorna 200 com movimento, operador/data automáticos. Chave única por sessão, payload/operador diferentes com mesma chave retornam 409. Retry idêntico retorna o movimento original, mesmo após fechamento. Não aceita VENDA manual nem retirada superior ao dinheiro disponível.
- Saldo esperado = saldo inicial + movimentos VENDA em dinheiro + SUPRIMENTO − SANGRIA. Diferença = saldo final informado − saldo esperado. Fechamento mantém os campos anteriores e acrescenta `resumo`; os totais permanecem consultáveis após fechar. Valores são derivados do histórico imutável de pagamentos/movimentos, sem manter um segundo saldo mutável.
- V10 adiciona o vínculo Venda–Sessão e movimentacoes_caixa com chaves de empresa e unicidade por pagamento/requisição. Vendas antigas não recebem sessão fictícia nem geram movimentos retroativos.
- Continua um pagamento por venda no contrato atual. Misto, confirmação de PIX/cartões e destinos bancários não fazem parte deste bloco. A implementação parcial anterior de venda em dinheiro em outro worktree foi superada por este bloco: não integrar sua V10 concorrente.

### Conferencia por forma no fechamento — Fase 1 backend

Implementada na branch `feat/conferencia-fechamento-backend`, atualizada com o baseline `1b313df`; pendente de integracao.

- O mesmo POST de fechamento aceita `{saldoFinal, conferencia?: {formas: [{formaPagamentoId, valorInformado}], observacao?}}`. Ausencia/null de conferencia seleciona LEGADA; objeto presente seleciona POR_FORMA. Dinheiro fisico continua exclusivamente em saldoFinal.
- LEGADA preserva o contrato anterior, inclusive divergencia sem observacao; grava modalidade LEGADA e nao inventa conferencias dos demais meios. A V16 classifica sessoes antigas fechadas como LEGADA, sem criar linhas retroativas.
- POR_FORMA reutiliza os esperados do CaixaOperacionalService sob lock da sessao. Exige exatamente as formas nao dinheiro com pagamentos nao cancelados na sessao, inclusive formas posteriormente inativadas. Lista vazia e valida se nao houver meios nao dinheiro. Duplicidade, omissao, forma extra/desconhecida/DINHEIRO, valor negativo ou com mais de duas casas retornam 400.
- Uma unica linha DINHEIRO_FISICO representa toda a gaveta; as demais linhas sao por ID cadastral, mesmo quando compartilham tipo. Diferenca = informado - esperado, sem compensar divergencias entre linhas. Qualquer divergencia exige observacao nao vazia (ate 500 caracteres); ausencia retorna 409 sem fechar.
- A V16 cria conferencias_fechamento_caixa com FK composta sessao/empresa, unicidade por escopo/forma e snapshots de descricao, tipo, esperado e informado. Sessao grava modalidade e observacao; operador/horario existentes sao preservados. Fechamento e linhas sao atomicos.
- Resposta do POST preserva campos anteriores e acrescenta modalidadeConferencia, observacaoFechamento e conferencias [{escopo, formaPagamentoId, descricao, tipo, valorEsperado, valorInformado, diferenca}]. As linhas retornam os snapshots salvos; o resumo anterior continua derivado do historico operacional.
- Retry compara modalidade, saldoFinal, mapa de IDs/valores e observacao normalizada. Ordem da lista, escala decimal equivalente e espacos externos da observacao nao mudam a identidade. Alteracao retorna 409; replay nao altera operador, horario ou snapshots, mesmo apos renomear/inativar a forma.
- Empresa vem do JWT. Conferencia nao liquida PIX/cartao, nao movimenta bancos e nao ajusta caixa/estoque. Boleto/transferencia continuam bloqueados no faturamento.
- Fora desta fase: frontend, consulta detalhada das conferencias no historico, relatorios e revisao do resumo para detectar alteracoes desde a abertura do modal. O servidor sempre recalcula sob lock e exige observacao conforme os valores atuais.

### Cancelamento integral de Venda

- `POST /vendas/{id}/cancelar` aceita somente Venda FATURADA da empresa autenticada. O retry de uma Venda já CANCELADA devolve o estado preservado sem repetir efeitos.
- A mesma transação marca a Venda como CANCELADA, cria movimentos compensatórios ENTRADA/CANCELAMENTO para as baixas originais de estoque, cancela Pagamento e lançamento financeiro e, em DINHEIRO, registra `ESTORNO_VENDA` na sessão de Caixa.
- Venda, itens, valores, movimentos originais, Pagamento e lançamento não são excluídos nem reescritos; os registros de cancelamento preservam a trilha histórica.
- O cancelamento de qualquer venda vinculada ao Caixa exige que a sessão ainda esteja ABERTA, inclusive PIX/cartões. Sessão fechada ou histórico original ausente/incompatível retorna conflito e desfaz toda a tentativa.
- A V15 alinha as constraints de Pagamento, lançamento financeiro e movimentos de Caixa aos estados de cancelamento, permitindo preservar a entrada original e registrar um único `ESTORNO_VENDA` por pagamento.
- PIX e cartões têm apenas os registros atuais de Pagamento/lançamento marcados como cancelados. Não existem ainda movimentação bancária, recebível ou liquidação externa para reverter.

## Persistência e histórico de Pagamento

A V7 cria `pagamentos`, protege os vínculos de empresa/venda/operador por chaves estrangeiras e migra as vendas FATURADA existentes sem repetir estoque ou financeiro. Dados necessários ausentes ou incompatíveis com as constraints interrompem a migration, em vez de gerar informação inventada.

A V8 cria `formas_pagamento`, insere as seis formas básicas e vincula todos os pagamentos existentes por FK obrigatória, sem repetir efeitos. Os IDs 1–6 são estáveis; novos registros começam em 7. A coluna antiga `pagamentos.forma_pagamento` permanece como snapshot do fechamento, não como autoridade cadastral. V1–V7 não foram alteradas.

Nos dados legados, o operador é o criador da Venda, pois o operador efetivo do faturamento não era armazenado separadamente. A data vem do lançamento financeiro, quando existente, ou da Venda; não permite reconstruir com precisão um horário de faturamento desconhecido. Novos pagamentos registram operador e momento efetivos.

## Fundações cadastrais

| Cadastro | Papel | Estágio |
|---|---|---|
| Forma de Pagamento | Catálogo global associado a TipoFormaPagamento, compartilhado entre empresas | IMPLEMENTADO no backend; frontend futuro |
| Condição de Pagamento | Prazo e parcelamento, sem política de crédito ou cobrança automática | PRÓXIMO |
| Caixa | Cadastro do local de dinheiro físico | IMPLEMENTADO; reutilizar o existente |
| Banco | Identificação da instituição bancária | PRÓXIMO |
| Agência | Identificação da agência vinculada ao Banco | PRÓXIMO, após Banco |
| Conta Bancária | Conta vinculada à Agência/Banco, respeitando o escopo da empresa | PRÓXIMO, após as bases bancárias |

Dados Bancários seguem `Banco → Agência → Conta Bancária`. Cadastrar esses dados não cria saldo nem movimentação. `Cadastro Caixa ≠ Movimentação Caixa ≠ Pagamento`: Caixa é exclusivamente dinheiro físico e não deve concentrar PIX, transferências ou liquidações de cartões.

As configurações ficam na área gerencial. A operação comum continua rápida: o operador escolhe a forma; quando a integração existir, o backend determinará o destino pela configuração válida. Não pedir novamente empresa/usuário nem exigir lançamentos manuais no PDV. Condições especiais aparecem somente quando necessárias.

## Limites da evolução — FUTURO

- Depois das fundações: demais destinos, MovimentacaoBancaria, Recebíveis, Contas a Receber e Contas a Pagar. MovimentacaoCaixa mínima de dinheiro já está implementada no bloco operacional. Cada fluxo exige tarefa própria; pagamento misto operacional também depende de regras explícitas, embora o modelo 1:N já o permita.
- Mais tarde: Carteira de Cobrança, CNAB, boleto avançado, conciliação bancária, política de crédito, bloqueios automáticos, cobrança avançada e relatórios financeiros avançados.
- Extensões comerciais futuras: portal B2B e força de vendas; não são dependências da próxima fundação financeira.

Esses itens não estão implementados pela fundação de Pagamento. Evoluir por necessidade real, sem antecipar infraestrutura ou levar a complexidade gerencial para a operação.
