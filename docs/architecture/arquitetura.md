docs/
└── architecture/
├── arquitetura.md
├── FINANCEIRO.md
├── VENDAS.md
├── ESTOQUE.md
├── ESTADO_ATUAL.md
├── AGENTES.md
└── ROADMAP.md

## Domínio de Vendas consolidado

`VendaEntity → ItemVendaEntity (itens_venda) → Produto` é o único modelo ativo para venda aberta e faturada. O item preserva preço/nome aplicados e referência ao movimento de estoque. Faturamento reutiliza `MovimentacaoEstoqueService`, registra `PagamentoEntity` e mantém o lançamento financeiro temporário na mesma transação, com lock da Venda e dos Produtos. A fundação `Venda 1 → N Pagamento` está descrita em [financeiro.md](financeiro.md); cancelamento completo e destinos bancários permanecem futuros; a integração mínima de dinheiro com Caixa já existe.

A V6 migra o modelo legado e mantém a tabela original somente como arquivo histórico. Contratos HTTP, validações e limitações de execução estão em [CURRENT_STATE.md](CURRENT_STATE.md).

## Evolução financeira

`Venda → Pagamento` existe na base `aeaec2e`; `Pagamento DINHEIRO → MovimentacaoCaixa` existe no MVP operacional, pela sessão associada à Venda. Os demais destinos permanecem FUTUROS. O lançamento temporário não substitui os destinos oficiais.

A fundação de Formas de Pagamento separa o catálogo global compartilhado (`FormaPagamentoEntity`, sem Empresa) do tipo técnico (`TipoFormaPagamento`). Pagamento referencia a forma, mantendo seu próprio tenant. Condição de prazo/parcelamento e os cadastros `Banco → Agência → Conta Bancária` permanecem futuros. Caixa possui cadastro e relação 1:N com SessaoCaixaEntity, com uma única sessão aberta e histórico de fechamentos; com Venda vinculada à sessão, totais operacionais por forma e movimentos físicos VENDA/SUPRIMENTO/SANGRIA. A sessão não transforma PIX/cartões em dinheiro; veja os contratos em financeiro.md. Configuração cadastral, sessão operacional, registro de pagamento e movimentação financeira têm responsabilidades distintas.

Preservar histórico, contratos e isolamento da empresa, sem exigir antecipadamente dependências de Caixa/Banco no Pagamento ou novas etapas no PDV. Os conceitos e estágios ficam em [financeiro.md](financeiro.md); a ordem incremental, em [roadmap.md](roadmap.md).
