# Design

## Context

Motivação e limites em `proposal.md`. Planejamento em 09/11/2026 sobre o worktree atual de `main`, HEAD `6d299eb`, com alterações locais extensas, inclusive nos arquivos consultados. Esta inspeção não comprova publicação ou testes aprovados.

Estado observado:
- `Estoque.tsx` já usa PageContainer/PageHeader/PageFilters/AppTable, busca com debounce de 350 ms e cancelamento, paginação/ordenação remotas, diálogos individuais e histórico filtrável. O grid não exibe `unidadeMedida`; erros de movimento e histórico compartilham o alerta da página.
- `AjusteEstoqueMassa.tsx` já possui tela dedicada, seleção, diferenças, prévia, histórico, importação CSV/XLSX, prevenção de reenvio, retry com UUID e retorno para novo ajuste. Não reconstruir esses recursos.
- `estoqueService.ts` recebe erros textuais, mas descarta diagnóstico estruturado; o lote já trata parte dos status HTTP. Melhorias de mensagem devem reutilizar o que existe.
- `MovimentacaoEstoqueController/Service` obtém empresa/usuário autenticados, usa produto do tenant com lock, mantém saldo e movimento na mesma transação, bloqueia inativos/sem controle/Kit e saída manual insuficiente. Ajuste é saldo final, não delta. Motivo individual é opcional, até 255 caracteres.
- `VendaService` combina controle da empresa e produto na venda. Movimentação manual não aplica esse mesmo bloqueio empresarial global. Não uniformizar essas regras nesta evolução.
- DTO individual, lote e parser aceitam até três casas decimais. Não foi observada exigência de inteiros por sigla de unidade; não criá-la. UI reutiliza CampoQuantidade e a precisão que já aceita, sem ampliar limites numéricos.
- Lote exige ADMIN, SALDO_FINAL, motivo, 1–200 itens e verifica saldo/último movimento na confirmação. Importação limita arquivo a 2 MiB/200 linhas. Atomicidade e idempotência são responsabilidade do backend existente.

Referências: `docs/architecture/estoque.md`, `frontend.md`, `paginacao.md` e guia `SYSTEM_CONTEXT.md`. As imagens listadas em `docs/references/olist/analise-visual.md` não foram inspecionadas; o código atual do Financeiro é a referência concreta desta proposta. Skill local novexa-ui-consistency indisponível no caminho indicado.

## Goals / Non-Goals

**Goals:** refinar a superfície operacional existente com mudanças locais e verificáveis, minimizando decisões repetidas e preservando os contratos consumidos.

**Non-Goals:** reestruturar o módulo, editar componentes compartilhados por preferência visual, alterar backend, migrations, regras, dependências ou dados reais. Não criar PRODUCT.md/DESIGN.md, auditoria ou documentação arquitetural paralela para este refinamento.

## Decisions

1. **Preservar React/MUI e composição atual.** Aplicar ao Saldo os padrões concretos de ContasFinanceiras/ContasPagar: cabeçalho breve, busca e filtros compactos, números alinhados à direita, estados discretos, ícones com tooltip e foco visível. Manter as quatro ações por linha visíveis em desktop; evitar esconder operações frequentes em menu. Em telas estreitas, manter tabela com rolagem própria e filtros empilhados. Alternativa rejeitada: novo grid ou sistema visual.
2. **Unidade junto à quantidade, sem coluna redundante.** Usar `Produto.unidadeMedida` para saldo atual/mínimo e contexto dos diálogos e histórico. No lote, aproveitar unidade da linha da prévia e dos produtos selecionados; na importação, aproveitar o resultado do lote já retornado, sem consulta por linha. Unidade ausente aparece como não informada, sem presumir UN. Não executar conversões nem somar unidades heterogêneas. Alternativa rejeitada: novas consultas e contratos para informações disponíveis.
3. **Manter diálogos curtos para operações individuais.** Produto/código e saldo/unidade formam resumo somente leitura; quantidade/novo saldo recebe foco; motivo continua opcional; saldo previsto explica o efeito. Preservar uma confirmação e Enter, mostrar erros no formulário e sucesso na página após resposta válida. Histórico permanece em diálogo amplo, com filtros recolhíveis quando necessário e detalhes legíveis. Alternativa rejeitada: migrar tudo para drawer apenas para imitar o Financeiro, aumentando o diff sem benefício comprovado.
4. **Separar feedback por contexto.** Estados de erro da listagem, movimento e histórico independentes, inclusive no lote. Reaproveitar o extrator de mensagem existente e normalizar somente formatos efetivamente usados pela API (texto/detail/message), com fallback orientativo. Erros de rede não garantem ausência de gravação; não criar retry automático para escrita individual, pois não possui o contrato idempotente do lote.
5. **Refinar a máquina de estados existente do lote.** Manter tela dedicada, rascunho, prévia, confirmação e resultado. Tornar visíveis saldo atual, físico, diferença/unidade e ações de revisar. Preservar invalidação da prévia após edição, UUID e payload pendentes, conflito 409 e novo ajuste após sucesso. Na importação, aproximar mensagens e conferência do lote manual, preservando a seleção de arquivo e os erros por linha. Alternativa rejeitada: novo assistente, upload persistido ou confirmação parcial.
6. **Validação proporcional somente no APPLY.** Aproveitar testes existentes de estoque/empresa/lote/compactação e campos; acrescentar cobertura apenas para comportamentos alterados. Preservar cenários de concorrência/idempotência/tenant já existentes. Referenciar Web Design Guidelines na revisão acessível futura, sem executar nova auditoria nesta etapa. Não iniciar servidor, testes ou build durante a proposta.

## Risks / Trade-offs

- [Baseline local diverge do publicado e contém trabalho paralelo] → comparar apenas os arquivos desta change no APPLY e preservar staging e alterações existentes, sem sincronização destrutiva.
- [Saldo exibido pode ficar obsoleto antes do envio] → tratar previsão individual como informativa e backend como autoridade; manter nova prévia em conflito de lote.
- [Histórico só fornece a unidade atual do cadastro] → usar contexto do produto sem apresentar unidade histórica imutável ou converter movimentos antigos.
- [Erro estruturado pode conter detalhes técnicos] → apresentar diagnóstico permitido e fallback de ação, sem stack trace ou dados de outros tenants.
- [Refinamento involuntariamente altera permissões ou precisão] → manter contrato de valores, ADMIN no lote, motivo individual opcional e controles empresariais/produto distintos; divergências retornam ao PO.
- [Tabela densa em mobile] → rolagem localizada e ações alcançáveis por teclado; verificar desktop e viewport estreito no APPLY sem redesenhar a navegação.

## Migration Plan

Sem migração de dados ou schema. APPLY incremental por grupo de tarefas; atualizar documentação apenas do comportamento efetivamente entregue. Rollback futuro consiste em reverter somente o incremento de UI desta change, sem editar saldos ou histórico. Commit, push, deploy e validação consolidada dependem de autorização própria.
