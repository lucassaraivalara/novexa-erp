# Proposal

## Why

Estoque → Saldo já reúne as operações necessárias, mas a apresentação de quantidades sem unidade no grid, mensagens fora do contexto e diferenças visuais em relação ao Financeiro dificultam a leitura e a execução. Evoluir a experiência existente permite operar e conferir estoque com mais clareza, preservando contratos e regras.

## What Changes

- Modernizar grid, identificação do produto, saldos com unidade e ações, seguindo os padrões React/MUI existentes em Contas Financeiras e Contas a Pagar.
- Simplificar os diálogos de entrada avulsa, saída e ajuste individual: contexto resumido, quantidade em destaque, efeito no saldo e feedback no próprio fluxo.
- Refinar histórico, filtros, estados vazios, erros e confirmação de sucesso.
- Refinar ajuste em massa e importação CSV/XLSX existentes: seleção, revisão de diferenças, erros por linha, prévia e retorno após confirmação.
- Preservar controle por produto e comportamento da configuração empresarial, isolamento por JWT, permissões, frações, histórico, concorrência e idempotência existentes.
- Esta entrega é somente planejamento para aprovação. Nenhuma tarefa de implementação foi iniciada.

## Capabilities

### New Capabilities

- `estoque-saldo-operacao`: consulta e movimentação operacional de saldos, histórico e conferência de ajustes individuais, em lote e importados. Formaliza a evolução da experiência existente; não cria um novo núcleo de estoque. Inventário OpenSpec consultado sem specs principais ou change equivalente.

### Modified Capabilities

Nenhuma.

## Impact

- Frontend: `frontend/src/pages/Estoque/Estoque.tsx`, `AjusteEstoqueMassa.tsx`, `estoqueRegras.ts` e, somente se necessário ao tratamento de mensagens, `frontend/src/services/estoqueService.ts`. Reutilizar `ajusteEstoqueLoteService.ts`, componentes compartilhados e tipos atuais.
- Referências de implementação: `ContasFinanceiras.tsx`, `ContasPagar.tsx`, `PageContainer`, `PageHeader`, `PageFilters`, `AppTable`, `CampoQuantidade` e `CampoTexto`.
- Backend consultado como contrato; sem mudança planejada em endpoints, permissões, schema, dependências ou regras. Necessidades divergentes retornam ao Product Owner antes de implementação.
- Documentos de referência: `docs/architecture/SYSTEM_CONTEXT.md`, `estoque.md`, `frontend.md`, `paginacao.md` e `docs/references/olist/analise-visual.md`. Atualizações do estado implementado somente no APPLY, conforme o resultado.
- Fora do escopo: corrigir dados operacionais da Mustache, alterar produção, criar WMS, produção industrial, depósitos, reservas, lotes, séries, conversões de unidade, novos indicadores ou mudar regras de negócio. Entradas de mercadoria e PDV permanecem fora desta evolução.
