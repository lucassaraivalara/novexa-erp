# Tasks

## 1. Isolamento e persistência

- [ ] 1.1 Confirmar baseline de integração, alterações locais e worktrees; obter autorização explícita para um worktree dedicado e coordenar com Codex Astra a reserva única da migration. Verificar `git status`, histórico, arquivos V65-V70 e reservas ativas; registrar versão, responsável e branch antes de editar qualquer migration.
- [x] 1.2 Após a reserva, adicionar a coluna `taxa_entrega` com zero para registros existentes e constraint não negativa, sem alterar migrations anteriores. Validar em PostgreSQL descartável a cadeia integrada, os checksums, o histórico de vendas com total inalterado e `ddl-auto=validate`.

## 2. Contrato e regras de venda no backend

- [x] 2.1 Incluir a taxa opcional nos contratos `POST /vendas` e `POST /vendas/{id}/faturar`, persistir e devolver o campo separado, recalcular o total nas operações de venda aberta e preservar a assinatura de idempotência para requests antigos sem taxa. Executar `.\mvnw.cmd -Dtest=VendaHttpTest,VendaServiceTest,CancelamentoVendaServiceTest test` em `backend/novexa-api`, incluindo ausência, zero, valores válidos, precisão inválida, total divergente e retry legado.
- [x] 2.2 Integrar a taxa à soma de pagamentos e parcelas a prazo e ao cancelamento integral, sem novo lançamento financeiro ou efeito de estoque. Cobrir dinheiro, PIX, débito, crédito, pagamentos mistos, prazo e cancelamento com os testes de Venda e Cancelamento em PostgreSQL/H2; atualizar somente as regras diretamente afetadas em `docs/architecture/financeiro.md`.

## 3. Entrada e totalização no PDV

- [x] 3.1 Adicionar a taxa ao rascunho e ao payload; implementar entrada em centavos restrita ao campo da taxa e a fórmula `subtotal - desconto + taxa`. Verificar `1`, `15` e `150` como R$ 0,01, R$ 0,15 e R$ 1,50, valor inicial zero, restauração do rascunho e compatibilidade de desconto/pagamento com `node --test tests/pdv.test.mjs`.
- [ ] 3.2 Adicionar o campo de taxa abaixo do endereço no diálogo existente e apresentar a taxa separada no resumo e no pagamento, preservando a composição e responsividade atuais. Verificar os estados de abertura, edição, fechamento e reabertura em `node --test tests/pdv.test.mjs`, validar desktop/mobile e atualizar somente a seção PDV de `docs/architecture/frontend.md`.

## 4. Histórico e integração

- [x] 4.1 Exibir a taxa separada no detalhe histórico e no resumo de finalização, mantendo o total e os pagamentos existentes e sem recalcular vendas antigas. Verificar `node --test tests/central-vendas.test.mjs` e os cenários relevantes de `pdv.test.mjs`.
- [ ] 4.2 Executar os testes direcionados de backend, frontend e migration descartável em conjunto, `npm run build` e as verificações de lint aplicáveis; confirmar ausência de mudanças em banco operacional, estoque, produção ou deploy. Após validação, registrar resultado em `docs/architecture/CURRENT_STATE.md` com coordenação do responsável pelo documento.
