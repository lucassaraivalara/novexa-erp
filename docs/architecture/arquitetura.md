docs/
└── architecture/
├── arquitetura.md
├── FINANCEIRO.md
├── VENDAS.md
├── ESTOQUE.md
├── ESTADO_ATUAL.md
├── AGENTES.md
└── ROADMAP.md

## Consultas paginadas

As consultas de crescimento contínuo usam Page/Pageable e PaginaResponseDTO, com tenant, filtros, ordenação e paginação no banco. Contratos e exceções List em [paginacao.md](paginacao.md).

## Usuários

`/usuarios` usa o tenant do JWT em listagem, cadastro e edição. O contrato de cadastro exige senha; a edição preserva o hash quando a senha não é informada. `PATCH /usuarios/{id}/senha` recebe somente a nova senha e `PATCH /usuarios/{id}/situacao` atualiza somente `ativo`, bloqueando a inativação do próprio usuário. `UsuarioResponseDTO` expõe a situação, nunca a senha. O filtro de segurança reserva `/usuarios` a `ADMIN`, cancelamento de Venda e sangria/suprimento a `ADMIN` ou `GERENTE`. No serviço de Sessão de Caixa, `OPERADOR` e o legado `USUARIO` só fecham a própria sessão; a abertura continua disponível aos perfis autenticados. O perfil no JWT é atualizado no próximo login.

## Domínio de Vendas consolidado

`VendaEntity → ItemVendaEntity (itens_venda) → Produto` é o único modelo ativo para venda aberta e faturada. O item preserva preço/nome aplicados e referência ao movimento de estoque. Faturamento reutiliza `MovimentacaoEstoqueService`, registra `PagamentoEntity` e mantém o lançamento financeiro temporário na mesma transação, com lock da Venda e dos Produtos. A fundação `Venda 1 → N Pagamento` está descrita em [financeiro.md](financeiro.md); cancelamento completo e destinos bancários permanecem futuros; a integração mínima de dinheiro com Caixa já existe.

A V6 migra o modelo legado e mantém a tabela original somente como arquivo histórico. Contratos HTTP, validações e limitações de execução estão em [CURRENT_STATE.md](CURRENT_STATE.md).

## Evolução financeira

`ContaPagarEntity` pertence à Empresa, com Fornecedor opcional da mesma empresa (FK composta na V17). O controller obtém o tenant do JWT; criação, edição, pagamento, cancelamento e estorno não recebem `empresaId`. A V20 vincula a baixa à MovimentacaoFinanceira de mesma empresa; novas baixas exigem Conta Financeira ativa e geram SAIDA/CONTAS_A_PAGAR, revertida no estorno. Pagamentos legados sem vínculo seguem válidos. Não há movimentação de Caixa/PDV ou da Conta Bancária cadastral. O frontend usa `/financeiro/contas-pagar` com lista e drawer, ainda sem enviar a conta financeira exigida pelo backend.

`ContaFinanceiraEntity` e `MovimentacaoFinanceiraEntity` formam um saldo gerencial separado de `CaixaEntity`/`SessaoCaixaEntity`. A V19 usa FKs compostas de empresa para conta e operadores; movimentos e estornos serializam pelo lock pessimista da Conta Financeira. A V21 vincula BANCO a `ContaBancariaEntity` em 1:1, com FK composta por empresa e unicidade; a identidade bancária não recebe saldo. Tipos e compatibilidade: [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md). Origens MANUAL e CONTAS_A_PAGAR estão habilitadas; a origem automática só é estornada pela baixa. Não há roteamento por forma de pagamento. O frontend usa `/financeiro/contas-financeiras` com lista, cadastro e extrato lateral.

Na branch `feat/conferencia-fechamento-backend` (baseline atualizado `1b313df`), a V16 acrescenta modalidade/observacao a SessaoCaixa e a relacao 1:N com ConferenciaFechamentoCaixa. O fechamento POR_FORMA persiste snapshots operacionais por forma e uma contagem fisica unica; o contrato LEGADA permanece disponivel. FK composta protege o tenant e o lock existente serializa fechamento, vendas e cancelamentos. Contrato e limites da Fase 1 em [financeiro.md](financeiro.md). O detalhe de sessão fechada agrega esses snapshots, resumo e eventos no endpoint de leitura; não altera persistência ou regra de fechamento.

`Venda → Pagamento` existe na base `aeaec2e`; `Pagamento DINHEIRO → MovimentacaoCaixa` existe no MVP operacional, pela sessão associada à Venda. Os demais destinos permanecem FUTUROS. O lançamento temporário não substitui os destinos oficiais.

A fundação de Formas de Pagamento separa o catálogo global compartilhado (`FormaPagamentoEntity`, sem Empresa) do tipo técnico (`TipoFormaPagamento`). Pagamento referencia a forma, mantendo seu próprio tenant. Condição de prazo/parcelamento e os cadastros `Banco → Agência → Conta Bancária` permanecem futuros. Caixa possui cadastro e relação 1:N com SessaoCaixaEntity, com uma única sessão aberta e histórico de fechamentos; com Venda vinculada à sessão, totais operacionais por forma e movimentos físicos VENDA/SUPRIMENTO/SANGRIA. A sessão não transforma PIX/cartões em dinheiro; veja os contratos em financeiro.md. Configuração cadastral, sessão operacional, registro de pagamento e movimentação financeira têm responsabilidades distintas.

Preservar histórico, contratos e isolamento da empresa, sem exigir antecipadamente dependências de Caixa/Banco no Pagamento ou novas etapas no PDV. Os conceitos e estágios ficam em [financeiro.md](financeiro.md); a ordem incremental, em [roadmap.md](roadmap.md).
