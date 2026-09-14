# Estratégia Multiagente do Novexa ERP

Fonte oficial de coordenação dos agentes. Complementa os princípios de [AGENTS.md](../../AGENTS.md) e a skill [minimal-work](../../.agents/skills/minimal-work/SKILL.md), preservando as decisões dos documentos de domínio. Instruções explícitas do usuário prevalecem sobre estas regras padrão.

## 1. Papéis dos agentes

### Codex Astra

Agente principal de engenharia/backend. Responsável por backend, Java, Spring Boot, JPA, PostgreSQL, arquitetura, regras de negócio, segurança, multiempresa, transações, concorrência, Flyway, integrações entre domínios e testes backend complexos.

Por padrão, é o único agente autorizado a criar migrations, alterar schema ou `pom.xml`, realizar mudanças arquiteturais relevantes e alterar regras de negócio backend. Essa responsabilidade não autoriza trabalho fora da tarefa solicitada. Exceções para outros agentes exigem autorização explícita.

### GitHub Copilot Luna 5.6

Responsável pelo frontend funcional: React, TypeScript, MUI, páginas, formulários, services, types, rotas, integração HTTP, tratamento de erros, validações, testes frontend e Playwright/E2E.

Não deve decidir regras de negócio backend, criar migrations, alterar schema, `pom.xml` ou backend sem autorização explícita. Deve consumir o contrato acordado e reportar necessidades de mudança ao responsável backend.

### Frontend Coringa

Responsável pelo refinamento visual solicitado: layout, alinhamento, espaçamento, responsividade, tipografia, ícones, densidade, componentes visuais e pequenos ajustes de UX, seguindo os princípios de produto do AGENTS.md.

Não deve alterar regras de negócio, contratos HTTP, backend, migrations ou autenticação, nem redesenhar a arquitetura frontend. Necessidades funcionais devem ser encaminhadas ao responsável pelo frontend funcional.

## 2. Ownership

| Responsável | Área de responsabilidade |
|---|---|
| Codex Astra | `backend/**`, incluindo `backend/**/db/migration/**` e `pom.xml`; arquitetura de domínio e regras de negócio |
| Copilot Luna | `frontend/src/pages/**`, `frontend/src/services/**`, `frontend/src/types/**`, `frontend/src/routes/**`, `frontend/tests/**` e `frontend/e2e/**` |
| Frontend Coringa | Refinamento visual em `frontend/src/components/**`, `frontend/src/layouts/**`, `frontend/src/theme/**` e páginas existentes |

Ownership não impede leitura de outra área para entender um contrato. Alterar fora da própria área exige necessidade real, coordenação com o responsável e registro na entrega; as restrições de autorização dos papéis continuam válidas.

Páginas e componentes podem envolver trabalho funcional e visual. Defina um responsável por arquivo durante cada tarefa: Luna conclui a alteração funcional antes de Coringa refinar o mesmo arquivo. O caminho do arquivo não autoriza Coringa a modificar seu comportamento funcional.

## 3. CONTRACT READY

Frontend dependente não começa enquanto o contrato backend estiver mudando. O responsável backend declara **CONTRACT READY** somente quando:

- endpoint e DTO estiverem definidos;
- regra principal estiver implementada;
- testes backend estiverem passando;
- nenhum outro agente estiver alterando simultaneamente esse contrato.

A entrega deve identificar o commit/baseline validado e o contrato disponível. O agente frontend deve trabalhar sobre essa base. Se o contrato precisar mudar, coordene a mudança e suspenda o trabalho dependente até uma nova declaração de CONTRACT READY; não ajuste os dois lados simultaneamente.

## 4. Git e worktrees

**1 tarefa = 1 objetivo = 1 branch/worktree = commits próprios.**

Antes de começar, execute:

```powershell
git status
git branch --show-current
git log --oneline -10
```

Confirme a branch correta, o worktree limpo e a ausência de alterações de outra tarefa. Se houver alterações pendentes, pare e informe; não as descarte nem inicie uma nova tarefa sobre elas.

Use branch e worktree próprios, a partir do baseline de integração definido. Não use `main` como local normal de desenvolvimento. A retomada de alterações conhecidas da mesma tarefa segue a seção de continuidade e não autoriza misturar tarefas.

## 5. Commits e conclusão

Uma tarefa implementada não está concluída sem commit. Antes de criar o commit:

1. Execute os testes necessários, build e lint quando aplicáveis.
2. Execute `git diff --check` e revise o diff da tarefa.
3. Adicione arquivos explicitamente com `git add <arquivo>` ou selecione trechos com `git add -p <arquivo>`.
4. Revise `git diff --cached`, execute `git diff --cached --check` e confirme que somente alterações da tarefa estão staged.

Evite `git add .` e `git add -A` quando houver alterações de outras tarefas. Não inclua arquivos gerados ou alterações alheias para obter um status limpo.

Depois do commit, execute `git status`. O worktree da tarefa deve terminar limpo antes de iniciar outra tarefa. Alterações inesperadas devem ser preservadas e reportadas. Não faça push sem autorização explícita.

## 6. Continuidade de tarefa

Ao assumir trabalho de outro agente, continue do estado atual; não comece do zero. Verifique `git status`, `git log`, `git diff`, o staged diff quando existir, commits relacionados e testes atuais.

Identifique quais alterações pendentes pertencem à mesma tarefa antes de prosseguir. Preserve o que estiver correto, continue na branch/worktree da tarefa quando disponível, complete somente o que falta e corrija apenas problemas comprovados. Se houver alterações de origem incerta ou de outra tarefa, pare e coordene a separação sem descartá-las.

## 7. Concorrência entre agentes

Dois agentes não devem alterar simultaneamente a mesma entidade, service, controller, migration, arquivo estrutural, contrato em evolução ou fluxo de domínio, mesmo em branches diferentes.

Cada tarefa deve declarar objetivo, domínio/arquivos, responsável, dependências e critério de conclusão. Trabalho paralelo deve ficar em áreas independentes. Quando houver dependência, o responsável pelo contrato termina primeiro; o agente dependente começa após CONTRACT READY. Combine a transferência de responsabilidade antes de editar arquivos compartilhados.

## 8. Migrations

Codex Astra é o responsável padrão pela reserva de números e integração de migrations. Copilot e Coringa não criam migrations sem autorização explícita.

Antes de criar uma migration, liste as existentes em `backend/novexa-api/src/main/resources/db/migration/` e confira o baseline de integração e as reservas de tarefas em andamento. Nunca presuma que um número está livre.

- Mantenha uma única reserva ativa de migration por vez, coordenada pelo responsável.
- Registre número, objetivo, responsável e branch na entrega/coordenação da tarefa antes de criar o arquivo.
- Nunca altere uma migration já aplicada nem crie duas com o mesmo número.
- Se houver disputa de numeração, pare antes de criar a migration e coordene a resolução.
- Integre a migration ou coordene a liberação da reserva antes de reservar a próxima.

## 9. Arquivos compartilhados

`CURRENT_STATE.md`, `arquitetura.md`, `package.json`, `pom.xml` e configurações globais exigem coordenação especial. Não os altere em paralelo com outro agente. Defina quem será responsável pela integração dessas alterações antes de editar.

Quando a documentação compartilhada estiver sob responsabilidade da integração, os agentes entregam as atualizações necessárias no resumo, sem editar simultaneamente os documentos. O integrador incorpora essas atualizações depois de validar o resultado e antes de concluir a etapa.

## 10. Função dos documentos

| Documento | Responsabilidade |
|---|---|
| [AGENTS.md](../../AGENTS.md) | Princípios globais obrigatórios e sequência de trabalho |
| [agent-workflow.md](agent-workflow.md) | Coordenação entre agentes |
| [SYSTEM_CONTEXT.md](SYSTEM_CONTEXT.md) | Visão geral do sistema e guia de consulta |
| [CURRENT_STATE.md](CURRENT_STATE.md) | Estado real implementado e limitações verificadas |
| [arquitetura.md](arquitetura.md) | Arquitetura estrutural, relacionamentos e integrações |
| [estoque.md](estoque.md) | Regras oficiais de Estoque |
| [financeiro.md](financeiro.md) | Regras oficiais de Financeiro |
| Relatórios e auditorias | Evidências históricas; não são fonte oficial de arquitetura |

Consulte somente os documentos pertinentes e não duplique regras de domínio no workflow. A matriz de atualização documental permanece no AGENTS.md.

## 11. CURRENT_STATE

Registre funcionalidades realmente implementadas e limitações verificadas; não marque intenção, planejamento ou validação pendente como conclusão.

Atualize após marcos importantes, refletindo o estado integrado real da `main` ou do baseline explicitamente identificado. Uma alteração ainda restrita à branch deve indicar essa condição e não ser apresentada como já integrada. Tarefas puramente visuais sem impacto funcional não exigem atualização do CURRENT_STATE.

## 12. Auditorias e diagnósticos antigos

Antes de corrigir algo relatado anteriormente:

1. Confirme que o problema ainda existe.
2. Verifique os commits recentes.
3. Confira o estado atual do código e dos testes.
4. Reproduza o comportamento quando possível.

Nunca implemente automaticamente uma correção apenas porque apareceu em relatório antigo. Preserve auditorias datadas como histórico e registre a evolução no documento responsável pelo estado atual.

## 13. Validação por agente

Execute primeiro os testes relacionados e amplie a validação ao final conforme o impacto. Os comandos abaixo devem ser executados no diretório correspondente; `git diff --check` vale para todas as tarefas.

| Responsável/escopo | Validação final |
|---|---|
| Codex / backend, em `backend/novexa-api` | `.\mvnw.cmd clean test` e `git diff --check` |
| Copilot / frontend, em `frontend` | `npm run test`, `npm run build`, `npm run lint` e `git diff --check` |
| Coringa / frontend, em `frontend` | `npm run build`, `npm run lint`, testes afetados quando aplicáveis e `git diff --check` |
| Documentação somente Markdown | `git diff --check`, revisão de `git diff`, `git diff --stat` e staged diff; Maven/npm não são necessários |

Quando houver migration, valide PostgreSQL/Flyway em ambiente seguro, preferencialmente descartável, quando disponível. Não apague bancos existentes para validar; reporte a verificação como pendente se não puder executá-la.

Quando houver E2E, execute `npm run test:e2e` se esse script existir, ou o comando equivalente documentado no projeto. Confira os scripts disponíveis antes de executar testes. Script ausente ou execução bloqueada deve ser reportado; E2E ignorado/skipped não comprova sucesso funcional. Não altere scripts ou dependências fora do escopo apenas para satisfazer esta lista.

## 14. Limites de escopo

Todos os agentes devem fazer somente a tarefa pedida, preservar código funcional, evitar refatoração não solicitada e não criar infraestrutura futura sem necessidade. Não atualize dependências sem necessidade e autorização; nunca altere Java, Spring Boot ou React automaticamente. Ao concluir o escopo, pare.

## 15. Entrega padrão

Entregue um resumo curto contendo:

- estado encontrado e o que já estava pronto;
- o que mudou e arquivos modificados;
- testes/verificações executados e resultados, incluindo falhas ou itens não executados;
- branch e commit;
- pendências reais, dependências e atualização documental necessária à integração.

Inclua CONTRACT READY quando os critérios forem atendidos. Evite relatórios extensos sem necessidade.

## 16. Fluxo recomendado e integração

```text
Codex Astra → backend / regra de negócio → testes → CONTRACT READY
Copilot Luna → frontend funcional → integração com o contrato → testes
Frontend Coringa → refinamento visual quando solicitado → validação
Integração → branch de integração → validação completa → main
```

O responsável pela integração reúne commits próprios das tarefas, resolve conflitos de forma coordenada, confere migrations e documentação e valida o resultado combinado. Testes isolados de cada agente não substituem a validação da integração.

## 17. Main e baseline

`main` representa o baseline estável. Mudanças chegam à `main` depois de implementação, commit, testes, integração e validação. O responsável pela integração publica o baseline que os agentes devem usar nas próximas tarefas.

Antes de iniciar uma tarefa, alinhe a branch/worktree ao baseline indicado, com o worktree limpo. Não descarte alterações locais para sincronizar. Integração e publicação seguem o escopo e a autorização da tarefa; concluir uma branch não autoriza merge ou push automático.

## 18. Prompts curtos

- Codex: "Siga AGENTS.md, agent-workflow.md e minimal-work. Você é o agente principal de backend. Tarefa: ..."
- Copilot: "Siga AGENTS.md, agent-workflow.md e minimal-work. Você é o agente responsável pelo frontend funcional. O backend está CONTRACT READY no commit ... Tarefa: ..."
- Coringa: "Siga AGENTS.md, agent-workflow.md e minimal-work. Você é o agente de refinamento visual. Tarefa: ..."
