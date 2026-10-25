# Padronização dos formulários — Tarefa 15B

Data: 24/10/2026. Baseline: `main`, `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`. Implementação local, sem commit, push ou deploy. Complementa o [piloto da Tarefa 15](padronizacao-formularios-2026-10-24.md), preservado como registro histórico.

## Escopo e preservação

Foram examinados os componentes com campos em `src/pages` e `src/components`, incluindo formulários embutidos em páginas, drawers, diálogos, campos gerados por metadados, seletores, checkboxes e uploads. O levantamento inicial encontrou 62 arquivos com controles e 229 declarações de campos; declarações dinâmicas representam vários campos/linhas e não equivalem a 229 campos únicos.

O staging inicial foi preservado. README, documentação de deploy, relatório 14D já staged, auditorias anteriores, script de backup, imagens temporárias e vídeos pertencem a trabalhos anteriores. Produtos, componentes e testes da Tarefa 15 são trabalho existente reaproveitado. Não houve mudança em backend, migrations, serviços HTTP, types de API, dependências ou configuração de produção.

## Componentes e conversão

- `CampoTexto` mantém as props do `TextField`, incluindo refs, máscaras, seletores e slots do Autocomplete/RHF. Acrescenta label flutuante visível, placeholder com cor do tema, altura mínima de 44 px e anúncio dos textos auxiliares. Autocomplete explícito e erros existentes são preservados.
- `CampoDecimal`, `CampoMonetario`, `CampoQuantidade` e `CampoPercentual` vêm da Tarefa 15. A opção `canonico` entrega uma string decimal com ponto aos parsers existentes; o texto digitado permanece no controle e a apresentação pt-BR ocorre ao sair. Texto inválido permanece visível, sem remoção silenciosa de dígitos ou arredondamento. `readOnly` preserva a consulta de dados históricos, inclusive valores que exigem revisão antes de nova gravação.
- `numeroFormulario` preserva aritmética escalada, validação de representação segura no contrato `number` e suporte a quatro/seis casas quando solicitado. Não há ampliação da precisão persistida.
- O PDV reutiliza também `ValorMonetarioPDV`, preservando seus limites, normalização, seleção ao focar e contratos de rascunho. Os botões de quantidade e atalhos operacionais existentes permanecem responsáveis por suas ações.

Um teste de envio reproduziu uma lacuna na conversão de valores muito grandes: `90071992547409,91` já aparecia inválido no campo, mas o submit ainda convertia a string com `Number` e enviava um valor sem os centavos originais. As fronteiras de entrada agora reutilizam `numeroDecimal` antes do envio; o reteste impede o POST e conserva o texto. Cofre, conferência, títulos e composição de kits usam a mesma proteção onde suas conversões eram feitas diretamente. Não foram alteradas fórmulas de saldo, totais, rateios, sinais, arredondamentos de cálculos, serviços ou regras de liquidação; a proteção impede que uma entrada sem representação segura chegue a eles. Zero e vazio seguem as regras de cada formulário.

| Domínio/campo | Precisão mantida | Controle e regra |
|---|---:|---|
| Produto: custo e venda | 2 | Moeda, sem spinbox |
| Produto: estoque mínimo e embalagem | 3 | Quantidade; incremento apenas no estoque mínimo do piloto |
| Kit: quantidade / fator | 3 / 6 | Decimal, sem incremento acidental da composição |
| Entrada manual/XML: quantidade / custo | 3 / 2 | Contrato atual; o XML original não é arredondado silenciosamente |
| Movimentação de estoque | 3 | Sem spinbox; ajuste aceita zero, entrada/saída exigem positivo |
| Limite de crédito, títulos, baixas, transferências, saldos e Caixa | 2 | Moeda, sem spinbox; vazio opcional continua `null` onde aplicável |
| Taxa percentual do cartão | 4 | Percentual sem spinbox; limite de 100% preservado |
| Taxa fixa | 2 | Moeda sem spinbox |
| Parcelas e dias | Inteiro | Limites do formulário preservados; crédito do consumidor continua 1–12 |
| Empresa: latitude/longitude | Contrato existente | Texto com sinal e validações atuais; não usa parser de quantia positiva |
| CPF/CNPJ, CEP, códigos, banco/agência/conta | Texto | Máscaras/zeros à esquerda preservados; sem spinbox |

`0,0002` é válido na taxa com quatro casas, mas permanece inválido num custo cujo contrato aceita somente duas. `1,2500` pode ser exibido com quatro casas num campo dessa precisão, sem alterar seu valor; `10,50` e `1.234,56` são enviados como `10.5` e `1234.56`. O ponto sem vírgula continua decimal, para preservar entradas e registros existentes; não se infere separador de milhar ambíguo.

## Inventário de formulários e avaliação

Legenda: **adaptado** = usa a base compartilhada onde necessário; **preservado** = já atendia ao padrão ou é parte operacional/consulta que deve manter seu comportamento. As suítes indicadas são arquivos em `frontend/tests`; os resultados consolidados estão na seção de validação.

| Etapa / módulo | Formulário / fonte | Campos avaliados e validações preservadas | Aplicação / componentes | Cobertura |
|---|---|---|---|---|
| A — Produtos | `ProdutoForm` completo, rápido e duplicação | Código/SKU, GTIN, nome*, descrição, unidade*, custo/venda*, estoque mínimo, NCM/CEST opcionais, imagens; limites e confirmações operacionais | Piloto preservado; embalagem agora usa `CampoQuantidade`, 3 casas; referência continua texto | `produto-campos-form`, `produto-duplicacao`, `produto-fornecedor`, `entrada-mercadoria` |
| A — Produtos | `ComposicaoProdutoCampos` | Busca de componente, quantidade positiva, unidade, fator positivo; duplicidade e 3/6 casas | `CampoQuantidade`, `CampoDecimal`, `CampoTexto`; sem spinbox | `kit-produtos`, `formularios-completos` |
| A — Produtos | `ClassificacaoProdutoCampos` | Categoria/subcategoria dependente e marca; seleção/pesquisa remotas | Preservado: labels, ajuda e tratamento de consulta já existentes | `categorias-produtos`, `marcas`, `produto-fornecedor` |
| A — Categorias | `CategoriasProdutos.Cadastro` — categoria e subcategoria | Nome* até 100 caracteres, categoria* da subcategoria e situação | `CampoTexto` com exemplo; seletor de categoria preservado | `categorias-produtos` |
| A — Marcas | `Marcas.MarcaForm` | Nome* até 100 caracteres e situação | `CampoTexto` com exemplo; conflitos/exclusão preservados | `marcas` |
| A — Clientes | `ClienteForm` | Nome/razão social*, fantasia, tipo, CPF/CNPJ, IE, telefone, e-mail, situação; condições comerciais, vendedor, limite e notas/entrega | `CampoTexto`; limite opcional em `CampoMonetario`, `null` no vazio, número no payload | `formularios-completos`, `central-vendas-cliente`, `contas-receber` |
| A — Clientes | `EnderecoDialog` / `ContatoDialog` | Logradouro, número textual, complemento, bairro, cidade, UF, CEP; flags principal/entrega; nome, cargo, telefone/e-mail | `CampoTexto`; labels, exemplos e grade existentes | Avaliação de código; fluxos de Cliente e regressão integrada |
| A — Fornecedores | `FornecedorForm` completo/rápido | Razão social*, fantasia, documento com máscara existente, contato, endereço completo, observação/situação | `CampoTexto` com exemplos por campo; mesma função de salvar e máscaras | `fornecedores-ui`, `fornecedor-contas-pagar`, `entrada-mercadoria` |
| B — Comercial | Central de Vendas / detalhes e pedidos | Filtros e consulta; não há formulário autônomo adicional de pedido nesta composição | Preservados; criação comercial usa o PDV existente, inventariado na etapa E | `central-vendas`, `central-vendas-cliente` |
| C — Estoque | `Estoque` — entrada, saída e ajuste avulsos | Produto somente leitura, quantidade/novo saldo*, motivo; regras de positivo/zero e tenant | `CampoQuantidade` (3), `CampoTexto`; conversão segura sem alterar movimentos | `estoque` |
| C — Compras | `EntradaMercadoriaForm` manual/XML | Fornecedor*, nota, série, emissão, observação e itens; bloqueios por estado | `CampoTexto`; datas, leitura e validações existentes | `entrada-mercadoria` |
| C — Compras | `EntradaMercadoriaItens` | Produto*, quantidade* (3), custo* (2), vínculos de fornecedor e cadastro rápido | `CampoQuantidade`, `CampoMonetario`, `CampoTexto`, sem spinbox | `entrada-mercadoria`, `formularios-completos` |
| C — Compras | `EntradaXmlImportacao` | Arquivo XML, extensão/tamanho e estado de processamento | Preservado: label visível, seletor nativo e ajuda existentes | `entrada-mercadoria` |
| C — Compras | `EntradaObrigacao` — gerar ou vincular | Descrição*, valor financeiro*, vencimento*; busca/seleção de conta existente | `CampoTexto`, `CampoMonetario`; sem alterar rateio ou geração financeira | `entrada-mercadoria` |
| D — A pagar | `ContaPagarDrawer` | Descrição*, documento, fornecedor, categoria, emissão/vencimento*, valor*, observação; modo somente leitura | `CampoTexto`, `CampoMonetario`; payload e vínculos preservados | `contas-pagar`, `fornecedor-contas-pagar`, `formularios-completos` |
| D — A pagar | `ContasPagar` — pagamento | Data*, conta financeira*, valor integral* e saldo disponível | Somente campos do diálogo adaptados; filtros da consulta preservados | `contas-pagar` |
| D — A receber | `ContaReceberForm` | Cliente ativo*, descrição*, valor*, emissão/vencimento*, parcela/total e observação | `CampoTexto`, `CampoMonetario`, inteiro com passo para metadados de parcela | `contas-receber`, `formularios-completos` |
| D — A receber | `ContaReceberBaixaDialog` | Valor recebido*, destino*, data*, observação; parcialidade/idempotência | `CampoMonetario`, `CampoTexto`; seletores e bloqueios preservados | `contas-receber` |
| D — A receber | `ContaReceberDetalhe` — estorno | Motivo do estorno | `CampoTexto`; confirmação e regras de estorno existentes | `contas-receber` |
| D — Contas | `ContaFinanceiraDrawer` | Nome*, tipo*, conta bancária*, saldo inicial* na criação; saldos somente leitura na edição | `CampoTexto`, `CampoMonetario`; não transforma saldo de edição em campo gravável | `contas-financeiras` |
| D — Extrato | `MovimentacaoFinanceiraDrawer` | Entrada/saída, descrição*, valor*, data*, observação | `CampoTexto`, `CampoMonetario`; valores/sinais e serviço preservados | `contas-financeiras`, `formularios-completos` |
| D — Transferências | `TransferenciaFinanceiraDrawer` | Origem*, destino*, valor*, data*, observação; idempotência e saldo | `CampoTexto`, `CampoMonetario`; não altera débito/crédito | `contas-financeiras` |
| D — Bancos | `BancoForm` | Número* textual, nome*, CNAB opcional, situação | `CampoTexto`; nenhum incremento em códigos | `dados-bancarios` |
| D — Agências | `AgenciaForm` | Banco*, número*, dígito, contato, telefone, cidade, situação | `CampoTexto`; RHF/Yup e vínculos preservados | `dados-bancarios` |
| D — Contas bancárias | `ContaBancariaForm` | Agência*, número*, dígito, titular, tipo*, situação | `CampoTexto`; códigos com zeros preservados | `dados-bancarios` |
| D — Caixa | `CaixaForm` | Descrição*, situação; duplicidade e limite de caracteres | `CampoTexto`; exemplo existente preservado | `caixa-detalhe`, `listagens-administrativas` |
| D — Caixa | `AberturaCaixaDialog` | Caixa, troco herdado, fundo inicial, origem, cofre, retirada mista, motivo do aporte | `CampoTexto`, `CampoMonetario`; permissões, limites, composição e submissão existentes | `caixa-abertura` |
| D — Caixa | `Caixa` — sangria/suprimento | Valor*, observação, destino COFRE opcional | Campos do diálogo adaptados; consultas e regras mantidas | `caixa-abertura`, `caixa-detalhe` |
| D — Caixa | `Caixa` — fechamento | Dinheiro físico contado, observação de divergência condicional*, entrega/troco e conferência | `CampoMonetario`, `CampoTexto`; cálculo/diferença e confirmação preservados | `caixa-abertura`, `politicas-recebimento` |
| D — Cofre | `EntregaCofreCampos` | Valor recolhido/troco, conta COFRE, responsável, observação, confirmação explícita | `CampoMonetario`, `CampoTexto`; complementos e regras existentes | `caixa-abertura` |
| D — Cofre | `CofrePainel` — devolução/suprimento | Sessão aberta de destino e entrega reutilizada | Seletor em `CampoTexto`; extrato/filtros da página preservados | `contas-financeiras`, `listagens-administrativas` |
| D — Conferência | `ConferenciaMeiosPagamento` | Total ou valores por meio; obrigatoriedade configurada, diferenças | `CampoMonetario`; conferência não se torna liquidação | `politicas-recebimento`, `caixa-abertura` |
| D — Pagamentos | `FormaPagamentoForm` | Descrição*, tipo*, situação | `CampoTexto`; catálogo e autorização sem alterações | `configuracao-forma-pagamento` |
| D — Pagamentos | `ConfiguracaoFormaPagamentoForm` | Nome*, forma*, destino*, parcelas 1–12, taxa percentual 4, fixa 2, prazo inteiro e situação | `CampoTexto`, `CampoPercentual`, `CampoMonetario`, `CampoDecimal`; Yup converte strings para o mesmo payload numérico | `configuracao-cartao-form`, `configuracao-forma-pagamento`, `formularios-completos` |
| D — Políticas | `ConfiguracaoRecebimentos` | Política, conferência, confirmação e escolhas administrativas | Preservado: controles MUI rotulados e orientações já existentes; sem mudar políticas | `politicas-recebimento` |
| D — Agenda | `RecebimentosContaDrawer`, `Recebiveis` | Seleção/confirmacão de recebíveis; filtros de consulta | Preservados: não há novo formulário de valores/parcelamento a criar | `recebimentos-contas`, `recebiveis` |
| E — PDV | `Vendas` — produto/quantidades | Busca/código de barras, quantidade selecionada e linhas, unidade/preço somente leitura | Busca orientada, quantidade decimal; atalhos, refs e controles existentes preservados | `pdv`, `pdv-buscas` |
| E — PDV | `Vendas` — opções | Cliente, desconto monetário, instruções de entrega e observações | `ValorMonetarioPDV` e `CampoTexto`; sem novo passo no checkout | `pdv`, `central-vendas-cliente` |
| E — PDV | `PagamentoVendaDialog` | Valores por meio, recebido em dinheiro, parcelas de crédito, prazo e vencimentos/valores de parcelas | `ValorMonetarioPDV` preservado com base textual comum; seletores/datas em `CampoTexto` | `pdv`, `confirmacao-pix`, `configuracao-cartao-form` |
| E — PDV | `BuscaAvancadaProdutoDialog`, `SessaoCaixaPDVDialog` | Pesquisa/classificação e abertura de sessão reutilizada | Busca já orientada; abertura reutiliza `AberturaCaixaDialog` | `pdv-buscas`, `caixa-abertura` |
| F — Empresa | `EmpresaForm` e metadados `empresaFormulario` | Documento*, razão social*, fantasia, regime*, inscrições; endereço/CEP/UF, contatos, coordenadas com sinal, campos fiscais/SPED e flags | `CampoTexto`, exemplos; máscaras, validação por aba, lookup de CEP e permissões preservados | `empresa`, `empresa-cep`, `empresa-listagem` |
| F — Empresa | `InscricaoDialog` e logomarca | UF da inscrição, IE*, upload PNG/JPEG e validações existentes | `CampoTexto`; seletor de imagem e leitura existentes preservados | `empresa`, `empresa-cep` |
| F — Usuários | `UsuarioDrawer` — cadastro/edição e redefinição | Nome*, CPF*, login*, e-mail*, senha*/nova senha*, perfil e situação; avisos de revogação | `CampoTexto`; tipos/autocomplete, refs, mensagens e permissões preservados | `usuarios`, `perfis`, `formularios-completos` |
| F — Acesso | `Login` | CPF com máscara e label externo, senha com label externo, visibilidade/autocomplete e erro | Preservado: já possui labels permanentes e campos apropriados; sem substituir seu layout | `login`, `renovacao-sessao` |

`*` indica obrigatoriedade existente, inclusive condicional; não cria exigência fiscal nova. Checkbox/Switch/Radio mantêm seu `FormControlLabel` ou `FormLabel`. Não foi criado cadastro de fornecedor, pedido ou ajuste de custo adicional: foram usados somente os fluxos existentes. Não há tela autônoma de ajuste de custo médio nesta composição.

### Superfícies examinadas e preservadas como consultas

Filtros e seletores de consulta em `Clientes`, `Empresa`, `Usuarios`, `Produtos`, `Fornecedores`, `Marcas`, `CategoriasProdutos`, `EntradasMercadoria`, `Estoque`, `CentralVendas`, `AnaliseVendas`, `RankingsVendas`, `ContasPagar`, `ContasReceber`, `Recebiveis`, `RecebimentosContaDrawer`, `ExtratoFinanceiroDrawer`, `BancoTab`, `AgenciaTab`, `ContaBancariaTab`, `FormasPagamento`, `Caixa` e `CofrePainel` não receberam substituição em massa. `RelatorioPrecosDialog` mantém filtros/seleção de impressão. `PageFilters`, `AppTable` e `Sidebar` são controles de consulta/navegação, sem mudança global.

## Validação e evidências

O piloto foi reexecutado antes da expansão: **116 casos, 114 aprovados, dois opcionais não executados** (integração PostgreSQL e captura do piloto, que exigem flags explícitas). Esses dois não são contabilizados como aprovados.

A suíte nova `formularios-completos.test.mjs` monta componentes reais e bloqueia todo HTTP não interceptado. Valida moeda no payload, edição, limite opcional, endereços/contatos, precisão 3/6 em kits, 3/2 em entradas, taxa 4 e fixa 2, CPF inválido, navegação por teclado, parser do PDV e ausência de erros de JavaScript. Inclui criação/edição de conta financeira sem regravar saldos na edição, transferência com chave idempotente, parcelas por teclado e bloqueio de perda de precisão. Na confirmação final, seus **14 testes passaram**, incluindo a captura de **40 PNG** em 1440×960 e 390×844, nos temas claro/escuro, antes/depois. Não houve overflow horizontal nas amostras. O teste usa colagem real pelo clipboard para o agrupamento brasileiro.

As capturas usam componentes reais com dados sintéticos e backend HTTP interceptado; não representam gravação em produção nem prova de persistência de todos os módulos em PostgreSQL. A evidência PostgreSQL da Tarefa 15 é histórica e restrita a Produtos; não é contabilizada como nova execução nesta etapa.

| Amostra | Desktop claro | Desktop escuro | Mobile claro | Mobile escuro |
|---|---|---|---|---|
| Cliente | [antes](assets/formularios-completa-2026-10-24/cliente-antes-desktop-claro.png) / [depois](assets/formularios-completa-2026-10-24/cliente-depois-desktop-claro.png) | [antes](assets/formularios-completa-2026-10-24/cliente-antes-desktop-escuro.png) / [depois](assets/formularios-completa-2026-10-24/cliente-depois-desktop-escuro.png) | [antes](assets/formularios-completa-2026-10-24/cliente-antes-mobile-claro.png) / [depois](assets/formularios-completa-2026-10-24/cliente-depois-mobile-claro.png) | [antes](assets/formularios-completa-2026-10-24/cliente-antes-mobile-escuro.png) / [depois](assets/formularios-completa-2026-10-24/cliente-depois-mobile-escuro.png) |
| Entrada | [antes](assets/formularios-completa-2026-10-24/entrada-antes-desktop-claro.png) / [depois](assets/formularios-completa-2026-10-24/entrada-depois-desktop-claro.png) | [antes](assets/formularios-completa-2026-10-24/entrada-antes-desktop-escuro.png) / [depois](assets/formularios-completa-2026-10-24/entrada-depois-desktop-escuro.png) | [antes](assets/formularios-completa-2026-10-24/entrada-antes-mobile-claro.png) / [depois](assets/formularios-completa-2026-10-24/entrada-depois-mobile-claro.png) | [antes](assets/formularios-completa-2026-10-24/entrada-antes-mobile-escuro.png) / [depois](assets/formularios-completa-2026-10-24/entrada-depois-mobile-escuro.png) |
| Configuração | [antes](assets/formularios-completa-2026-10-24/configuracao-antes-desktop-claro.png) / [depois](assets/formularios-completa-2026-10-24/configuracao-depois-desktop-claro.png) | [antes](assets/formularios-completa-2026-10-24/configuracao-antes-desktop-escuro.png) / [depois](assets/formularios-completa-2026-10-24/configuracao-depois-desktop-escuro.png) | [antes](assets/formularios-completa-2026-10-24/configuracao-antes-mobile-claro.png) / [depois](assets/formularios-completa-2026-10-24/configuracao-depois-mobile-claro.png) | [antes](assets/formularios-completa-2026-10-24/configuracao-antes-mobile-escuro.png) / [depois](assets/formularios-completa-2026-10-24/configuracao-depois-mobile-escuro.png) |
| Usuário | [antes](assets/formularios-completa-2026-10-24/usuario-antes-desktop-claro.png) / [depois](assets/formularios-completa-2026-10-24/usuario-depois-desktop-claro.png) | [antes](assets/formularios-completa-2026-10-24/usuario-antes-desktop-escuro.png) / [depois](assets/formularios-completa-2026-10-24/usuario-depois-desktop-escuro.png) | [antes](assets/formularios-completa-2026-10-24/usuario-antes-mobile-claro.png) / [depois](assets/formularios-completa-2026-10-24/usuario-depois-mobile-claro.png) | [antes](assets/formularios-completa-2026-10-24/usuario-antes-mobile-escuro.png) / [depois](assets/formularios-completa-2026-10-24/usuario-depois-mobile-escuro.png) |
| Campo do PDV | [antes](assets/formularios-completa-2026-10-24/pdv-antes-desktop-claro.png) / [depois](assets/formularios-completa-2026-10-24/pdv-depois-desktop-claro.png) | [antes](assets/formularios-completa-2026-10-24/pdv-antes-desktop-escuro.png) / [depois](assets/formularios-completa-2026-10-24/pdv-depois-desktop-escuro.png) | [antes](assets/formularios-completa-2026-10-24/pdv-antes-mobile-claro.png) / [depois](assets/formularios-completa-2026-10-24/pdv-depois-mobile-claro.png) | [antes](assets/formularios-completa-2026-10-24/pdv-antes-mobile-escuro.png) / [depois](assets/formularios-completa-2026-10-24/pdv-depois-mobile-escuro.png) |

As imagens de PDV mostram o componente monetário isolado; a interação da página completa é coberta pelas suítes próprias. Imagens são amostras, não comprovação visual de todas as abas de todos os formulários. A revisão mecânica Impeccable dos arquivos alterados retornou `[]`; revisão de labels, foco, contraste por tokens, slots e grids complementa esse resultado, que não substitui testes funcionais.

## Resultado final

### Testes executados

| Execução | Total | Aprovados | Falhas | Não executados | Observação |
|---|---:|---:|---:|---:|---|
| Piloto, antes da expansão | 116 | 114 | 0 | 2 | Guardas opcionais de PostgreSQL e captura do piloto |
| Diagnóstico global serial | 640 | 568 | 69 | 3 | Execução intermediária; falhas analisadas abaixo |
| Confirmação de PDV e configuração | 145 | 144 | 0 | 1 | Inclui atalhos, quantidade inteira/fracionária, alinhamento, pagamento misto, parcelas e configuração; captura opcional fora dessa execução |
| Final: Entradas, Kits, Produtos e formulários integrados | 72 | 70 | 0 | 2 | Captura 15B executada; apenas PostgreSQL/captura específicos do piloto ignorados |
| Final: campos, Caixa, contas financeiras, a pagar e a receber | 87 | 87 | 0 | 0 | Reexecutada integralmente após interrupção anterior; inclui parsers protegidos |
| Final: conferência e acessibilidade das políticas | 7 | 7 | 0 | 0 | Seleção de casos afetados, sem repetir a Agenda preexistente |
| Final: correções estáticas | 24 | 20 | 4 | 0 | As mesmas quatro falhas preexistentes, reproduzidas no HEAD |
| Reprodução estática no HEAD original | 6 | 0 | 6 | 0 | Reprodução intencional das quatro anteriores, título e regra estática de listagens |

As linhas se sobrepõem e não devem ser somadas como testes únicos. As três execuções finais limpas de 72, 87 e sete casos usam arquivos/seleções distintos: **164 aprovados, zero falhas e dois opcionais não executados**. Uma execução foi interrompida após 82 casos aprovados, antes do resumo; ela não foi usada como aprovação integral e seus arquivos foram executados novamente.

Build frontend (`npm run build`, incluindo TypeScript) aprovado depois dos ajustes de precisão. `npm run lint`: zero erros e dois avisos anteriores de `react-hooks/incompatible-library` em `watch()` do React Hook Form, em `ConfiguracaoFormaPagamentoForm` e `ContaBancariaForm`. O aviso de bundle acima de 500 kB permanece; não foram alteradas dependências ou divisão de bundles. `git diff --check` aprovado.

Execução serial utilizada para reduzir concorrência entre os navegadores:

```powershell
node --test --test-concurrency=1 tests/*.test.mjs
node --test --test-concurrency=1 tests/entrada-mercadoria.test.mjs tests/formularios-completos.test.mjs tests/kit-produtos.test.mjs tests/produto-campos-form.test.mjs
node --test --test-concurrency=1 tests/campos-formulario.test.mjs tests/caixa-abertura.test.mjs tests/contas-pagar.test.mjs tests/contas-receber.test.mjs tests/contas-financeiras.test.mjs
node --test --test-name-pattern='conferência|total, divergências' tests/politicas-recebimento.test.mjs
```

A captura 15B da segunda linha recebeu `FORM_15B_EVIDENCE` apontando ao diretório temporário de imagens e `FORM_15B_BASELINE` à cópia das fontes anterior à expansão. Os testes bloqueiam requisições não simuladas. Logs completos ficaram no TEMP local com prefixo `novexa-15b-`; não contêm credenciais. A suíte global não foi repetida após os ajustes: foram reexecutados os consumidores afetados e mantidas as evidências dos arquivos preservados.

### Falhas globais e limites

Das 69 falhas intermediárias, 51 estavam relacionadas à adaptação: 41 de PDV (representação compacta, nome acessível e layout), cinco de configuração, três de apresentação em recebimentos, uma em Caixa e uma asserção estática sobre `inputMode` deslocado à base compartilhada. Foram corrigidas e os consumidores retestados. Os três valores fracionários esperados no PDV foram atualizados para vírgula; os testes de inteiros, atalhos, foco, alinhamento, payload e limites não foram enfraquecidos. Outras atualizações de expectativas restringem-se à representação brasileira ou à localização do componente reutilizado. Uma falha intermediária de temporização da paginação de Categorias não se repetiu na execução global serial; a consulta/paginação não foi modificada.

**Permanecem 18 falhas preexistentes, fora da padronização:**

| Suíte | Casos | Evidência / pendência |
|---|---:|---|
| `correcoes-criticas` | 4 | Regex estáticas antigas sobre tipos do Caixa, expressão de foco, título de identificação e implementação do fechamento; quatro reproduzidas novamente no HEAD |
| `layout` | 1 | Expectativa literal do título dinâmico da Central; reproduzida no HEAD |
| `listagens-administrativas` | 8 | Sete casos de seletores/fixtures de tabelas e Cofre e uma regra estática que proíbe filtros; reprodução anterior do piloto preservada e caso estático reconfirmado no HEAD |
| `politicas-recebimento` | 5 | Agenda espera ação “Confirmar recebimento” ausente na composição anterior; reprodução do piloto preservada. O consumidor da Agenda não foi modificado |

O diagnóstico global não é verde. Esses casos não foram removidos, suprimidos ou contabilizados como aprovados. A aprovação desta padronização local não autoriza publicação nem resolve essas pendências independentes.

As verificações de persistência desta etapa cobrem contratos de envio, releitura simulada e estados de edição/erro. Não foi executada nova integração PostgreSQL de todos os módulos nem gravação no banco local original. O backend e seus contratos permanecem inalterados. As imagens são representativas: não há captura de cada aba, combinação de permissões ou dispositivo físico. Não foi realizada auditoria completa com leitor de tela; labels, associações de ajuda, foco e teclado foram verificados nos componentes e cenários automatizados.

### Arquivos e continuidade

Há **41 fontes frontend novas ou diferentes do início da 15B**, delimitadas pelos componentes/fontes do inventário: `CampoTexto`, `CampoDecimal`, `numeroFormulario`, os formulários adaptados e os parsers de entrada `composicaoProduto`, `cofreFormulario`, `conferenciaMeios` e `contaReceberUtils`. `CampoTexto` e `formularios-completos.test.mjs` são novos nesta etapa. Os arquivos de Produtos e campos decimais anteriores foram reaproveitados, sem substituir o piloto.

Testes ajustados nesta expansão: `caixa-abertura`, `configuracao-cartao-form`, `contas-receber`, `correcoes-criticas`, `entrada-mercadoria`, `estoque` e `pdv-buscas`; `campos-formulario` anterior foi ampliado. `produto-campos-form` existente foi preservado. Documentação atualizada: este inventário/relatório, `architecture/frontend.md` e uma seção no início de `architecture/CURRENT_STATE.md`. Evidência nova: 40 PNG e `medidas.json` em `assets/formularios-completa-2026-10-24`; imagens anteriores do piloto preservadas.

HEAD final permanece `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`, branch `main`. O diff binário do staging continua idêntico ao baseline. Arquivos paralelos, inclusive README, documentação de deploy, auditorias, backup, imagens e vídeos, foram preservados. Não houve commit, push, deploy ou acesso a produção. O trabalho anterior já staged não foi organizado nem incorporado a um commit nesta tarefa.

**FORM UX STANDARD COMPLETE**, no escopo de implementação frontend local: todos os formulários existentes foram inventariados e avaliados, os que necessitavam foram adaptados, e os testes direcionados afetados passaram. As limitações de integração real e as falhas globais preexistentes acima continuam explícitas para a futura integração. Não há expansão automática para novos fluxos ou módulos.
