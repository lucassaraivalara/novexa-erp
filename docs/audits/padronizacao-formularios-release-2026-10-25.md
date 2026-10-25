# Formulários — preparação de publicação 15D

Data: 25/10/2026. Escopo: Tarefas 15, 15B e 15C. Sem commit, push, deploy ou acesso à produção.

## 1. Resultado executivo

**FORM UX RELEASE READY**, para a composição isolada descrita neste documento e mediante nova autorização. Não significa publicação autorizada nem suíte global verde.

A integração foi exercitada com frontend real, API Spring Boot e PostgreSQL descartável. Produtos, compras, estoque, kits, PDV, pagamentos mistos, abertura/fechamento de Caixa, contas a pagar/receber, transferências, estornos e acesso entre empresas foram verificados. Nenhuma correção funcional foi necessária nesta etapa.

O staging atual **não está pronto para um commit direto**: contém documentos paralelos e versões anteriores de dois componentes. O manifesto seleciona as versões finais do worktree, já testadas, e somente os trechos de formulários de `CURRENT_STATE.md`.

## 2. Estado do Git e preservação

| Item | Estado inicial e final |
|---|---|
| Branch | `main` |
| HEAD | `71f2ea0224359ad0e886fdc45ab79941f0ce9d17` |
| Commits anteriores relevantes | `bbb543f` (14A), `71f2ea0` (14B); não pertencem ao novo diff de formulários |
| Staging | Oito caminhos; conteúdo preservado integralmente |
| Arquivos existentes acompanhados | 135 arquivos modificados/untracked com SHA-256; nenhuma mudança durante a 15D |
| Alterações desta etapa | Este relatório e seu diretório de evidências; nenhum código funcional |
| Operações Git de escrita | Nenhuma; não executados add, commit, reset, restore, clean, stash, push ou deploy |

Os oito caminhos já staged são:

```text
docs/audits/auditoria-operacional-mustache-producao-2026-10-25.md
docs/audits/deploy-performance-14a-14b-2026-10-23.md
docs/audits/investigacao-historica-mustache-2026-10-25.md
docs/audits/padronizacao-formularios-2026-10-24.md
docs/audits/padronizacao-formularios-auditoria-final-2026-10-25.md
frontend/src/components/ui/CampoDecimal.tsx
frontend/src/utils/numeroFormulario.ts
frontend/tests/produto-campos-form.test.mjs
```

`CampoDecimal.tsx` e `numeroFormulario.ts` estão `AM`: o blob staged é anterior ao conteúdo final validado. Incluir apenas o que já está staged produziria uma composição diferente da auditada. Três relatórios staged, de 14D/16/16A, devem ficar fora do commit de formulários.

README, documentação de deploy, scripts de backup, caches, vídeos, imagens temporárias e auditorias independentes foram preservados. Não se inferiu ownership apenas pelo estado `M` ou `??`.

## 3. Manifesto e isolamento verificável

Manifesto completo, com caminhos, seleção e SHA-256: [manifesto-release.json](assets/formularios-release-2026-10-25/manifesto-release.json).

A base aprovada contém **112 caminhos**: 42 fontes, 10 testes, 5 documentos e 55 evidências anteriores. Foi montada uma cópia temporária de `git archive HEAD`, sobrepondo somente esses caminhos. Não é branch nem worktree Git. As 112 seleções corresponderam aos hashes do manifesto antes da validação final. Dependências npm existentes foram reutilizadas por junction; não houve instalação ou atualização.

### Fontes — conteúdo final inteiro dos arquivos

```text
frontend/src/components/fornecedores/FornecedorForm.tsx
frontend/src/components/ui/CampoDecimal.tsx
frontend/src/components/ui/CampoTexto.tsx
frontend/src/pages/Clientes/ClienteForm.tsx
frontend/src/pages/Empresa/EmpresaForm.tsx
frontend/src/pages/Estoque/EntradaMercadoriaForm.tsx
frontend/src/pages/Estoque/EntradaMercadoriaItens.tsx
frontend/src/pages/Estoque/EntradaObrigacao.tsx
frontend/src/pages/Estoque/Estoque.tsx
frontend/src/pages/Financeiro/AberturaCaixaDialog.tsx
frontend/src/pages/Financeiro/AgenciaForm.tsx
frontend/src/pages/Financeiro/BancoForm.tsx
frontend/src/pages/Financeiro/Caixa.tsx
frontend/src/pages/Financeiro/CaixaForm.tsx
frontend/src/pages/Financeiro/CofrePainel.tsx
frontend/src/pages/Financeiro/ConferenciaMeiosPagamento.tsx
frontend/src/pages/Financeiro/ConfiguracaoFormaPagamentoForm.tsx
frontend/src/pages/Financeiro/ContaBancariaForm.tsx
frontend/src/pages/Financeiro/ContaFinanceiraDrawer.tsx
frontend/src/pages/Financeiro/ContaPagarDrawer.tsx
frontend/src/pages/Financeiro/ContaReceberBaixaDialog.tsx
frontend/src/pages/Financeiro/ContaReceberDetalhe.tsx
frontend/src/pages/Financeiro/ContaReceberForm.tsx
frontend/src/pages/Financeiro/ContasPagar.tsx
frontend/src/pages/Financeiro/EntregaCofreCampos.tsx
frontend/src/pages/Financeiro/ExtratoFinanceiroDrawer.tsx
frontend/src/pages/Financeiro/FormaPagamentoForm.tsx
frontend/src/pages/Financeiro/MovimentacaoFinanceiraDrawer.tsx
frontend/src/pages/Financeiro/TransferenciaFinanceiraDrawer.tsx
frontend/src/pages/Financeiro/cofreFormulario.ts
frontend/src/pages/Financeiro/conferenciaMeios.ts
frontend/src/pages/Financeiro/contaReceberUtils.ts
frontend/src/pages/Produtos/CategoriasProdutos.tsx
frontend/src/pages/Produtos/ComposicaoProdutoCampos.tsx
frontend/src/pages/Produtos/Marcas.tsx
frontend/src/pages/Produtos/ProdutoForm.tsx
frontend/src/pages/Produtos/composicaoProduto.ts
frontend/src/pages/Usuarios/UsuarioDrawer.tsx
frontend/src/pages/Vendas/PagamentoVendaDialog.tsx
frontend/src/pages/Vendas/ValorMonetarioPDV.tsx
frontend/src/pages/Vendas/Vendas.tsx
frontend/src/utils/numeroFormulario.ts
```

### Testes — conteúdo final inteiro dos arquivos

```text
frontend/tests/caixa-abertura.test.mjs
frontend/tests/campos-formulario.test.mjs
frontend/tests/configuracao-cartao-form.test.mjs
frontend/tests/contas-receber.test.mjs
frontend/tests/correcoes-criticas.test.mjs
frontend/tests/entrada-mercadoria.test.mjs
frontend/tests/estoque.test.mjs
frontend/tests/formularios-completos.test.mjs
frontend/tests/pdv-buscas.test.mjs
frontend/tests/produto-campos-form.test.mjs
```

### Documentos e arquivo compartilhado

- `docs/architecture/frontend.md`: diff de formulários inteiro, conforme manifesto da 15C.
- Relatórios 15, 15B, 15C e este relatório: arquivos inteiros; auditorias datadas preservadas.
- Evidências: somente os caminhos explicitamente enumerados no manifesto; não adicionar `docs/audits/assets/` inteiro.
- `docs/architecture/CURRENT_STATE.md`: seleção especial. Conservar o HEAD e acrescentar apenas os resumos 15/15B/15C e o resumo proposto da 15D. **Excluir** a seção de publicação 14D e a alteração do status da 14B existentes no mesmo diff local.

O patch exato contra o HEAD está em [CURRENT_STATE-somente-formularios.patch](assets/formularios-release-2026-10-25/CURRENT_STATE-somente-formularios.patch). É uma proposta para composição futura do índice; **não foi aplicado ao arquivo compartilhado**. Não aplicá-lo sobre o worktree atual, que já contém os textos e trabalhos paralelos. O manifesto informa o hash do blob selecionado, distinto do hash do arquivo inteiro no worktree.

Além dos 112 caminhos da base, a proposta inclui este relatório e as evidências da 15D listadas em `releaseEvidence`. O próprio manifesto é listado separadamente para evitar hash autorreferente.

### Exclusões obrigatórias

```text
README.md
docs/deploy/producao.md
docs/audits/deploy-performance-14a-14b-2026-10-23.md
docs/audits/auditoria-operacional-mustache-producao-2026-10-25.md
docs/audits/investigacao-historica-mustache-2026-10-25.md
docs/audits/performance-financeiro-2026-10-23.md
docs/audits/reconciliacao-local-v54-2026-10-23.md
scripts/operacoes/backup_postgres.py
scripts/operacoes/__pycache__/
tmp-video-*
videos_referencias/
demais assets não enumerados
```

## 4. Dependências e contratos

`CampoDecimal` depende de `numeroFormulario`; os adapters monetário, percentual e quantidade e os consumidores precisam entrar juntos. `CampoTexto` é compartilhado pelos formulários. Os helpers de composição, conferência, cofre e contas a receber fazem conversões de entrada; não podem ser omitidos como se fossem apenas alterações cosméticas.

Foram preservados services/types HTTP, rotas, tema, autenticação, dependências npm, backend e migrations do HEAD. Nenhum endpoint novo ou contrato novo é necessário para esta entrega. `/painel` já faz parte da base anterior de Caixas; não é dependência backend nova da padronização.

A cobertura da 15C, de 45 grupos de formulários (35 padronizados, cinco adequados e cinco exceções), foi reaproveitada mediante conferência dos arquivos finais e hashes, complementada pelo smoke real desta etapa. Não foi repetida uma revisão manual de todas as abas do ERP.

## 5. Ambiente e metodologia

- Java 21.0.12.1, Spring Boot 3.5.4, PostgreSQL 18.6, Node 24.13.0 e npm 11.6.2.
- Cluster novo, somente loopback, em diretório TEMP próprio; banco `novexa_forms_test`, API e Vite em portas distintas de 5432/8080/5173.
- Dados integralmente sintéticos, duas empresas, ADMIN/GERENTE/OPERADOR. Nenhuma cópia de dados da Mustache.
- Configuração de execução temporária por processo. Datasource explícito no PostgreSQL descartável; Storage apontado para loopback sem serviço; geocoding desabilitado. Browser bloqueou hosts externos.
- Flyway aplicou as 57 migrations existentes até V58; Hibernate `validate` e health `UP` aprovados. Sem migrations novas.
- Backend compilado e empacotado a partir do snapshot limpo, com testes backend não executados (`-DskipTests`). SHA-256 do JAR: `e3f1701005baace0aea2a7059fa4405595060db005ba3e71e624865f62775c25`.
- O primeiro opt-in de Produto usou origem aleatória da fixture e foi negado por CORS. Reexecução na origem temporária autorizada passou, sem flexibilização de CORS ou mudança no código.
- Ajustes de seletores, unidade de conversão e nome de arquivo foram feitos exclusivamente nos drivers/fixtures TEMP. Asserções de payload, status e persistência foram mantidas.

Os serviços descartáveis foram encerrados ao final. Os serviços locais originais continuaram com os mesmos processos: PostgreSQL 5432/PID 27080, backend 8080/PID 6648 e Vite 5173/PID 26148. Nenhum diretório de dados foi apagado.

## 6. Smoke real e precisão

| Fluxo | Evidência e resultado |
|---|---|
| Login/autorização | Login válido 200, senha inválida 401 e consulta sem autenticação 401. ADMIN cria e GERENTE edita configuração; OPERADOR consulta e recebe 403 ao escrever. |
| Multiempresa | Produto, conta a pagar e configuração de outra empresa retornam 404. Verificações SQL não encontraram vínculos de estoque/financeiro entre empresas. |
| Produtos | Componente real no Chromium criou e editou por POST/PUT, releu por GET e conferiu `1234.56`, `10.5`, `1.25`, depois `0`, `10.5`, `0.125`; estoque permaneceu zero nesse produto. |
| Compras | API e formulário real criaram rascunho e confirmaram entrada. Quantidades `1,250`/`0,125`, custo `10,50`; status CONFIRMADA e estoque atualizado. |
| Estoque | Entrada/saída via HTTP, entrada fracionada pela UI com payload `0.125`; entrada negativa rejeitada com 400. Cadeia saldo anterior/posterior e último movimento conferidos no PostgreSQL. |
| Kit | Composição com unidade de conversão CX e fator `0,000002`; edição UI para `0,000004`, PUT 200 e valor nativo PostgreSQL `0.000004`. Fator diferente de 1 na própria unidade de estoque foi corretamente rejeitado na preparação da fixture. |
| PDV | Busca por código com Enter, foco F5, quantidade selecionada com F3 e fechamento com F2. `1,250 KG × R$ 10,50` gerou total `R$ 13,13`, conforme arredondamento monetário existente. |
| Pagamento misto | POST `/vendas` 201, FATURADA, quantidade enviada `1.25`, dinheiro `8`, PIX `5.13`; total persistido `13.13`. |
| Caixa | Abertura UI com zero, painel com físico esperado `8.00` e vendido `13.13`; fechamento UI 200, FECHADO, contado/troco `8.00`, conferência PIX `5.13`, diferença zero. Abertura seguinte reutilizou o troco no ambiente sintético. |
| Contas a pagar | UI bloqueou precisão inválida `1.234,567` e persistiu `1.234,56` como `1234.56`, POST 201. Pagamento e estorno exercitados por HTTP em outra conta sintética. |
| Contas a receber | Cliente remoto real, valor `10,50`, POST 201 e `valorOriginal=10.5`. Baixa de `12.34` e estorno por HTTP restauraram o saldo da conta a receber sintética. |
| Transferências | UI persistiu `123,45` como `123.45`, HTTP 200. Transferência anterior de `1234.56` e estorno restauraram os saldos originais. |
| Taxa com quatro casas | Configuração de crédito exibiu `3,1234`; edição UI para `0,0002`, PUT 200 e PostgreSQL `0.0002`. Parcelamento configurado permaneceu 3. |

Não houve requisições de erro inesperadas ou exceções JavaScript nas execuções finais do smoke. Os fluxos não foram operados em produção.

A conferência financeira respeitou o modelo existente: movimentos estornados permanecem auditáveis e são excluídos da soma dos movimentos efetivos. Após estornos e a transferência UI, saldos conferidos: origem `4876.55`, destino `123.45`. Não foi presumida uma linha compensatória adicional para cada estorno. Pagamentos da venda somaram exatamente seu total.

Vazios, inválidos, colagem, `0,0002`, `1,2500`, `10,50`, `1.234,56`, limites, negativos proibidos, incremento/decremento, valores inseguros para `number` e precisão de 2/3/4/6 casas têm cobertura na suíte executada. A precisão depende do domínio: Produto/compra continuam com custo de duas casas; taxa aceita quatro e fator de kit seis. Não se passou a aceitar quatro casas em um contrato de duas. Valores financeiros continuam sem spinbox; quantidades e contadores utilizam controles apenas onde previstos.

Evidências: [HTTP](assets/formularios-release-2026-10-25/smoke-http.json), [UI](assets/formularios-release-2026-10-25/smoke-ui.json), [venda](assets/formularios-release-2026-10-25/pdv-venda.json), [fechamento](assets/formularios-release-2026-10-25/caixa-fechamento.json), [integridade PostgreSQL](assets/formularios-release-2026-10-25/pg-integridade.json).

## 7. Testes e verificações

| Execução | Total | Aprovados | Falhas | Ignorados |
|---|---:|---:|---:|---:|
| Frontend global, composição isolada | 650 | 629 | 18 preexistentes | 3 |
| Opt-in HTTP real do Produto | 1 | 1 | 0 | 0 |
| Reprodução HEAD por loaders somente leitura | 38 | 19 | 19 ocorrências / 18 casos distintos | 0 |
| Smoke UI/HTTP adicional | Grupos da seção 6 | Todos os grupos concluídos | 0 nas execuções finais | — |
| Revisão responsiva/temas | 12 capturas | 12 | 0 nas verificações de labels/overflow | 0 |
| Build frontend, TypeScript e lint | Executados | Aprovados | 0 erros | — |
| Build/boot backend e Hibernate validate | Executados | Aprovados | 0 | Testes backend não repetidos |
| `git diff --check` | Executado | Aprovado | 0 | — |

**Não somar as rodadas.** O caso HTTP real de Produto é um dos casos opcionais ignorados na execução global, depois executado separadamente. Os três ignorados da global são opções de integração/evidência, não aprovações. A execução global já inclui os testes direcionados das dez entradas do manifesto. Os dois casos adicionais em relação aos 648 da rodada global 15C são os casos de estorno do Extrato adicionados ao fim daquela auditoria.

As 19 ocorrências de falha na reprodução HEAD incluem duas execuções da mesma verificação estática de listagem. O conjunto deduplicado corresponde exatamente às **18 falhas globais atuais**; diferença de conjuntos: zero. As expectativas não foram enfraquecidas.

| Origem das falhas preexistentes | Casos distintos |
|---|---:|
| `correcoes-criticas`: padrões estáticos de fechamento/formulários | 4 |
| `layout`: nomenclatura estática | 1 |
| `listagens-administrativas`: regra estática sobre `.filter` | 1 |
| `listagens-administrativas`: seletores de tabela/fixtures de Cofre | 7 |
| `politicas-recebimento`: ação esperada na Agenda ausente na composição HEAD | 5 |

Persistem dois avisos `react-hooks/incompatible-library` ligados a `watch()` em ConfiguracaoFormaPagamentoForm e ContaBancariaForm. Build avisa sobre chunk maior que 500 KB (aproximadamente 1.414 KB, gzip 417 KB). Não foram ocultados ou corrigidos fora do escopo.

Comandos principais, executados na cópia temporária:

```text
mvnw.cmd -q -DskipTests package
node --test --test-concurrency=1 --test-reporter=tap tests/*.test.mjs
npm run build
npx tsc --noEmit -p tsconfig.app.json
npm run lint
node --test --test-name-pattern=HTTP tests/produto-campos-form.test.mjs
node release15d-smoke.mjs
node release15d-visual.mjs
git diff --check
```

O opt-in recebeu somente API/state/origem da fixture descartável. Os drivers adicionais foram executados dentro de `snapshot/frontend`, com `RELEASE15D_ROOT` apontando para o diretório TEMP desta validação; cópias estão nas evidências. Não os executar apontando para contas ou serviços reais.

O script legado `npm run test:e2e` não foi usado como comprovação: ainda procura o botão “Entrar” e o preço de Produto na aba inicial. A tela de login atual usa “Acessar”, inclusive no HEAD; o smoke temporário utilizou os seletores e abas reais. Atualizar esse roteiro é uma pendência de automação, sem alterar ou esconder suas asserções nesta tarefa.

Logs: [global](assets/formularios-release-2026-10-25/frontend-global.tap), [HEAD](assets/formularios-release-2026-10-25/baseline-head.tap), [resumo](assets/formularios-release-2026-10-25/testes-resumo.json), [build/TypeScript/lint](assets/formularios-release-2026-10-25/qualidade-frontend.log).

## 8. Visual, teclado e acessibilidade

Revisão orientada por Minimal Work, Impeccable e [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). O detector Impeccable não apontou ocorrências nos quatro alvos principais consultados; isso não substitui teste funcional ou avaliação humana.

Foram capturados Contas a Pagar, Kit e PDV em desktop 1440×1000 e mobile 390×844, temas claro/escuro, browser pt-BR. As 12 imagens foram conferidas em painel comparativo, com inspeção ampliada de amostras. Labels, espaçamento, ajuda, valores, botões e foco permanecem legíveis. Não houve overflow horizontal da página ou dos diálogos nas amostras; os inputs visíveis analisados tinham nome acessível. Textareas internas de medição do MUI, `aria-hidden`, não foram tratadas como campos operacionais.

F5/F3/F2 e Enter foram exercitados no PDV real. As quantidades inteiras continuam compactas; frações e valores monetários preservam suas precisões. Teclado, associação de erro, colagem e controles numéricos também estão cobertos pelos testes de componentes. Não houve teste com leitor de tela dedicado ou leitor físico de código de barras.

Exemplos: [Kit mobile escuro](assets/formularios-release-2026-10-25/kit-mobile-dark.png), [Contas a Pagar mobile escuro](assets/formularios-release-2026-10-25/pagar-mobile-dark.png), [PDV mobile claro](assets/formularios-release-2026-10-25/pdv-mobile-light.png), [pagamento misto](assets/formularios-release-2026-10-25/pdv-misto.png). A lista das 12 verificações está em [visuais.json](assets/formularios-release-2026-10-25/visuais.json).

A evidência é amostral, não validação visual de cada aba dos 45 grupos. A borda clara de baixo contraste apontada na 15C permanece preexistente no tema. As abas de Produto conservam a rolagem horizontal própria no mobile, sem alargar o formulário. Não houve redesign.

## 9. Pendências e riscos

- Nenhum bloqueio funcional novo foi confirmado para esta composição.
- A suíte global permanece com 18 falhas preexistentes: dívida de automação/funcionalidade anterior, registrada separadamente. Não anunciar CI totalmente verde.
- Atualizar futuramente o roteiro E2E legado; os drivers desta auditoria não o substituem silenciosamente.
- Acessibilidade e visual possuem amostragem; não foram usados NVDA nem dispositivos móveis/leitores físicos reais.
- Valores monetários que ultrapassem representação segura em JavaScript são bloqueados, não arredondados silenciosamente. É a proteção existente da implementação auditada, não mudança no banco.
- O maior risco imediato é operacional de Git: um commit a partir do índice atual misturaria trabalhos e usaria blobs antigos. Conferência seletiva é obrigatória.
- A 15D não revalidou o deploy 14D nem investigou dados históricos da Mustache. Não há dependência de reparo de estoque ou Caixa para publicar este frontend. Nenhuma autorização para corrigir dados decorre deste relatório.
- A saúde e a versão efetiva de produção não foram consultadas nesta etapa. Precisam ser reconfirmadas na tarefa autorizada de publicação.

## 10. Proposta de commit e sequência de publicação

Mensagem proposta: `feat(ui): padroniza formularios e campos numericos do ERP`.

Após autorização, reservar Git e arquivos compartilhados para um responsável. Revalidar HEAD, hashes e índice contra este manifesto. Preparar uma seleção de commit separada do staging paralelo, preservando seus blobs e seu patch; não fazer commit direto do índice atual. Não usar `git add .` nem adicionar diretórios amplos. Substituir os dois blobs `AM` pela versão final testada somente na seleção autorizada. Compor `CURRENT_STATE.md` pelo patch seletivo, conservando os demais trechos locais fora do commit. Conferir diff staged, lista exata de caminhos e `diff --check` antes de criar o commit.

O manifesto fecha a seleção lógica; esta auditoria não criou outro índice ou alterou o staging para forçar a separação. Se os arquivos/HEAD mudarem, invalidar a seleção afetada e reavaliar antes de integrar.

Ordem segura proposta:

1. Confirmar autorização, ausência de mudanças concorrentes e composição exclusiva do commit; preservar documentos 14D/16/16A e demais trabalhos.
2. Consultar remoto e Vercel, identificar deployment anterior recuperável e conferir `VITE_API_URL` HTTPS existente. Push em `main` pode publicar automaticamente; tratá-lo como ato de publicação.
3. Confirmar que a API publicada mantém os contratos existentes usados por este frontend. Nenhuma dependência backend nova foi introduzida; não fazer deploy Oracle, reinício ou migration apenas por esta entrega.
4. Preferir uma janela fora do pico do cliente. Usar o projeto e fluxo Vercel existentes, sem alterar domínio ou variáveis desnecessariamente. Promover somente o commit autorizado.
5. Executar o checklist somente leitura abaixo e observar erros. READY local não dispensa esse smoke.

### Smoke pós-deploy, sem transações financeiras reais

- Conferir commit/deployment, HTTPS, assets e URL da API.
- Com sessão autorizada, abrir dashboard, Produtos e edição de um registro existente; conferir preços, custos, frações e cancelar sem salvar.
- Abrir consultas de Estoque, Entradas e Kits; conferir apresentação e fechar sem ajustes.
- Abrir PDV; conferir foco, busca/leitura digitada, quantidade no rascunho, F2, meios de pagamento e parcelas existentes. Voltar, limpar apenas o rascunho de teste e **não concluir venda**.
- Abrir Caixa/painel/histórico; não abrir/fechar/movimentar sessão real.
- Abrir e cancelar formulários de contas/transferências/configurações; não salvar ou estornar registros reais.
- Conferir menu por perfil quando houver contas autorizadas disponíveis, logomarca e ausência de 401/403 inesperados, 500 e erros JavaScript.
- Qualquer teste transacional adicional permanece restrito a ambiente descartável ou tenant de teste explicitamente autorizado.

### Rollback

Antes de publicar, registrar o deployment frontend anterior e confirmar, no projeto Vercel existente, a disponibilidade de restauração/promoção daquela versão. O procedimento não foi executado nem sua disponibilidade atual presumida. Sem versão anterior recuperável, suspender a publicação.

Em regressão de precisão/payload, perda de foco/atalhos, erros de autorização ou falhas relevantes, interromper o rollout e restaurar o deployment frontend anterior pelo fluxo existente da Vercel. Não reiniciar Oracle, alterar Supabase, reverter banco ou manipular dados financeiros. O rollback frontend é compatível porque os contratos backend e schema permanecem iguais. Revalidar login/consultas/PDV sem concluir transações após a restauração.

## 11. Encerramento

**FORM UX RELEASE READY** — seleção isolável, smoke real concluído, precisão e regressões verificadas, falhas anteriores explicitadas e procedimento de publicação preparado. Produção não foi alterada. Commit, push e deploy dependem de nova autorização explícita.

Documentação compartilhada não foi sobrescrita: o resumo necessário para `CURRENT_STATE.md` está no patch proposto. Auditorias datadas anteriores e staging paralelo permanecem intactos.
