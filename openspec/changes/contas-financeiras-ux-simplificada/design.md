# Design

## Context

Ver `proposal.md` para motivação e escopo. O diagnóstico já confirmou os componentes existentes e o resumo por empresa/tipo, sem filtro de ativo. Há complexidade de carregamento: `CofrePainel` consulta pendências e histórico juntos; recolher tudo por desmontagem esconderia alertas necessários. Este desenho registra a separação entre cabeçalho persistente e detalhe sob demanda, sem nova arquitetura financeira.

## Goals / Non-Goals

**Goals:** compor a tela e seus estados com React/MUI existentes; manter números e ações corretos ao mudar apenas sua apresentação.

**Non-Goals:** novas APIs, agregações, permissões, tipos de conta, campos, conciliação bancária, integrações ou migrations. Não modificar o PDV nem transportar regras de Pagar/Receber para Contas Financeiras.

## Decisions

1. **Composição local:** PageContainer/PageHeader, indicadores, PageFilters, AppTable e Cofre após a tabela. Reaproveitar tokens/padrões aprovados; não refatorar defaults globais ou copiar telas inteiras. Manter busca e situação inicial atuais; expor tipo/situação pelos parâmetros já aceitos na API.
2. **Semântica dos valores:** manter `/resumo` e sua agregação; usar rótulo de saldo registrado e nota explícita sobre inativas/legados e abrangência global. Manter previsão em campo separado, sem somá-la ao saldo ou inferir valores ausentes. Identificação bancária fica junto ao nome para conter a largura da tabela.
3. **Cofre com único responsável pela consulta:** preservar cabeçalho/alertas e consultar a página inicial de pendências pelo endpoint atual, inclusive recolhido. Usar `totalItems`, não o tamanho da lista. Reutilizar a resposta ao abrir a primeira página; carregar histórico/extrato apenas quando a consulta correspondente estiver aberta. Não criar dois painéis que busquem as mesmas pendências. Preservar atualização via `versao/onAlterado`, erros independentes, cancelamento e estados de consulta; sem polling ou cache global.
4. **Formulário centralizado:** reutilizar CadastroDialog e os campos/handlers atuais de ContaFinanceiraDrawer, alterando apenas a apresentação. Grupos: identificação (nome/tipo), vínculo bancário condicional e saldos. Reaproveitar o atalho existente de Dados bancários; preservar preenchimento/retorno e a consulta de vínculos, inclusive legados.
5. **Ações existentes:** Extrato textual principal, Editar acessível e menu com operações secundárias. Os drawers e confirmações de movimentação, transferência, recebimentos e situação continuam responsáveis por suas operações; abrir/reorganizar não pode disparar escrita.

## Risks / Trade-offs

- **Ocultar pendência ao recolher** → cabeçalho independente do detalhe; loading/erro nunca viram zero, e a consulta mínima permanece ativa.
- **Duplicar requests ao expandir ou reaplicar resposta antiga** → único estado de pendências, reaproveitamento local e AbortController; invalidar após ações e troca de contexto autenticado.
- **Interpretar saldo do ERP como saldo bancário/físico** → rótulos e ajuda próximos aos valores; nenhuma soma entre saldo, previsão e sessão do PDV.
- **Formulário central perder dados/foco ou relaxar regras** → manter payload, validações e callbacks; preservar foco contido, bloqueio de duplo envio e erro com dados preenchidos.

## Migration Plan

Sem migração de dados/schema. Implementação local somente após aprovação e APPLY explícito; publicação exige autorização separada. Eventual recuperação de UI não envolve downgrade do backend ou alteração de saldos.

## Open Questions

Sem decisão funcional bloqueante. Densidade, largura do formulário, clareza dos rótulos e descoberta das pendências serão validadas visualmente pelo Product Owner após a implementação, dentro do escopo desta especificação.
