# Estoque — Arquitetura e Regras de Negócio

## Composição de Produtos — V46

Kit/Combo não mantém saldo físico nem recebe entrada, saída ou ajuste avulso. Disponibilidade é o menor quociente entre saldo físico disponível de cada componente e seu consumo por kit, truncado a três casas; saldo negativo ou componente inativo/sem controle resulta em disponibilidade zero. Esse resultado é calculado na consulta, inclusive filtros e ordenação remotos; não há outra fonte persistida de saldo nem reserva no rascunho. O MVP tem estoque por empresa, sem depósitos.

Faturamento bloqueia kit e componentes por ID crescente e valida quantidades agregadas, incluindo componentes compartilhados e itens avulsos. A configuração empresarial de estoque negativo e a confirmação explícita V44 continuam sendo exigidas; nenhum efeito parcial persiste em falha. Cada componente gera sua saída VENDA e um consumo auditável vinculado ao item/versão/custo. Cancelamento integral usa a saída original e registra sua reversão, sem consultar a composição atual para calcular reposição. Histórico de movimentos acrescenta `vendaId` e `produtoCompostoId` pelo vínculo persistido, consultado em lote, inclusive reversões; o link abre o detalhe existente da venda em nova aba.

## Exceção explícita de venda sem saldo — V44

A empresa pode habilitar `permitirVendaEstoqueNegativo` no formulário de Empresas (ADMIN). O padrão é `false`, inclusive para empresas existentes. Fora do faturamento de Venda, a regra de saída sem saldo continua bloqueada.

`POST /vendas` e `POST /vendas/{id}/faturar` aceitam `confirmarEstoqueInsuficiente=true`. Sem autorização empresarial ou confirmação, retornam 409 com `codigo=ESTOQUE_INSUFICIENTE`, `permitido` e `itens[{produtoId,nome,disponivel,solicitada}]`, sem gravar efeitos parciais. O PDV apresenta esses dados e só reenvia confirmado após ação explícita. Vendas com saldo suficiente seguem diretamente.

Somente a saída VENDA confirmada pode ficar negativa. `movimentacoes_estoque.estoque_insuficiente_confirmado` registra a exceção junto ao usuário, horário, saldos e vínculo com item da venda já existentes. Locks, transação, hash da requisição, repetição e reversão permanecem; flag ausente/false preserva o hash legado. Nenhuma baixa acontece ao adicionar itens ao rascunho. Cancelamento da venda repõe a quantidade original, sem apagar a confirmação histórica.

## Entrada de Mercadoria manual implementada

Entrada/Itens preservam nota, fornecedor e custo historico. RASCUNHO nao movimenta; CONFIRMADA aplica ENTRADA/COMPRA e ultimo precoCusto; CANCELADA gera SAIDA/CANCELAMENTO pelo servico existente. Locks de Entrada e Produtos em ordem crescente, idempotencia de operacoes e transacao unica preservam saldo/historico; saldo insuficiente bloqueia reversao integral. Contrato e detalhes em [entradas-mercadoria.md](entradas-mercadoria.md). Nao ha custo medio, importacao XML ou geracao financeira automatica nesta etapa. As referencias futuras a Compras neste documento nao representam implementacao de Pedido/Ordem de Compra.

## 1. Objetivo do módulo

O módulo de Estoque do Novexa ERP é responsável por controlar a quantidade disponível dos produtos da empresa e manter histórico rastreável de todas as alterações de saldo.

O objetivo é combinar:

- operação rápida;
- poucas ações manuais;
- rastreabilidade;
- segurança;
- integração automática com outros módulos;
- informação gerencial confiável.

Princípio do Novexa:

> O operador precisa de velocidade. O gestor precisa de informação.

O operador não deve precisar criar movimentações manualmente quando outro processo do sistema já conhece a origem da alteração.

Exemplos:

Venda faturada
→ gera saída de estoque automaticamente.

Compra recebida
→ futuramente gera entrada automaticamente.

Cancelamento de venda
→ futuramente gera estorno automaticamente.

Ajuste de inventário
→ gera movimentação de ajuste.

---

## 2. Conceitos principais

O estoque possui dois conceitos complementares:

### 2.1 Saldo atual

O Produto mantém um saldo materializado:

`estoqueAtual`

Esse valor representa a quantidade disponível atual do produto.

Ele existe para permitir consultas rápidas no PDV, listagens, relatórios e validações.

### 2.2 Histórico de movimentações

Toda alteração de saldo deve possuir uma movimentação correspondente.

A movimentação registra:

- empresa;
- produto;
- usuário;
- tipo;
- origem;
- quantidade;
- saldo anterior;
- saldo posterior;
- data/hora;
- motivo quando aplicável.

Portanto:

`estoqueAtual`

é o saldo operacional atual.

`MovimentacaoEstoque`

é a trilha histórica que explica como o saldo chegou naquele valor.

---

## 3. Regra fundamental

O saldo de estoque NÃO deve ser alterado diretamente pelo cadastro normal do Produto.

O fluxo correto é:

Movimentação
→ validações
→ saldo anterior
→ cálculo
→ atualização do Produto
→ saldo posterior
→ registro histórico

Isso deve ocorrer dentro de uma única transação.

Exemplo:

Saldo atual: 10

Entrada: 5

Resultado:

saldoAnterior = 10
quantidade = 5
saldoPosterior = 15

Produto.estoqueAtual = 15

---

## 4. Produtos que controlam estoque

Produto possui:

`controlaEstoque`

### controlaEstoque = true

O produto participa do controle de estoque.

Exemplos:

- bebidas;
- alimentos;
- tabaco;
- seda;
- acessórios;
- mercadorias em geral.

### controlaEstoque = false

O produto não participa do controle quantitativo.

Exemplos futuros possíveis:

- serviços;
- taxas;
- itens não controlados;
- produtos cuja empresa decidiu não controlar saldo.

Produtos sem controle de estoque não devem receber movimentações normais de estoque.

---

## 5. Tipos de movimentação

O Novexa possui três tipos básicos.

### ENTRADA

Aumenta o saldo.

Fórmula conceitual:

novoSaldo = saldoAtual + quantidade

Exemplos:

- recebimento de compra;
- entrada manual;
- devolução;
- correção positiva.

### SAÍDA

Diminui o saldo.

Fórmula conceitual:

novoSaldo = saldoAtual - quantidade

Exemplos:

- venda;
- perda;
- avaria;
- consumo interno;
- saída manual.

### AJUSTE

Define o saldo físico real do produto.

No Novexa, AJUSTE representa o NOVO SALDO, e não uma diferença.

Exemplo:

Saldo no sistema: 15

Contagem física: 12

Ajuste informado: 12

Resultado:

saldoAnterior = 15
saldoPosterior = 12

Essa abordagem facilita inventários e correções operacionais.

---

## 6. Origem da movimentação

Tipo e origem são conceitos diferentes.

Tipo responde:

> O saldo aumentou, diminuiu ou foi ajustado?

Origem responde:

> Por que essa movimentação aconteceu?

Origens previstas:

- MANUAL;
- VENDA;
- COMPRA;
- AJUSTE;
- CANCELAMENTO.

Outras origens podem ser adicionadas futuramente quando existirem módulos correspondentes.

Exemplo:

Venda faturada:

tipo = SAIDA
origem = VENDA

Cancelamento da venda:

tipo = ENTRADA
origem = CANCELAMENTO

Recebimento de compra:

tipo = ENTRADA
origem = COMPRA

---

## 7. Estoque negativo

Por padrão, o Novexa NÃO deve permitir que uma saída gere saldo negativo.

Exemplo:

Saldo atual = 3
Saída solicitada = 5

Resultado:

movimentação rejeitada.

Nenhuma alteração parcial deve permanecer.

Esse comportamento protege a consistência operacional.

Se futuramente existir necessidade comercial de permitir estoque negativo, isso deverá ser uma configuração explícita da Empresa e não uma exceção escondida no código.

---

## 8. Quantidades

Quantidade de estoque utiliza `BigDecimal`.

Isso permite trabalhar com:

- unidade;
- peso;
- volume;
- produtos fracionados.

Exemplos:

1 unidade

1,5 kg

0,750 litro

O domínio não deve depender exclusivamente de números inteiros.

A unidade de medida poderá evoluir futuramente como parte do cadastro de Produto.

---

## 9. Integração com Venda

Venda não deve editar `estoqueAtual` diretamente.

O fluxo arquitetural deve ser:

Venda ABERTA
→ ainda não altera estoque definitivo

Venda FATURADA
→ gera SAÍDA de estoque

Para cada ItemVenda que controla estoque:

Venda
→ MovimentacaoEstoque
→ tipo SAIDA
→ origem VENDA
→ atualização do saldo

A baixa deve acontecer automaticamente.

O operador do PDV não deve precisar acessar a tela de Estoque para dar baixa da mercadoria vendida.

---

## 10. Venda aberta e reserva de estoque

No modelo inicial do Novexa, Venda ABERTA não deve reduzir o saldo definitivo.

A baixa ocorre somente no faturamento.

Reserva de estoque poderá ser criada futuramente caso exista necessidade real, por exemplo:

- pedidos;
- orçamento convertido;
- vendas pendentes;
- separação de mercadoria;
- e-commerce.

Reserva NÃO deve ser misturada com saldo físico.

Conceitualmente, no futuro:

saldoFisico
- quantidadeReservada
  = saldoDisponivel

Essa funcionalidade não faz parte do MVP atual.

---

## 11. Cancelamento de Venda

Venda FATURADA não deve simplesmente ser apagada.

O cancelamento deve preservar histórico.

Fluxo futuro:

Venda FATURADA
→ CANCELADA
→ estorno das movimentações de estoque

Exemplo:

Venda:
SAIDA 2 unidades
origem VENDA

Cancelamento:
ENTRADA 2 unidades
origem CANCELAMENTO

A movimentação original não deve ser excluída.

O histórico mostrará:

Venda
→ saída

Cancelamento
→ entrada de estorno

Isso garante auditoria.

---

## 12. Integração futura com Compras

O módulo de Compras deverá utilizar a mesma estrutura.

Fluxo esperado:

Compra
→ recebimento
→ ENTRADA de estoque
→ origem COMPRA

Criar uma Compra não significa necessariamente aumentar o estoque.

A movimentação deve acontecer quando houver recebimento físico da mercadoria.

Isso permite futuramente trabalhar com:

- pedido de compra;
- compra aguardando entrega;
- recebimento parcial;
- recebimento total.

---

## 13. Ajustes manuais

Movimentações manuais devem existir para exceções operacionais.

Exemplos:

- perda;
- avaria;
- quebra;
- consumo interno;
- correção;
- contagem física.

Movimentação manual deve registrar:

- usuário;
- data/hora;
- produto;
- saldo anterior;
- saldo posterior;
- motivo.

O motivo deve ser recomendado e poderá futuramente ser obrigatório dependendo do tipo de operação.

Movimentação manual é exceção.

Processos conhecidos pelo sistema devem gerar movimentações automaticamente.

---

## 14. Inventário

Inventário completo é uma evolução futura.

Fluxo desejado:

Iniciar inventário
→ registrar contagem física
→ comparar sistema x físico
→ apresentar divergências
→ confirmar
→ gerar AJUSTES

Exemplo:

Sistema: 20
Físico: 18

Confirmação do inventário:

AJUSTE
saldoAnterior = 20
saldoPosterior = 18

Não alterar saldo silenciosamente.

---

## 15. Estoque mínimo

Produto pode possuir:

`estoqueMinimo`

O estoque mínimo não altera o saldo.

Ele serve para controle gerencial.

Situações conceituais:

### SEM_CONTROLE

`controlaEstoque = false`

### ZERADO

`controlaEstoque = true`
e
`estoqueAtual <= 0`

### BAIXO

`estoqueAtual > 0`
e
`estoqueAtual <= estoqueMinimo`

### NORMAL

`estoqueAtual > estoqueMinimo`

Essas situações devem preferencialmente ser calculadas, e não persistidas.

---

## 16. Tela operacional de Estoque

Produtos e histórico usam paginação/filtros/ordenação no banco. O histórico mantém produtoId no path e retorna 404 para produto de outro tenant. A situação do estoque é filtro global anterior ao count. Contratos em [paginacao.md](paginacao.md); regras de movimentação e saldo preservadas.

A tela de Estoque deve priorizar consulta rápida.

Informações principais:

- produto;
- código;
- saldo atual;
- estoque mínimo;
- situação;
- ações.

Ações:

- Entrada;
- Saída;
- Ajuste;
- Histórico.

Produtos sem controle devem aparecer identificados como:

`Sem controle de estoque`

A interface deve ser compacta e operacional.

Não transformar a página de Estoque em um dashboard cheio de cards.

---

## 17. Histórico

Na Etapa 6 da branch `feat/central-configuracoes`, sobre `24f3f33`, `GET /estoque/movimentacoes/produto/{produtoId}` mantém os parâmetros, a ordenação e o envelope paginado existentes. Cada item acrescenta `entradaMercadoriaId: Long | null`, preenchido exclusivamente quando `movimentacaoEstoqueId` ou `movimentacaoCancelamentoId` de um item de Entrada coincide com o movimento consultado. A consulta filtra empresa do JWT, empresa da Entrada e produto, buscando os vínculos em lote para os IDs da página; não há consulta por linha nem interpretação do motivo ou dedução pelo valor de `origem`. Sem associação persistida, o campo é nulo e a apresentação anterior permanece.

O frontend oferece “Abrir entrada de origem #ID (nova aba)” para `/estoque?aba=entradas&entradaId=ID`, inclusive quando o vínculo corresponde à reversão de uma Entrada cancelada. Reutiliza o detalhe e a autorização existentes; a consulta de estoque permanece aberta com seus filtros e paginação. Apenas leitura, sem mudança de saldo, custo, confirmação, cancelamento ou criação de movimento; nenhuma migration necessária.

Consolidação sobre `1e12040`: corrigida a dependência de mapper no service, mantendo o mapeamento no controller e a busca em lote em método somente leitura. Teste HTTP de confirmação/reversão verifica os vínculos reais, ausência de associação mesmo com motivo semelhante, isolamento por empresa/produto, uma chamada de busca para os IDs da página, filtros/paginação e ausência de efeitos de leitura em saldo/custo/movimentos. Passou em H2 e PostgreSQL com V37/Hibernate validate. Dois cenários Playwright com HTTP real passaram em 1440px/390px, incluindo teclado, nova aba, Entrada cancelada, ausência de link no movimento avulso e preservação da consulta. Testes relacionados, build, lint e diff check aprovados; resultados conjuntos das Etapas 5 e 6 e pendências gerais que mantêm CONTRACT READY pendente em [CURRENT_STATE.md](CURRENT_STATE.md).

O histórico deve permitir entender:

> quem alterou;
> quando alterou;
> qual produto;
> quanto alterou;
> por que alterou;
> qual era o saldo antes;
> qual ficou depois;
> qual processo originou a mudança.

Consultas futuras deverão permitir filtros por:

- produto;
- período;
- tipo;
- origem;
- usuário.

---

## 18. Multiempresa

Todo dado de estoque pertence obrigatoriamente a uma Empresa.

O tenant vem da autenticação:

JWT
→ UsuarioAutenticado
→ empresaId

Empresa A nunca pode:

- consultar estoque da Empresa B;
- movimentar produto da Empresa B;
- consultar histórico da Empresa B.

O frontend não define a empresa da movimentação.

---

## 19. Concorrência

Alterações de estoque são operações críticas.

Duas operações simultâneas não podem calcular saldo utilizando o mesmo valor antigo.

Exemplo incorreto:

Saldo inicial = 10

Venda A lê 10
Venda B lê 10

Venda A tira 2 → 8
Venda B tira 3 → 7

Resultado correto deveria ser 5.

Por isso o fluxo de movimentação deve utilizar controle de concorrência, como lock apropriado do Produto durante a alteração.

Todo fluxo que altera saldo deve respeitar a mesma estratégia.

---

## 20. Atomicidade

Movimentação e alteração de saldo devem ocorrer na mesma transação.

Se falhar:

- atualização do Produto;
- criação do histórico;
- integração de Venda;
- ou outra parte da operação;

nenhuma alteração parcial deve permanecer.

---

## 21. Auditoria

Movimentações históricas não devem ser apagadas como forma normal de correção.

Correções devem gerar novas movimentações.

Exemplo:

movimentação errada
→ movimentação de correção

e não:

movimentação errada
→ DELETE

Isso preserva rastreabilidade.

---

## 22. Estoque por local

O MVP trabalha conceitualmente com estoque da Empresa.

Futuramente o sistema poderá evoluir para:

- depósitos;
- lojas;
- filiais;
- estoques físicos diferentes.

Arquitetura futura possível:

Empresa
→ LocalEstoque
→ Produto
→ Saldo

Mas essa complexidade NÃO deve ser implementada antes de existir necessidade real.

---

## 23. Custo de estoque

Quantidade e custo são conceitos relacionados, porém diferentes.

O controle atual é prioritariamente quantitativo.

Futuramente poderão existir:

- custo de aquisição;
- custo médio;
- custo da mercadoria vendida;
- margem;
- valorização de estoque.

Esses cálculos não devem ser misturados prematuramente com a regra básica de saldo.

Primeiro:

quantidade correta e rastreável.

Depois:

valorização financeira do estoque.

---

## 24. Lote, série e validade

Não fazem parte do MVP atual.

A arquitetura poderá futuramente suportar:

- lote;
- número de série;
- validade;
- rastreabilidade por unidade.

Esses recursos devem ser adicionados como extensões do domínio, sem complicar o fluxo padrão de produtos simples.

---

## 25. Relatórios futuros

O histórico estruturado permitirá relatórios como:

- posição atual de estoque;
- estoque abaixo do mínimo;
- produtos zerados;
- entradas por período;
- saídas por período;
- movimentação por produto;
- movimentação por origem;
- perdas e ajustes;
- giro de estoque;
- produtos sem movimentação;
- inventário;
- valorização futura.

Essa é a razão pela qual toda mudança deve possuir histórico confiável.

---

## 26. Princípio de automação

Sempre que o sistema souber por que o estoque mudou, ele deve registrar automaticamente a origem.

Exemplo:

Venda faturada
→ operador NÃO registra saída manual.

Compra recebida
→ operador NÃO registra entrada manual adicional.

Cancelamento
→ operador NÃO faz ajuste manual para devolver mercadoria.

O processo de negócio produz a movimentação.

Essa é uma regra central do Novexa.

---

## 27. Fonte de verdade

A arquitetura utiliza:

Produto.estoqueAtual
→ fonte rápida do saldo operacional atual

MovimentacaoEstoque
→ fonte histórica/auditável das alterações

Os dois devem permanecer consistentes.

Nunca atualizar um sem o outro em um fluxo operacional.

---

## 28. Arquitetura resumida

Produto
│
├── controlaEstoque
├── estoqueAtual
└── estoqueMinimo
│
↓
MovimentacaoEstoque
├── tipo
├── origem
├── quantidade
├── saldoAnterior
├── saldoPosterior
├── usuário
├── dataHora
└── motivo

Origem dos movimentos:

Venda FATURADA
→ SAIDA / VENDA

Compra recebida
→ ENTRADA / COMPRA

Cancelamento
→ movimento inverso / CANCELAMENTO

Operação manual
→ ENTRADA ou SAIDA / MANUAL

Contagem física
→ AJUSTE / AJUSTE

---

## 29. Prioridades do módulo

Ordem recomendada de evolução:

### Fase 1 — Base
- saldo atual;
- movimentações;
- entrada;
- saída;
- ajuste;
- histórico.

### Fase 2 — Operação
- tela de Estoque;
- estoque mínimo;
- filtros;
- histórico visual.

### Fase 3 — Integrações
- Venda;
- cancelamento;
- Compra.

### Fase 4 — Gestão
- inventário;
- relatórios;
- giro;
- perdas;
- valorização.

### Fase 5 — Recursos avançados
- múltiplos locais;
- reserva;
- lote;
- série;
- validade.

---

## 30. Regra para desenvolvimento

Antes de adicionar funcionalidade de estoque, perguntar:

1. Isso altera saldo físico?
2. Qual é a origem da alteração?
3. Precisa gerar histórico?
4. Deve acontecer automaticamente?
5. Pode ocorrer simultaneamente com outra movimentação?
6. Precisa ser reversível?
7. Pertence realmente ao MVP?
8. Está adicionando trabalho desnecessário ao operador?

A solução deve priorizar:

consistência
+
rastreabilidade
+
velocidade operacional.
