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

`VendaEntity → ItemVendaEntity (itens_venda) → Produto` é o único modelo ativo para venda aberta e faturada. O item preserva preço/nome aplicados e referência ao movimento de estoque. Faturamento reutiliza `MovimentacaoEstoqueService`, registra `PagamentoEntity` e mantém o lançamento financeiro temporário na mesma transação, com lock da Venda e dos Produtos. A fundação `Venda 1 → N Pagamento` está descrita em [financeiro.md](financeiro.md); cancelamento completo e destinos financeiros permanecem futuros.

A V6 migra o modelo legado e mantém a tabela original somente como arquivo histórico. Contratos HTTP, validações e limitações de execução estão em [CURRENT_STATE.md](CURRENT_STATE.md).
