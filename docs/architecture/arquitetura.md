docs/
└── architecture/
├── arquitetura.md
├── FINANCEIRO.md
├── VENDAS.md
├── ESTOQUE.md
├── ESTADO_ATUAL.md
├── AGENTES.md
└── ROADMAP.md

## Código interno de Produtos — V47

Código interno de novos Produtos é atribuído pelo PostgreSQL quando ausente (V47), na mesma transação da criação. A tabela técnica `produto_codigo_numeradores` e o trigger de Produtos serializam a geração por empresa; Hibernate recupera o código antes da resposta. O contrato HTTP e a unicidade por empresa existentes são preservados. Formato, edição e carga operacional em [produtos.md](produtos.md).

## Produtos compostos — V46

`Produto(composto, composicaoVersao) → componentes_produto` mantém revisões imutáveis da receita, quantidades/fatores e auditoria. `ItemVenda → consumos_kit_venda → MovimentacaoEstoque` preserva componentes, custo, versão e saída/reversão efetivos. Estoque físico permanece somente nos componentes; disponibilidade e custo do composto são consultas calculadas no banco. Faturamento/cancelamento reutilizam a transação e os efeitos financeiros existentes. Contratos aditivos e limites em [produtos.md](produtos.md).

## Execucao em producao

Perfil `prod` isola configuracao local, valida propriedades criticas, preserva Hibernate validate/Flyway e usa pool limitado por instancia. A API publica somente probes de health sem detalhes; JWT/perfis/tenant continuam na cadeia existente. Request ID em MDC/header e logs JSON permitem correlacao sem payload/PII. Estrategia atual: Vercel (frontend) -> Oracle Cloud VM Ubuntu (Nginx/HTTPS -> Docker/Compose, Java 21 non-root, PORT dinamica e shutdown graceful) -> Supabase (PostgreSQL/Storage). Render abandonado; sem banco local. Procedimento, limites e checklist em [producao.md](../deploy/producao.md); preparacao nao equivale a deploy homologado.

## Categorias e subcategorias de Produtos

Na `main`, sobre `4e71b92`, a V38 aditiva cria `categorias_produtos` e `subcategorias_produtos`, ambas pertencentes à Empresa. A relação Categoria 1:N Subcategoria possui FK composta `(categoria_id, empresa_id)`; não permite associar empresas diferentes nem excluir uma categoria com subcategorias. Índices únicos `(empresa_id, lower(nome))` protegem cada cadastro contra duplicidade, inclusive concorrente. Nomes são aparados, obrigatórios e limitados a 100 caracteres; a unicidade de subcategoria vale para toda a empresa, mesmo em categorias distintas. Categoria e subcategoria têm espaços de nomes separados. Inativação não se propaga; não se acrescentaram restrições de situação ao vínculo.

`CategoriaProdutoController/Service` reutilizam autenticação, validação, paginação e tratamento de erros existentes. Todos os perfis autenticados que acessam os cadastros de Produtos têm acesso; a empresa vem exclusivamente do JWT, sem `empresaId` no contrato. A classificação opcional de Produtos foi conectada posteriormente pela V41, sem efeitos em estoque, vendas, PDV e financeiro; contrato descrito ao final deste documento.

| Recurso | Contrato |
|---|---|
| `/produtos/categorias` | GET paginado; POST `{nome, ativo?}` → 201 `{id,nome,ativo}` |
| `/produtos/categorias/{id}` | GET; PUT `{nome,ativo?}` → 200; DELETE → 204 |
| `/produtos/subcategorias` | GET paginado; POST `{nome,ativo?,categoriaId}` → 201 `{id,nome,ativo,categoria:{id,nome,ativo}}` |
| `/produtos/subcategorias/{id}` | GET; PUT `{nome,ativo?,categoriaId}` → 200; DELETE → 204 |

GET de coleção recebe `termo`, `ativo`, `page=0`, `size=25` (máximo 100), `sort=nome,asc`; subcategorias aceita também `categoriaId`. Ambos retornam `{items,page,size,totalItems,totalPages}`, ordenam por `id|nome|ativo` com desempate por ID e fazem filtro/count/paginação no banco. Termo ausente/vazio/branco não restringe nomes; `%`, `_` e `!` são literais. Criação sem situação assume ativa; edição sem situação preserva o valor atual. Nome ou paginação inválidos, ou categoria obrigatória ausente → 400; registro ou categoria inexistente/de outra empresa → 404; duplicidade ou exclusão de categoria com vínculos → 409; sem sessão → 401. A exclusão não é em cascata; inativar é a alternativa reversível.

V38/Flyway/Hibernate validate e CRUD foram validados em PostgreSQL 18.6 descartável local. Resultados e limites em [CURRENT_STATE.md](CURRENT_STATE.md); interface em [frontend.md](frontend.md#categorias-e-subcategorias-de-produtos).

## Marcas de Produtos

Implementação local na `main`, sobre `4e71b92`, reutiliza o padrão de Categorias: `MarcaEntity`, DTOs, repository, service e controller próprios. A V39 cria `marcas` com empresa, nome obrigatório de até 100 caracteres e situação; nomes aparados são únicos por empresa, ignorando maiúsculas/minúsculas, inclusive em marcas inativas. O índice único `(empresa_id, lower(nome))` protege também requisições concorrentes. Todos os perfis autenticados dos cadastros de Produtos têm acesso; empresa vem exclusivamente do JWT.

`/produtos/marcas`: GET paginado e POST `{nome,ativo?}` → 201 `{id,nome,ativo}`. `/produtos/marcas/{id}`: GET, PUT com o mesmo corpo → 200 e DELETE → 204. Criação sem situação assume ativa; edição sem situação preserva o valor. Listagem aceita `termo`, `ativo`, `page=0`, `size=25` (1–100), `sort=nome,asc`; ordenação permitida por `id|nome|ativo`, com desempate por ID, e envelope `{items,page,size,totalItems,totalPages}`. Busca vazia/branca não filtra; `%`, `_` e `!` são literais. Validação inválida → 400, registro inexistente/de outra empresa → 404, nome duplicado ou exclusão com produtos vinculados → 409; ausência de autenticação → 401.

Para cumprir o bloqueio de exclusão, a V39 acrescenta somente `produtos.marca_id` opcional, índice por empresa/marca e FK composta `(marca_id,empresa_id)` → `marcas(id,empresa_id)`, sem cascata. `ProdutoEntity` mapeia a relação lazy, ignorada na serialização direta. A integração posterior de classificação expõe um resumo de Marca no DTO de Produto e permite seleção opcional pelo formulário completo, conforme contrato ao final deste documento. Produtos ativos ou inativos impedem excluir a marca; inativar/reativar/renomear a marca preserva todos os vínculos. A FK protege também exclusões concorrentes e vínculos entre empresas.

Testes HTTP reais em H2/PostgreSQL e V39/Flyway/Hibernate validate em banco descartável: resultados e limites em [CURRENT_STATE.md](CURRENT_STATE.md). Não houve alteração em estoque, vendas, PDV ou financeiro.

## Produto e fornecedor principal

V40 adiciona relação opcional N:1 de Produto para o cadastro de Fornecedor existente, com FK `(fornecedor_principal_id,empresa_id)` e índice por empresa/fornecedor. ProdutoService valida o ID pela empresa do JWT; ProdutoRequestDTO diferencia ausência de `fornecedorId` de `null` explícito para preservar clientes anteriores na edição. ProdutoMapper/ResponseDTO acrescentam somente o resumo cadastral do fornecedor. Consultas de Produto usam EntityGraph para carregar essa referência em conjunto, preservando produtos sem fornecedor e evitando N+1 na listagem/relatório; consultas com lock de estoque permanecem inalteradas. Sem tabela ProdutoFornecedor ou nova integração operacional.

Fornecedor mantém exclusão lógica/inativação; exclusão física com produto vinculado é impedida pela FK, sem cascata. Contrato, compatibilidade e limites em [fornecedores.md](fornecedores.md#fornecedor-principal-do-produto).

## Consultas paginadas

EntradaMercadoria/ItemEntradaMercadoria reutilizam Fornecedor, Produto e MovimentacaoEstoqueService: rascunho sem efeito, confirmacao e cancelamento integrais, ultimo custo e historico tenant-safe. V34 mantém o domínio de estoque. Na etapa 5 da branch `feat/central-configuracoes`, V37 adiciona a referência opcional 1:1 de Entrada para ContaPagar, com FK composta por empresa, unicidade da conta e origem GERADA/PREEXISTENTE. ContaPagar expõe a referência inversa; não há outra fonte de saldo ou novo módulo. Ações explícitas são coordenadas por EntradaContaPagarService, sem dependência inversa para EntradaMercadoriaService; ContaPagarService mantém baixas/estornos. Locks de Contas a Pagar em ID crescente precedem Entrada e produtos, com refresh/revalidação após espera; vínculo alterado causa conflito antes de efeitos. API/cancelamento em [entradas-mercadoria.md](entradas-mercadoria.md). V37/Flyway/Hibernate validate e concorrência deste vínculo validados localmente sobre `25b703c` em PostgreSQL descartável; o contrato permanece sem CONTRACT READY por falhas nas suítes gerais, detalhadas em [CURRENT_STATE.md](CURRENT_STATE.md).

Fornecedor e dominio proprio por empresa; evolui o cadastro/tabela existentes, sem criar ProdutoFornecedor ou Compras. A mesma API cria cadastro minimo/completo e retorna objeto selecionavel; manutencao paginada e lookup limitado compartilham filtro tenant. V33 aditiva preserva referencias legadas e adiciona endereco estruturado/timestamps e unicidade parcial de documento normalizado por empresa. Contrato e compatibilidade em [fornecedores.md](fornecedores.md).

As consultas de crescimento contínuo usam Page/Pageable e PaginaResponseDTO, com tenant, filtros, ordenação e paginação no banco. Contratos e exceções List em [paginacao.md](paginacao.md).

Empresa e Contas Financeiras possuem consultas administrativas /pagina com o mesmo contrato; Empresa continua limitada a empresa autenticada. As listas simples permanecem compativeis para seletores. Cards de Contas Financeiras usam /resumo agregado por tipo no banco, independente da pagina; nao alteram saldo ou fluxo financeiro.

## Usuários

`/usuarios` usa exclusivamente o tenant do JWT e permanece restrito a `ADMIN`. GET simples e contratos de cadastro/edição foram preservados. GET `/usuarios/pagina` acrescenta `termo`, `ativo`, `page=0`, `size=25` (1–100) e `sort=nomeUsuario,asc`; busca nome, CPF normalizado, login e e-mail, com envelope `{items,page,size,totalItems,totalPages}`. Ordenação permitida por `id|nomeUsuario|cpf|login|email|perfil|ativo`, desempate por ID; termo ausente, vazio ou branco não filtra, e `%`, `_`, `!` são literais.

Cadastro exige senha e usa BCrypt existente; edição sem senha preserva o hash. `login` é identificação cadastral, normalizada sem espaços laterais e sem distinção de caixa; omissão no cadastro assume CPF, e na edição preserva o valor anterior. Login e e-mail não vazio são únicos por empresa, inclusive entre usuários inativos, com índices da V43 e validação no serviço. CPF permanece globalmente único pela V32, pois `/auth/login` ainda recebe somente CPF/senha: a unicidade global foi explicitamente mantida nesta entrega; identificação de tenant no login está fora deste escopo. Nenhuma empresa é aceita no DTO de administração; DTOs administrativos não retornam senha, hash ou versão interna.

`PATCH /usuarios/{id}/senha` altera somente senha e invalida tokens. `PATCH /usuarios/{id}/situacao` e o DELETE legado (inativação lógica) bloqueiam auto-inativação; PUT também aplica a proteção. Inativação/rebaixamento do último ADMIN ativo são bloqueados. O ADMIN preservado pelo CPF definido no escopo não pode ser inativado, removido, rebaixado nem ter seu CPF alterado. Escritas administrativas adquirem locks ordenados dos usuários da empresa antes de validar os vínculos e a contagem de administradores. Não há exclusão física ou novo mecanismo de auditoria administrativa; o padrão atual de logs HTTP/Request ID permanece.

A V43 é aditiva: cria `login` (preenchido com CPF normalizado para usuários existentes), `versao_token` inicial zero e índices de login/e-mail. Duplicidade legada de e-mail na mesma empresa interrompe a migration transacionalmente, sem escolher ou sobrescrever usuários; exige regularização explícita antes de publicar. Migrations anteriores permanecem intactas. O filtro JWT já consultava vínculo, perfil, usuário/empresa ativos; agora compara também a versão persistida. Senha, situação, perfil ou CPF alterados invalidam tokens anteriores, inclusive após reativação. Tokens legados sem versão equivalem à versão zero, preservando sessões não alteradas.

O formulário apresenta ADMIN, GESTOR e OPERADOR. `GESTOR` é aceito no JSON como alias de `GERENTE`, preservando papel persistido, resposta e permissões gerenciais existentes; `USUARIO` continua legado de operador. Cancelamento de Venda e sangria/suprimento continuam reservados a `ADMIN`/`GERENTE`; operadores só fecham a própria sessão. Gerenciamento de Acessos por menu/ação e perfis avançados não existem; permanecem pendentes, sem desenvolvimento ou chamadas novas nesta entrega. Não foi criada matriz granular nem alterada regra operacional/financeira.

## Domínio de Vendas consolidado

`VendaEntity → ItemVendaEntity (itens_venda) → Produto` é o único modelo ativo para venda aberta e faturada. O item preserva preço/nome aplicados e referência ao movimento de estoque. Faturamento reutiliza `MovimentacaoEstoqueService`, registra `PagamentoEntity` e mantém o lançamento financeiro temporário na mesma transação, com lock da Venda e dos Produtos. A fundação `Venda 1 → N Pagamento` está descrita em [financeiro.md](financeiro.md); cancelamento completo e destinos bancários permanecem futuros; a integração mínima de dinheiro com Caixa já existe.

A V6 migra o modelo legado e mantém a tabela original somente como arquivo histórico. Contratos HTTP, validações e limitações de execução estão em [CURRENT_STATE.md](CURRENT_STATE.md).

## Evolução financeira

ContaReceber e dominio do Cliente separado de Recebivel de cartao. V35 adiciona FK composta cliente/empresa, venda nullable e relacao 1:N em MovimentacaoFinanceira; baixa gera ENTRADA e estorno identifica um movimento especifico. Bloco 3 integra Venda/PDV: pagamentos imediatos -> PagamentoEntity; parcelasPrazo -> N ContaReceber, sem dinheiro na criacao. V36 armazena valorPrazo na Venda e ajusta CHECKs sem reinterpretar historico. Cancelamento coordena estoque, Caixa, PIX, cartao e estorno de todas as baixas/parcelas numa transacao; locks e contrato em [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md) e [financeiro.md](financeiro.md). Pagina/filtros/sort/resumo permanecem server-side; Bloco 2 oferece manutencao financeira e historico, agora acessivel tambem pelo detalhe da Venda.

`ContaPagarEntity` pertence à Empresa, com Fornecedor opcional da mesma empresa (FK composta na V17). O controller obtém o tenant do JWT; criação, edição, pagamento, cancelamento e estorno não recebem `empresaId`. A V20 vincula a baixa à MovimentacaoFinanceira de mesma empresa; novas baixas exigem Conta Financeira ativa e geram SAIDA/CONTAS_A_PAGAR, revertida no estorno. Pagamentos legados sem vínculo seguem válidos. Não há movimentação de Caixa/PDV ou da Conta Bancária cadastral. O frontend usa `/financeiro/contas-pagar` com lista e drawer, ainda sem enviar a conta financeira exigida pelo backend.

`ContaFinanceiraEntity` e `MovimentacaoFinanceiraEntity` formam um saldo gerencial separado de `CaixaEntity`/`SessaoCaixaEntity`. A V19 usa FKs compostas de empresa para conta e operadores; movimentos e estornos serializam pelo lock pessimista da Conta Financeira. A V21 vincula BANCO a `ContaBancariaEntity` em 1:1, com FK composta por empresa e unicidade; a identidade bancária não recebe saldo. Tipos e compatibilidade: [FINANCEIRO_RULES.md](FINANCEIRO_RULES.md). Origens MANUAL e CONTAS_A_PAGAR estão habilitadas; a origem automática só é estornada pela baixa. Não há roteamento por forma de pagamento. O frontend usa `/financeiro/contas-financeiras` com lista, cadastro e extrato lateral.

Na branch `feat/conferencia-fechamento-backend` (baseline atualizado `1b313df`), a V16 acrescenta modalidade/observacao a SessaoCaixa e a relacao 1:N com ConferenciaFechamentoCaixa. O fechamento POR_FORMA persiste snapshots operacionais por forma e uma contagem fisica unica; o contrato LEGADA permanece disponivel. FK composta protege o tenant e o lock existente serializa fechamento, vendas e cancelamentos. Contrato e limites da Fase 1 em [financeiro.md](financeiro.md). O detalhe de sessão fechada agrega esses snapshots, resumo e eventos no endpoint de leitura; não altera persistência ou regra de fechamento.

`Venda → Pagamento` existe na base `aeaec2e`; `Pagamento DINHEIRO → MovimentacaoCaixa` existe no MVP operacional, pela sessão associada à Venda. Os demais destinos permanecem FUTUROS. O lançamento temporário não substitui os destinos oficiais.

A fundação de Formas de Pagamento separa o catálogo global compartilhado (`FormaPagamentoEntity`, sem Empresa) do tipo técnico (`TipoFormaPagamento`). Pagamento referencia a forma, mantendo seu próprio tenant. Condição de prazo/parcelamento e os cadastros `Banco → Agência → Conta Bancária` permanecem futuros. Caixa possui cadastro e relação 1:N com SessaoCaixaEntity, com uma única sessão aberta e histórico de fechamentos; com Venda vinculada à sessão, totais operacionais por forma e movimentos físicos VENDA/SUPRIMENTO/SANGRIA. A sessão não transforma PIX/cartões em dinheiro; veja os contratos em financeiro.md. Configuração cadastral, sessão operacional, registro de pagamento e movimentação financeira têm responsabilidades distintas.

Preservar histórico, contratos e isolamento da empresa, sem exigir antecipadamente dependências de Caixa/Banco no Pagamento ou novas etapas no PDV. Os conceitos e estágios ficam em [financeiro.md](financeiro.md); a ordem incremental, em [roadmap.md](roadmap.md).

## Classificação opcional do Produto

V41 adiciona categoria_id e subcategoria_id opcionais a produtos e reutiliza marca_id da V39. FKs compostas validam empresa e a combinação subcategoria/categoria; CHECK impede subcategoria sem categoria. Produtos existentes permanecem sem os novos vínculos. A exclusão ou mudança de categoria de uma subcategoria vinculada é bloqueada pela integridade referencial, sem cascata.

POST/PUT /produtos recebe categoriaId, subcategoriaId e marcaId opcionais e positivos. IDs são resolvidos pela empresa do JWT; referência indisponível/de outra empresa retorna 404, relação incompatível retorna 400. PUT preserva cada campo omitido; null remove. Trocar categoria sem informar a remoção/troca da subcategoria incompatível é rejeitado, preservando o vínculo omitido. Respostas retornam categoria e marca {id,nome,ativo}, e subcategoria {id,nome,ativo,categoria}, ou null. GET /produtos acrescenta os três filtros opcionais ao contrato paginado existente. Leituras carregam vínculos em lote via EntityGraph; nenhuma consulta financeira ou de estoque é criada.

## Metadados de Produtos e legado V42

NCM/CEST opcionais permanecem no cadastro e nos contratos normais de Produto. A V42 aplicada permanece imutável; `importacoes_produtos` fica como estrutura legada, sem Entity, repository, endpoints ou uso pela aplicação. A carga inicial é procedimento operacional separado, sem API.
