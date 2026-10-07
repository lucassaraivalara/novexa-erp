FINANCEIRO NOVEXA

## PIX - validacao operacional no faturamento

PIX exige configuracaoFormaPagamentoId de configuracao ativa do tenant, com destino BANCO/CARTEIRA_DIGITAL ativo. Isso vale para pagamentos[] e para o payload singular legado; ausencia de configuracao/destino ou destino indisponivel retorna 409 antes de faturar. Historicos nao sao recalculados; confirmacao posterior continua usando o snapshot original, inclusive se o destino foi inativado depois da venda. O cadastro de configuracoes ja exige destino e permanece sem mudancas.

No PDV, PIX invalido nao e oferecido e configuracao indisponivel no rascunho nao permite uma nova finalizacao. Totais distinguem Pago agora de A receber; Falta distribuir aparece apenas se nao zero. Adicionar forma preserva valores anteriores e inicializa a nova linha com o valor nao alocado (ou zero), sem redistribuicao.

## Venda a prazo - contrato integrado (Bloco 3)

POST /vendas e POST /vendas/{id}/faturar aceitam pagamentos[] e parcelasPrazo[] separadamente. Exemplo de alocacao de R$200: pagamentos=[{configuracaoFormaPagamentoId:1,valor:50,valorRecebido:60}], parcelasPrazo=[{valor:75,vencimento:"2026-11-15"},{valor:75,vencimento:"2026-12-15"}]. Soma = totalEsperado; valores positivos com centavos exatos, vencimento obrigatorio e cliente ativo do tenant obrigatorio quando houver prazo. Pagamentos pode ser [] ou omitido na venda 100% a prazo; contrato singular legado continua aceito sem parcelasPrazo. Nao misturar campos singulares com listas.

Cada parcela cria ContaReceber VENDA_A_PRAZO/PENDENTE com vendaId, numeroParcela 1..N e totalParcelas N, sem PagamentoEntity ou movimento financeiro. Venda permanece FATURADA. Resposta de Venda adiciona valorPrazo (snapshot do total a prazo) e contasReceber[] resumidas, sem carregar historico de baixas; detalhe financeiro continua no endpoint de ContaReceber. valorRecebido nao inclui a divida; troco considera somente dinheiro entregue acima da parte imediata. V36 aditiva preserva historicos com valorPrazo=0 e ajusta CHECKs de recebido/troco para esta semantica.

PDV mantem pagamento simples/misto e oferece A prazo como opcao sistemica, com 1..120 parcelas editaveis, sem juros ou calendario automatico. Central distingue valores imediatos e a prazo e abre /financeiro/contas-receber?contaId={id}. Editar/cancelar conta da venda individualmente retorna 409; cancelamento da Venda estorna todas as baixas ativas e cancela as parcelas junto aos demais dominios, sem DELETE, com rollback integral. Regras de locks/idempotencia em [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md).

## Conta a Receber - backend independente (Bloco 1)

Dominio do Cliente, distinto de Recebivel de cartao. V35 cria contas_receber e vinculo 1:N nos movimentos financeiros existentes; criacao nao credita saldo. Somente baixa gera ENTRADA/CONTA_RECEBER, com destino escolhido por recebimento. Bloco 2 integra o frontend em Financeiro -> Contas a Receber, com CRUD permitido, baixa parcial/total, historico, estorno individual, cancelamento e resumo. Bloco 3 integra Venda/PDV conforme contrato acima.

Base: `/financeiro/contas-receber` (usuario autenticado, tenant do JWT):

| Metodo | Rota relativa | Contrato |
|---|---|---|
| POST | / | ContaReceberRequestDTO, retorna 201 com conta criada |
| GET | /pagina | PaginaResponseDTO; termo, status, clienteId, origem, vencimentoDe/Ate, page, size, sort |
| GET | /{id} | Detalhe com historico completo de recebimentos |
| PUT | /{id} | Mesmo DTO de criacao; somente antes de qualquer baixa |
| POST | /{id}/receber | Baixa parcial/total, UUID idempotente |
| POST | /{id}/recebimentos/{movimentacaoId}/estornar | `{ "motivoEstorno": "Correcao" }` |
| POST | /{id}/cancelar | Sem body; exige valorRecebido zero |
| GET | /resumo | vencidas, seteDias, trintaDias, emAberto, recebidasMes (total/quantidade) |

Criacao/edicao: `clienteId`, `descricao`, `valorOriginal`, `dataVencimento` obrigatorios; `dataEmissao`, `observacao`, `numeroParcela`, `totalParcelas` opcionais (parcelas default 1/1). Origem/venda/empresa nao sao campos de input. Valores positivos com no maximo duas casas, sem arredondamento silencioso.

Baixa: `{ "contaFinanceiraId": 1, "valor": 40.00, "dataRecebimento": "2026-10-06", "observacao": "Opcional", "chaveRequisicao": "uuid" }`. Soma acumulada nao pode ultrapassar o saldo; reutilizar chave com dados diferentes retorna 409. Retry apos estorno nao recria dinheiro. Estorno identifica recebimento especifico, preserva original/auditoria e exige saldo suficiente no destino historico.

Resposta: id, cliente {id/nome/cpfCnpj/ativo}, vendaId nullable, descricao, valorOriginal, valorRecebido, saldo, dataEmissao/Vencimento, status, origem, parcelas, observacao, dataCriacao/Atualizacao e recebimentos. Historico usa MovimentacaoFinanceiraResponseDTO, agora com contaReceberId/chaveRequisicao aditivos. Detalhe/mutacoes incluem todas as baixas; pagina retorna recebimentos=[] intencionalmente. Filtros/sort server-side: id, descricao, valorOriginal, valorRecebido, dataEmissao, dataVencimento, status, dataCriacao; desempate id,asc, default dataVencimento,asc. Page>=0, size 1..100.

Resumo em aberto considera saldo restante PENDENTE/PARCIAL, vencidas ate ontem, proximos 7/30 dias desde hoje. Recebidas no mes soma movimentos nao estornados pela data do recebimento; quantidade corresponde ao numero de baixas. Regras/locks e politica de acesso em [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md).

## LancamentoFinanceiro: LEGADO / READ-ONLY HISTORICO

Novas vendas NAO geram LancamentoFinanceiroEntity. VendaService nao injeta o repository legado; PagamentoService.cancelarFaturamento valida os Pagamentos e reverte Caixa/PIX, sem buscar ou alterar lancamentos_financeiros. CancelamentoVendaService/LiquidacaoRecebivelService continuam responsaveis pelos Recebiveis, inclusive pela reversao de LIQUIDADO no 5B.

Fonte de verdade atual: Venda/Pagamento + MovimentacaoCaixa + MovimentacaoFinanceira + Recebivel, conforme a forma de pagamento. Entidade, repository, tabela e historico legado permanecem intactos e legiveis; sua situacao nao acompanha novos cancelamentos e nao deve ser interpretada como estado operacional. Nenhuma migration, exclusao ou backfill.

## Bloco 5C: taxas e prazo de cartao (backend)

Configuracao empresarial DEBITO/CREDITO recebe taxa percentual, taxa fixa opcional e prazo em dias corridos. As condicoes sao independentes por configuracao (sem hardcode por bandeira/adquirente). Faturamento captura snapshot no Pagamento e copia para Recebivel, onde o calculo monetario e centralizado: percentual monetario arredondado HALF_UP em duas casas + fixa = taxas previstas; bruto - taxas = liquido previsto. Liquido zero/negativo causa 409 e rollback da Venda/Pagamento/estoque. Data prevista deriva de dataVenda.toLocalDate() + prazo; nao usa dias uteis.

V31 adiciona colunas nullable com CHECKs; sem alterar migrations anteriores, valores/datas historicos ou FKs. Historico sem snapshot continua liquidando pelo valor previsto ja armazenado, nunca pelo cadastro atual. Novas vendas sem taxas configuradas usam 0% / R$0 / 0 dias para compatibilidade com payloads existentes. Edicao com campo omitido preserva o valor vigente; NULL historico nao representa uma taxa inferida retroativamente.

POST /financeiro/recebiveis/{id}/liquidar permanece sem body, ADMIN/GERENTE, com locks operador -> Venda -> Pagamento -> Recebivel -> ContaFinanceira e UNIQUE do movimento. Credita somente valorLiquidoPrevisto; cancelamento reverte o valor original creditado e preserva auditoria, idempotencia e rollback por saldo insuficiente. Configuracao atual nunca muda destino, taxa, prazo, liquido ou data de venda anterior. Exemplo: R$100, 3%, 30 dias -> R$3 taxas, R$97 liquido; com R$0,50 fixa -> R$3,50 taxas e R$96,50 liquido.

### Contrato para frontend (implementado)

- POST/PUT /financeiro/configuracoes-formas-pagamento: taxaPercentual decimal 0..100, ate quatro casas; taxaFixa decimal >=0, ate duas casas; prazoRecebimentoDias inteiro >=0. Exclusivos de DEBITO/CREDITO. Na criacao, omissao/NULL usa zero para compatibilidade; na edicao preserva vigente. Enviar explicitamente 0 para zerar. Destino financeiro continua obrigatorio conforme regras do 5B.
- Resposta da configuracao adiciona os mesmos tres campos (NULL quando desconhecidos no legado ou nao aplicaveis).
- Pagamento adiciona taxaPercentualSnapshot, taxaFixaSnapshot, prazoRecebimentoDiasSnapshot.
- GET /financeiro/recebiveis e POST /financeiro/recebiveis/{id}/liquidar adicionam taxaPercentualSnapshot, taxaFixaSnapshot, valorTaxasPrevisto, prazoRecebimentoDiasSnapshot; preservam valorBruto, valorLiquidoPrevisto, dataPrevistaRecebimento e toda paginacao existente. Snapshots historicos desconhecidos retornam NULL.
- O formulario frontend exibe e envia os tres campos somente para DEBITO/CREDITO. Novas configuracoes iniciam com zero; valores nulos de configuracoes antigas permanecem em branco e campos nao informados sao omitidos. Recebiveis exibe bruto, taxas, liquido e data diretamente dos snapshots/valores retornados; confirmacao usa valorLiquidoPrevisto sem recalculo.
- Fora do 5C: parcelamento real, antecipacao, conciliacao, prazo por dias uteis, PSP, taxas por bandeira, liquidacao parcial ou em lote.

## Bloco 5B: liquidacao backend de cartao

MVP 03B: liquidacao autorizada apenas para ADMIN/GERENTE no matcher POST /financeiro/recebiveis/{id}/liquidar, seguindo a protecao existente do PIX. OPERADOR/USUARIO recebem 403 antes da execucao financeira; nao autenticado recebe 401. Consulta GET permanece inalterada. Snapshot, saldo, locks, idempotencia, tenant, cancelamento e reversao abaixo nao mudam.

Backend consolidado sobre `ae4df35` (Bloco 5A). Fluxo: Venda -> Pagamento -> Recebivel PENDENTE -> liquidacao explicita -> entrada RECEBIVEL_LIQUIDACAO -> ContaFinanceira -> LIQUIDADO. Venda de cartao continua sem efeito no saldo. POST /financeiro/recebiveis/{id}/liquidar sem body deriva valor do previsto (igual ao bruto, sem taxas) e destino somente do snapshot do Pagamento. Cadastro atual nao reinterpreta historico; conta historica inativa e permitida; destino ausente/invalido retorna 409, recebivel externo ao tenant retorna 404.

V30 adiciona auditoria de liquidacao e cancelamento no Recebivel (data, valor recebido, usuarios tenant-safe), FK MovimentacaoFinanceira -> Recebivel e UNIQUE(recebivel_id), CHECK de origem/tipo ENTRADA. Nao existe relacao circular: movimentacaoFinanceiraId exposto pelo DTO e derivado do movimento vinculado, com busca em lote dos IDs da pagina no GET. DTO conserva todos os campos 5A e adiciona valorLiquidoRecebido, dataLiquidacao, usuarioLiquidacaoId, dataCancelamento, usuarioCancelamentoId e movimentacaoFinanceiraId. Extrato financeiro adiciona recebivelId, sem alterar filtros/paginacao.

V30 tambem substitui somente chk_config_forma_destino da V24 para permitir destino em DEBITO/CREDITO, preservando registros sem destino e todas as outras regras. Novas configuracoes exigem BANCO/CARTEIRA_DIGITAL ativo do tenant. Historicas sem destino podem ser lidas/inativadas, mas nao usadas em novas vendas sem regularizacao. PagamentoService valida essa condicao antes do faturamento e captura o destino pelo mecanismo de snapshot existente. Contrato legado de venda sem configuracao continua compativel, com destino NULL e liquidacao 409. Nao ha backfill nem fallback, mesmo depois de regularizar a configuracao.

Locks em liquidacao: operador -> Venda -> Pagamento -> Recebivel -> ContaFinanceira; cancelamento mantem locks intermediarios de estoque entre Venda e Pagamento. Recebiveis e pagamentos por ID crescente; contas de reversao por ID crescente e debitos agregados/validados antes dos efeitos. Refresh apos lock evita saldo/status obsoleto. Dupla liquidacao utiliza o lock da Venda/Recebivel e unicidade estrutural. Se cancelar vencer, liquidacao retorna 409; se liquidacao vencer, cancelamento debita a conta historica, estorna o movimento original e muda recebivel/venda para CANCELADO/CANCELADA na mesma transacao. Auditoria anterior permanece. Retry nao duplica efeitos; saldo insuficiente ou falha em qualquer etapa reverte toda a operacao. Estorno individual e recusado pelo endpoint generico.

No fechamento do 5B, taxas/prazos e frontend eram pendentes. O MVP 01 integrou destino/regularizacao e o 5C adiciona taxas/prazo backend conforme contrato acima. Permanecem fora do escopo: adquirentes, parcelamento real, antecipacao, liquidacao parcial/lote, conciliacao e webhook. Nao existe API de troca manual de destino da liquidacao.

## Bloco 5A: nucleo backend de Recebiveis

Consolidado na branch sobre `9815b40`, sem push ou integracao a main: CARTAO -> Pagamento -> Recebivel -> futura Liquidacao -> ContaFinanceira. Venda com cartao NAO movimenta ContaFinanceira diretamente. O LancamentoFinanceiro legado A_RECEBER continua preservado e nao representa saldo disponivel.

Somente DEBITO/CREDITO geram uma parcela PENDENTE na mesma transacao do faturamento, apos o Pagamento, inclusive no contrato legado sem configuracao. Nenhum backfill de vendas anteriores. O modelo guarda empresa, pagamento/venda, tipo, numero/total de parcelas, valores bruto/liquido previsto, momento do faturamento (dataVenda = dataHora do Pagamento), data prevista nullable, status, criacao e snapshot ID/nome/tipo da configuracao copiado do Pagamento. Sem taxas reais, liquido previsto = bruto; sem prazo real, data prevista = NULL. Parcelamento, taxas e adquirentes pertencem a blocos posteriores.

V29 cria recebiveis com FKs tenant-safe e vinculo composto pagamento/venda/empresa, UNIQUE(empresa_id,pagamento_id,numero_parcela) e CHECKs de tipo/status/parcelas/valores. Retry usa a idempotencia e locks existentes de Venda; falha na geracao reverte toda a operacao. Cancelamento sob lock da Venda preserva os registros e altera PENDENTE para CANCELADO; retry nao repete efeitos. No 5A, LIQUIDADO nao era produzido pela API e bloqueava cancelamento com 409. Essa limitacao foi substituida no 5B pela liquidacao/reversao transacional descrita acima.

GET /financeiro/recebiveis retorna PaginaResponseDTO<RecebivelResponseDTO>, empresa exclusivamente do JWT. Filtros: status, tipo (DEBITO/CREDITO), dataInicial/dataFinal (datas ISO, inclusivas sobre dataVenda) e vendaId. Defaults page=0, size=25, sort=dataVenda,desc com id,desc; size 1..100. Allowlist sort: id, dataVenda, tipo, status, valorBruto, dataPrevistaRecebimento; parametros invalidos retornam 400. Consulta, filtros, ordenacao, count e pagina executados no banco. DTO: id, vendaId, pagamentoId, tipo, numeroParcela, totalParcelas, valorBruto, valorLiquidoPrevisto, dataVenda, dataPrevistaRecebimento, status, configuracaoNomeExibicao. Nenhum endpoint de criacao manual, liquidacao ou frontend.

## Consultas paginadas

Contas a Pagar, Movimentações Financeiras e Transferências usam filtros, ordenação e paginação no banco. Totais de Contas a Pagar são agregados por empresa, independentes da página. Contratos em [paginacao.md](paginacao.md). Esta alteração de consultas não modifica criação, confirmação PIX, cancelamento, estorno, locks ou saldo.

## Estágios da arquitetura

**IMPLEMENTADO** descreve Pagamento e a fundação backend de Formas de Pagamento global; os commits/baselines e sua integração na main devem ser conferidos em [CURRENT_STATE.md](CURRENT_STATE.md). **PRÓXIMO** identifica as fundações cadastrais planejadas. **FUTURO** depende dessas bases e não faz parte do estágio atual. A ordem de execução está no [roadmap.md](roadmap.md).

## Conceitos distintos

`TipoFormaPagamento ≠ FormaPagamento ≠ Pagamento ≠ DestinoFinanceiro`.

| Conceito | Responsabilidade | Estágio |
|---|---|---|
| TipoFormaPagamento | Classificar o comportamento: DINHEIRO, PIX, TRANSFERENCIA, DEBITO, CREDITO ou BOLETO | IMPLEMENTADO: enum técnico, não é cadastro administrado pelo usuário |
| FormaPagamento | Cadastro global compartilhado, associado a um tipo comportamental | IMPLEMENTADO no backend: descrição, tipo e ativo; sem empresaId |
| ConfiguracaoFormaPagamentoEmpresa | Nome e destino cadastral próprios da empresa, com N configurações por forma/tipo | IMPLEMENTADO no backend; vínculo opcional de identificação em Venda/Pagamento, sem roteamento financeiro |
| Pagamento | Registro ligado à Venda, indicando forma e valor aplicado, com status e rastreabilidade | IMPLEMENTADO: fundação descrita abaixo |
| DestinoFinanceiro | Determinar onde o efeito financeiro deverá ocorrer, conforme o tipo e a configuração válida | FUTURO: Caixa, Conta Bancária ou títulos intermediários, conforme o fluxo |
| CondiçãoPagamento | Definir prazo e distribuição dos vencimentos/parcelas | PRÓXIMO: conceito planejado, sem domínio cadastral próprio implementado |

Exemplos de formas configuráveis: **PIX Sicredi → tipo PIX**, **Cartão Stone → tipo CREDITO**, **Dinheiro → tipo DINHEIRO**. O nome comercial não muda o comportamento do tipo, não identifica sozinho uma conta de destino e não comprova recebimento.

Exemplos de condições: **À vista**, **30 dias**, **30/60**, **30/60/90**. Forma responde como pagar; condição responde quando pagar. Configurar prazos não significa criar recebíveis, conceder crédito ou executar cobrança nesta etapa.

### Transição a partir do código atual

O catálogo oficial é `FormaPagamentoEntity`, global e sem vínculo com Empresa. O enum `TipoFormaPagamento` define os seis tipos. O antigo enum `FormaPagamento` permanece apenas como adaptador dos quatro códigos de Venda/PDV e como representação dos snapshots históricos; não é um segundo catálogo.

`POST /vendas` e `POST /vendas/{id}/faturar` aceitam exatamente uma opção: `formaPagamentoId` ou o campo legado `formaPagamento`. Os códigos antigos resolvem as formas básicas de IDs estáveis 1–4 da V8, independentemente da descrição. A nova forma precisa estar ativa. Boleto e transferência podem ser cadastrados, mas seu faturamento retorna 409 até a definição dos respectivos fluxos; não são tratados como PIX ou cartão.

O tipo é imutável após o cadastro: para outro comportamento, criar outra forma. Descrição e ativo podem ser atualizados; pagamentos antigos continuam consultáveis. Descrições são únicas globalmente ignorando caixa e espaços nas extremidades. A descrição exibida na consulta é a atual do catálogo; o código legado do fechamento permanece preservado no Pagamento.

O catálogo não fornece endpoints de exclusão física. A leitura autenticada por `GET /financeiro/formas-pagamento` e `GET /financeiro/formas-pagamento/{id}` continua disponível por compatibilidade. Desde o Bloco 3A, POST/PUT desse catálogo retornam 403 para os perfis empresariais, inclusive ADMIN; não existe papel de administrador de plataforma. Serviços internos e registros históricos foram preservados, sem migração automática do catálogo para configurações.

Quando todos os clientes migrarem para ID, retirar a entrada legada em uma tarefa de contrato coordenada. Os snapshots persistidos não são fonte cadastral e devem continuar preservados. Os formatos anteriores usados no hash de idempotência foram mantidos para não invalidar retries históricos.

DestinoFinanceiro é um conceito de integração, sem roteamento automático nesta fase. ContaFinanceira já representa saldo gerencial e pode ser destino cadastral da configuração empresarial, mas ainda não é destino vinculado ao Pagamento nem substitui o cadastro bancário. Efeitos automáticos serão definidos nas tarefas correspondentes, respeitando o contexto da empresa autenticada.

### Bloco 3A: configuração empresarial (somente backend)

`ConfiguracaoFormaPagamentoEmpresaEntity` liga empresa autenticada, forma global imutável, nomeExibicao, nomeNormalizado, ativo, destino opcional e timestamps. Permite múltiplos PIX, débitos, créditos e boletos na mesma empresa, inclusive com a mesma formaPagamentoId. nomeNormalizado é persistido como coluna gerada pelo banco com `lower(trim(nome_exibicao))`, sem autoridade do payload, e único por empresa; tipo é derivado exclusivamente do catálogo.

API: `GET/POST /financeiro/configuracoes-formas-pagamento` e `GET/PUT /financeiro/configuracoes-formas-pagamento/{id}`. Listagem aceita `situacao=ativas|inativas|todas` (padrão todas). Payload: formaPagamentoId, nomeExibicao (até 150 caracteres), ativo opcional e contaFinanceiraDestinoId opcional; sem empresaId/tipo como autoridade externa. Criação assume ativo; PUT preserva ativo quando omitido, exige a mesma forma e o destino atual ou novo. Resposta inclui tipo, resumo do destino (id/nome/tipo/ativo) e timestamps. IDs de outro tenant retornam 404.

PIX/TRANSFERENCIA exigem destino BANCO ou CARTEIRA_DIGITAL; DINHEIRO/DEBITO/CREDITO/BOLETO exigem destino nulo. DINHEIRO representa Caixa operacional, cartão aguarda Recebíveis e boleto aguarda Conta a Receber. Criar/trocar destino exige conta ativa; inativação posterior não apaga vínculo nem bloqueia edição de nome/situação, inclusive reativação da configuração mantendo o mesmo destino. Uso financeiro futuro deverá revalidar conta e configuração. Forma global inativa não aceita novas configurações.

A V24 cria tabela, UNIQUE(id, empresa_id), FK composta de destino/empresa, índice único de nome normalizado e índices de consulta. O tipo derivado possui FK (forma_pagamento_id, tipo) para o catálogo, permitindo CHECK de presença/ausência de destino. Tipo permitido/atividade da conta são validados no serviço, com lock na conta ao vincular. Dados anteriores permanecem intactos.

A V25 adiciona nome_normalizado gerado e armazenado, preenchendo automaticamente configurações existentes, e substitui o índice por expressão da V24 por UNIQUE(empresa_id, nome_normalizado). V24 e migrations anteriores permanecem inalteradas.

Nenhum destino cadastrado gera lançamento financeiro neste bloco. Venda, Pagamento, Caixa, transferências entre contas e snapshots não mudam. Frontend e uso das configurações no PDV ficam pendentes; a tela antiga não poderá gravar no catálogo global até sua adaptação.

### Pagamento misto no PDV (2026-10-06)

`POST /vendas` e `POST /vendas/{id}/faturar` aceitam `pagamentos` com 1 a 20 itens: `configuracaoFormaPagamentoId`, `valor` e `valorRecebido` opcional para DINHEIRO. O backend deriva a forma da configuracao ativa do tenant autenticado, exige parcelas positivas com ate duas casas decimais e soma exatamente igual ao total da venda. A mesma configuracao nao pode ser repetida; configuracoes distintas do mesmo tipo sao permitidas. Nao ha pagamento parcial ou Conta a Receber.

O contrato anterior (formaPagamento/formaPagamentoId, configuracaoFormaPagamentoId opcional, valorRecebido) permanece aceito, convertido em uma unica parcela pelo mesmo processamento. Nao misturar campos singulares com pagamentos[]. Os formatos legados do hash permanecem intactos. Reenvio identico nao repete efeitos; alteracao do payload na mesma chave retorna conflito.

Venda -> N Pagamentos em sequencias 1..N conforme payload, dentro de uma unica transacao: baixa de estoque uma vez, DINHEIRO no Caixa pelo valor aplicado, PIX pendente de confirmacao posterior, DEBITO/CREDITO com Recebivel individual e snapshots existentes de destino/taxas/prazo. Dinheiro aplicado 40 e recebido 50 gera movimento 40 e troco 10; recebido omitido assume o aplicado. Troco nunca integra a soma das parcelas. A ordem de locks do Caixa continua Operador -> Caixa -> Sessao; configuracoes usam os locks existentes por ID crescente.

Na venda mista, forma/configuracao singulares de Venda ficam nulas; a fonte de detalhe e `GET /vendas/{id}/pagamentos`. Venda conserva total recebido operacional e troco agregado. Cada Pagamento preserva seu proprio valor/configuracao/snapshot. Cancelamento percorre todos os pagamentos/recebiveis pela infraestrutura existente, incluindo PIX confirmado e cartao liquidado pelo liquido, com estorno de dinheiro e estoque uma vez. Qualquer falha desfaz toda a operacao; historico permanece.

O PDV inicia com uma forma e valor automatico do total, permite adicionar/remover formas, mostra total informado/restante/troco e impede finalizar com diferenca. HTTP continua no service; tenant vem do JWT. Sem migration, arquitetura financeira paralela ou mudanca nas permissoes de confirmacao/liquidacao. As secoes abaixo registram as etapas anteriores de evolucao.

### Vínculo operacional em Venda/Pagamento (contrato singular V26)

`POST /vendas` e `POST /vendas/{id}/faturar` aceitam `configuracaoFormaPagamentoId` opcional, além de exatamente uma forma global (`formaPagamentoId` ou código legado `formaPagamento`). Não substitui a forma global: a configuração deve estar ativa, ser da empresa autenticada e ter o mesmo tipo técnico, embora possa referenciar outro registro global do mesmo tipo. Inexistente/outro tenant retorna 404; inativa/tipo divergente retorna 409, sem efeitos parciais. O lock da configuração é mantido até o commit para serializar alterações cadastrais concorrentes.

Venda e Pagamento persistem o mesmo vínculo opcional, protegido por FKs compostas de empresa na V26. Respostas de Venda e `GET /vendas/{id}/pagamentos` incluem `configuracaoFormaPagamentoId`, nulo no legado. Não há preenchimento retroativo nem alteração de registros anteriores. Cancelamento preserva o vínculo mesmo após inativação cadastral. O novo ID participa do hash somente quando informado; retries legados permanecem compatíveis e outra configuração na mesma chave não substitui o vínculo original.

A configuração é identificação operacional. ContaFinanceira não é movimentada nem validada para liquidação por este vínculo. Não há Recebível, liquidação, taxa ou TEF; os efeitos legados de estoque/Caixa/LancamentoFinanceiro permanecem. Frontend e os fluxos ainda não suportados de boleto/transferência não mudam.

### Bloco 4C-A1: confirmação financeira explícita do PIX

No MVP 02, o endpoint existente permite apenas ADMIN/GERENTE (OPERADOR/USUARIO: 403; sem autenticacao: 401), usando a autorizacao atual do Spring Security. A Central de Vendas, no detalhe da venda/seccao Pagamentos, apresenta o estado real e permite confirmacao explicita com dialog, sem conta/valor/empresa no payload. Atualiza detalhe e auditoria apos sucesso; 403 e conflitos funcionais sao apresentados, com bloqueio de clique durante a request. Nao ha acao no PDV. Snapshot, idempotencia, locks e reversao por cancelamento abaixo permanecem inalterados; PIX antigo sem destino retorna conflito, sem fallback.

`POST /financeiro/pagamentos/{id}/confirmar-recebimento`, sem payload, usa empresa e usuário do JWT. Exige pagamento não cancelado, configuracaoTipo PIX, destino histórico e valor positivo; pagamentos legados sem snapshot válido não são reinterpretados. O destino vem exclusivamente do snapshot, mesmo após alteração da configuração ou inativação da conta histórica. Conta deve existir no tenant; não há redirecionamento.

Uma transação segue a ordem de locks operador, Venda, Pagamento e ContaFinanceira com PESSIMISTIC_WRITE, verifica confirmação existente, credita o saldo e cria ENTRADA/PAGAMENTO_PIX. A V28 acrescenta pagamento_id em movimentacoes_financeiras, FK composta por empresa, UNIQUE por pagamento e CHECK de origem/vínculo/tipo. A confirmação deriva do movimento único: PagamentoResponseDTO expõe confirmadoFinanceiramente, dataConfirmacaoFinanceira, usuarioConfirmacaoFinanceiraId e movimentacaoFinanceiraId. Retry preserva saldo, movimento e auditoria originais.

Não há confirmação automática no faturamento ou fechamento do Caixa. Efeitos legados permanecem; não há Recebível ou liquidação de cartão.

### Bloco 4C-A2: cancelamento e concorrência PIX

Cancelamento da Venda integra o estorno do PIX à mesma transação de estoque/Pagamento/lançamento legado. Debita o valor na conta histórica (inclusive inativa) e preserva o movimento original com estornada, dataEstorno, usuarioEstorno e motivoEstorno. Sem confirmação não inventa movimento. Retry de cancelamento não repete débito nem altera auditoria; saldo insuficiente retorna 409 e desfaz toda a tentativa. A confirmação ocorrida e sua auditoria continuam históricas; status CANCELADO e movimento estornado registram sua reversão.

Confirmação e cancelamento usam a mesma ordem operador → Venda → Pagamento → ContaFinanceira. Cancelamento mantém os locks existentes de produtos antes dos pagamentos, adquiridos por ID; pagamentos também são bloqueados em ordem de ID. A confirmação nunca tenta bloquear Venda depois de Pagamento. O saldo da conta é relido sob lock para evitar entidades previamente carregadas com saldo desatualizado. Pagamento misto percorre cada pagamento pela mesma infraestrutura, sem confirmar PIX automaticamente.

Dupla confirmação serializa e mantém uma única entrada, também protegida pelo UNIQUE da V28. Se confirmar primeiro, cancelamento estorna; se cancelar primeiro, confirmação retorna conflito. Falha em qualquer etapa provoca rollback integral. Estorno individual de PAGAMENTO_PIX permanece bloqueado no endpoint genérico, devendo ocorrer pelo cancelamento da venda. V27/V28 preservadas; nenhuma V29 necessária.

### Bloco 4B-A: snapshot histórico no Pagamento

Pagamento é a fonte histórica imutável da configuração utilizada. Seu construtor captura, na mesma transação do faturamento, configuracaoNomeExibicao, configuracaoTipo, configuracaoContaFinanceiraDestinoId e configuracaoContaFinanceiraDestinoNome, com destino nulo quando não existe. Todos são updatable=false e sem setters; cancelamento altera somente status. Consulta de Pagamento devolve esses valores persistidos, sem reler nome/tipo/destino da configuração atual. Os campos anteriores do contrato permanecem disponíveis.

A V27 adiciona as quatro colunas nullable e FK tenant-safe (destino histórico, empresa_id) para contas_financeiras(id, empresa_id), sem backfill. Pagamentos anteriores, mesmo com configuração vinculada, e novos pagamentos sem configuração mantêm snapshot NULL. Nome da configuração e nome do destino suportam 150 caracteres, alinhados às entidades de origem, e tipo suporta 20. Nenhum nome válido é truncado.

Retries usam o mecanismo/hash existente e devolvem o Pagamento original, sem recriar ou atualizar snapshot. Alterações futuras de nome/destino na configuração ou renomeação da conta não reinterpretam pagamentos já registrados. Integração financeira futura deverá usar o ID original gravado no Pagamento. PIX financeiro, Recebíveis e liquidação automática permanecem fora deste bloco.

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

Na Fase 2 de Usuários e Acessos, qualquer perfil operacional autenticado pode abrir uma sessão. `OPERADOR` e `USUARIO` legado fecham apenas a sessão que abriram; `GERENTE` e `ADMIN` podem fechar outras sessões e registrar sangria/suprimento. O saldo inicial segue o fluxo de abertura e não é um suprimento manual sujeito a autorização gerencial.

- Reutiliza CaixaEntity: um Caixa possui várias SessaoCaixaEntity históricas, no máximo uma ABERTO. FECHADO é definitivo; reabrir cria outra sessão.
- Abertura informa saldoInicial; fechamento informa saldoFinal. Ambos são valores declarados de dinheiro físico, não negativos e com até duas casas decimais. O fechamento retorna o resumo calculado descrito abaixo; não há conciliação bancária.
- Empresa e operadores vêm da autenticação, horários do backend. São registrados usuários e datas da abertura e do fechamento; o fechamento respeita a propriedade da sessão e o perfil conforme descrito acima.
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

### Detalhe de sessão fechada

`GET /financeiro/caixas/sessoes/{sessaoId}/detalhe` agrega sessão, resumo calculado, modalidade/observação de fechamento, snapshots de conferência e eventos de abertura, vendas, suprimentos, sangrias, estornos de venda em dinheiro e fechamento. A lista `/fechadas` e as leituras de resumo/movimentações de sessões fechadas aplicam o mesmo acesso: operador (inclusive `USUARIO` legado) apenas às sessões que abriu; gerente/admin a todas as sessões da empresa. Outro tenant retorna 404. O drawer em `Caixas anteriores` usa esse contrato sem criar relatório ou alterar o fechamento. Em sessões LEGADA, formas não dinheiro não têm informado/diferença; não são preenchidas artificialmente. Vendas canceladas preservam a data original da venda, pois o contrato atual não guarda horário próprio de cancelamento para meios sem estorno físico.

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

## Contas a Pagar — MVP operacional

Contas a Pagar usa a empresa do JWT e aceita fornecedor da mesma empresa, número do documento, categoria textual e emissão opcionais. Vencimento, descrição e valor positivo são obrigatórios. Uma conta ABERTA pode ser editada, paga ou cancelada; uma conta PAGA pode ter o pagamento estornado, voltando a ABERTA. Vencida é uma condição calculada pela data de vencimento, não um status persistido. Sem pagamentos parciais ou ajustes nesta etapa, a baixa exige data e valor integral da conta; o valor em aberto é derivado do valor original menos o pago, desconsiderando contas canceladas. Na Fase 3A backend, a baixa também exige `contaFinanceiraId` ativo da mesma empresa, saldo suficiente e gera SAIDA de origem CONTAS_A_PAGAR na Conta Financeira; estorno reverte essa saída. Baixas legadas sem vínculo continuam estornáveis. A baixa não movimenta Caixa/PDV nem Conta Bancária cadastral. O frontend ainda precisa enviar o novo campo. Não há recorrência, parcelas, conciliação ou DRE nesta etapa.

## Contas Financeiras — base gerencial manual

Listagem administrativa usa GET /financeiro/contas-financeiras/pagina (page/size/sort, termo, ativo, tipo), com PaginaResponseDTO e tenant do JWT. GET simples permanece para seletores existentes. Cards usam GET /financeiro/contas-financeiras/resumo, agregado por tipo para todas as contas do tenant, incluindo inativas/legados e independente dos filtros/pagina. Nenhuma regra de saldo/movimentacao mudou; contrato em [paginacao.md](paginacao.md).

ContaFinanceira pertence à empresa do JWT e mantém saldo inicial e atual não negativos. O saldo inicial é definido somente no cadastro; nome, tipo e situação podem ser alterados sem reescrever o histórico. Tipos funcionais: BANCO, COFRE, CARTEIRA_DIGITAL e OUTROS. BANCO exige vínculo 1:1 com ContaBancaria da mesma empresa; novos vínculos exigem conta bancária ativa. ContaBancaria guarda identidade, nunca saldo. Saldo e extrato continuam exclusivamente na ContaFinanceira. A V21 adiciona vínculo nullable, FK composta por empresa, unicidade e CHECK que restringe vínculos ao tipo BANCO. BANCO legado sem vínculo continua legível/inativável, mas deve ser regularizado ao salvar edição. CAIXA/ADQUIRENTE permanecem legíveis, renomeáveis e inativáveis, sem novos usos nem conversões automáticas; seus saldos permanecem no total geral. Consulte [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md) para as regras oficiais. Não há alteração no Caixa operacional nem liquidação bancária automática neste bloco.

MovimentacaoFinanceira registra origens MANUAL, CONTAS_A_PAGAR, SALDO_INICIAL e TRANSFERENCIA, operador autenticado, data do movimento, valor positivo, descrição e observação opcional. ENTRADA aumenta e SAIDA diminui saldo na mesma transação, sob lock da conta; saldo negativo é recusado. Conta inativa não recebe novos movimentos, mas seu histórico e estornos continuam disponíveis. Estorno exige motivo, marca o registro sem excluí-lo e reverte o saldo; estorno de entrada é recusado se causaria saldo negativo. Movimentos de Contas a Pagar só são estornados pela baixa, nunca pelo endpoint manual. SALDO_INICIAL não admite estorno individual; TRANSFERENCIA usa o estorno do agregado descrito abaixo. PDV e Caixa não geram lançamentos automáticos neste saldo gerencial. A idempotência explícita deste bloco aplica-se às transferências; outras integrações permanecem futuras.

Bloco 2A: a V22 identifica contas anteriores com `saldo_inicial_auditado=false`, sem alterar saldos nem criar movimentos retroativos. Novas contas são marcadas como auditadas; se o saldo inicial for positivo, a criação registra uma única ENTRADA/SALDO_INICIAL com usuário do JWT e data da criação. O construtor já inicializa saldoAtual, portanto esse registro de auditoria não reaplica o valor. Com saldo zero, nenhum movimento é criado. Conta e movimento são persistidos na mesma transação; saldo inicial continua imutável. O índice único parcial protege a unicidade e o CHECK exige ENTRADA não estornada. O extrato identifica a origem e sinaliza discretamente saldo inicial legado. Regularização de contas antigas permanece pendente, sem reconstrução histórica presumida.

### Bloco 2B: transferências entre Contas Financeiras

TransferenciaFinanceira é o agregado de uma operação única, com empresa, origem/destino, valor, data do movimento, observação, usuário, UUID da requisição, criação, status CONCLUIDA/ESTORNADA e auditoria de estorno. Criação debita a origem e credita o destino, produzindo exatamente dois movimentos TRANSFERENCIA vinculados ao mesmo agregado. ContaBancaria continua sendo apenas identidade; este fluxo não integra Pagamento, PIX, Recebíveis ou Caixa operacional.

V23 cria transferencias_financeiras com unicidade (id, empresa_id) e (empresa_id, chave_requisicao), FKs compostas para ambas as contas e usuários, CHECK de contas distintas/valor positivo/status e auditoria coerentes. Movimentações recebem transferencia_id com FK composta por empresa, CHECK de coerência com origem e índice único por transferência/tipo, impedindo duas entradas ou duas saídas para o mesmo agregado. Dados anteriores permanecem intactos.

Criação e estorno adquirem os locks PESSIMISTIC_WRITE das contas por ID crescente, reduzindo deadlocks entre direções opostas. As validações de situação, tipo e saldo ocorrem sob lock. A criação verifica a chave antes e depois dos locks; colisão concorrente na unicidade causa rollback e releitura em outra transação para replay ou conflito. Um retry não reaplica efeitos, mesmo após estorno ou inativação. Observação é normalizada e valores equivalentes são comparados numericamente.

API autenticada:
- POST /financeiro/transferencias: chaveRequisicao, contaOrigemId, contaDestinoId, valor, dataMovimento e observacao opcional; retorna 200 com o agregado criado ou recuperado.
- GET /financeiro/transferencias: histórico da empresa, ordenado por data/ID decrescente.
- POST /financeiro/transferencias/{id}/estornar: motivoEstorno obrigatório, até 500 caracteres. Devolve agregado ESTORNADA, restaura os saldos e marca os dois movimentos originais com auditoria, sem movimentos compensatórios novos.

As respostas incluem nomes/IDs das contas, valor, data, observação, status, chave, operador/criação e dados de estorno. IDs externos ao tenant retornam 404. Saldo insuficiente, conta inativa/legada para nova transferência, chave divergente e estorno duplicado retornam 409. Estorno permite contas inativadas, mas exige saldo no destino original e mantém ambos os saldos não negativos. O endpoint genérico recusa estorno individual e indica o endpoint próprio.

Na tela Contas Financeiras, a ação Transferir pré-seleciona a origem da linha; o drawer lista somente contas ativas funcionais, exclui a origem dos destinos e mostra seu saldo. Mantém o UUID durante a tentativa e retries, bloqueia controles durante processamento e recarrega contas após sucesso. O extrato mostra transferência enviada/recebida com contraparte; sua ação de estorno confirma a transferência inteira e recarrega o histórico e os saldos do backend.

## Limites da evolução — FUTURO

- Depois das fundações: demais destinos, MovimentacaoBancaria, Recebíveis e Contas a Receber. A integração backend da baixa de Contas a Pagar com Conta Financeira já existe; falta adaptar o frontend. A baixa não gera efeito na Conta Bancária cadastral. MovimentacaoCaixa mínima de dinheiro já está implementada no bloco operacional. Cada fluxo exige tarefa própria; pagamento misto operacional também depende de regras explícitas, embora o modelo 1:N já o permita.
- Mais tarde: Carteira de Cobrança, CNAB, boleto avançado, conciliação bancária, política de crédito, bloqueios automáticos, cobrança avançada e relatórios financeiros avançados.
- Extensões comerciais futuras: portal B2B e força de vendas; não são dependências da próxima fundação financeira.

Esses itens não estão implementados pela fundação de Pagamento. Evoluir por necessidade real, sem antecipar infraestrutura ou levar a complexidade gerencial para a operação.
