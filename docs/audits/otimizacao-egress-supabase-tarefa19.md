# Tarefa 19 — otimização de egress do Supabase

27/10/2026. **EGRESS OPTIMIZATION READY — implementação local, sem publicação.**

## Diagnóstico e correção

Os achados fornecidos no pedido foram reproduzidos em PostgreSQL 18.6 descartável, Flyway V59, com logomarca sintética de 971.611 bytes. Não foi localizado um relatório autônomo da Tarefa 18 nos documentos disponíveis; consultados os registros de performance de autenticação/Caixas e de correção do Upload. A hipótese de 240 GB não é medição confirmada do Supabase. Nenhum acesso produtivo foi realizado nesta tarefa.

- **Logomarca:** `EmpresaEntity` carregava o campo básico `logomarca` em SELECTs de entidades relacionadas por EAGER. A leitura de uma Venda podia repetir a Empresa em vários aliases. Não bastava omitir a imagem do DTO. Aplicados `@Basic(LAZY)` e grupo próprio, com enhancement Maven **restrito a EmpresaEntity**, na mesma versão Hibernate 6.6.22.Final já gerenciada pelo Spring Boot. Dirty tracking e gerenciamento automático de associações não foram habilitados. SQL e teste de atributo não inicializado comprovam o efeito; o JAR empacotado contém o interceptor, e UsuarioEntity não foi instrumentada. Sem mudar schema, relacionamentos ou imagem armazenada. Login inicializa explicitamente a imagem dentro da transação; detalhe/cadastro/edição preservam seus contratos.
- **Caixa:** painel chamava `resumo → bloquear → refresh`, carregando Sessão/Caixa/Usuário/Empresa para uma leitura. Painel e resumo passam a usar projeção escalar e transação `readOnly + REPEATABLE_READ`, mantendo um snapshot entre resumo, movimentos e vendas. Cálculo financeiro compartilhado, sem mudança de fórmulas. `bloquear`, `refresh` e locks das escritas permanecem. Testes verificam leitura durante lock de escrita e snapshot consistente quando um estorno confirma entre consultas.
- **Polling:** 2→10 segundos, agendados depois da resposta; pausa em aba oculta e Histórico, retomada ao ficar visível, cancelamento/listener limpos ao desmontar. Consultas em andamento são compartilhadas sem sobreposição; após escrita há releitura nova, mesmo se o polling anterior ainda estava pendente. Retry manual imediato. Sem nova biblioteca ou mudança visual.
- **Storage:** uploads existentes já usam UUID por objeto e URL pública estável. Adicionado somente `Cache-Control: public, max-age=31536000, immutable` ao corpo binário enviado por REST. Nesse protocolo o header é a diretiva HTTP completa, não apenas segundos como na opção do SDK ([implementação oficial](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts)). Substituição gera outra URL; remoção deixa de referenciar o objeto na interface. Nenhum objeto existente foi alterado e não há purge retroativo do cache. Tratamento paralelo de 402, timeouts e preservação cadastral mantido.

## Medição local antes/depois

Cinco repetições após aquecimento, execuções separadas, fixture de 85 vendas. **Bytes são a soma UTF-8 dos valores não nulos retornados nos ResultSets JDBC**, não bytes de protocolo/TLS ou egress faturado. Tempo inclui instrumentação; não é benchmark controlado ou previsão de latência produtiva. Produto/Cliente/Venda/Conta abaixo são leituras de entidade por ID, não medição integral de todos os endpoints de listagem. [SQL completo e medições](assets/tarefa19-egress/metrics.json).

| Operação | SELECTs antes→depois | SELECTs com logo antes→depois | Conteúdo JDBC, bytes antes→depois |
|---|---:|---:|---:|
| Painel HTTP de Caixa, incluindo autenticação | 10→6 | 3→0 | 4.878.936→20.351 |
| Produto | 1→1 | 1→0 | 971.740→129 |
| Cliente | 1→1 | 1→0 | 971.711→101 |
| Venda | 1→1 | 1→0 | 4.858.735→680 |
| Conta Financeira | 1→1 | 1→0 | 971.747→136 |

Mediana instrumentada do painel: **65,83→35,42 ms**. Conteúdo JDBC por painel: **−99,58%** nesta fixture. Polling nominal em aba visível: até 30→6 atualizações/minuto, sem contar a carga inicial ou ações; aba oculta: zero chamadas periódicas. Estimativa matemática combinada: 146.368.080→122.106 bytes/minuto de conteúdo JDBC para esse painel/fixture, ignorando duração das chamadas, compressão e outras operações. **Não equivale a redução observada na cota do Supabase.**

SQL capturado, trechos abreviados; os `...` apenas omitem outras colunas:

```sql
-- Antes: materialização EAGER carrega a imagem mesmo sem incluí-la no JSON.
select ce1_0.id, ..., e1_0.logomarca, ...
from caixas ce1_0 join empresas e1_0 on e1_0.id=ce1_0.empresa_id
where ce1_0.id=?;
select sce1_0.id, ... from sessoes_caixa sce1_0
where sce1_0.id=? and sce1_0.empresa_id=? for no key update;

-- Depois: leitura do cabeçalho do painel, sem entidade Empresa ou lock.
select sce1_0.id,sce1_0.empresa_id,sce1_0.caixa_id,c1_0.descricao,
       sce1_0.status,sce1_0.saldo_inicial,sce1_0.saldo_final,
       sce1_0.data_abertura,sce1_0.usuario_abertura_id,ua1_0.nome_usuario
from sessoes_caixa sce1_0
join caixas c1_0 on c1_0.id=sce1_0.caixa_id
join usuario ua1_0 on ua1_0.id=sce1_0.usuario_abertura_id
where sce1_0.id=? and sce1_0.empresa_id=?;
```

As outras cinco consultas do painel são autenticação, pagamentos resumidos, movimentos resumidos, movimentos para exibição e timeline de vendas. Nenhuma seleciona logomarca. A regressão também acessa explicitamente `getLogomarca()` em transação, confere conteúdo integral e confirma SELECT contendo a coluna. Atualizar outro campo sem inicializar a imagem preserva seu conteúdo no banco sintético. O mecanismo depende do enhancement, conforme [documentação do Hibernate](https://docs.hibernate.org/orm/6.6/userguide/html_single/#BytecodeEnhancement); `@Basic(LAZY)` isolado não foi tratado como solução.

## Validação e reprodução

**233 casos backend distintos aprovados, um ignorado, zero falhas finais.** Regressões: Empresa (cadastro, alteração, leitura multiempresa e consolidação), autenticação HTTP PostgreSQL (25 aprovados; a medição opcional histórica foi ignorada), Caixa operacional/sessões/ciclo de dinheiro e Storage/ProdutoImagem com mocks. `EgressSupabasePostgresTest` reaproveita os 13 casos de `CaixaPainelPostgresTest` e acrescenta quatro casos de medição/preservação/concorrência; não contar os métodos herdados ou reexecuções duas vezes. Painel mantém totais, perfis e isolamento; regressões financeiras cobrem abertura/fechamento, vendas, suprimento, sangria, cancelamento, idempotência e concorrência. Falhas iniciais da fixture de medição foram corrigidas preenchendo data de cadastro e tipo de pessoa obrigatórios; nenhum assert funcional foi enfraquecido.

**36 casos frontend distintos aprovados**, incluindo sete do painel/polling, abertura, detalhe e Upload; sete do polling revalidados após estabilizar o callback, sem duplicar a contagem. Relógio simulado verifica os 10s, aba oculta, Histórico, unmount, resposta lenta, retry e releitura após suprimento. Builds backend/JAR e frontend/TypeScript aprovados; ESLint do módulo alterado sem erros ou avisos. Aviso preexistente de bundle >500 kB permanece. Diff check somente dos arquivos da tarefa aprovado, sem varrer o worktree global.

Reprodução: iniciar PostgreSQL descartável em loopback e criar `novexa_caixas_performance_test` e `novexa_auth_performance_test`. Em `backend/novexa-api`, usar o Maven Wrapper com `-Dspring.config.import=optional:classpath:tarefa19-none.properties`, `-Dnovexa.test.caixas.jdbc-url=jdbc:postgresql://127.0.0.1:<porta>/novexa_caixas_performance_test` e a propriedade equivalente `novexa.test.auth.jdbc-url` para o segundo banco. Executar `EgressSupabasePostgresTest,AutenticacaoPerformancePostgresTest,EmpresaCadastroTest,EmpresaAlteracaoIsolamentoTest,EmpresaLeituraIsolamentoTest,EmpresaConsolidacaoTest,CaixaOperacionalHttpTest,SessaoCaixaHttpTest,CicloDinheiroFisicoCaixaTest,SupabaseStorageServiceTest,ProdutoImagemHttpTest`; medir isoladamente com `-Dtest=EgressSupabasePostgresTest#medirOperacoesSemCarregarImagem`. O modo `novexa.test.egress.before=true` desativa somente as asserções de otimização e foi usado **antes** da alteração; não restaura código antigo. Nunca apontar os testes a produção.

Frontend: `node --test tests/caixa-performance.test.mjs tests/caixa-abertura.test.mjs tests/caixa-detalhe.test.mjs tests/produto-imagem-upload.test.mjs`, `npm run build` e `npx --no-install eslint src/pages/Financeiro/Caixa.tsx`. O PostgreSQL exclusivo da tarefa foi encerrado; logs, snapshots anteriores e diff seletivo ficam em `backend/novexa-api/target/tarefa19-evidence/`, fora do Git.

## Arquivos, preservação e publicação futura

- Backend: `pom.xml`, `EmpresaEntity`, `UsuarioService`, `SessaoCaixaRepository`, `CaixaOperacionalService`; testes novos em `EgressSupabasePostgresTest`.
- Compartilhados com Upload: `SupabaseStorageService` e seu teste, limitados ao header/cache e prova de URLs distintas. Demais hunks de normalização, erros HTTP e transações de Upload preservados; não incorporados em commit nem declarados como autoria da Tarefa 19. Nenhum outro arquivo funcional de Upload alterado.
- Frontend: `Financeiro/Caixa.tsx` e `caixa-performance.test.mjs`; relatório/métricas e referências mínimas em CURRENT_STATE, arquitetura, financeiro e frontend.

Branch `main`, HEAD local `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`, com mudanças anteriores 17A/17B e Upload já presentes no worktree. Nenhum checkout, novo worktree, commit, push ou deploy. Staging preservado por SHA-256 `674309c892dc3925968d2f7a3acbf4ce50a67fd422ef6d46d62364caf22cac4d`. V59, locks de política empresarial, snapshots e precisão/reversão da Sprint 17A/17B não foram modificados. A versão publicada continua inalterada; estes resultados descrevem somente o código local.

**Riscos/pendências:** o build deve passar pelo Maven com enhancement (inclusive no Dockerfile existente); execução por IDE sem instrumentação pode voltar a carregar a imagem. Acessos explícitos ao campo exigem transação; login e detalhe atuais foram cobertos com open-in-view desligado. `REPEATABLE_READ` aplica-se às leituras do painel/resumo; escritas mantêm seus locks. Cache beneficia uploads novos e não muda metadados de objetos antigos. O 402 `exceed_egress_quota` histórico pode continuar: código/cache não regularizam a cota, não alteram o plano e não contornam restrições. Situação atual da cota e consumo real do painel Supabase não foram consultados.

Publicação somente após **nova autorização expressa**: compor o delta sobre a Sprint 17 publicada, validar separação dos hunks de Upload, produzir JAR/imagem com interceptor e preservar recuperação compatível com V59. Backend antes do frontend; smoke autorizado de login/logomarca e Caixa, sem operações sintéticas em empresa real. Comparar depois consultas/bytes instrumentados e métricas reais de Database/Storage egress no Supabase em períodos equivalentes, registrando duração, usuários e volume operacional. Nenhuma medição produtiva ou teste de carga integra esta entrega.
