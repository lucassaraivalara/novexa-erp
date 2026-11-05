# Design

## Context

Ver proposal.md para motivação e specs/contas-pagar-operacao/spec.md para comportamento. A exploração confirmou ContasPagar com filtros simultâneos, indicadores inicializados em zero e consultas auxiliares/resumo num Promise.all; o detalhe reutiliza ContaPagarDrawer desabilitado e a ação de estorno da tabela aponta ao pagamento atual. PagamentosContaPagar já oferece histórico paginado e estorno por ID. A 23C está no worktree local com V63; não é prova de publicação. Contratos e semântica financeira permanecem em docs/architecture/financeiro.md.

As observações acima são o contexto anterior à implementação 23D, preservado como motivação técnica. A base 23D foi implementada localmente, com tarefas concluídas e avaliação operacional do Product Owner ainda pendente. A revisão 23D.1 abaixo é exclusivamente planejamento de refinamento, sem nova exploração ou alegação de validação visual realizada nesta etapa.

## Goals / Non-Goals

**Goals:** reutilizar componentes MUI locais e serviços atuais; separar apresentação de consulta/edição; preservar estados seguros e tornar a operação principal evidente.

**Non-Goals:** outro motor financeiro, alterações de backend/schema, reorganização de rotas, dependências novas ou modificação de AppTable que afete outras telas. Nenhuma implementação ou publicação nesta fase.

## Decisions

1. **Tabela e painel mantidos.** Renomear colunas no escopo ContasPagar e usar ação textual Pagar com os recursos locais ou extensão restrita à página. Alternativa B rejeitada pelo Product Owner; evitar alteração global do componente compartilhado.
2. **Filtros progressivos com estado único.** Busca/situação/vencimento permanecem visíveis; Collapse ou equivalente local para fornecedor/categoria/emissão, com indicação de critérios ativos quando recolhido. Recolher não limpa estado nem dispara nova consulta; os parâmetros existentes continuam sendo enviados ao backend.
3. **Indicadores globais e estados independentes.** Preservar os cinco campos do resumo atual e separar seu carregamento/erro das consultas auxiliares. Reutilizar uma resposta por ação, sem novo endpoint, polling ou cálculo de totais a partir da página. Alternativa de indicadores filtrados exigiria outro contrato e está excluída.
4. **Consulta distinta de edição.** Reutilizar o drawer e seus pontos de integração, apresentando resumo textual antes do histórico em modo consulta; campos editáveis continuam restritos ao cadastro/edição. Não tornar informação somente leitura desnecessariamente difícil de ler através de campos desabilitados.
5. **Estorno agrupado no histórico.** A ação da listagem abre detalhes/histórico, sem POST automático para pagamentoAtualId; botão da baixa selecionada abre confirmação com seus valores e motivo. Preservar IDs, autorização gerencial, idempotência e atualização após sucesso. Legado sem agregado conserva caminho existente, explicitamente identificado, sem origem/baixa fictícia.
6. **Pagamento existente preservado.** Reaproveitar PagamentoContaPagarDialog da 23C, sem reimplementar cálculos, UUID ou lógica de retry. Ajustar somente contexto e apresentação necessários à experiência compacta.

## Risks / Trade-offs

- Layout horizontal pode comprimir campos → usar grade responsiva, largura mínima adequada e empilhamento no mobile; não reduzir legibilidade para eliminar toda rolagem.
- Histórico com pagamentos retroativos pode sugerir cronologia falsa → distinguir data da baixa, registro e estorno quando disponíveis; não inferir saldo histórico ou sequência global a partir de uma página.

- Filtros recolhidos podem esconder critérios → indicador de filtros ativos e limpeza explícita.
- Cards globais podem parecer resultado da tabela → rótulo de abrangência visível e ajuda para intervalos cumulativos.
- Drawer estreito com histórico extenso → resumo compacto, paginação existente, rolagem interna e ações acessíveis.
- Base local com trabalhos paralelos e 23C não publicada → identificar hunks autorizados antes de APPLY; não integrar ou publicar como parte desta change.
- Ajuste de UI afetar confirmação incerta → preservar serviços/UUID e executar os testes direcionados já existentes, acrescentando somente cenários modificados.

## Migration Plan

Nenhuma migration desta change. Implementação depende da base local 23C e não aplica V63 em ambientes persistentes. Futuro release será tarefa autorizada separadamente, com composição final e compatibilidade backend/frontend; não há rollback de schema previsto aqui.

## Open Questions

Não há decisão funcional bloqueante. Após implementação autorizada, o Product Owner validará hierarquia/densidade dos valores, clareza dos cards, localização dos filtros e Pagar e leitura do histórico em desktop/mobile. Ajustes cosméticos dentro do escopo não autorizam alterar regras ou criar novas visões.

## Refinement 23D.1

1. **Cadastro horizontal responsivo:** reorganizar os campos atuais em grupos de identificação (descrição/documento/fornecedor), classificação e datas (categoria/emissão/vencimento), valor e observação. Usar Grid/Stack existentes; ampliar a área útil do formulário quando necessário sem substituir o painel lateral como padrão de navegação. Manter campos, obrigatoriedade, valores iniciais e submissão existentes. Alternativa de copiar o formulário Athom foi excluída.
2. **Pagamento compacto:** aproveitar largura em desktop para relacionar resumo financeiro e origens; empilhar em mobile. Manter original, principal já quitado, principal da baixa, encargos, desembolso e residual claramente distintos. Rodapé acessível, sem cobrir campos/foco; rolagem interna permanece permitida para muitas origens. Não alterar cálculos, seleção integral/parcial, inclusão/remoção de origens, UUID, retry ou bloqueio durante envio.
3. **Histórico cronológico:** apresentar datas legíveis e ordenação identificável, respeitando paginação/ordenação do contrato atual. Associar visualmente cada estorno à baixa de origem com sua data, responsável e motivo, sem aparentar novo pagamento. Diferenciar data financeira da baixa de registro/estorno; não inventar datas legadas, reordenar globalmente uma coleção parcial ou reconstruir saldos históricos. Nenhum endpoint adicional ou carregamento de todas as baixas.
4. **Tabela e ações:** refinar alinhamentos, números tabulares, espaçamentos e distinção entre ação principal Pagar e ações secundárias/destrutivas. Manter nomenclatura, residual destacado, filtros progressivos e todos os estados da base 23D. Ajustes ficam nos componentes/página afetados, sem mudar defaults de tabelas de outras telas.

Athom orienta somente os princípios acima; não há reprodução literal de uma tela ou novos componentes externos. Reutilizar o sistema visual Novexa e validar o resultado com o Product Owner em desktop/mobile. Nenhuma mudança de contrato, dependência ou migration é prevista. Um novo APPLY explícito será necessário para executar o delta; esta edição apenas atualiza os artefatos.


Ajuste final aprovado em 05/11/2026: Pagar inicia a coluna Ações e aparece somente nas obrigações elegíveis; coluna Pagamento removida. Ações secundárias preservadas. Sem mudança financeira.
