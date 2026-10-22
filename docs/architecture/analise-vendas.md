# Análise de vendas

Evolução gerencial somente leitura na Central de Vendas, aba `?aba=analise`, para ADMIN/GERENTE. Consulta continua padrão e links `vendaId` preservam o detalhe existente. Não cria efeitos em venda, estoque, pagamento ou financeiro.

## 1. Resumo do período

`GET /vendas/analise/resumo?dataInicial=AAAA-MM-DD&dataFinal=AAAA-MM-DD` agrega todas as vendas FATURADAS da empresa do JWT. Retorna faturamento (total final), quantidade, ticket médio e descontos gerais. Nenhuma junção com pagamentos: pagamentos mistos não multiplicam valores. Datas inclusivas, limite de 366 dias e sem futuro; presets Hoje/7/30 dias e intervalo personalizado. Ver vendas do período abre Consulta com datas e status FATURADA.

A referência é `Venda.dataFaturamento`, registrada uma única vez ao passar para FATURADA, na mesma transação de estoque/pagamentos/financeiro, pelo relógio oficial `TempoNovexa` em `America/Sao_Paulo`, truncada para microssegundos (precisão PostgreSQL), evitando arredondamento para o dia seguinte no último instante da noite. `Venda.dataHora` continua sendo a criação e não é sobrescrita. Retry conserva a data original do faturamento. O conceito é **total comercial após descontos das vendas atualmente FATURADAS, por data efetiva de faturamento**; não é recebimento, liquidação bancária, lucro nem apuração fiscal.

A V56 adiciona a coluna nullable de data de faturamento, sem inferir datas históricas a partir de criação, pagamento, recebível ou parcelas. Vendas anteriores sem data confiável permanecem NULL: não entram em nenhum período (inclusive comparação/rankings/CSV) e não são tratadas como zero de faturamento conhecido. `Resumo.vendasSemDataFaturamento` informa a quantidade dessas vendas atualmente FATURADAS na empresa inteira, sem atribuir período fictício. A interface avisa sobre a cobertura incompleta; o CSV de indicadores inclui essa contagem. Consulta por criação e links por vendaId continuam disponíveis para o legado.

Intervalos são inclusivos por dia civil: início às 00:00 e limite exclusivo às 00:00 do dia seguinte. Ver vendas do período envia `referenciaData=FATURAMENTO`, datas e FATURADA ao GET /vendas; sem esse parâmetro, a Consulta preserva a referência padrão CRIACAO. A coluna de data/hora da Consulta permanece a criação. O filtro por faturamento não faz fallback no legado. A referência da lista é validada no backend e continua tenant-safe.

Cancelamento mantém a data de faturamento registrada, mas exclui a venda dos resultados pelo status atual. Assim, cancelar posteriormente recalcula o período original e a comparação; esta visão não é um livro imutável de eventos de faturamento/estorno. Nenhum histórico antigo é corrigido.

Validação inicial, anterior à V54: 3 testes PostgreSQL reais (Flyway V1→V52 e Hibernate validate) e 3 testes de interface com HTTP simulado aprovados. As integrações foram executadas em instância local descartável; nenhuma consulta a dados de produção.

## 2. Evolução e comparação

O resumo também retorna o intervalo imediatamente anterior de igual duração civil e as duas séries diárias, com zero para cada dia sem vendas. Comparação de faturamento, quantidade e ticket explicita base anterior zero sem inventar percentual. Intervalo atual que inclui hoje é sinalizado como incompleto; a comparação anterior corresponde a dias completos. O gráfico distingue linha contínua/círculos e tracejada/quadrados; tabela nativa expansível permite consultar os valores por teclado, sem depender de cor ou hover.

Validação inicial, anterior à V54: 4 testes PostgreSQL e 4 testes de interface aprovados, incluindo fronteira de meia-noite, dias zerados, períodos anteriores iguais e acesso por teclado à tabela diária.

## 3. Produtos, categorias e CSV

| Endpoint GET | Contrato |
|---|---|
| `/vendas/analise/produtos` | Datas obrigatórias; `ordem=valor|quantidade`, `unidade` opcional por valor e obrigatória por quantidade, `page=0`, `size=5` (1..100). Retorna `pagina: PaginaResponseDTO`, unidades presentes e faturamento integral do período. |
| `/vendas/analise/categorias` | Datas obrigatórias; retorna todas as categorias agregadas em `items` e `faturamentoPeriodo`, incluindo Sem categoria. |
| `/vendas/analise/exportar` | Datas, `secao=resumo|evolucao|produtos|categorias`; ranking aceita os mesmos ordem/unidade. CSV UTF-8 com BOM, separador `;`, cabeçalho e conteúdo completo, sem limite da página visível. |

Os endpoints são gerenciais (ADMIN/GERENTE), somente leitura e tenant exclusivamente do JWT. Consultas agregam no PostgreSQL todos os registros do período. A data de faturamento utiliza a coluna adicionada pela V56; a unidade histórica utiliza o campo adicionado pela V57, que também cria o índice por empresa/data de faturamento sobre a estrutura existente. Não há consultas individuais por produto. Transação REPEATABLE_READ mantém guardas, totais e linhas de cada resposta consistentes. As seções são consultadas independentemente; se novas vendas causarem totais distintos entre respostas, a interface orienta atualizar a análise.

O desconto geral é rateado por venda, proporcional ao subtotal histórico de cada item. Calcula-se o líquido ideal em centavos, aplica-se o piso e distribuem-se os centavos restantes por maior resto, com desempate por `ordem,id` do item. A soma monetária de produtos e categorias reconcilia exatamente com o total final das vendas; percentuais apresentados com duas casas podem somar 99,99%/100,01% por arredondamento. Não se usam pagamentos, preços atuais, custos ou componentes consumidos para reconstruir o valor vendido. Histórico com itens ausentes/inconsistentes retorna conflito orientativo nos rankings/exportações correspondentes, sem inventar distribuição.

O nome vem do item histórico mais recente do produto/unidade no período. Categoria continua sendo a classificação **atual**, explicitamente informada; mudar a categoria reclassifica resultados passados. Preço e subtotais continuam históricos.

`ItemVenda.unidadeMedidaVenda` captura a unidade na inclusão do item (inclusive criação direta e kit), sem depender do cadastro atual em consultas. Ela não é alterada ao editar quantidade ou faturar. Para item novo cuja unidade mudou no cadastro enquanto a venda estava aberta, adicionar/faturar exige remover e incluir novamente para revisar a quantidade; nenhum efeito parcial ocorre. Itens antigos abertos sem snapshot permanecem desconhecidos, sem inferência retroativa. Não se mudam fórmulas, saldos, conversões ou políticas de estoque.

O agrupamento é produto + unidade histórica; o mesmo produto pode aparecer em duas linhas (UN/KG), inclusive no CSV, com paginação e desempate determinísticos. Ordenar por quantidade exige escolher uma unidade conhecida. A quantidade de um grupo sem unidade confiável é NULL, não zero nem soma com a unidade atual: o ranking monetário preserva seu valor e exibe “Não registrada”. `Ranking.itensSemUnidade` informa os itens afetados no período. Esses grupos não entram na ordenação por quantidade; o denominador da participação permanece o faturamento integral filtrado. CSV usa “Unidade histórica” e deixa a quantidade desconhecida vazia. A paginação conta grupos produto/unidade. Kits contam somente pelo produto comercial, sem somar componentes.


CSV protege campos textuais iniciados por `=`, `+`, `-` ou `@`, inclusive após espaços/controles/separadores Unicode, com prefixo de texto e escape de aspas. Indicadores incluem os dois períodos; evolução contém todos os dias e ambas as séries; produtos exporta todo o ranking filtrado, mantendo a unidade selecionada; categorias exporta toda a distribuição.

Validação do terceiro incremento, anterior à V54: 9 testes PostgreSQL reais aprovados, com Flyway V1→V52 e Hibernate validate, cobrindo centavos, misto, isolamento, perfis, paginação, CSV completo/seguro, vazio e histórico inválido. Regressões H2 de Dashboard (2) e paginação (10) aprovadas. Interface com HTTP simulado: 9 testes de análise, 49 regressões da Consulta e 8 testes de data/hora em quatro fusos; capturas em 1440×900, 1024×600, 390×844 e 1024×360, claro/escuro/automático, com corpo e raiz sem overflow externo. Evidência de interface não equivale à integração completa navegador→API→PostgreSQL.

## Estado local e limitações de validação

Composição vigente em 2026-10-22: V56 cria `vendas.data_faturamento`; V57 adiciona `itens_venda.unidade_medida_venda`, sua restrição de normalização e o índice parcial por empresa/data de faturamento, sem recriar a coluna da Venda. Nenhuma delas faz backfill. A V54 local foi substituída e não integra as fontes nem os artefatos compilados atuais. A sequência Flyway é V1–V53, V55, V56 e V57.

A auditoria da composição atual aprovou novamente os 16 testes PostgreSQL da Análise, Flyway e Hibernate validate. Atualizações a partir de históricos commitados V53, V55 já aplicada e V56 até V57 preservaram registros, valores e dados históricos conhecidos; reinício sem migrations pendentes e bloqueio atômico de duplicados legados pela V55 também conferidos. O JAR real iniciou na base atualizada desde V55, com sete consultas HTTP aprovadas. A preparação final mantém código e migrations auditados e separa as entregas em commits locais, sem publicação.

Registro histórico da correção local de integridade em 2026-10-22, antes da composição V56/V57, sem commit/push/deploy ou acesso à produção naquela etapa. A V54 local então utilizada não fazia backfill e foi validada também sobre schema V53 com registros sintéticos preservados. O antigo bloqueio sintático de BancoController não estava presente na auditoria atual; a compilação é feita no worktree real, sem substituir arquivos em cópia. Arquivos paralelos de Produtos, Estoque e Dashboard não pertencem a este escopo.

Validação histórica desta correção no worktree real (V54 local, anterior à composição V56/V57):
- 16 casos PostgreSQL aprovados em rodadas direcionadas: resumo/rateio/CSV/tenant/perfis, criação e faturamento em dias diferentes, mesmo dia, prazo sem pagamento imediato, retry, cancelamento, unidade alterada entre vendas, legado sem data/unidade, fronteiras de meia-noite e V53→V54 com dados preservados. Flyway V1→V54 e Hibernate validate aprovados.
- 45 regressões complementares de Venda/Cancelamento/Paginação e 2 cenários direcionados de kit aprovados (unidade/H2; não contabilizados como integração PostgreSQL).
- 68 testes frontend distintos aprovados (11 análise, 49 Consulta, 8 data/hora) em execuções relacionadas. O teste de navegação encontrou uma corrida entre atualização da URL e remontagem da Consulta: a intenção do filtro passou a ser entregue explicitamente pelo componente pai. Timeouts de carregamento do Vite durante carga concorrente foram superados na execução isolada, sem skip ou redução de expectativas.
- Builds backend package/frontend, lint dos arquivos frontend afetados e diff check aprovados. Permanece o aviso anterior de chunk frontend acima de 500 kB.
- HTTP real no PostgreSQL descartável: criação sintética em 19/10 e faturamento em 22/10, retry concorrente com um único pagamento, saldo comercial R$35 em três vendas datáveis, unidades 2 UN e 0,5 KG separadas e terceira quantidade desconhecida. Uma venda sem data foi sinalizada/excluída, sem atribuição ao dia da criação. Rankings/CSV/Consulta reconciliados com HTTP 200 e Request-ID efetivamente capturado.
- Navegador→API real→PostgreSQL em 1440×900/claro e 1024×600/escuro: indicadores, avisos, UN/KG separados, quantidade não registrada e link com filtro FATURAMENTO aprovados; sem erros JavaScript capturados ou overflow horizontal externo. Testes HTTP simulados permanecem evidência de interface, distinta dessa integração real.
- API e PostgreSQL de validação encerrados e banco sintético removido. Nenhum acesso a produção/VM/Supabase. Nenhum commit/push/deploy executado por esta tarefa; um commit paralelo (`ebc42ae`, Caixa) incorporou os trechos compartilhados de VendaRepository e services/vendaService.ts durante o trabalho. Eles foram preservados; a seleção final de publicação exige revisão integrada.

 Limites restantes: dados anteriores sem snapshots não podem ser reconstruídos com segurança; categorias atuais; cancelamentos recalculam períodos anteriores; comparação de hoje incompleto com dias anteriores completos é explicitamente sinalizada. Seções usam transações de leitura independentes; divergência de totais entre respostas orienta atualizar. Não há certificação de desempenho para bases de grande volume nem alteração de histórico fiscal/financeiro.

## Backfill de implantação (22/10/2026)

Operação excepcional de dados, autorizada pelo gestor e executada fora do Flyway: `UPDATE vendas SET data_faturamento = data_hora WHERE status = 'FATURADA' AND data_faturamento IS NULL` (102 vendas de 19/10–21/10, transação única com validação prévia e posterior). Justificativa: cliente em fase de implantação e vendas sempre faturadas no ato, o que torna `data_hora` evidência válida de faturamento para o legado. Esta operação é histórica e não deve ser reexecutada; vendas novas preenchem `data_faturamento` no ato do faturamento (V56 em diante).
