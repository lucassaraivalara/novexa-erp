# Entrada de Mercadoria - manual e XML NF-e

Dominio unico `EntradaMercadoriaEntity -> ItemEntradaMercadoriaEntity`, implementado na branch `feat/contas-pagar-integracao-backend`, sobre `039526f`. Criacao manual usa origem MANUAL; importacao revisada usa XML. Ambas criam RASCUNHO e compartilham confirmacao/cancelamento, sem dominio paralelo.

## API

- `POST /estoque/entradas`: cria RASCUNHO e retorna detalhe (201).
- `POST /estoque/entradas/importar-xml`: multipart, campo `arquivo`; retorna EntradaXmlPreviewDTO (200), sem gravar dados.
- `POST /estoque/entradas/from-xml`: dados revisados, mesmo EntradaMercadoriaRequestDTO; exige chave NF-e e cria RASCUNHO XML (201).
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

## Importacao XML NF-e - backend

Fluxo: XML -> preview -> resolucao de fornecedor/produtos -> criacao RASCUNHO -> confirmacao existente. Preview nao cria Entrada, fornecedor, produto ou movimento, nem altera saldo/custo. `from-xml` exige IDs validos e ativos no tenant; nao cadastra entidades implicitamente. Origem/status/tenant/totais sao determinados pelo backend. Dados historicos dos itens ficam no mesmo ItemEntradaMercadoria.

Parser StAX aceita `NFe` ou `nfeProc`, com namespace `http://www.portalfiscal.inf.br/nfe` e prefixo livre; uma nota por arquivo. Rejeita DTD, entidades, resolucao externa, campos duplicados e profundidade acima de 32; limita campos e 200 itens. Filename/content-type nao determinam validade. Limite de leitura segue `spring.servlet.multipart.max-file-size` (2MB atual), inclusive por leitura limitada do stream. Arquivo vazio/XML malformado/inseguro retorna 400, NF-e incompleta/conteudo inadequado 422, tamanho excedido 413 e duplicidade 409, sem expor erro interno.

Extrai chave de `infNFe/@Id` (prefixo NFe + 44 digitos), numero/serie, data local de emissao de dhEmi ou dEmi, emitente, totais e itens: cProd/xProd/cEAN ou cEANTrib/NCM/CFOP/uCom/qCom/vUnCom/vProd. Datas com offset preservam a data declarada no documento, sem conversao para UTC. BigDecimal preserva precisao original no preview. GTIN exige 8/12/13/14 digitos com digito verificador valido; vazio, SEM GTIN ou invalido vira null, usando cEANTrib valido como alternativa. Nao valida assinatura digital ou autorizacao SEFAZ.

Fornecedor e localizado por CPF/CNPJ normalizado/validado com DocumentoUtils e igualdade exata tenant-safe, inclusive documentos historicos mascarados. Inativo e retornado com `ativo=false` para regularizacao; inexistente devolve `fornecedorMatch=null` e os dados do emitente. Produto e localizado por codigoBarras exato, ativo e do tenant; sem match/GTIN devolve `produtoMatch=null`. Nao ha matching por descricao ou ProdutoFornecedor.

Preview retorna `fornecedorXml` (cpfCnpj, razaoSocial, nomeFantasia), `fornecedorMatch` (id, razaoSocial, ativo) ou null, cabecalho/totais originais e itens com `produtoMatch` (id, nome, codigoBarras) ou null. Na criacao, enviar fornecedorId e produtoId resolvidos, chaveAcessoNfe e dados revisados no DTO existente. Quantidade/custo mantem as escalas operacionais de 3/2 casas; XML com precisao superior requer revisao explicita, nao arredondamento silencioso. Totais persistidos sao recalculados pelos itens, podendo diferir do vNF original (frete/impostos nao compoem esta etapa).

Duplicidade por empresa/chave e verificada no preview e na criacao; unique parcial da V34 continua a protecao final, inclusive entre requisicoes concorrentes. Idempotencia de criacao existente permanece, agora distinguindo MANUAL/XML para impedir reutilizar a mesma chave de requisicao entre origens. Nao foi criada migration ou alterado o fluxo de estoque/Financeiro.

Validacao backend: 100 testes direcionados aprovados (30 parser, 13 XML HTTP/H2, 43 Entrada HTTP/H2 e 14 XML PostgreSQL 18.6). Banco local dedicado/schema descartavel, Flyway V1..V34 e Hibernate validate, query exata de documento/GTIN, unicidade estrutural da chave, tenant e ciclo XML -> rascunho -> confirmacao/cancelamento. Package backend e diff check aprovados. Sem frontend, E2E geral ou suite financeira.

## Frontend XML

Importar XML esta na aba Entradas existente. Aceita um arquivo .xml de ate 2 MB, enviado como multipart `arquivo` pelo service, sem parser frontend. Mostra cabecalho, emitente, totais originais e itens. Reutiliza EntradaMercadoriaForm/CadastroDialog e a mesma revisao/confirmacao manual; mobile usa dialog full screen e itens empilhados com scroll vertical.

Fornecedor ativo encontrado fica selecionado; ausente permite cadastro rapido no FornecedorForm real, pre-preenchido com os dados do emitente, e seleciona o retorno. Inativo exige escolher fornecedor ativo pelo autocomplete remoto; nao reativa implicitamente nem cadastra duplicado. Produto encontrado vem selecionado; pendentes usam busca remota existente, sem matching por nome ou carregar catalogo completo. Cadastro embutido de produto nao foi adicionado: selecionar produto existente, ou cadastra-lo previamente na manutencao atual.

Sem fornecedor ou itens vinculados, salvar/confirmar fica bloqueado. Quantidade/custo podem ser revisados explicitamente para as escalas de 3/2 casas; selecionar produto nao sobrescreve o custo do XML. Total operacional local e apenas preview, separado dos totais originais da NF-e; backend recalcula os valores persistidos. Salvar como rascunho chama `from-xml`; confirmar cria rascunho e chama o endpoint existente pelo ID, com protecao contra clique duplo, reconciliacao e preservacao do ID em falha. Nenhum update de estoque/custo ocorre no frontend.

Erros de preview 400/422/409/413 exibem mensagens amigaveis sem detalhes tecnicos; erros de criacao/confirmacao preservam o tratamento existente. Validacao: 33 testes direcionados de Entrada/XML e Fornecedor, TypeScript/build e lint dos arquivos alterados; navegador real desktop/mobile com HTTP simulado, sem homologacao integrada com backend nesta etapa.

## Fora desta etapa

ProdutoFornecedor, matching por nome, Pedido/Ordem de Compra, Cotacao, recebimento parcial, custo medio, tributacao e geracao automatica de Conta a Pagar nao foram implementados. Entrada nao altera Caixa, Contas Financeiras, PIX, Recebiveis ou Transferencias.
