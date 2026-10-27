# Evolução de Estoque — 17A/17B

Data: 26/10/2026. Escopo: implementação e validação local; nenhuma operação em produção.

## 1. Resumo e veredito

**STOCK 17A/17B READY**, para revisão e futura integração autorizada. Correções de conversão/cancelamento, entrada manual em produto inativo, auditoria de inativação e controle empresarial implementadas. Não representa autorização de publicação nem conclusão de importação de estoque, operações em massa ou inventário físico.

## 2. Estado inicial e isolamento

- Branch `main`; HEAD `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`.
- Baseline com 173 caminhos locais existentes, incluindo arquivos staged, unstaged e untracked. Staging mantido byte a byte; SHA-256 do índice inicial: `38c92cd39a6dd32b29b2b3889b362d8fd586f9523f8e887fbeac8193dd462354`.
- Worktree principal utilizado, sem criação/movimentação de branches ou worktrees, commits, staging ou publicação.
- EmpresaForm e ProdutoForm já continham a padronização UX. Foram acrescentados somente o controle empresarial e uma orientação do controle individual.
- A tarefa paralela de upload alterou ProdutoController, ProdutoService, GlobalExceptionHandler, SupabaseStorageService e seus testes. Preservada; seus hunks não pertencem a esta entrega. Em ProdutoController, esta sprint altera apenas a passagem do usuário para `inativar`; em ProdutoService, apenas `inativar`.

## 3. Precisão e causa da falha

O domínio persiste estoque em `NUMERIC(19,3)`. A Entrada multiplicava quantidade e fator sem normalizar a escala; PostgreSQL arredondava o movimento, enquanto o cancelamento comparava com a multiplicação não arredondada. `0,003 × 0,5 = 0,0015` persistia `0,002`, mas a comparação recusava a reversão (409).

`EntradaMercadoriaService.quantidadeEstoque` agora aplica três casas e `HALF_UP` antes do cálculo do saldo. Mantém a regra de armazenamento existente; não muda para uma precisão nova. Resultado que vira zero ou excede a capacidade é recusado com rollback. Valores monetários e a fórmula do custo permanecem iguais.

| Entrada × fator | Movimento registrado | Cancelamento | Saldo final |
|---|---:|---:|---|
| 0,003 × 0,5 | 0,002 | −0,002 | Igual ao anterior |
| 1,250 × 0,5 | 0,625 | −0,625 | Igual ao anterior |
| 0,001 × 0,5 | 0,001 | −0,001 | Igual ao anterior |
| 2,001 × 0,333 | 0,666 | −0,666 | Igual ao anterior |
| 0,001 × 0,1 | Rejeitado | Sem efeitos | Igual ao anterior |

O fator de fornecedor continua com três casas (V52). Fatores de Kit continuam com seis casas e consumo representável exatamente em três, conforme domínio anterior. Não ampliamos o contrato de fornecedores nem aplicamos arredondamento de Entrada a Kits.

## 4. Reversão e integridade operacional

- Cancelamento confere produto, ENTRADA/COMPRA, quantidade normalizada e diferença entre saldos do movimento original; `reverterEntradaCompra` usa a quantidade persistida.
- Locks, vínculo de reversão, repetição idempotente e transação integral existentes reutilizados.
- Produto posteriormente inativado ou com controle individual desligado continua reversível pelo movimento original. Saldo insuficiente e obrigações financeiras continuam bloqueadores legítimos.
- Dados históricos com saldo/quantidade incompatíveis continuam protegidos por 409; não foram reparados nem reinterpretados automaticamente.
- `MovimentacaoEstoqueService.movimentar` rejeita nova movimentação de produto inativo com orientação para reativação. Não foi inserido esse bloqueio nos métodos de reversão histórica.
- `ProdutoService.inativar` bloqueia/atualiza o produto e reutiliza `registrarAuditoria`. DELETE registra empresa, usuário, horário e `ativo: true → false`. Repetição não registra uma alteração fictícia. Sem remoção do produto/histórico.

## 5. Controle empresarial e matriz

`Empresa.controlaEstoque`, default `true`, combina com o campo individual existente. Omitir no PUT preserva o valor atual; omitir na criação usa `true`. Não confundir com `permitirVendaEstoqueNegativo`.

| Empresa | Produto | Nova baixa automática |
|---|---|---|
| true | true | Sim |
| true | false | Não |
| false | true | Não |
| false | false | Não |

As quatro combinações foram validadas com venda, retry, troca da configuração e cancelamento repetido, verificando saldo, movimentos e preservação da preferência individual.

`VendaService` lê a política sob lock compartilhado, registra a decisão em cada item e só executa baixa/consumo quando efetiva. A edição empresarial usa o lock exclusivo já existente. Teste PostgreSQL pausa uma venda na inserção do pagamento: a atualização empresarial aguarda; a venda conserva snapshot `true`, e a seguinte usa `false`, sem baixa duplicada. A barreira SQL existe somente no schema descartável do teste.

Entradas e ajustes explícitos continuam operacionais com empresa desligada, respeitando produto ativo/controlado e outras regras atuais. Desativar não apaga saldos; reativar não reconstrói vendas anteriores. Não há reconciliação automática de estoque físico.

## 6. Kits e cancelamentos

Kits seguem composição válida, componentes físicos ativos e controlados e precisão existente. Não se criou kit com componente sem controle nem entrada física do composto. Empresa desligada elimina baixas e consumos das novas vendas de Kit. A disponibilidade exibida continua sendo a consulta de saldo físico; não é reserva nem bloqueio de venda quando o controle empresarial está desligado.

`itens_venda.controle_estoque_aplicado` é registrado uma vez ao faturar. `false` identifica venda sem baixa; cancelamento exige ausência de movimentos/consumos conflitantes antes de ignorar reposição. `true` e legado `null` conservam verificações anteriores. Kits com histórico incompleto não passam a ser silenciosamente aceitos. Mudanças posteriores de política/composição não recalculam o estoque a repor.

## 7. Migration e compatibilidade

`V59__controle_estoque_empresa.sql` é a única migration nova:

- `empresas.controla_estoque BOOLEAN NOT NULL DEFAULT TRUE`;
- `itens_venda.controle_estoque_aplicado BOOLEAN NULL`, sem backfill;
- check impedindo snapshot falso com vínculo direto de baixa.

Empresas existentes continuam controlando conforme seus produtos. Não atualiza saldo, configuração individual, recebíveis ou pagamentos. Verificada criação do schema vazio, atualização V58→V59 com empresas/produtos sintéticos existentes, preservação de saldos/flags, ausência de movimentos artificiais, nullable/default do snapshot, segunda execução sem migration adicional, Flyway validate e Hibernate validate. Teste: `ControleEstoqueMigrationTest`.

## 8. Interface e permissões

EmpresaForm reutiliza Checkbox/MUI, estado e salvamento existentes. Explica controle individual, preservação de saldos e ausência de baixa retroativa. Checkbox nomeado, label associado e `aria-describedby`; teclado Space/Tab, erro de API preservando estado e ausência de sucesso antes da resposta verificados. Quatro capturas desktop/mobile e claro/escuro foram inspecionadas; sem overflow horizontal ou labels cortados no novo controle.

Autorização de Empresas já era **ADMIN**; foi preservada. GERENTE, OPERADOR e USUARIO recebem 403 ao atualizar; continuam consultando. Não foi aberto PUT empresarial amplo ao GERENTE. Caso seja desejada delegação gerencial específica, exige decisão/contrato separado. APIs de Produto/Estoque preservam seus perfis vigentes, sem inventar restrição administrativa nesta sprint.

## 9. Validações finais

PostgreSQL 18 descartável, loopback `127.0.0.1:58469`, banco sintético `novexa_stock17ab`, schemas exclusivos por suíte. Aplicações de teste com Flyway e Hibernate validate. Nenhuma conexão com banco local original, Supabase ou Mustache. Teste de rede real usa Spring Boot RANDOM_PORT/TestRestTemplate; demais testes HTTP usam MockMvc com PostgreSQL ou H2 conforme classe.

| Suíte final | Aprovados | Ignorados | Falhas |
|---|---:|---:|---:|
| KitProdutoPostgresTest (inclui regressões herdadas de Vendas) | 168 | 2 | 0 |
| EntradaMercadoriaPostgresTest | 67 | 0 | 0 |
| ControleEstoqueHttpPostgresTest | 1 | 0 | 0 |
| ControleEstoqueMigrationTest | 1 | 0 | 0 |
| EmpresaAlteracaoIsolamentoTest | 15 | 0 | 0 |
| EmpresaCadastroTest | 15 | 0 | 0 |
| MovimentacaoEstoqueHttpTest | 25 | 0 | 0 |
| MovimentacaoEstoqueServiceTest | 19 | 0 | 0 |
| EstoqueConcorrenciaTest | 15 | 0 | 0 |
| ProdutoAuditoriaServiceTest | 4 | 0 | 0 |
| ProdutoServiceTest | 6 | 0 | 0 |
| **Backend** | **336** | **2** | **0** |
| Frontend: empresa, empresa-estoque, produto-campos-form, entrada-mercadoria, estoque, kit-produtos, pdv | **118** | **2** | **0** |

Não foram somadas rodadas sobrepostas. Primeira rodada final sem a propriedade JDBC de Entradas ignorou suas classes; executadas depois com a propriedade correta. Duas anotações `@Disabled` herdadas de VendaHttpTest para concorrência de fechamento de Caixa permanecem sem execução, não aprovadas. Dois testes opcionais antigos de Produto (HTTP/visual dependentes de ambiente) foram ignorados; esta sprint executou seu HTTP PostgreSQL próprio e quatro testes visuais/operacionais de Empresa.

HTTP real comprovou: configuração ADMIN e bloqueios por perfil/tenant, leitura anônima 401, produto criado por API, ajuste explícito, venda com controle desligado, retry após reativação, cancelamento repetido sem reposição fictícia, venda insuficiente bloqueada após reativação, Entrada fracionada, inativação por DELETE, rejeição de nova entrada e cancelamento histórico com saldo restaurado/auditoria única.

Build backend (`package -DskipTests`) aprovado após testes. Build frontend (`tsc -b && vite build`) aprovado. ESLint: zero erros, dois avisos existentes `react-hooks/incompatible-library` em ContaBancariaForm e ConfiguracaoFormaPagamentoForm. Build avisa bundle >500 kB; npm avisa configuração externa `min-release-age`. Nenhum desses arquivos/configurações foi corrigido nesta sprint. `git diff --check` aprovado (avisos de conversão LF/CRLF não são erros de whitespace).

Durante desenvolvimento foram corrigidos: fixture que sobrescrevia saldo com entidade desatualizada, mock de EmpresaCadastro após uso do lock e instrumentação de concorrência que tentava chamar método abstrato do repository. Asserções funcionais preservadas. Expectativa antiga V47 do teste de Kit atualizada para V59, mantendo Flyway validate; não houve alteração de migration histórica para satisfazer teste.

## 10. Manifesto da sprint

Prefixo backend: `backend/novexa-api/src/`.

- `main/java/br/com/novexa/erp/controller/ProdutoController.java` — somente chamada de inativação com usuário.
- `main/java/br/com/novexa/erp/dto/EmpresaRequestDTO.java`, `EmpresaResponseDTO.java`.
- `main/java/br/com/novexa/erp/entity/EmpresaEntity.java`, `ItemVendaEntity.java`.
- `main/java/br/com/novexa/erp/mapper/EmpresaMapper.java`.
- `main/java/br/com/novexa/erp/service/EntradaMercadoriaService.java`, `MovimentacaoEstoqueService.java`, `CancelamentoVendaService.java`, `VendaService.java`, `EmpresaService.java`.
- `main/java/br/com/novexa/erp/service/ProdutoService.java` — somente método `inativar`; excluir hunks de upload.
- `main/resources/db/migration/V59__controle_estoque_empresa.sql` (novo).
- `test/java/br/com/novexa/erp/controller/EntradaMercadoriaPostgresTest.java`, `KitProdutoPostgresTest.java`, `MovimentacaoEstoqueHttpTest.java`, `EmpresaAlteracaoIsolamentoTest.java`.
- `test/java/br/com/novexa/erp/controller/ControleEstoqueHttpPostgresTest.java` (novo).
- `test/java/br/com/novexa/erp/repository/ControleEstoqueMigrationTest.java` (novo).
- `test/java/br/com/novexa/erp/service/ProdutoServiceTest.java`, `ProdutoAuditoriaServiceTest.java`, `EstoqueConcorrenciaTest.java`, `EmpresaCadastroTest.java`.

Frontend:

- `frontend/src/types/auth.ts` — campo empresarial opcional para compatibilidade.
- `frontend/src/pages/Empresa/empresaFormulario.ts` — estado/default/payload.
- `frontend/src/pages/Empresa/EmpresaForm.tsx` — somente novo controle/helper.
- `frontend/src/pages/Produtos/ProdutoForm.tsx` — somente helper da preferência individual.
- `frontend/tests/empresa.test.mjs` — teste adicional de contrato/default.
- `frontend/tests/empresa-estoque.test.mjs` (novo) — comportamento real no navegador, API simulada local.

Documentação: este relatório; complementos em `estoque.md`, `entradas-mercadoria.md`, `produtos.md`, `CURRENT_STATE.md`, `arquitetura.md`, `requisitos.md`, `roadmap.md`. Evidências técnicas locais em `%TEMP%/novexa-stock17ab-de8oyja3` (logs finais, baseline, capturas); não devem ser publicadas indiscriminadamente.

## 11. Riscos, pendências e publicação futura

1. Revisar e isolar hunks de ProdutoService/ProdutoController e frontend já modificado. Testes foram executados no worktree composto; upload paralelo não faz parte desta aprovação.
2. Publicar backend com V59 antes do frontend empresarial. Não aplicar migration isolada em produção nesta tarefa. Conferir backup, versão Flyway e conflitos de numeração novamente na integração.
3. Rollback de binário anterior exige avaliar empresas já desativadas: o código antigo ignora a nova configuração e poderia voltar a baixar estoque. Não há rollback automático de banco nem exclusão da V59.
4. Reativação exige conferência operacional dos saldos; não existe reconstrução automática ou inventário novo. Essa limitação é explicada na interface.
5. Não foi criada nova trilha de auditoria empresarial; reutilizou-se autorização/lock existentes. Auditoria de Produto cobre a inativação solicitada.
6. Suíte global não executada; cobertura direcionada inclui regras afetadas, multiempresa, concorrência, entradas, vendas/Kits e UI. Ignorados explicitados acima.
7. Nenhum reparo do estoque histórico da Mustache foi realizado ou preparado. Dados anteriores inconsistentes continuam requerendo investigação separada e autorização própria.

## 12. Estado final

HEAD/branch, worktrees e índice preservados (SHA-256 do índice idêntico ao inicial); arquivos novos e modificados permanecem locais, sem staging desta sprint. Entre os 173 caminhos preexistentes, somente EmpresaForm, ProdutoForm e CURRENT_STATE receberam os acréscimos desta tarefa. Alterações paralelas de UX, auditorias e upload mantidas. Nenhum commit, push ou deploy. PostgreSQL descartável encerrado ao término, preservando logs e arquivos de evidência. A próxima ação é revisão desta entrega; não iniciar automaticamente importação, lote ou inventário.
