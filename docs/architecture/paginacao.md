# Paginacao server-side

Implementacao na branch `feat/contas-pagar-integracao-backend`, sobre `4d84785`, ainda nao integrada a main. Consulta aplica empresa do JWT, filtros, ORDER BY e Page/Pageable no banco.

## Contrato

`PaginaResponseDTO<T>` / `PaginaResponse<T>`: `{items, page, size, totalItems, totalPages}`. Defaults: page=0, size=25; size maximo=100. Page negativo, size fora de 1..100, campo/direcao invalidos retornam 400. Sort: `campo,asc` ou `campo,desc`, com desempate por id. Quando o campo principal e id, sua direcao solicitada prevalece. Datas sao inclusivas; periodo invertido retorna 400.

| GET | Filtros | Allowlist sort | Default; desempate |
|---|---|---|---|
| `/empresas/pagina` | termo (razao social, fantasia, documento), ativo | id, razaoSocial, nomeFantasia, cnpj, ativo | razaoSocial,asc; id,asc |
| `/financeiro/contas-financeiras/pagina` | termo (nome/tipo), ativo, tipo | id, nome, tipo, saldoAtual, ativo, dataCriacao | nome,asc; id,asc |
| `/vendas` | status, dataInicial, dataFinal, clienteId | id, dataHora, total, status | dataHora,desc; id,desc |
| `/clientes` | situacao, busca, campoBusca | id, nome, nomeFantasia, cpfCnpj, cidadeUf, telefone, ativo | nome,asc; id,asc |
| `/produtos` | busca, campoBusca, situacao, situacaoEstoque | id, codigoInterno, nome, precoVenda, estoqueAtual, estoqueMinimo, ativo | nome,asc; id,asc |
| `/produtos/categorias` | termo (nome), ativo | id, nome, ativo | nome,asc; id,asc |
| `/produtos/subcategorias` | termo (nome), ativo, categoriaId | id, nome, ativo | nome,asc; id,asc |
| `/produtos/marcas` | termo (nome), ativo | id, nome, ativo | nome,asc; id,asc |
| `/fornecedores` | termo, ativo | id, razaoSocial, nomeFantasia, cpfCnpj, ativo, dataCadastro, dataAtualizacao | razaoSocial,asc; id,asc |
| `/estoque/entradas` | termo (nota/fornecedor), status, origem, fornecedorId, dataInicial, dataFinal (dataEntrada) | id, dataEntrada, dataEmissao, numeroNota, status, origem, valorTotal, dataCadastro | dataEntrada,desc; id,desc |
| `/financeiro/contas-pagar` | busca, status, fornecedor (ID), categoria, vencimentoDe, vencimentoAte, emissaoDe, emissaoAte | id, dataVencimento, dataEmissao, valor, status, categoria | dataVencimento,asc; id,asc |
| `/financeiro/movimentacoes-financeiras` | contaFinanceiraId, tipo, origem, dataInicial, dataFinal, estornada | id, dataMovimento, tipo, origem, valor | dataMovimento,desc; id,desc |
| `/estoque/movimentacoes/produto/{produtoId}` | tipo, origem, dataInicial, dataFinal | id, dataHora, tipo, origem, quantidade | dataHora,desc; id,desc |
| `/financeiro/transferencias` | contaOrigemId, contaDestinoId, status, dataInicial, dataFinal | id, dataMovimento, valor, status | dataMovimento,desc; id,desc |

Cliente: campoBusca aceita id, nome, nomeFantasia, cpfCnpj, cidadeUf e telefone. Produto: nome, codigoInterno e codigoBarras. Campo definido restringe a busca a ele; ausente faz busca geral. Situacao aceita ativos/inativos/todos. SituacaoEstoque aceita baixo/zerado/normal/semControle, aplicada antes do count. Produtos também aceita categoriaId, subcategoriaId e marcaId opcionais, combinados antes da paginação/count e validados pela empresa do JWT; filtro de subcategoria isolado é aceito. Contas a Pagar pesquisa descricao, documento, razao social do fornecedor e categoria. Busca ignora caixa, sem normalizacao de acentos ou pg_trgm.

Cliente usa CASE por campo/direcao no ORDER BY por causa de cidadeUf, derivado da colecao de enderecos. Ordena cidade/UF principal, com fallback ao primeiro endereco; id,asc desempata. Vendas nao possui ORDER BY fixo na consulta paginada.

## Frontend e compatibilidade

Clientes, Produtos, CentralVendas, Estoque, Contas a Pagar e Extrato recebem items/totalItems. Pagina/tamanho/filtro/ordenacao geram request; tamanho/filtro/ordenacao voltam a pagina zero. Busca usa 350 ms e AbortController. Alteracoes recarregam a pagina atual; pagina esvaziada volta a ultima valida. AppTable.ordenacaoRemota conserva a ordem do banco. Historico tem paginacao e filtros proprios. Contas a Pagar usa `/resumo` para totais globais e `/categorias` para opcoes, independentes da pagina.

Dashboard pede cinco vendas. Caixa usa `/vendas/por-sessao/{sessaoId}`, tenant + FATURADA, na timeline existente. A consulta e o service de Transferencias estao paginados; nao havia tela de listagem para migrar. Nenhuma regra de criacao, estorno, locks ou saldo foi alterada.

`/produtos/buscar?termo=...` permanece List para PDV/autocomplete, limitado a 10 ativos do tenant; termo vazio/branco retorna lista vazia. Codigos de barras/internos exatos tem prioridade, seguidos de nome/id ASC. `/clientes/buscar?termo=...` retorna ate 10 ativos do tenant por nome/nomeFantasia/documento normalizado, nome/id ASC; vazio retorna lista vazia. O parametro opcional `incluirInativos=true` inclui inativos para filtros historicos da Central de Vendas; default false preserva o uso operacional. `/clientes/opcoes` permanece compativel para outros seletores, mas nao alimenta o PDV nem o filtro da Central. useRemoteSearch trabalha com arrays; os efeitos paginados mantem o envelope e debounce/cancelamento na propria tela.

Empresa e Contas Financeiras usam os endpoints administrativos `/pagina`, items/totalItems e AppTable.ordenacaoRemota. Busca tem debounce de 350 ms e cancelamento; filtro/sort/tamanho retornam a pagina zero, mutations recarregam e pagina esvaziada volta a ultima valida. Empresa continua consultando somente o ID da empresa do JWT (nao e um catalogo multiempresa). O backend anterior mantinha apenas List; a consulta paginada e aditiva, sem ampliar acesso. Documento informado com mascara e pesquisado sem pontuacao.

As listas simples `/empresas` e `/financeiro/contas-financeiras` permanecem compativeis. Contas a Pagar e configuracoes mantem seus seletores; a tela administrativa carrega a lista simples somente ao abrir o seletor de transferencia, nao para listar/filtrar/paginar. `/financeiro/contas-financeiras/resumo` agrega por tipo `{tipo, quantidade, saldoAtual}` no banco, para o tenant inteiro, incluindo inativas e legados como antes, independente de pagina/busca. Cards combinam somente esses grupos; falha do resumo exibe indisponibilidade, nunca totais da pagina como globais. Sem mudanca em saldo, locks ou movimentos e sem migration.

## Cadastros secundarios

| Classe | Recursos | Justificativa |
|---|---|---|
| A: agora | Fornecedores | Manutencao paginada; lookup /fornecedores/buscar separado e limitado. Contrato/compatibilidade em fornecedores.md |
| B: pode esperar | Usuarios | Pode crescer; mantido List para evitar ampliar contratos nesta etapa |
| A: agora | Empresa, Contas Financeiras (administracao) | Consulta paginada em /pagina; listas simples preservadas para compatibilidade/seletores |
| C: continuar List | Configuracoes de Pagamento, Contas Bancarias, Caixas, Agencias, Bancos, Formas de Pagamento | Baixo volume esperado e uso em seletores; nao paginar apenas por uniformidade |

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

## Busca vazia/nula — auditoria PostgreSQL (2026-10-17)

Revisão sobre `main`/`8b9d068`, com correção local sem publicação. `EmpresaService.listarPagina` já normalizava busca ausente, vazia e branca para null. No PostgreSQL 18.6, a query de `EmpresaRepository.listarPagina` enviava os parâmetros sem tipo textual ao concat; o resultado era `lower(bytea)`, SQLSTATE `42883` e HTTP 500. Foram acrescentados casts HQL `as string` a `termo` e `documento`, preservando a normalização, o filtro exclusivo do ID da empresa do JWT, paginação, count, ordenação e situação. Nenhuma outra query precisou de alteração.

| Listagens conferidas | Resultado no contrato exposto pelo service |
|---|---|
| Empresas | Falha reproduzida e corrigida na query; antes, seis casos da matriz PostgreSQL retornavam 500 |
| Contas Financeiras e Contas a Receber | Casts textuais já existentes; mantidos e aprovados nos testes PostgreSQL |
| Contas a Pagar, Clientes e Produtos | Service envia texto vazio não nulo; ausência de filtro aprovada sem mudança nas queries |
| Fornecedores | Padrão textual não nulo para nome; documento opcional ancorado no LIKE de campo textual; aprovado sem mudança |
| Entradas de mercadoria, Categorias, Subcategorias e Marcas | Service envia padrão textual não nulo; filtros e consultas aprovados sem mudança |

Também revisadas estaticamente Vendas, Recebíveis, extrato/movimentos financeiros, histórico de estoque e Transferências: parâmetros de data já possuem cast e IDs/enums/booleanos são comparados a atributos tipados; não há a mesma busca textual nula sem tipo. As verificações de nome de Caixa/configuração de pagamento recebem texto obrigatório validado; Usuários e cadastros bancários não expõem essa busca paginada. Não foram modificados apenas por semelhança de sintaxe.

`BuscaPaginadaHttpTest` e `BuscaPaginadaPostgresTest` exercitam as onze listagens com busca ausente, vazia, espaços, tabulação/quebra de linha e texto preenchido, mais paginação real/count, ordenação, situação e isolamento mesmo recebendo empresaId de outro tenant. Empresas também confere nome fantasia e documento mascarado. Antes da correção, H2 aprovou 67 casos e PostgreSQL aprovou 61/67, com as seis falhas exclusivamente em Empresas. Após o cast, 67 H2 e 67 PostgreSQL aprovados (134/134), com Flyway V1–V42 e Hibernate validate em schema descartável. Build backend aprovado. Frontend e contratos HTTP não foram alterados; build/lint frontend não se aplicam a esta correção interna.

A suíte existente de Empresas (leitura, consolidação, isolamento de alterações, cadastro e persistência) aprovou mais 56 casos após o build: 190 aprovações finais nesta etapa. `git diff --check` aprovado. Suíte backend geral não repetida; os erros anteriores de fixture de Vendas não foram corrigidos nem considerados falhas desta matriz. Nenhum dado de produção foi consultado ou alterado.

## Empresas — correção isolada da listagem (2026-10-18)

Correção validada sobre `d2d146b`: a query anterior de `EmpresaRepository.listarPagina` falha no PostgreSQL quando o service normaliza busca ausente/vazia/branca para `null`. Sem tipo textual no parâmetro de `concat/lower`, o driver envia `bytea`; o banco responde SQLState `42883`, `function lower(bytea) does not exist`. O cast `as string` foi preservado e validado; também tipa o parâmetro `documento`, derivado da mesma busca. Não há joins na consulta; o DTO de lista não inicializa inscrições lazy. Nome fantasia e dados cadastrais opcionais nulos continuam aceitos.

Contrato inalterado: GET `/empresas/pagina`, filtros `termo`/`ativo` opcionais, defaults e allowlist acima, envelope paginado e `e.id = empresaId` exclusivamente do JWT. O frontend envia busca vazia como parâmetro ausente e consome `items`/totais do backend; não exige correção. Leituras continuam permitidas aos perfis autenticados existentes; manutenção exige ADMIN. Empresa de outro tenant, mesmo enviada no parâmetro extra `empresaId`, não amplia o resultado. Sem autenticação retorna 401; ordenação inválida retorna 400.

Evidência de produção somente leitura: GET `/empresas/pagina` retornou HTTP 500 no log HTTP da API, request ID `5f371680-6edf-4a1d-a981-705a7017ad4f`, com erro SQL correspondente. A tela exibiu o texto sanitizado “Nao foi possivel concluir a operacao. Informe o X-Request-ID ao suporte.” Nenhuma entrada de console JavaScript foi capturada pela ferramenta. Não foram capturados o header de resposta nem a URL absoluta com query string; o request ID acima foi obtido nos logs, sem expor Authorization ou dados cadastrais.

Regressão: contra a query publicada, teste HTTP em PostgreSQL descartável reproduziu 3 falhas (ausente/vazio/espaços) e 2 aprovações (busca preenchida). Com a correção, 92 testes backend de Empresas aprovados, incluindo 27 PostgreSQL, Flyway V1–V43 e Hibernate validate; transações de teste revertidas e schema UUID removido. Cobrem parâmetros ausentes, buscas, nulos permitidos, vazio, situação, paginação, ordenação, autenticação e isolamento. Frontend: 17 testes aprovados (7 de formulário, 5 novos da listagem e 5 existentes de paginação de Empresas), com HTTP simulado. Capturas claro/escuro/automático em 1440×900, 1024×640, 390×844 e 390×480 em `frontend/node_modules/.vite-empresa-listagem`, fora do Git. Os testes com HTTP simulado não comprovam integração frontend/API em produção; o smoke após deploy é conferido separadamente na entrega.

Builds backend/frontend e lint aprovados; permanecem dois avisos preexistentes de React Hook Form nos formulários financeiros e o aviso de tamanho do bundle. Suíte geral não repetida; falhas históricas de fixture de Vendas não foram alteradas. Sem migration, SQL corretivo ou alteração de dados reais. A publicação inclui somente a correção de Empresas e seus testes/documentação; a auditoria ampla de buscas permanece separada.

## Auditoria preventiva complementar de buscas (2026-10-18)

Árvore local da `main` sobre `d2d146b`, incluindo a correção de Empresas já pendente. Revalidados repositories, respectivos services/controllers e os parâmetros enviados pelas telas. Nenhuma nova falha SQLState `42883` foi reproduzida; nenhuma query, service, DTO, componente ou migration foi alterado nesta auditoria. A correção anterior de Empresas e todas as demais alterações locais foram preservadas.

### Backend: classificação e evidência

| Locais auditados (repository + normalização no service) | Classificação quanto a texto opcional | Evidência atual |
|---|---|---|
| EmpresaRepository.listarPagina / EmpresaService | Risco confirmado na query publicada; corrigido localmente na tarefa anterior | Null de busca/documento com cast textual; matriz PostgreSQL aprovada |
| ContaFinanceiraRepository.listarPagina, ContaReceberRepository.listarPagina | Seguro, sem alteração | Null permitido, casts textuais já existentes; PostgreSQL aprovado |
| ClienteRepository.findAllPaginado, ProdutoRepository.listarPagina, ContaPagarRepository.listarPagina | Seguro pelo contrato do service | Busca ausente/vazia/branca chega como texto vazio não nulo; PostgreSQL aprovado |
| FornecedorRepository.listarPagina/buscarPorTermo | Seguro pelo contrato do service | Padrão textual não nulo; documento opcional comparado a expressão textual; PostgreSQL aprovado com documento nulo |
| EntradaMercadoriaRepository.listarPagina, CategoriaProdutoRepository.listar, SubcategoriaProdutoRepository.listar, MarcaRepository.listar | Seguro pelo contrato do service | Padrões `%...%` não nulos e escape de `!`, `%`, `_`; PostgreSQL aprovado |
| UsuarioRepository.listarPagina / UsuarioService | Seguro, sem alteração | Nome/login/e-mail/CPF pesquisados com padrões não nulos; PostgreSQL aprovado |
| ClienteRepository.buscarPorTermo, ProdutoRepository.buscarPorTermo | Seguro pelo contrato do service/controller | Vazio/branco não consulta o repository. Clientes aceita parâmetro ausente; Produtos exige `termo` e retorna 400 quando ausente; PostgreSQL aprovado |
| VendaRepository, RecebivelRepository, MovimentacaoEstoqueRepository, MovimentacaoFinanceiraRepository, TransferenciaFinanceiraRepository | Seguro quanto ao padrão textual investigado; revisão estática | Filtros opcionais são IDs/enums/booleanos ligados a atributos tipados e datas com cast; não recebem busca textual opcional em `lower/concat` |
| CaixaRepository, ConfiguracaoFormaPagamentoEmpresaRepository, FormaPagamentoRepository; verificações de duplicidade de Empresa/Categoria/Subcategoria/Marca | Seguro quanto ao padrão investigado; revisão estática | Nome/descrição obrigatórios validados antes da query; documento ligado a comparação textual; sem nova correção |
| UsuarioRepository: login/e-mail e query nativa findByCpfNormalizado | Seguro quanto ao padrão investigado; revisão estática | Comparação com atributo/expressão textual; CPF de autenticação validado/normalizado e globalmente único, sem filtro opcional em lower do parâmetro |
| BancoRepository, AgenciaRepository, ContaBancariaRepository | Seguro quanto ao padrão investigado; revisão estática | Listas sem busca textual opcional; filtros por IDs/enums/booleanos tipados e identidades obrigatórias. Nenhuma alteração |

Não há ocorrência adicional classificada como risco confirmado nem risco potencial exposto sem decisão nesta matriz. A revisão estática das consultas sem texto opcional não equivale à execução de todos os seus filtros ou fluxos de escrita.

### Frontend: envio e tratamento da consulta

| Tela/arquivo | Parâmetros e normalização conferidos | Resultado |
|---|---|---|
| Empresa/Empresa.tsx | `termo: busca.trim() || undefined`, `ativo`, `page/size/sort` | Montagem omite termo; vazio, totais e retry existentes preservados |
| Clientes/Clientes.tsx + clienteService.ts | `busca`, `campoBusca`, `situacao`, `page/size/sort`; texto encaminhado, normalizado no backend | Não exige omissão/trim adicional no frontend; catch e estado vazio existentes |
| Produtos/Produtos.tsx + produtoService.ts | `busca`, `campoBusca`, `situacao`, IDs de classificação, `page/size/sort`; trim no backend | Consulta preserva paginação/ordenação remotas; erro e vazio existentes |
| Produtos/Fornecedores.tsx | `termo.trim() || undefined`, `ativo`, `page/size/sort` | Ausência/vazio aceitos; catch/retry e totais existentes |
| Usuarios/Usuarios.tsx + usuarioService.ts | `termo` encaminhado, `ativo`, `page/size/sort`; trim/lower/escape no backend | Montagem válida; restrição ADMIN, paginação e feedback existentes |
| Financeiro/ContasFinanceiras.tsx | `termo.trim() || undefined`, `ativo`, `tipo`, `page/size/sort` | Query já corrigida; falha de resumo/lista não muda o universo de saldo |
| Estoque/EntradasMercadoria.tsx | `termo.trim() || undefined`, status/origem/fornecedor/período, `page/size/sort` | IDs e datas opcionais omitidos; catch e totais existentes |
| Estoque/Estoque.tsx + estoqueService.ts | Reutiliza `/produtos`, com `codigoEstoque` traduzido para `codigoInterno`; histórico usa IDs/enums/datas | Sem busca textual nula nova; filtros/paginação independentes preservados |
| Vendas/CentralVendas.tsx + centralVendasUtils.ts | status/datas/clienteId omitidos quando vazios; cliente usa lookup remoto | Sem campo textual opcional na query de Vendas; catch e envelope existentes |
| Financeiro/Caixa.tsx | Listas operacionais; situação e paginação do histórico locais, sem termo textual enviado | Sem request de busca nula; carregamento/erro/vazio existentes; não alterado |
| Configuracoes/Configuracoes.tsx | Central sem consultas HTTP, busca ou paginação | Não há request inválido de busca na montagem |
| Produtos/CategoriasProdutos.tsx, Produtos/Marcas.tsx | `termo`, `ativo`, categoriaId quando aplicável, `page/size/sort`; normalização no service/useRemoteSearch | Filtros remotos e feedback existentes, sem alteração |
| Financeiro/FormasPagamento.tsx e DadosBancarios.tsx | Situação/listas/IDs; sem busca textual opcional na listagem | Default de situação no controller; inválido retorna 400; sem alteração |

O cliente HTTP omite valores `undefined`/`null` em query params; não transforma isso na string literal `null`. `useRemoteSearch` normaliza por trim e cancela consultas obsoletas. Não foi necessário uniformizar as telas que deixam a normalização a cargo do backend: ambos os contratos existentes foram exercitados sem mudança de comportamento. Alertas HTTP e lista vazia foram conferidos no código e nos testes selecionados, não tratados como prova de integração de produção.

### Validação desta auditoria

`BuscaPaginadaHttpTest` ampliado, reaproveitando a fixture existente: 121 testes H2 + 121 PostgreSQL aprovados, sem falhas/erros/ignorados. Incluem onze listagens anteriores, `/usuarios/pagina` e os lookups `/clientes/buscar`, `/produtos/buscar`, `/fornecedores/buscar`; busca ausente/vazia/espaços/texto, sem resultado, filtros combinados, páginas 0/1, ordenação, 400/401, contagem e isolamento. Nenhuma chamada para produção. PostgreSQL local descartável, Flyway V1–V43 e Hibernate validate; transações revertidas e schema UUID removido.

Frontend: 56 testes selecionados aprovados de consultas, services, filtros, paginação, vazio, erro/retry e respostas obsoletas, com HTTP simulado. Builds backend/frontend e lint aprovados; dois avisos preexistentes de React Hook Form nos formulários financeiros e aviso de tamanho do bundle permanecem. `git diff --check` aprovado. Nenhuma tela foi alterada, portanto não houve revisão visual adicional nem mudança de tema/layout; Impeccable/Web Design Guidelines não foram aplicados fora desse escopo visual. Suíte geral e fluxos de escrita não repetidos. Nenhum acesso ou alteração de dados de produção, migration nova, commit, push ou deploy.

## Validacao

Alinhamento administrativo Empresa/Contas Financeiras: 39 testes HTTP backend (H2, queries reais), 27 testes frontend direcionados, package backend, build/TypeScript, lint direcionado e diff check. Testes de navegador usam HTTP simulado; verificam requests, ordem preservada, totais, pagina esvaziada, busca antiga cancelada, resumo global e destino de transferencia fora da pagina. Sem suite completa ou E2E geral; PostgreSQL nao executado neste ajuste sem migration. Evidencias abaixo pertencem ao bloco inicial de paginacao.

PaginacaoHttpTest/PaginacaoPostgresTest verificam paginas 0/1, totais, filtros combinados, allowlists, parametros invalidos, tenant, desempate e cidade/UF. PostgreSQL usa schema UUID descartavel, Flyway ate V28 e Hibernate validate. `npx playwright test e2e/paginacao.spec.mjs` verifica UI/requests com HTTP simulado; consultas reais sao verificadas no PostgreSQL.

Resultado: 10 casos H2 e 10 PostgreSQL aprovados; regressao HTTP aprovada em Vendas (4 listagem e 95 Venda), Clientes (2 HTTP e 17 isolamento), Produtos (25 isolamento), Contas a Pagar (9), Movimentacoes Financeiras (14 ContaFinanceira), Estoque (17) e Transferencias (29). Frontend: 84 testes, seis casos Playwright e build aprovados; lint direcionado aprovado.

Suite backend final: 687 casos, 0 falhas, 38 erros de contexto, 22 ignorados (inclui testes PostgreSQL condicionais, executados separadamente). VendaServiceTest tem 23 erros por ConfirmacaoPagamentoPixService ausente no contexto; EstoqueConcorrenciaTest tem 15 por ArquivoStorageService ausente. Esses contextos e o trabalho PIX foram preservados. Lint global: cinco erros anteriores e tres avisos fora das telas de paginacao. Nao declarar suite completa verde nem pronto para push enquanto PIX estiver pendente de consolidacao.

## Prévia de importação de Produtos

O catálogo GET /produtos mantém filtros/count/paginação reais. A prévia administrativa é um lote limitado a 2.000 linhas, com contagens calculadas no backend e paginação local da tabela já carregada; não substitui a consulta do catálogo nem importa somente a página visível. Confirmar usa todas as linhas válidas persistidas, independente da página de prévia aberta. Contrato em [produtos.md](produtos.md).
