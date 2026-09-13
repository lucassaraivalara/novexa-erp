Empresa ........ funcional
Produto ........ funcional
Cliente ........ funcional
Estoque ........ backend funcional
Venda .......... em consolidação
Caixa .......... cadastro apenas
Dados Bancários  não iniciado
Financeiro ..... fundação parcial
Dashboard ...... placeholder

Frontend operacional de Estoque ...... implementado

- Lista produtos usando o endpoint autenticado de produtos, sem enviar empresaId ou usuarioId.
- Exibe estoque atual, estoque mínimo e situação calculada como NORMAL, BAIXO, ZERADO ou SEM CONTROLE.
- Permite ENTRADA, SAIDA e AJUSTE pelo serviço oficial de movimentações.
- AJUSTE é apresentado como novo saldo físico e não altera o saldo local como fonte definitiva.
- Consulta histórico de movimentações por produto.
- Testes frontend cobrem as classificações de estoque e os contratos HTTP da tela.