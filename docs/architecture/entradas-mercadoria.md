# Entrada de Mercadoria - fluxo manual

Dominio unico `EntradaMercadoriaEntity -> ItemEntradaMercadoriaEntity`, implementado na branch `feat/contas-pagar-integracao-backend`, sobre `039526f`. Origem possui MANUAL/XML; as APIs desta etapa sempre criam MANUAL. XML e apenas capacidade do modelo, sem parser/upload/endpoint de importacao.

## API

- `POST /estoque/entradas`: cria RASCUNHO e retorna detalhe (201).
- `GET /estoque/entradas`: PaginaResponseDTO, sem carregar itens na listagem (`itens=null`).
- `GET /estoque/entradas/{id}`: detalhe, fornecedor, itens, custos, totais, movimentos e auditoria.
- `PUT /estoque/entradas/{id}`: substitui dados/itens somente de RASCUNHO.
- `POST /estoque/entradas/{id}/confirmar`: confirma integralmente, sem body.
- `POST /estoque/entradas/{id}/cancelar`: cancela integralmente CONFIRMADA, sem body.

Nao existe DELETE. Tenant/usuario/origem/status/totais/movimentos/auditoria nao sao definidos pelo request. Autorizacao segue as movimentacoes de estoque atuais: usuario autenticado, ativo e da empresa ativa; nao foi criado perfil ou regra financeira nova. Referencia inexistente ou de outro tenant retorna 404, dados invalidos 400 e conflito de estado/duplicidade/saldo 409. Erro inesperado usa o tratamento global sem detalhes internos.

## Request unico de criacao/edicao

```json
{
  "fornecedorId": 1,
  "numeroNota": "100",
  "serie": "1",
  "dataEmissao": "2026-10-01",
  "dataEntrada": "2026-10-02",
  "itens": [{"produtoId": 1, "quantidade": 5, "valorUnitario": 3.50}]
}
```

Fornecedor e pelo menos um item sao obrigatorios. Maximo 200 itens; agrupar quantidades do mesmo produto. Fornecedor/produtos devem estar ativos e no tenant; produto sem controle de estoque e rejeitado conforme regra existente. Fornecedor inativado apos confirmacao continua no detalhe/historico.

Numero/serie/chave NF-e/dataEmissao/observacao sao opcionais. dataEntrada omitida usa a data local do servidor. Chave NF-e, quando informada, exige 44 digitos. Strings opcionais sao aparadas; vazias tornam-se null. Itens aceitam descricaoOriginal, codigoProdutoFornecedor, gtin, ncm, cfop e unidade opcionais como dados historicos, sem integracao fiscal.

Quantidade positiva, ate 3 casas decimais; custo >= 0, ate 2 casas. BigDecimal, quantidade NUMERIC(19,3), valores NUMERIC(19,2). Total de item = quantidade * valorUnitario, arredondado HALF_UP em 2 casas. valorProdutos = valorTotal = soma dos totais arredondados. Nao ha frete, desconto fiscal, impostos ou valores enviados pelo cliente como fonte de verdade.

## Estoque / transacoes / locks

RASCUNHO nao altera saldo nem precoCusto. Confirmacao revalida cadastros, aplica ENTRADA/COMPRA via MovimentacaoEstoqueService e grava o ID original em cada item. Atualiza precoCusto com o ultimo custo unitario dessa entrada; nao calcula custo medio.

Cancelamento valida movimento original (tenant, produto, quantidade, ENTRADA/COMPRA), aplica SAIDA/CANCELAMENTO pelo mesmo nucleo de estoque e guarda o ID inverso. Preserva entrada, itens e movimentos originais. A reversao historica segue o padrao do cancelamento de Venda e continua possivel se o cadastro posteriormente ficar inativo/sem controle. Saldo insuficiente rejeita a transacao inteira. Nao ha restauracao automatica de precoCusto no cancelamento, evitando sobrescrever custos de entradas posteriores.

Ordem: criacao bloqueia usuario (padrao idempotente de Venda); edicao/confirmacao/cancelamento bloqueiam Entrada. Confirmacao tambem bloqueia Fornecedor para leitura antes dos produtos. Confirmacao e cancelamento bloqueiam todos os Produtos em ID crescente e fazem refresh apos adquirir os locks. Nenhum desses fluxos adquire lock de usuario depois de produto. MovimentacaoEstoqueService reutiliza os locks de produto ja adquiridos. Cada operacao e uma unica transacao; falha de qualquer item reverte movimentos, saldo, custo, referencias, status e auditoria.

Confirmacao repetida de CONFIRMADA e cancelamento repetido de CANCELADA retornam o estado atual, sem novos movimentos. Confirmar CANCELADA ou cancelar RASCUNHO retorna 409. Criacao aceita chaveRequisicao UUID opcional: lock de usuario + resumo SHA-256 do DTO + unique por empresa/usuario/chave; mesmo payload retorna a entrada atual, chave com payload diferente retorna 409. A chave identifica a criacao e nao e modificada por PUT. Sem chave, criacao nao promete deduplicacao de pedidos sem identificacao de nota.

## Banco / duplicidade

V34 aditiva cria entradas_mercadoria e itens_entrada_mercadoria, sem alterar V1..V33 ou backfill. FKs compostas protegem fornecedor, usuarios, entrada, produto e movimentos por tenant; referencia de movimento tambem exige o mesmo produto. Uniques adicionais em produtos e movimentacoes_estoque suportam essas FKs, sem mudar saldo/historico existentes.

Nota identificada e unica por empresa/fornecedor/numero/serie, com serie null equivalente a vazia; inclui rascunhos e canceladas para preservar identificacao historica. Numero igual em outro fornecedor/tenant e permitido; multiplas entradas sem numero/chave sao permitidas. Chave NF-e e unica por empresa quando preenchida. IDs de movimentos originais/inversos sao unicos por item. CHECKs validam valores, quantidade, status/origem, chave e auditoria. Indices de empresa/data/id e empresa/fornecedor atendem listagem e referencia; nao ha pg_trgm nem tuning especulativo.

## Frontend manual

Disponivel nas abas Saldo/Entradas da tela Estoque existente, sem nova rota ou item de menu. Listagem administrativa paginada usa termo, status, fornecedorId, periodo e sort no backend. FornecedorAutocomplete/FornecedorForm rapido sao reutilizados; cadastro rapido retorna o fornecedor ja selecionado. Produto usa /produtos/buscar com useRemoteSearch somente para termos de pelo menos dois caracteres, evitando carregar o catalogo completo.

Formulario permite salvar RASCUNHO ou revisar e confirmar (POST de criacao seguido de POST de confirmacao pelo ID, ou PUT de rascunho existente). Origem MANUAL e definida pelo backend, nao enviada pelo frontend. Payload nao envia tenant, estoque ou totais; total local e apenas preview. Falha de confirmacao mantem o ID conhecido e o rascunho para nova tentativa, com reconciliacao do detalhe. Confirmadas/canceladas sao somente leitura; cancelar exige confirmacao e recarrega dados canonicos. CadastroDialog ganhou apenas uma acao secundaria opcional; consumidores anteriores preservam comportamento.

Validacao frontend direcionada usa navegador real com respostas HTTP simuladas, incluindo mobile, sem E2E geral ou homologacao com banco/backend nesta etapa.

## Fora desta etapa

XML/preview/matching, ProdutoFornecedor, Pedido/Ordem de Compra, Cotacao, recebimento parcial, custo medio, tributacao e geracao automatica de Conta a Pagar nao foram implementados. Entrada nao altera Caixa, Contas Financeiras, PIX, Recebiveis ou Transferencias.
