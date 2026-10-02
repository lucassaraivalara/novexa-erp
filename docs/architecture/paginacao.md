# Paginacao server-side

Implementacao na branch `feat/contas-pagar-integracao-backend`, sobre `4d84785`, ainda nao integrada a main. Consulta aplica empresa do JWT, filtros, ORDER BY e Page/Pageable no banco.

## Contrato

`PaginaResponseDTO<T>` / `PaginaResponse<T>`: `{items, page, size, totalItems, totalPages}`. Defaults: page=0, size=25; size maximo=100. Page negativo, size fora de 1..100, campo/direcao invalidos retornam 400. Sort: `campo,asc` ou `campo,desc`, com desempate por id. Quando o campo principal e id, sua direcao solicitada prevalece. Datas sao inclusivas; periodo invertido retorna 400.

| GET | Filtros | Allowlist sort | Default; desempate |
|---|---|---|---|
| `/vendas` | status, dataInicial, dataFinal, clienteId | id, dataHora, total, status | dataHora,desc; id,desc |
| `/clientes` | situacao, busca, campoBusca | id, nome, nomeFantasia, cpfCnpj, cidadeUf, telefone, ativo | nome,asc; id,asc |
| `/produtos` | busca, campoBusca, situacao, situacaoEstoque | id, codigoInterno, nome, precoVenda, estoqueAtual, estoqueMinimo, ativo | nome,asc; id,asc |
| `/fornecedores` | termo, ativo | id, razaoSocial, nomeFantasia, cpfCnpj, ativo, dataCadastro, dataAtualizacao | razaoSocial,asc; id,asc |
| `/estoque/entradas` | termo (nota/fornecedor), status, origem, fornecedorId, dataInicial, dataFinal (dataEntrada) | id, dataEntrada, dataEmissao, numeroNota, status, origem, valorTotal, dataCadastro | dataEntrada,desc; id,desc |
| `/financeiro/contas-pagar` | busca, status, fornecedor (ID), categoria, vencimentoDe, vencimentoAte, emissaoDe, emissaoAte | id, dataVencimento, dataEmissao, valor, status, categoria | dataVencimento,asc; id,asc |
| `/financeiro/movimentacoes-financeiras` | contaFinanceiraId, tipo, origem, dataInicial, dataFinal, estornada | id, dataMovimento, tipo, origem, valor | dataMovimento,desc; id,desc |
| `/estoque/movimentacoes/produto/{produtoId}` | tipo, origem, dataInicial, dataFinal | id, dataHora, tipo, origem, quantidade | dataHora,desc; id,desc |
| `/financeiro/transferencias` | contaOrigemId, contaDestinoId, status, dataInicial, dataFinal | id, dataMovimento, valor, status | dataMovimento,desc; id,desc |

Cliente: campoBusca aceita id, nome, nomeFantasia, cpfCnpj, cidadeUf e telefone. Produto: nome, codigoInterno e codigoBarras. Campo definido restringe a busca a ele; ausente faz busca geral. Situacao aceita ativos/inativos/todos. SituacaoEstoque aceita baixo/zerado/normal/semControle, aplicada antes do count. Contas a Pagar pesquisa descricao, documento, razao social do fornecedor e categoria. Busca ignora caixa, sem normalizacao de acentos ou pg_trgm.

Cliente usa CASE por campo/direcao no ORDER BY por causa de cidadeUf, derivado da colecao de enderecos. Ordena cidade/UF principal, com fallback ao primeiro endereco; id,asc desempata. Vendas nao possui ORDER BY fixo na consulta paginada.

## Frontend e compatibilidade

Clientes, Produtos, CentralVendas, Estoque, Contas a Pagar e Extrato recebem items/totalItems. Pagina/tamanho/filtro/ordenacao geram request; tamanho/filtro/ordenacao voltam a pagina zero. Busca usa 350 ms e AbortController. Alteracoes recarregam a pagina atual; pagina esvaziada volta a ultima valida. AppTable.ordenacaoRemota conserva a ordem do banco. Historico tem paginacao e filtros proprios. Contas a Pagar usa `/resumo` para totais globais e `/categorias` para opcoes, independentes da pagina.

Dashboard pede cinco vendas. Caixa usa `/vendas/por-sessao/{sessaoId}`, tenant + FATURADA, na timeline existente. A consulta e o service de Transferencias estao paginados; nao havia tela de listagem para migrar. Nenhuma regra de criacao, estorno, locks ou saldo foi alterada.

`/produtos/buscar?termo=...` permanece List para PDV/autocomplete, inclusive termo vazio. `/clientes/opcoes` permanece List para seletores. useRemoteSearch trabalha com arrays; os efeitos paginados mantem o envelope e debounce/cancelamento na propria tela.

## Cadastros secundarios

| Classe | Recursos | Justificativa |
|---|---|---|
| A: agora | Fornecedores | Manutencao paginada; lookup /fornecedores/buscar separado e limitado. Contrato/compatibilidade em fornecedores.md |
| B: pode esperar | Usuarios | Pode crescer; mantido List para evitar ampliar contratos nesta etapa |
| C: continuar List | Contas Financeiras, Configuracoes de Pagamento, Contas Bancarias, Caixas, Agencias, Bancos, Formas de Pagamento | Baixo volume esperado e uso em seletores; nao paginar apenas por uniformidade |

## Indices existentes

Conferidos nas migrations e aplicados no PostgreSQL descartavel. Nenhum indice/migration novo.

| Recurso | Indice existente | Diferenca para os candidatos avaliados |
|---|---|---|
| Vendas | V3: (empresa_id, data_hora); V10: (empresa_id, sessao_caixa_id) | Sem id no indice de data |
| Contas a Pagar | V17: (empresa_id, data_vencimento, id) | Sem status |
| Movimentacoes Financeiras | V19: (empresa_id, conta_financeira_id, data_movimento DESC, id DESC) | Atende extrato por conta/data |
| Estoque historico | V2: (empresa_id, produto_id), mais indices separados | Sem data_hora/id no composto |
| Clientes | V1: empresa_id e (empresa_id, cpf_cnpj) | Sem ativo/nome |
| Produtos | V1: empresa_id; unicos empresa/codigo interno e empresa/codigo barras | Sem ativo/nome |
| Transferencias | V23: (empresa_id, data_movimento DESC, id DESC), origem/empresa e destino/empresa | Ordenacao principal indexada |

Nao houve evidencia de plano/volume que justificasse indice novo. LIKE '%termo%' nao aproveita B-tree comum apenas por adicionar indice de nome. Avaliar EXPLAIN ANALYZE com dados representativos antes de ampliar indices.

## Validacao

PaginacaoHttpTest/PaginacaoPostgresTest verificam paginas 0/1, totais, filtros combinados, allowlists, parametros invalidos, tenant, desempate e cidade/UF. PostgreSQL usa schema UUID descartavel, Flyway ate V28 e Hibernate validate. `npx playwright test e2e/paginacao.spec.mjs` verifica UI/requests com HTTP simulado; consultas reais sao verificadas no PostgreSQL.

Resultado: 10 casos H2 e 10 PostgreSQL aprovados; regressao HTTP aprovada em Vendas (4 listagem e 95 Venda), Clientes (2 HTTP e 17 isolamento), Produtos (25 isolamento), Contas a Pagar (9), Movimentacoes Financeiras (14 ContaFinanceira), Estoque (17) e Transferencias (29). Frontend: 84 testes, seis casos Playwright e build aprovados; lint direcionado aprovado.

Suite backend final: 687 casos, 0 falhas, 38 erros de contexto, 22 ignorados (inclui testes PostgreSQL condicionais, executados separadamente). VendaServiceTest tem 23 erros por ConfirmacaoPagamentoPixService ausente no contexto; EstoqueConcorrenciaTest tem 15 por ArquivoStorageService ausente. Esses contextos e o trabalho PIX foram preservados. Lint global: cinco erros anteriores e tres avisos fora das telas de paginacao. Nao declarar suite completa verde nem pronto para push enquanto PIX estiver pendente de consolidacao.
