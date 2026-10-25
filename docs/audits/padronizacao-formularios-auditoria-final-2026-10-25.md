# Auditoria final dos formulários — Tarefas 15, 15B e 15C

Data: 25/10/2026. Escopo: frontend local; auditoria, validação e preparação de commit. Sem autorização de publicação. Os relatórios datados das Tarefas 15 e 15B permanecem preservados.

## 1. Resumo executivo

A cobertura frontend foi confrontada com o código e complementada: o motivo de estorno do Extrato estava omitido e recebeu ajuste pontual, com testes. Foram avaliados 45 grupos/variantes: **35 PADRONIZADOS, cinco JÁ ADEQUADOS, cinco EXCEÇÕES JUSTIFICADAS e nenhum PENDENTE de padronização no inventário final**. A declaração anterior de inventário completo precisava dessa correção; os relatórios históricos não foram reescritos.

Execução global atual: **648 casos, 627 aprovados, 18 falhas preexistentes comprovadas e três ignorados**. Não houve nova falha funcional não resolvida. Após o ajuste pontual, a suíte afetada passou com 17 aprovados e um opcional ignorado; verificações adicionais de acessibilidade e visual também passaram. A suíte global não está verde. O trabalho está validado para preparar um commit isolado, com ressalvas explícitas e publicação ainda pendente de autorização, composição correta do staging e smoke de integração real.

## 2. Estado inicial e preservação do Git

Branch `main`, HEAD `71f2ea0224359ad0e886fdc45ab79941f0ce9d17` (`perf(auth): otimiza consulta de segurança JWT`), confirmado no início. Nenhum commit das Tarefas 15/15B existe nesse HEAD: a implementação está no worktree/index. Os commits anteriores de performance já fazem parte do baseline e não são mudanças novas desta publicação proposta.

Cinco arquivos estavam staged: relatório de deploy 14A/14B (fora do escopo), relatório do piloto 15, `CampoDecimal.tsx`, `numeroFormulario.ts` e `produto-campos-form.test.mjs`. Os dois componentes/utilitários novos possuem também alterações unstaged; o index sozinho contém versões anteriores às utilizadas pelos formulários da 15B.

Há documentação de deploy e execução local, auditorias, backup, caches, imagens temporárias e vídeos paralelos. `CURRENT_STATE.md` mistura seções das Tarefas 15/15B e publicação 14A/14B no mesmo hunk. Nada disso foi descartado, restaurado ou reorganizado. Baseline privado registra hashes de 124 arquivos e o diff binário completo do staging, para conferir preservação ao terminar. Não foram executados `git add`, commit, push, reset, restore, clean ou stash.

## 3. Método e inventário completo

O relatório anterior foi usado como hipótese, não como prova de cobertura. A varredura direta por AST TypeScript encontrou 64 arquivos TSX com 272 declarações de controles, incluindo bases, filtros, seletores, inputs gerados por metadados e controles de confirmação. Esses números não equivalem a campos únicos nem a 64 formulários editáveis. Foram examinados labels, props, handlers e diffs; Empresa e Fornecedor foram conferidos também nos renderizadores dinâmicos. Consultas sem edição foram separadas dos fluxos de gravação.

O confronto encontrou uma omissão: `ExtratoFinanceiroDrawer` não é somente consulta; contém o motivo editável para estornar movimentação/transferência. Esse fluxo passa a constar separadamente no inventário auditado. Não existem telas autônomas adicionais de Pedidos, Ajuste de Custo ou cadastro de adquirentes nesta composição.

| Grupo / módulo | Formulário / variante | Classificação | Verificação no código |
|---|---|---|---|
| 1 / A — Produtos | `ProdutoForm` completo, rápido e duplicação | **PADRONIZADO** | Piloto preservado; embalagem agora usa `CampoQuantidade`, 3 casas; referência continua texto |
| 2 / A — Produtos | `ComposicaoProdutoCampos` | **PADRONIZADO** | `CampoQuantidade`, `CampoDecimal`, `CampoTexto`; sem spinbox |
| 3 / A — Produtos | `ClassificacaoProdutoCampos` | **JÁ ADEQUADO** | Preservado: labels, ajuda e tratamento de consulta já existentes |
| 4 / A — Categorias | `CategoriasProdutos.Cadastro` — categoria e subcategoria | **PADRONIZADO** | `CampoTexto` com exemplo; seletor de categoria preservado |
| 5 / A — Marcas | `Marcas.MarcaForm` | **PADRONIZADO** | `CampoTexto` com exemplo; conflitos/exclusão preservados |
| 6 / A — Clientes | `ClienteForm` | **PADRONIZADO** | `CampoTexto`; limite opcional em `CampoMonetario`, `null` no vazio, número no payload |
| 7 / A — Clientes | `EnderecoDialog` / `ContatoDialog` | **PADRONIZADO** | `CampoTexto`; labels, exemplos e grade existentes |
| 8 / A — Fornecedores | `FornecedorForm` completo/rápido | **PADRONIZADO** | `CampoTexto` com exemplos por campo; mesma função de salvar e máscaras |
| 9 / B — Comercial | Central de Vendas / detalhes e pedidos | **JÁ ADEQUADO** | Preservados; criação comercial usa o PDV existente, inventariado na etapa E |
| 10 / C — Estoque | `Estoque` — entrada, saída e ajuste avulsos | **PADRONIZADO** | `CampoQuantidade` (3), `CampoTexto`; conversão segura sem alterar movimentos |
| 11 / C — Compras | `EntradaMercadoriaForm` manual/XML | **PADRONIZADO** | `CampoTexto`; datas, leitura e validações existentes |
| 12 / C — Compras | `EntradaMercadoriaItens` | **PADRONIZADO** | `CampoQuantidade`, `CampoMonetario`, `CampoTexto`, sem spinbox |
| 13 / C — Compras | `EntradaXmlImportacao` | **EXCEÇÃO JUSTIFICADA** | Preservado: label visível, seletor nativo e ajuda existentes |
| 14 / C — Compras | `EntradaObrigacao` — gerar ou vincular | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; sem alterar rateio ou geração financeira |
| 15 / D — A pagar | `ContaPagarDrawer` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; payload e vínculos preservados |
| 16 / D — A pagar | `ContasPagar` — pagamento | **PADRONIZADO** | Somente campos do diálogo adaptados; filtros da consulta preservados |
| 17 / D — A receber | `ContaReceberForm` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`, inteiro com passo para metadados de parcela |
| 18 / D — A receber | `ContaReceberBaixaDialog` | **PADRONIZADO** | `CampoMonetario`, `CampoTexto`; seletores e bloqueios preservados |
| 19 / D — A receber | `ContaReceberDetalhe` — estorno | **PADRONIZADO** | `CampoTexto`; confirmação e regras de estorno existentes |
| 20 / D — Contas | `ContaFinanceiraDrawer` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; não transforma saldo de edição em campo gravável |
| 21 / D — Extrato | `MovimentacaoFinanceiraDrawer` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; valores/sinais e serviço preservados |
| 22 / D — Transferências | `TransferenciaFinanceiraDrawer` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; não altera débito/crédito |
| 23 / D — Bancos | `BancoForm` | **PADRONIZADO** | `CampoTexto`; nenhum incremento em códigos |
| 24 / D — Agências | `AgenciaForm` | **PADRONIZADO** | `CampoTexto`; RHF/Yup e vínculos preservados |
| 25 / D — Contas bancárias | `ContaBancariaForm` | **PADRONIZADO** | `CampoTexto`; códigos com zeros preservados |
| 26 / D — Caixa | `CaixaForm` | **PADRONIZADO** | `CampoTexto`; exemplo existente preservado |
| 27 / D — Caixa | `AberturaCaixaDialog` | **PADRONIZADO** | `CampoTexto`, `CampoMonetario`; permissões, limites, composição e submissão existentes |
| 28 / D — Caixa | `Caixa` — sangria/suprimento | **PADRONIZADO** | Campos do diálogo adaptados; consultas e regras mantidas |
| 29 / D — Caixa | `Caixa` — fechamento | **PADRONIZADO** | `CampoMonetario`, `CampoTexto`; cálculo/diferença e confirmação preservados |
| 30 / D — Cofre | `EntregaCofreCampos` | **PADRONIZADO** | `CampoMonetario`, `CampoTexto`; complementos e regras existentes |
| 31 / D — Cofre | `CofrePainel` — devolução/suprimento | **PADRONIZADO** | Seletor em `CampoTexto`; extrato/filtros da página preservados |
| 32 / D — Conferência | `ConferenciaMeiosPagamento` | **PADRONIZADO** | `CampoMonetario`; conferência não se torna liquidação |
| 33 / D — Pagamentos | `FormaPagamentoForm` | **PADRONIZADO** | `CampoTexto`; catálogo e autorização sem alterações |
| 34 / D — Pagamentos | `ConfiguracaoFormaPagamentoForm` | **PADRONIZADO** | `CampoTexto`, `CampoPercentual`, `CampoMonetario`, `CampoDecimal`; Yup converte strings para o mesmo payload numérico |
| 35 / D — Políticas | `ConfiguracaoRecebimentos` | **JÁ ADEQUADO** | Preservado: controles MUI rotulados e orientações já existentes; sem mudar políticas |
| 36 / D — Agenda | `RecebimentosContaDrawer`, `Recebiveis` | **EXCEÇÃO JUSTIFICADA** | Preservados: não há novo formulário de valores/parcelamento a criar |
| 37 / E — PDV | `Vendas` — produto/quantidades | **EXCEÇÃO JUSTIFICADA** | Busca orientada, quantidade decimal; atalhos, refs e controles existentes preservados |
| 38 / E — PDV | `Vendas` — opções | **PADRONIZADO** | `ValorMonetarioPDV` e `CampoTexto`; sem novo passo no checkout |
| 39 / E — PDV | `PagamentoVendaDialog` | **EXCEÇÃO JUSTIFICADA** | `ValorMonetarioPDV` preservado com base textual comum; seletores/datas em `CampoTexto` |
| 40 / E — PDV | `BuscaAvancadaProdutoDialog`, `SessaoCaixaPDVDialog` | **JÁ ADEQUADO** | Busca já orientada; abertura reutiliza `AberturaCaixaDialog` |
| 41 / F — Empresa | `EmpresaForm` e metadados `empresaFormulario` | **PADRONIZADO** | `CampoTexto`, exemplos; máscaras, validação por aba, lookup de CEP e permissões preservados |
| 42 / F — Empresa | `InscricaoDialog` e logomarca | **EXCEÇÃO JUSTIFICADA** | `CampoTexto`; seletor de imagem e leitura existentes preservados |
| 43 / F — Usuários | `UsuarioDrawer` — cadastro/edição e redefinição | **PADRONIZADO** | `CampoTexto`; tipos/autocomplete, refs, mensagens e permissões preservados |
| 44 / F — Acesso | `Login` | **JÁ ADEQUADO** | Preservado: já possui labels permanentes e campos apropriados; sem substituir seu layout |
| 45 / D — Extrato | `ExtratoFinanceiroDrawer` — motivo do estorno manual/transferência | **PADRONIZADO na 15C** | `CampoTexto`, placeholder e ajuda; obrigatoriedade, 500 caracteres, foco, Tab e payload dos dois tipos de estorno comprovados |

As linhas agrupam variantes e componentes reutilizados; não representam 45 formulários independentes. `JÁ ADEQUADO` exige label, validação e comportamento existentes adequados, não ausência de leitura do arquivo. As exceções preservam uploads nativos, controles operacionais do PDV e confirmações sem novos valores; não dispensam acessibilidade.

Filtros em Produtos, Clientes, Empresa, Usuários, Fornecedores, Categorias, Marcas, Entradas, Estoque, Central/Análise/Rankings, Contas a Pagar/Receber, Recebíveis, Dados Bancários, Formas de Pagamento, Caixa e Cofre foram conferidos como consulta. `AppTable`, `PageFilters`, listas mobile e navegação não receberam adaptação em massa. Confirmações de inativação, cancelamento e liquidação sem campos editáveis foram avaliadas como fluxos já adequados; isso não acrescenta formulários fictícios à cobertura.

## 4. Componentes reutilizáveis

`CampoTexto` reaproveita `TextFieldProps` do MUI: encaminha refs, máscaras, valores, slots de Autocomplete/RHF e estados; preserva callbacks de slots. Label encolhido visível, nome de controle, ajuda anunciada e placeholder pelo tema são comuns. `sx` do consumidor permanece combinável. A tipagem é verificada pelo build TypeScript.

`CampoDecimal` e os adaptadores monetário/quantidade/percentual vêm do piloto. Preservam string durante edição, formatação no blur, vazio, erro, `disabled`/`readOnly`, nome/descrição acessíveis, inputMode decimal ou inteiro e precisão por consumidor. `canonico` converte apenas texto lexicalmente válido para os parsers existentes; inválidos continuam visíveis. O callback que retorna `false` conserva o validador de digitação do PDV. Campos com passo usam cálculo em inteiros escalados, limites e teclado; o evento de rolagem não altera valores.

Não foi encontrada necessidade de nova base. A sobreposição de altura mínima com `CadastroDialog` é compatibilidade de formulários existentes, não motivo para uma refatoração global. `ValorMonetarioPDV` preserva parser, limite de dígitos e seleção ao focar próprios da operação; substituí-lo pelo parser genérico seria uma mudança de comportamento. A configuração de cartão usa `Controller`, `inputRef`, `onBlur` e validações Yup; o payload final continua numérico/null conforme o contrato.

## 5. Precisão, payload e regras preservadas

| Área | Conferência |
|---|---|
| Produtos | Custo/venda 2 casas, estoque mínimo 3; custo/preço zero conforme regra anterior, vazio obrigatório bloqueado; documentos/códigos continuam texto |
| Kits | Quantidade 3, fator 6; conversão segura, positividade e duplicidade; nenhum arredondamento automático de `0,000002` |
| Entradas/Estoque | Quantidade 3, custo 2; zero no ajuste e positividade na entrada/saída preservados; custo XML acima da precisão continua exigindo revisão explícita |
| Financeiro | Quantias 2; taxas percentuais 4; fixa 2; parcelas/dias inteiros. Contas distintas, saldo, UUID e regras de baixa/estorno continuam existentes |
| PDV | Quantidades inteiras compactas, frações com até 3 casas; parser monetário operacional e cálculo em centavos preservados; preço somente leitura |

`numeroDecimal` valida texto e roundtrip decimal antes da conversão para o contrato `number`; valores sem representação segura são bloqueados. `0,0002`, `1,2500`, `10,50` e `1.234,56` mantêm semântica conforme a precisão do campo. Ponto sem vírgula não vira automaticamente separador de milhar nos campos genéricos. No PDV, inteiros não recebem agrupamento de milhar ambíguo.

As proteções da 15B impedem que `90071992547409,91` seja enviado após perder centavos; reutilizam o parser do piloto nas fronteiras de entrada. Não mudam fórmulas de saldo, juros, estoque, rateio ou liquidação. Campos financeiros sensíveis não recebem spinbox; incremento fica restrito a estoque mínimo e metadados de parcelas. Vazio opcional segue null/omissão por domínio; texto inválido de taxa não vira zero ou null silenciosamente. A exceção dos campos ocultos de cartão mantém sua exclusão do payload de outros meios.

A persistência física de todos os módulos não foi revalidada em banco nesta auditoria. Os testes de interface verificam os payloads, releitura simulada e ausência de envio indevido; o cenário PostgreSQL do piloto é evidência histórica restrita a Produtos. Essa distinção impede afirmar homologação financeira/produção com base em mocks.

## 6. Revisão visual das 40 capturas

Foram comparados os 20 pares das [capturas 15B](assets/formularios-completa-2026-10-24/medidas.json), não apenas contados os arquivos: Cliente, Itens de Entrada, Configuração de Pagamento, Usuário e campo monetário do PDV, cada qual em desktop/mobile e claro/escuro. As imagens foram examinadas em painéis antes/depois e originais mobile. A origem é a cópia anterior à 15B, que já continha o piloto, não necessariamente o HEAD publicado. Capturas e fontes correspondentes permaneceram com os hashes do início da auditoria.

| Amostra | Comparação e resultado |
|---|---|
| Cliente, oito imagens | Labels persistentes e exemplos melhoram campos vazios; espaçamento e altura mantidos. No mobile as abas seguem roláveis, com texto lateral parcialmente fora da área inicial, já presente antes |
| Entrada, oito imagens | Quantidade com vírgula e moeda identificada por R$; grid e alinhamento preservados. É a seção de itens isolada, não a entrada inteira |
| Configuração, oito imagens | Taxa 4 casas, R$/%, incremento apenas nas parcelas; helper existente sobre recebimento preservado. Rodapé fora da área inicial no mobile em ambas as versões; requer verificação de rolagem/teclado |
| Usuário, oito imagens | Labels/exemplos úteis, foco e hierarquia preservados; corpo mantém rolagem sob rodapé fixo. Não houve crescimento de helper texts |
| Campo PDV, oito imagens | Aparência quase idêntica; representa o componente isolado. Não comprova sozinha carrinho, leitor ou atalhos da página completa |

Não foram observados overflow horizontal novo, labels de campos truncados, desalinhamento de botões de incremento ou excesso novo de textos nas amostras. Truncamento natural de placeholder longo no input não remove seu label. As 40 imagens não incluem erros, todas as abas nem todos os formulários: esses estados exigem testes e leitura de código complementares.

## 7. Acessibilidade e operação

Os tokens de texto/placeholder foram calculados contra as superfícies usadas: claro `#5D6B7A` sobre branco 5,46:1 e sobre canvas 5,17:1; escuro `#B1C1D3` sobre input 8,82:1 e diálogo 6,70:1. Foco primário sobre input: 5,13:1 claro e 8,68:1 escuro. Isso não certifica conformidade WCAG completa de cada combinação/estado.

Ressalva P2 preexistente: a borda clara `#E4E8EC` sobre branco tem 1,23:1. Campos recebem label contrastante e foco mais forte; uma revisão de contraste não textual do tema é recomendada antes de alegar conformidade integral. Não foi alterado o tema global nesta auditoria. Controles pequenos existentes fora dos spinboxes e o rodapé rolável da configuração também merecem atenção em uma revisão transversal, sem serem regressões comprovadas da 15B.

Validação adicional em Chromium, 390×844 claro/escuro: o botão Atualizar é alcançado por Tab e entra na viewport por rolagem (y=738,33/h=42,5 no claro; y=737,33/h=42,5 no escuro). O campo inválido da taxa mantém `aria-invalid=true` e `aria-describedby` aponta à mensagem existente. Duas verificações passaram; [medidas e associações](assets/formularios-auditoria-2026-10-25/a11y-runtime.json). O rodapé não estar na captura inicial da configuração não é impedimento de operação por teclado.

As suítes atuais de PDV cobrem busca/código exato, Enter, Tab, Escape, atalhos F2/F3/F4/F5/F7/F8/F9, Ctrl+B/Ctrl+Delete, foco/restauração, quantidade inteira/fracionada, toque em viewport mobile e envio do pagamento. Foram revisadas também capturas novas da página completa em [desktop](assets/formularios-auditoria-2026-10-25/pdv-desktop-claro.png) e [mobile](assets/formularios-auditoria-2026-10-25/pdv-mobile-claro.png), geradas pela execução atual: layout operacional, inteiros compactos, moeda e alvos operacionais preservados. O screenshot fullPage mobile inclui o rodapé fixo na posição da viewport inicial; não equivale a teste de oclusão de todos os campos possíveis. As verificações de teclado e rolagem complementam a imagem.

O campo de estorno foi confirmado em [desktop claro](assets/formularios-auditoria-2026-10-25/extrato-desktop-claro.png) e [mobile escuro](assets/formularios-auditoria-2026-10-25/extrato-mobile-escuro.png), sem truncamento de label ou overflow do diálogo. Não há evidência de leitor de tela NVDA/Narrador nem de leitor físico de código de barras; os testes usam teclado e emulação de viewport, não dispositivo físico. Não foi feita certificação WCAG integral.

## 8. Testes e falhas preexistentes

| Verificação nesta auditoria | Total | Aprovados | Falhas | Ignorados | Resultado / origem |
|---|---:|---:|---:|---:|---|
| Global serial — 51 arquivos `tests/*.test.mjs` | 648 | 627 | 18 | 3 | Baseline inicial da 15C, antes do ajuste do único campo de estorno |
| Reprodução estática com `git show HEAD` | 6 | 0 | 6 | 0 | As seis falhas são esperadas na reprodução; não são aprovações |
| Contas/Cofre com fontes do HEAD | 8 | 1 | 7 | 0 | 38 módulos de fonte carregados do HEAD por plugin de leitura |
| Agenda com fontes do HEAD | 5 | 0 | 5 | 0 | 18 módulos de fonte carregados do HEAD; cinco timeouts esperados na reprodução |
| Final pós-ajuste: `formularios-completos` + `contas-financeiras` | 18 | 17 | 0 | 1 | Treze casos anteriores preservados e dois novos de estorno, mais dois de services/descrição; captura opcional da 15B ignorada |
| Acessibilidade adicional da configuração | 2 | 2 | 0 | 0 | Tab, botão na viewport e erro associado; claro/escuro mobile |
| Estorno adicional desktop/mobile com captura | 2 | 2 | 0 | 0 | Mesmos componentes/payloads, dados simulados e HTTP interceptado |

As linhas têm sobreposição e não devem ser somadas como testes únicos. Os três ignorados globais foram a integração PostgreSQL e captura específicas do piloto e a captura opcional da 15B. Os 40 PNG existentes foram revisados; não se declarou sua geração novamente como teste aprovado nesta rodada.

Build final e TypeScript (`npm run build`, `tsc -b && vite build`) aprovados após o ajuste. ESLint final: **zero erros e dois avisos anteriores** de `react-hooks/incompatible-library` no `watch()` de `ConfiguracaoFormaPagamentoForm` e `ContaBancariaForm`. Aviso de bundle acima de 500 kB permanece (bundle JS ~1,414 MB, gzip ~417 kB); não foi ocultado. `git diff --check` aprovado; staging verificado separadamente.

Os logs históricos foram conferidos: 72/70/2 ignorados, 87/87 e 7/7 sustentam os 164 aprovados em três execuções distintas; a confirmação PDV/configuração registra 145/144/um ignorado. Seus resultados não foram somados entre si nem usados para substituir a nova execução global. Os logs antigos não contêm um manifesto inequívoco de toda a linha de comando da rodada 145; a auditoria atual define seu universo pelo glob de 51 arquivos e comandos registrados abaixo.

Asserções revistas: `caixa-abertura`, `contas-receber`, `entrada-mercadoria` e `pdv-buscas` alteraram somente expectativas de exibição pt-BR; números do payload, limites, saldo, UUID, HTTP/tenant e atalhos permanecem. `estoque`/`correcoes-criticas` passaram a localizar a definição de inputMode na base compartilhada e exigir seu uso no consumidor. Não foi removido teste nem alargada tolerância para esconder falhas. `configuracao-cartao-form` acrescentou rejeição de texto/precisão excedida e preservou expectativas de envio. Novos arquivos da implementação: `campos-formulario`, `produto-campos-form` e `formularios-completos`; a 15C acrescentou dois casos ao último.

Na escrita dos dois testes novos houve falhas intermediárias de fixture: o botão do AppTable se chama “Estornar movimentação”, e transferência usa `/transferencias/{id}/estornar`, enquanto movimento usa `/movimentacoes-financeiras/{id}/estorno`. As expectativas foram conferidas no service/types inalterados, com ID numérico, e corrigidas; as asserções exatas de rota e payload permanecem. Não foi mudado o produto para satisfazê-las.

### As 18 falhas preexistentes comprovadas

| Suíte / causa | Quantidade | Confirmação independente |
|---|---:|---|
| `correcoes-criticas`: regex antigas de tipos/foco/seções/fechamento | 4 | Mesmas expectativas falham contra fonte lida diretamente do HEAD |
| `layout`: título literal da Central, hoje dinâmico | 1 | Reproduzida com fonte do HEAD |
| `listagens-administrativas`: regra estática genérica que proíbe `.filter` | 1 | Reproduzida com fonte do HEAD |
| `listagens-administrativas`: escopo de tabelas/seletores e fixture sem consultas do Cofre | 7 | Fontes do HEAD, sete falhas nos mesmos nomes/causas; avisos assíncronos de HTTP inesperado da fixture também reaparecem |
| `politicas-recebimento`: ação “Confirmar recebimento” ausente na Agenda da composição anterior | 5 | Fontes do HEAD, mesmos cinco timeouts; não corresponde a quebra de liquidação causada pelo wrapper |

Os loaders de reprodução só leem `71f2ea0` por `git show`; não usam checkout, restore, worktree ou substituição das fontes. As expectativas dos casos são mantidas, e os requests continuam simulados. Portanto, **18 falhas preexistentes, zero falhas novas não resolvidas** na composição auditada. Os avisos assíncronos de fixture são registrados, não convertidos em aprovação.

Comandos atuais, executados em `frontend`:

```powershell
node --test --test-concurrency=1 tests/*.test.mjs
node --test --test-concurrency=1 tests/formularios-completos.test.mjs tests/contas-financeiras.test.mjs
npm run build
npm run lint
git diff --check
```

Os testes auxiliares isolados ficam no TEMP privado `novexa-form-15c-*`, com logs `novexa-15c-global`, `baseline-estatico`, `baseline-contas`, `baseline-agenda`, `estorno-entrega`, `a11y` e `extrato-visual`. Não há credenciais nesses artefatos. A suíte global não foi repetida depois de trocar somente o campo textual: os consumidores não afetados mantiveram seus hashes; foram reexecutados os testes do arquivo afetado, build e lint finais. O smoke `npm run test:e2e` com conta/API real não foi executado: ele cria registros e não foi configurado um tenant/banco descartável autorizado nesta auditoria.

## 9. Segurança e regressões fora de UX

O diff contra HEAD não contém backend, migrations, services/types de API, rotas, tema, autenticação, permissões ou dependências (`package.json`/lock). Foram revisadas as conversões de entrada e handlers alterados: não removem empresa, perfil, confirmação, validação de saldo, idempotência ou verificações de estado. Financeiro/PDV continuam usando os mesmos services e DTOs.

Nenhuma operação em produção, banco original, Oracle, Supabase ou Vercel foi executada. A auditoria de frontend não substitui retestes de segurança do backend caso esses arquivos mudem depois desta validação.

## 10. Achados e ajustes pontuais

- **P2 — omissão do motivo de estorno no inventário, resolvida**: `frontend/src/pages/Financeiro/ExtratoFinanceiroDrawer.tsx:137`. É um campo editável, não filtro. Usa `CampoTexto`, placeholder e ajuda, mantendo obrigatoriedade, 500 caracteres e foco. O corpo de `confirmarEstorno` foi comparado ao snapshot anterior e permanece textual e integralmente idêntico; os dois novos testes cobrem os contratos distintos de movimentação e transferência.
- **P2 — evidência visual limitada**: 40 PNG são cinco amostras, incluindo dois componentes isolados. São úteis e mostram melhoria, mas não comprovam cobertura visual integral de todas as abas. A validação funcional complementa a amostragem.
- **P2 — borda clara de baixo contraste**: `frontend/src/theme/theme.ts:107`, preexistente; revisão transversal recomendada, fora da padronização pontual.

Detector Impeccable sobre os arquivos alterados e confirmação no único componente ajustado: `[]`, sem achados mecânicos. Esse resultado não substitui os achados manuais. O sistema visual é coerente com o Novexa: MUI, tokens, hierarquia operacional e componentes existentes, sem novo framework. Pontuação manual limitada à amostragem: acessibilidade 3/4, performance 3/4 (bundle grande anterior), temas 3/4, responsividade 3/4, integridade 3/4: **15/20**, sem certificação universal de acessibilidade. Melhorias futuras devem começar pelas ressalvas reais, não por redesenho ou abstrações novas. Se aprovadas em outra tarefa, usar `impeccable adapt`/`harden` para responsividade/estados e uma confirmação `polish` ao final; nenhuma expansão foi iniciada.

## 11. Manifesto e preparação do commit isolado

Manifesto fechado: **112 arquivos/caminhos**, com `CURRENT_STATE.md` somente por hunks: 42 fontes, 10 testes, 5 documentos e 55 evid?ncias. Nenhum arquivo exclu?do. Estado `AM` significa vers?o j? staged e altera??es adicionais unstaged; `A ` ? novo j? staged; `??` ? novo n?o rastreado; ` M` ? somente unstaged.

### Fontes

```text
 M frontend/src/components/fornecedores/FornecedorForm.tsx
AM frontend/src/components/ui/CampoDecimal.tsx
?? frontend/src/components/ui/CampoTexto.tsx
 M frontend/src/pages/Clientes/ClienteForm.tsx
 M frontend/src/pages/Empresa/EmpresaForm.tsx
 M frontend/src/pages/Estoque/EntradaMercadoriaForm.tsx
 M frontend/src/pages/Estoque/EntradaMercadoriaItens.tsx
 M frontend/src/pages/Estoque/EntradaObrigacao.tsx
 M frontend/src/pages/Estoque/Estoque.tsx
 M frontend/src/pages/Financeiro/AberturaCaixaDialog.tsx
 M frontend/src/pages/Financeiro/AgenciaForm.tsx
 M frontend/src/pages/Financeiro/BancoForm.tsx
 M frontend/src/pages/Financeiro/Caixa.tsx
 M frontend/src/pages/Financeiro/CaixaForm.tsx
 M frontend/src/pages/Financeiro/CofrePainel.tsx
 M frontend/src/pages/Financeiro/ConferenciaMeiosPagamento.tsx
 M frontend/src/pages/Financeiro/ConfiguracaoFormaPagamentoForm.tsx
 M frontend/src/pages/Financeiro/ContaBancariaForm.tsx
 M frontend/src/pages/Financeiro/ContaFinanceiraDrawer.tsx
 M frontend/src/pages/Financeiro/ContaPagarDrawer.tsx
 M frontend/src/pages/Financeiro/ContaReceberBaixaDialog.tsx
 M frontend/src/pages/Financeiro/ContaReceberDetalhe.tsx
 M frontend/src/pages/Financeiro/ContaReceberForm.tsx
 M frontend/src/pages/Financeiro/ContasPagar.tsx
 M frontend/src/pages/Financeiro/EntregaCofreCampos.tsx
 M frontend/src/pages/Financeiro/ExtratoFinanceiroDrawer.tsx
 M frontend/src/pages/Financeiro/FormaPagamentoForm.tsx
 M frontend/src/pages/Financeiro/MovimentacaoFinanceiraDrawer.tsx
 M frontend/src/pages/Financeiro/TransferenciaFinanceiraDrawer.tsx
 M frontend/src/pages/Financeiro/cofreFormulario.ts
 M frontend/src/pages/Financeiro/conferenciaMeios.ts
 M frontend/src/pages/Financeiro/contaReceberUtils.ts
 M frontend/src/pages/Produtos/CategoriasProdutos.tsx
 M frontend/src/pages/Produtos/ComposicaoProdutoCampos.tsx
 M frontend/src/pages/Produtos/Marcas.tsx
 M frontend/src/pages/Produtos/ProdutoForm.tsx
 M frontend/src/pages/Produtos/composicaoProduto.ts
 M frontend/src/pages/Usuarios/UsuarioDrawer.tsx
 M frontend/src/pages/Vendas/PagamentoVendaDialog.tsx
 M frontend/src/pages/Vendas/ValorMonetarioPDV.tsx
 M frontend/src/pages/Vendas/Vendas.tsx
AM frontend/src/utils/numeroFormulario.ts
```

### Testes

```text
 M frontend/tests/caixa-abertura.test.mjs
?? frontend/tests/campos-formulario.test.mjs
 M frontend/tests/configuracao-cartao-form.test.mjs
 M frontend/tests/contas-receber.test.mjs
 M frontend/tests/correcoes-criticas.test.mjs
 M frontend/tests/entrada-mercadoria.test.mjs
 M frontend/tests/estoque.test.mjs
?? frontend/tests/formularios-completos.test.mjs
 M frontend/tests/pdv-buscas.test.mjs
A  frontend/tests/produto-campos-form.test.mjs
```

### Documenta??o

```text
 M docs/architecture/CURRENT_STATE.md [SOMENTE HUNKS DE FORMULARIOS 15/15B/15C]
 M docs/architecture/frontend.md
A  docs/audits/padronizacao-formularios-2026-10-24.md
?? docs/audits/padronizacao-formularios-completa-2026-10-24.md
?? docs/audits/padronizacao-formularios-auditoria-final-2026-10-25.md
```

### Evid?ncias enumeradas (sem incluir imagens de outras tarefas)

```text
?? docs/audits/assets/formularios-2026-10-24/antes-desktop-claro-dados.png
?? docs/audits/assets/formularios-2026-10-24/antes-desktop-claro-precos.png
?? docs/audits/assets/formularios-2026-10-24/antes-desktop-escuro-precos.png
?? docs/audits/assets/formularios-2026-10-24/antes-mobile-claro-precos.png
?? docs/audits/assets/formularios-2026-10-24/depois-desktop-claro-dados.png
?? docs/audits/assets/formularios-2026-10-24/depois-desktop-claro-precos.png
?? docs/audits/assets/formularios-2026-10-24/depois-desktop-escuro-precos.png
?? docs/audits/assets/formularios-2026-10-24/depois-mobile-claro-precos.png
?? docs/audits/assets/formularios-2026-10-24/medidas.json
?? docs/audits/assets/formularios-auditoria-2026-10-25/a11y-runtime.json
?? docs/audits/assets/formularios-auditoria-2026-10-25/extrato-desktop-claro.png
?? docs/audits/assets/formularios-auditoria-2026-10-25/extrato-mobile-escuro.png
?? docs/audits/assets/formularios-auditoria-2026-10-25/pdv-desktop-claro.png
?? docs/audits/assets/formularios-auditoria-2026-10-25/pdv-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-antes-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-antes-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-antes-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-antes-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-depois-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-depois-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-depois-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/cliente-depois-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-antes-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-antes-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-antes-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-antes-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-depois-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-depois-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-depois-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/configuracao-depois-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-antes-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-antes-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-antes-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-antes-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-depois-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-depois-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-depois-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/entrada-depois-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/medidas.json
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-antes-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-antes-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-antes-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-antes-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-depois-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-depois-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-depois-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/pdv-depois-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-antes-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-antes-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-antes-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-antes-mobile-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-depois-desktop-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-depois-desktop-escuro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-depois-mobile-claro.png
?? docs/audits/assets/formularios-completa-2026-10-24/usuario-depois-mobile-escuro.png
```

Entre fontes/testes: **6 novos e 46 modificados em rela??o ao HEAD**. Os estados do index mostram por que o commit n?o pode usar indiscriminadamente o que j? estava staged.

O commit proposto deve conter as versões completas finais de `CampoDecimal`, `numeroFormulario` e `CampoTexto` junto de todos os consumidores: o conteúdo já staged dos dois primeiros é insuficiente para as props utilizadas pela 15B. Os testes novos não rastreados também são dependências da entrega. Não separar arbitrariamente o wrapper dos consumidores.

O index atual inclui o relatório 14D: um commit convencional após adicionar apenas os arquivos restantes ainda misturaria esse relatório. A futura etapa autorizada precisa segregar o staging paralelo sem alterar seu arquivo/conteúdo, guardar e conferir seu diff e revisar a lista staged final contra este manifesto. Não foi feita essa reorganização agora. O relatório 14D e seus estados permaneceram intactos.

Em `CURRENT_STATE.md`, selecionar somente as seções de formulários 15, 15B e auditoria 15C no início. O primeiro hunk também contém publicação 14A/14B: precisa ser dividido/selecionado por linhas numa etapa futura autorizada. Deixar fora a seção de publicação e as substituições dos parágrafos de autenticação/extrato. `frontend.md` contém somente as seções pertinentes aos formulários e pode ser incluído integralmente após revisão.

Devem ficar fora: `README.md`, `docs/deploy/producao.md`, `docs/audits/deploy-performance-14a-14b-2026-10-23.md` (já staged), auditoria anterior de performance financeiro, reconciliação local V54, script/cache de backup, imagens `tmp-video-*` e `videos_referencias/`. Não usar `git add .` ou incluir todo `docs/audits/assets/`: somente os arquivos enumerados.

Mensagem proposta: `feat(ui): padroniza formularios e campos numericos do ERP`. Não foi executado staging ou commit. A documentação 14D deve seguir integração independente. Antes de qualquer commit autorizado: revisar diffs staged por arquivo/hunk, validar que correspondem à versão testada e conferir novamente HEAD/concorrência.

## 12. Critérios de publicação e veredito

**APROVADO COM RESSALVAS PARA PREPARAÇÃO DO COMMIT — PUBLICAÇÃO PENDENTE.** Cobertura revisada/complementada, precisão e contratos frontend preservados, melhoria visual nas amostras, nenhum defeito funcional novo não resolvido. O conjunto completo da implementação deve ser mantido junto; o staging atual ainda mistura documentação paralela e versões parciais, portanto não está pronto para um commit indiscriminado.

Antes de publicar:

1. Autorizar a etapa de integração e montar o commit exclusivamente com o manifesto/hunks abaixo, preservando o staging paralelo; conferir novamente HEAD, diffs e hashes testados.
2. Registrar decisão explícita sobre as 18 falhas preexistentes e a ressalva de contraste não textual; não suprimir testes nem afirmar WCAG/global verde.
3. Executar smoke de integração com API e persistência reais em ambiente descartável/tenant de teste autorizado, para os fluxos representativos adaptados. Mocks provam contrato e comportamento de interface, não persistência física universal.
4. Obter autorização separada para push/deploy e conferir o efeito de deploy automático da Vercel. Não há nova migration, contrato ou necessidade de alteração de backend nesta entrega frontend; o estado efetivo dos ambientes publicados não foi auditado nesta tarefa.

Somente o campo de estorno, seus dois testes e a documentação/evidência da auditoria foram acrescentados pela 15C. Relatórios anteriores, 40 capturas da 15B, piloto, staging e trabalhos paralelos foram preservados. Sem commit, push, deploy ou operações em bancos reais.

Referências: [Minimal Work](../../.agents/skills/minimal-work/SKILL.md), [padrões frontend](../architecture/frontend.md), [piloto](padronizacao-formularios-2026-10-24.md), [expansão 15B](padronizacao-formularios-completa-2026-10-24.md), [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Impeccable orientou a auditoria técnica, preservando a identidade e o escopo do produto.
