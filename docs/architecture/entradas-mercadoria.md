# Entrada de Mercadoria - manual e XML NF-e

Kit/Combo composto não pode ser recebido como mercadoria nem movimentado fisicamente. Entrada manual/XML deve referenciar os componentes físicos; não cria montagem, compra ou entrada automática do composto. A validação backend rejeita o composto e o seletor apresenta produtos físicos. Custo/disponibilidade do composto são derivados dos componentes conforme [produtos.md](produtos.md#kitcombo--composição-operacional-v46).

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

Na Etapa 6 da branch `feat/central-configuracoes`, o histórico de estoque passa a abrir este detalhe por `entradaMercadoriaId`, obtido dos vínculos persistidos de confirmação/reversão dos itens, inclusive para Entrada cancelada. O acesso em nova aba usa `/estoque?aba=entradas&entradaId=...` e preserva a consulta original. Contrato e limites em [estoque.md](estoque.md#17-histórico); vínculo e navegação validados na consolidação das Etapas 5 e 6 sobre `1e12040`, com resultados em [CURRENT_STATE.md](CURRENT_STATE.md).

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

17A (implementação local, 26/10/2026): `quantidade × fator` é normalizada com `HALF_UP` em três casas antes de movimentar, conforme `NUMERIC(19,3)` já adotado. Conversão arredondada a zero ou além da capacidade é 409 com rollback integral. O cancelamento confere produto, origem, tipo, quantidade normalizada e diferença entre saldos do movimento original, e reverte sua quantidade persistida. Exemplo: `0,003 × 0,5 → 0,002`; cancelamento retira exatamente `0,002`. O fator histórico do item não é substituído pelo cadastro atual. Custo/total financeiro mantêm a regra anterior.

Controle empresarial desligado não impede uma Entrada explícita em produto físico ativo e controlado. Produto inativado ou com controle individual desligado depois da confirmação não impede, por si só, a reversão histórica. Regras de saldo suficiente, obrigação financeira vinculada e integridade continuam válidas. Evidências no [relatório 17A/17B](../audits/evolucao-estoque-17a-17b-2026-10-26.md).

RASCUNHO nao altera saldo nem precoCusto. Confirmacao revalida cadastros, aplica ENTRADA/COMPRA via MovimentacaoEstoqueService e grava o ID original em cada item. Cada item guarda o snapshot do fator de conversao do vinculo produto+fornecedor (V52, padrao 1): a confirmacao credita `quantidade x fator` no estoque e atualiza o precoCusto com `valorUnitario / fator` (custo por unidade de estoque; o valorUnitario continua por embalagem comprada). Nao calcula custo medio. A confirmacao tambem memoriza o `codigoProdutoFornecedor` do item no vinculo (cria quando ausente, preenche quando o codigo e nulo; nunca sobrescreve codigo definido nem altera fator), alimentando o matching por codigo de fabricante do XML.

Cancelamento valida movimento original (tenant, produto, quantidade efetiva `quantidade x fator` do snapshot, ENTRADA/COMPRA), aplica SAIDA/CANCELAMENTO pelo mesmo nucleo de estoque e guarda o ID inverso. Preserva entrada, itens e movimentos originais. A reversao historica segue o padrao do cancelamento de Venda e continua possivel se o cadastro posteriormente ficar inativo/sem controle. Saldo insuficiente rejeita a transacao inteira. Nao ha restauracao automatica de precoCusto no cancelamento, evitando sobrescrever custos de entradas posteriores.

Ordem: criacao bloqueia usuario (padrao idempotente de Venda); edicao/confirmacao/cancelamento bloqueiam Entrada. Confirmacao tambem bloqueia Fornecedor para leitura antes dos produtos. Confirmacao e cancelamento bloqueiam todos os Produtos em ID crescente e fazem refresh apos adquirir os locks. Nenhum desses fluxos adquire lock de usuario depois de produto. MovimentacaoEstoqueService reutiliza os locks de produto ja adquiridos. Cada operacao e uma unica transacao; falha de qualquer item reverte movimentos, saldo, custo, referencias, status e auditoria.

Confirmacao repetida de CONFIRMADA e cancelamento repetido de CANCELADA retornam o estado atual, sem novos movimentos. Confirmar CANCELADA ou cancelar RASCUNHO retorna 409. Criacao aceita chaveRequisicao UUID opcional: lock de usuario + resumo SHA-256 do DTO + unique por empresa/usuario/chave; mesmo payload retorna a entrada atual, chave com payload diferente retorna 409. A chave identifica a criacao e nao e modificada por PUT. Sem chave, criacao nao promete deduplicacao de pedidos sem identificacao de nota.

## Banco / duplicidade

V52 aditiva acrescenta `fator_conversao` a produto_fornecedor (com CHECK > 0) e a itens_entrada_mercadoria (NOT NULL DEFAULT 1), sem alterar migrations anteriores nem dados existentes. V34 aditiva cria entradas_mercadoria e itens_entrada_mercadoria, sem alterar V1..V33 ou backfill. FKs compostas protegem fornecedor, usuarios, entrada, produto e movimentos por tenant; referencia de movimento tambem exige o mesmo produto. Uniques adicionais em produtos e movimentacoes_estoque suportam essas FKs, sem mudar saldo/historico existentes.

Nota identificada e unica por empresa/fornecedor/numero/serie, com serie null equivalente a vazia; inclui rascunhos e canceladas para preservar identificacao historica. Numero igual em outro fornecedor/tenant e permitido; multiplas entradas sem numero/chave sao permitidas. Chave NF-e e unica por empresa quando preenchida. IDs de movimentos originais/inversos sao unicos por item. CHECKs validam valores, quantidade, status/origem, chave e auditoria. Indices de empresa/data/id e empresa/fornecedor atendem listagem e referencia; nao ha pg_trgm nem tuning especulativo.

## Frontend manual

Disponivel nas abas Saldo/Entradas de mercadoria da tela Estoque existente, sem nova rota ou item de menu. Listagem administrativa paginada usa termo, status, fornecedorId, periodo e sort no backend. FornecedorAutocomplete/FornecedorForm rapido sao reutilizados; cadastro rapido retorna o fornecedor ja selecionado. Produto usa /produtos/buscar com useRemoteSearch somente para termos de pelo menos dois caracteres, evitando carregar o catalogo completo.

Na branch `feat/central-configuracoes`, sobre `8fd6b40`, o formulário manual/XML oferece Consultar produtos (`/produtos`) e Consultar fornecedores (`/produtos?aba=fornecedores`) em nova aba. A entrada permanece montada, com fornecedor, itens, quantidades, custos, dados da nota e parâmetros da URL preservados. A orientação pede voltar à aba original para continuar; Voltar às entradas mantém o fechamento existente para a listagem. Não há retorno por uma nova instância da rota nem restauração por armazenamento. Cadastros rápidos, buscas remotas, seleção explícita e confirmação/cancelamento permanecem. Textos distinguem cadastro de produto, recebimento com fornecedor e ajuste avulso de saldo. Testes, build, lint e homologação desta navegação não executados por orientação explícita; validação pendente.

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

Fornecedor ativo encontrado fica selecionado; ausente permite cadastro rapido no FornecedorForm real, pre-preenchido com os dados do emitente, e seleciona o retorno. Inativo exige escolher fornecedor ativo pelo autocomplete remoto; nao reativa implicitamente nem cadastra duplicado. Produto encontrado vem selecionado; pendentes usam busca remota existente, sem matching por nome ou carregar catalogo completo.

Entrada manual e XML reutilizam ProdutoForm em modo rapido: nome, codigo de barras, unidade, preco de custo e preco de venda. No XML, descricaoOriginal/gtin/unidade/valorUnitario preenchem nome/codigo/unidade/custo; preco de venda nao e inferido. O POST existente retorna o produto, imediatamente selecionado no item sem nova busca. Produto nasce com estoque zero: quantidade da entrada nunca e enviada no cadastro. Custo XML preserva sua precisao para revisao explicita; cadastro nao arredonda silenciosamente nem substitui o custo do documento. Erros 400/409 usam o tratamento existente. Modo completo permanece compativel; nenhuma regra backend foi alterada.

Sem fornecedor ou itens vinculados, salvar/confirmar fica bloqueado. Quantidade/custo podem ser revisados explicitamente para as escalas de 3/2 casas; selecionar produto nao sobrescreve o custo do XML. Total operacional local e apenas preview, separado dos totais originais da NF-e; backend recalcula os valores persistidos. Salvar como rascunho chama `from-xml`; confirmar cria rascunho e chama o endpoint existente pelo ID, com protecao contra clique duplo, reconciliacao e preservacao do ID em falha. Nenhum update de estoque/custo ocorre no frontend.

Erros de preview 400/422/409/413 exibem mensagens amigaveis sem detalhes tecnicos; erros de criacao/confirmacao preservam o tratamento existente. Validacao: 33 testes direcionados de Entrada/XML e Fornecedor, TypeScript/build e lint dos arquivos alterados; navegador real desktop/mobile com HTTP simulado, sem homologacao integrada com backend nesta etapa.

Cadastro rapido validado com 37 testes direcionados de Entrada/XML/Produto e 3 verificacoes diretamente afetadas do formulario completo, build/TypeScript e lint. Navegador desktop/mobile com API simulada cobre selecao por item, ausencia de estoque no payload, erros, precisao e bloqueio de clique duplo; nao substitui homologacao com backend real.

## Etapa 5 — obrigação financeira explícita

Implementado na branch `feat/central-configuracoes` em `25b703c`, com consolidação local descrita abaixo. Apenas Entrada CONFIRMADA aceita geração/vinculação por ação do usuário. Criar rascunho, importar XML e confirmar estoque não geram dívida. Cada Entrada possui no máximo uma conta vinculada, e uma conta não pode estar vinculada a duas Entradas. GERADA identifica conta criada pela Entrada; PREEXISTENTE identifica conta manual já cadastrada. Datas/usuário de vinculação são persistidos. Desvincular uma preexistente remove a associação atual e preserva a conta; não existe novo histórico financeiro ou exclusão de títulos.

Contrato autenticado, empresa sempre do JWT; respostas 200 com ObrigacaoEntradaDTO (`entradaId`, `origem`, `conta`, `usuarioVinculoId`, `dataVinculo`, `podeGerar`, `podeVincular`, `podeDesvincular`, `podeCancelarEntrada`, `motivoBloqueioCancelamento`):

- `GET /estoque/entradas/{id}/conta-pagar`: consulta; sem vínculo, `conta`/`origem` nulos. Flags descrevem o estado financeiro; saldo físico e demais regras de cancelamento continuam revalidados pelo endpoint existente.
- `POST /estoque/entradas/{id}/conta-pagar/gerar`: `{chaveRequisicao: UUID, descricao, valor, dataVencimento}`. Valor positivo, até duas casas, independente do total operacional; fornecedor/documento/emissão vêm da Entrada, sem inferir frete/impostos. Reutiliza criação de ContaPagar ABERTA, sem movimento financeiro. Mesma chave e mesmos dados normalizados retornam a obrigação existente, inclusive após cancelamento; chave/payload diferentes com vínculo existente retornam 409. Conta gerada permanece vinculada para preservar origem e impedir nova geração.
- `POST /estoque/entradas/{id}/conta-pagar/vincular`: `{contaPagarId}`. Aceita ABERTA/PAGA da empresa, sem vínculo anterior; fornecedor informado deve coincidir com a Entrada. Conta sem fornecedor pode ser escolhida explicitamente, sem preencher ou alterar seu cadastro. Valor, pagamento e histórico existentes não mudam. Repetir o mesmo vínculo retorna o estado atual.
- `POST /estoque/entradas/{id}/conta-pagar/desvincular`: `{contaPagarId}` esperado. Apenas PREEXISTENTE sem pagamento efetivo e em Entrada confirmada; vínculo diferente retorna 409. Repetir sem vínculo não altera nada. Conta gerada não pode perder a origem.

Pagamento efetivo considera status PAGA, valor pago positivo ou movimento financeiro não estornado; registros legados pagos também bloqueiam. A integração nunca chama baixa ou estorno. Depois do tratamento financeiro explícito pelos fluxos existentes, o estado é reavaliado.

Cancelamento da Entrada: sem conta, comportamento anterior; com GERADA aberta, cancela a obrigação e reverte estoque na mesma transação (falha física também desfaz cancelamento financeiro). Com PREEXISTENTE, bloqueia até desvincular, sem cancelá-la automaticamente. Com pagamento efetivo, bloqueia também a desvinculação. Cancelamento repetido de Entrada CANCELADA conserva o histórico. Não restaura custo nem altera regras de estoque.

V37 aditiva inclui vínculo opcional, FK ContaPagar/usuário por empresa, unicidade da conta, check de origem/auditoria e chave/resumo de geração, sem backfill. Operações bloqueiam contas antes da Entrada; o cancelamento prossegue para os produtos só depois da decisão financeira. Leitura anterior ao lock é revalidada; mudança concorrente do vínculo retorna 409 para atualização/retry. ContaPagar mantém seu lock nas operações de editar/pagar/cancelar/estornar; não adquire lock de Entrada depois dele por outra ordem.

Frontend: detalhe confirmado/cancelado mostra origem, situação e valor financeiro; geração sugere somente `valorTotal`, permite edição e preserva UUID/payload em tentativa incerta. Vinculação consulta páginas de contas, sem carregar catálogo completo; canceladas, já vinculadas e fornecedores incompatíveis não são selecionáveis. Consulta/atualização da obrigação não apaga dados do formulário. A conta exata abre `/financeiro/contas-pagar?contaId=...`; o retorno abre `/estoque?aba=entradas&entradaId=...`. Ambos usam nova aba para preservar o contexto de origem. Fechar detalhes remove apenas o parâmetro correspondente. Cancelar exige consulta prévia de bloqueios e nova validação no backend; não há consultas de obrigação por linha da listagem.

Validação local em 2026-10-15 sobre `25b703c` e correção do foco de Descrição após abertura do diálogo: 58 testes de `EntradaMercadoriaHttpTest`/`ContaPagarHttpTest`, 54 de `EntradaContaPagarPostgresTest`/`EntradaContaPagarMigrationTest` e 44 frontend de Entrada/Fornecedor/Contas a Pagar passaram. O PostgreSQL 18.6 recebeu V1→V37 em schema novo e V36→V37 com dados anteriores, Flyway validate/reaplicação sem efeito e Hibernate validate; nenhum banco operacional foi migrado. Cobertura de FK tenant-safe, unicidade, geração concorrente/retry, disputa de conta entre Entradas, geração/pagamento contra cancelamento, preexistente aberta/paga e rollback quando falta estoque. Sem alteração de regras ou da migration V37.

Playwright `e2e/entrada-conta-pagar.spec.mjs`: cinco cenários passaram com HTTP/backend/PostgreSQL reais em banco descartável, sem interceptação. Conferência de geração, vínculo/desvinculação, conta paga/bloqueio, cancelamento, destinos exatos e contexto original; tamanhos 1440×900, 1366×768, 390×844 e 1024×600, incluindo a nova aba da Conta a Pagar. Verificados foco inicial/ativação por teclado, ações alcançáveis e ausência de overflow horizontal nos diálogos. Para reproduzir: API/frontend locais apontados ao banco descartável; `E2E_ENTRADA_API_URL`, `E2E_BASE_URL`, `E2E_USER_CPF` e `E2E_USER_PASSWORD` definidos; executar `npx playwright test e2e/entrada-conta-pagar.spec.mjs --workers=1`. O teste cria apenas dados de validação; não usar empresa operacional. Os testes PostgreSQL usam `-Dnovexa.test.entrada.jdbc-url=jdbc:postgresql://.../banco_descartavel`, usuário opcional `-Dnovexa.test.entrada.jdbc-user=...` e senha em `NOVEXA_ENTRADA_TEST_DB_PASSWORD`; seus schemas aleatórios são removidos ao terminar.

Build e lint passam (aviso de bundle e dois avisos preexistentes de React Hook Form). Maven 3.9.16 do cache local foi usado diretamente, equivalente ao wrapper, cujo script PowerShell falhou antes de executar Java. Suítes completas executadas, mas com falhas fora do vínculo: dez erros de fixture de vendas em `PaginacaoHttpTest` e seis falhas frontend em Vendas/Contas a Receber/configuração de cartão. Resultados e pendências em [CURRENT_STATE.md](CURRENT_STATE.md). **Sem CONTRACT READY enquanto a validação geral obrigatória falhar.**

Revalidação conjunta das Etapas 5 e 6 sobre `1e12040`: 78 testes backend relacionados, 55 PostgreSQL/Flyway, 51 frontend e sete cenários Playwright com HTTP real aprovados. Reutilizados os cenários de geração/vínculo, origem GERADA/PREEXISTENTE, repetição, pagamento efetivo, desvinculação, cancelamento e rollback de estoque; V36→V37 e migração do zero validadas novamente em schemas descartáveis, sem mudar a V37. A cobertura essencial do histórico foi incorporada à suíte HTTP de Entrada e herdada pela suíte PostgreSQL; o mesmo arquivo E2E acrescenta dois cenários do histórico. Build/lint aprovados. As falhas gerais anteriores permanecem pendências separadas, sem reexecução ou correção nesta rodada; CONTRACT READY continua pendente.

## Fora desta etapa

ProdutoFornecedor, matching por nome, Pedido/Ordem de Compra, Cotacao, recebimento parcial, custo medio, tributacao e geracao automatica de Conta a Pagar nao foram implementados. A integração explícita acima não movimenta Caixa, Contas Financeiras, PIX, Recebiveis ou Transferencias.
