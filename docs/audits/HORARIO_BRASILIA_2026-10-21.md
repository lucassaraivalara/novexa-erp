# Auditoria de data/hora — 2026-10-21

Baseline: `main`, `99353fc`. Auditoria por busca em fontes backend/frontend, configurações, scripts, migrations, execução e serialização. Produção e histórico não foram alterados.

| Área | Achado e tratamento |
|---|---|
| Backend | 25 arquivos com relógio civil implícito em entidades/serviços: Venda, Pagamento, Recebível, Caixa, Estoque, Entrada, cadastros, composição, contas, cofre, transferência, vencimentos e Dashboard. Substituídos por `TempoNovexa.agora()/hoje()`, relógio com zona explícita. |
| Schedulers | Um scheduler periódico de cartão; o intervalo não depende de fuso, mas a seleção de vencidos e a revalidação transacional usavam o dia da máquina. Ambos usam o dia de Brasília. |
| Filtros | Vendas, Estoque e Recebíveis já aplicavam intervalo civil semiaberto (`>= início`, `< dia seguinte`). Preservados. Dashboard e totais de vencidos agora obtêm hoje da fonte central. Datas informadas continuam civis. |
| Frontend | Vendas/Central, Caixa/abertura/fechamento/timeline, Estoque, Entradas, Dashboard, saudação, contas/extratos, recebimentos/cartões/cofre, composição e impressão dependiam do navegador para interpretar/formatar datas ou determinar hoje. Centralizados sem alterar layout. |
| Serialização/banco | DTOs operacionais usam `LocalDateTime` sem offset e `LocalDate`; migrations usam `TIMESTAMP`/`DATE`. Contratos e colunas preservados. Jackson e conexões PostgreSQL têm zona explícita, sem deslocamento de timestamps civis no JDBC. |
| NF-e | `dhEmi` com offset passa a ser convertido para o dia de Brasília; `dEmi` sem hora permanece data civil. Nenhuma regra fiscal ou dado histórico foi modificado. |
| Segurança/tempo técnico | JWT (`Date`, epoch), expiração, renovação, timeouts, debounce, cache e UUIDs baseados em tempo são independentes de fuso; preservados. `Date.parse` do PDV só verifica validade de data de parcela; não determina hoje nem formata horário. |
| Runtime | Dockerfile/Compose já continham zona de Brasília, preservados. Bootstrap Java fixa a mesma zona também fora do container e registra a zona efetiva; logs textuais têm zona explícita. Inspeção da VM não faz parte desta execução. |
| Scripts/IDE | Scripts operacionais, exemplos e configurações de execução não são fonte do horário civil da aplicação. Não foram executados scripts de carga ou correção de dados. |

Artefato antigo `V51` foi encontrado somente em `target/classes`, ausente das fontes. `mvn clean` removeu o resíduo; a validação final deve refletir apenas Flyway V1–V50. Nenhuma migration foi editada.

## Evidências

- Backend: `mvnw -Dtest=TempoNovexaTest,HorarioBrasiliaPostgresTest,NfeXmlParserTest,SessaoCaixaHttpTest,MovimentacaoEstoqueHttpTest,DashboardHttpTest,RecebivelHttpTest -Dnovexa.test.tempo.jdbc-url=jdbc:postgresql://127.0.0.1:55477/postgres -Duser.timezone=UTC test`: **97 aprovações, zero falhas/erros/ignorados**. Seis casos PostgreSQL verificam gravação/retorno de venda, pagamento, estoque e movimento financeiro às 14:03, sessão 14:03→15:03, filtros/Dashboard nos dois lados da meia-noite de Brasília e scheduler antes/depois da data prevista, incluindo retry sem duplicar. O banco servidor usa UTC; a sessão JDBC da aplicação comprova `America/Sao_Paulo`.
- PostgreSQL 18 descartável exclusivo, porta 55477: Flyway V1–V50 aplicado e validado, Hibernate `ddl-auto=validate` e contexto completo aprovados. O contador Flyway pode incluir o marcador de criação do schema; a versão vigente foi confirmada como **V50**, não V51. Testes H2 são complementares.
- Frontend: `node --test tests/data-hora.test.mjs`: **8 aprovações** em quatro fusos. `14:03` permanece `14:03` com/sem offset; regras IANA históricas de horário de verão, datas inválidas, calendário, hoje e filtros na troca de dia também verificados.
- Regressão frontend: 144 cenários de Central de Vendas, Caixa/abertura/detalhe, recebíveis/recebimentos, contas, estoque, Dashboard e impressão. Execução inicial: 139 aprovados e cinco falhas; três timeouts de carregamento passaram na reexecução isolada. Duas expectativas de Contas a Receber dependiam do dia do computador: a fixture agora fixa o relógio, sem mudar expectativas financeiras; **30/30** no grupo final. Nenhuma falha conhecida restante desses cenários. Evidência de interface usa HTTP simulado e não substitui integração PostgreSQL.
- `mvnw -DskipTests package`, `npm run build`, `npm run lint` e `git diff --check` aprovados. Lint: zero erros, dois avisos anteriores de React Hook Form; bundle acima de 500 kB e aviso Flyway/PostgreSQL 18 permanecem. Sem atualização de dependências. Revisão Impeccable retornou `[]`; mudanças de apresentação restritas à data/hora.
- JAR real em loopback, porta 18087, perfil `prod` com configuração inteiramente sintética e banco descartável: iniciado com `-Duser.timezone=UTC`; log comprova `Horário oficial Novexa: America/Sao_Paulo; zona JVM: America/Sao_Paulo`, timestamps estruturados com `-03:00`, Flyway V50, Hibernate inicializado e zero erros de startup. Readiness HTTP **200/UP** e GET protegido sem token **401**, capturados localmente. Nenhum endpoint de escrita foi chamado nesse smoke test. As instâncias descartáveis são encerradas após a conferência.

## Limites

Não há acesso, teste financeiro ou mudança de dados em produção. Não foi corrigido histórico. Sem offset, dados antigos não permitem identificar automaticamente se foram gravados no fuso errado; isso exige operação separada. Publicação e deploy devem ser reportados separadamente da validação local.

## Arquivos da tarefa

```text
backend/novexa-api/src/main/java/br/com/novexa/erp/NovexaApiApplication.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/AberturaCaixaOrigemEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ClienteEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ConfiguracaoFormaPagamentoEmpresaEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ContaFinanceiraEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ContaReceberEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/EntradaMercadoriaEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/FornecedorEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/MovimentacaoCaixaEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/MovimentacaoEstoqueEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/MovimentacaoFinanceiraEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/PagamentoEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ProdutoEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/RecebivelEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/SessaoCaixaEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/TransferenciaFinanceiraEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/entity/VendaEntity.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/CofreService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/ComposicaoProdutoService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/ContaPagarService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/ContaReceberService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/DashboardService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/EntradaMercadoriaService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/LiquidacaoAutomaticaCartaoScheduler.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/LiquidacaoRecebivelService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/NfeXmlParser.java
backend/novexa-api/src/main/java/br/com/novexa/erp/service/SessaoCaixaService.java
backend/novexa-api/src/main/java/br/com/novexa/erp/time/TempoNovexa.java
backend/novexa-api/src/main/resources/application.properties
backend/novexa-api/src/test/java/br/com/novexa/erp/controller/HorarioBrasiliaPostgresTest.java
backend/novexa-api/src/test/java/br/com/novexa/erp/service/NfeXmlParserTest.java
backend/novexa-api/src/test/java/br/com/novexa/erp/time/TempoNovexaTest.java
docs/architecture/CURRENT_STATE.md
docs/architecture/SYSTEM_CONTEXT.md
docs/architecture/arquitetura.md
docs/architecture/financeiro.md
docs/architecture/frontend.md
docs/audits/HORARIO_BRASILIA_2026-10-21.md
docs/deploy/producao.md
frontend/src/components/layout/AppHeader.tsx
frontend/src/pages/Dashboard/Dashboard.tsx
frontend/src/pages/Estoque/EntradasMercadoria.tsx
frontend/src/pages/Estoque/Estoque.tsx
frontend/src/pages/Financeiro/AberturaCaixaDialog.tsx
frontend/src/pages/Financeiro/AgendaRecebimentos.tsx
frontend/src/pages/Financeiro/Caixa.tsx
frontend/src/pages/Financeiro/CofrePainel.tsx
frontend/src/pages/Financeiro/ContasPagar.tsx
frontend/src/pages/Financeiro/ExtratoFinanceiroDrawer.tsx
frontend/src/pages/Financeiro/MovimentacaoFinanceiraDrawer.tsx
frontend/src/pages/Financeiro/RecebimentosContaDrawer.tsx
frontend/src/pages/Financeiro/Recebiveis.tsx
frontend/src/pages/Financeiro/TransferenciaFinanceiraDrawer.tsx
frontend/src/pages/Financeiro/caixaTimeline.ts
frontend/src/pages/Financeiro/contaPagarCalculos.ts
frontend/src/pages/Financeiro/contaReceberUtils.ts
frontend/src/pages/Produtos/ComposicaoProdutoCampos.tsx
frontend/src/pages/Produtos/imprimirRelatorioPrecos.ts
frontend/src/pages/Vendas/SessaoCaixaPDVDialog.tsx
frontend/src/pages/Vendas/centralVendasUtils.ts
frontend/src/utils/dataHora.ts
frontend/tests/contas-receber.test.mjs
frontend/tests/data-hora.test.mjs
```
