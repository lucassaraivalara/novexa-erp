# Publicação 23C + 23D + 23D.1 — Contas a Pagar

Data: 05/11/2026. Autorização do Product Owner: ajuste final, VALIDATION e RELEASE condicionado aos gates.

## Composição e escopo

- HEAD original preservado: `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`.
- Main remota inicial: `20b5cf94b136b758725dbd97734e20bc65176232` (20 commits à frente do HEAD original).
- Commit funcional publicado: `1d29b443380dfea6ae3bfb955e04d4ed0233e070`, filho direto da main remota, sem merge/force push. Release isolado em `.release-sprint23cd`; os commits remotos foram integralmente preservados.
- Somente incremento 23C, interface 23D/23D.1 e dependência de rótulo de status em EntradaObrigacao. Testes publicados 23B.1 de commit, resposta perdida, estorno simultâneo e UUID com payload incompatível preservados; não foram substituídos pela cópia local antiga.
- Ajuste final: coluna Pagamento removida; Pagar primeiro em Ações, visível somente para ABERTA/PARCIALMENTE_PAGA; ações secundárias preservadas. Nenhuma regra financeira alterada por esse ajuste.

## Validação integrada

- PostgreSQL exclusivamente descartável/loopback: 75 execuções nas classes Parcial/Multiorigem, 74 aprovadas e uma opt-in de navegador não executada; mais 10 testes HTTP aprovados. Cobertura: parcial, quitação final, múltiplas origens, centavos/encargos, residual, idempotência, resposta perdida após commit, falha diferida no commit, rollback real, concorrência, estorno individual/anterior/simultâneo, autorização e isolamento multiempresa.
- Dois erros iniciais eram de fixture: schema legado reutilizado entre subclasses e cópia de títulos parciais para um schema V62. Corrigidos apenas nos testes do release, preservando o cenário legado e a verificação de migração. Reexecução final sem falhas.
- 32 testes frontend aprovados (19 multiorigem/recuperação, três parciais, dez UX); teste da tabela reexecutado com asserts de ausência da coluna e primeira ação. Cinco testes de lazy/proteção aprovados; dois reexecutados após criar o diretório ausente de evidências no worktree isolado. Não foi ocultada falha funcional.
- Build backend e frontend/TypeScript aprovados; lint de todos os arquivos TS/TSX alterados aprovado. Nenhuma dependência ou arquivo de rota modificado.
- Interface sintética desktop 1366×768 e mobile 390×844, incluindo formulário, histórico/seleção de baixa, filtros rápidos e recuperação. Evidências locais em `docs/audits/assets/release23cd/`; não representam smoke produtivo autenticado.
- Validação HTTP/runtime adicional com Java e PostgreSQL 17.6.1 isolado na Oracle: integral legado, recuperação após reinício, duas baixas parciais com encargos/múltiplas origens, estorno da primeira preservando a segunda e restauração exata dos saldos sintéticos.

## Backup, V63 e preservação

Backup completo schema+dados: `/var/backups/novexa-postgres/novexa-postgres-20261105T152511Z-2d2d9e8f.dump`, 1.536.517 bytes; SHA-256 `326469839afdbfb50eec64c6ede301878a0a767745bb75490eb37f149ab61d0b`. Retenção desativada nesta execução: nenhum backup anterior removido.

Arquivo conferido por hash e restauração transacional integral em PostgreSQL 17.6.1 sem rede. V62→V63 e Hibernate validate aprovados sobre a restauração. Triggers impediram escritas de negócio na cópia, permitindo exclusivamente o backfill esperado do novo principal_quitado. Fingerprints dos 44 conjuntos de dados legados preservados, excluindo somente a coluna nova.

V63 adiciona principal_quitado, preenche títulos PAGA com o principal original (sem transformar encargos em principal), evolui constraints e substitui a unicidade de uma baixa ativa por índice de consulta. UUID por empresa, locks e transações existentes preservados. Nenhuma migration anterior alterada.

## Oracle

- Versão funcional: `1d29b443380dfea6ae3bfb955e04d4ed0233e070`.
- Imagem: `sha256:7ccc3ee323b08383c2b1411b0c4a6990673c3c43a3e3c904b4c7020838541951`.
- Comparação binária com produção anterior: apenas dez classes financeiras (incluindo classe interna DTO) e V63 diferem; bibliotecas e demais classes/recursos preservados. `application-local.properties` excluído do artefato produtivo.
- Flyway 62→63, checksum V63 `-1070743001`, V61 `1337766711` e V62 `-583159523` preservados; 62 linhas de histórico, zero falhas.
- Health/readiness/liveness UP; zero reinícios, início `2026-11-05T15:31:57.464080993Z`.
- Override incremental: `/home/ubuntu/novexa-sprint23cd-20261105/compose.sprint23cd.yml`, mantendo os seis anteriores e target63. Backend publicado antes do frontend; contrato sem principal explícito continua quitando o saldo residual.
- Verificação produtiva pré/pós: dados de 44 tabelas preservados, excluindo novo principal; histórico Flyway anterior intacto; nenhum pagamento/estorno de teste produtivo.

## Recuperação

Imagem compatível fixada em `novexa-api:sprint23cd-v63-recovery-20261105`, qualificada por reinício e replay/estornos sintéticos. Recuperação é manter/reiniciar backend compatível com V63 e, diante de defeito, conter a operação e corrigir progressivamente. Não usar backend V62 após existirem parciais; não fazer downgrade, repair, rollback de schema nem restauração produtiva automática. Restauração integral exige decisão operacional específica para evitar perda de escritas posteriores ao backup. Frontend anterior, isoladamente, não resolve suporte a novos estados: preferir a composição compatível.

## Frontend e smoke

Deployment Vercel: `dpl_A1K9eu8qbejfKVMU6gVnVXCFstyr`, https://novexa-bo4l3lgfn-orion-4009.vercel.app. Production READY no SHA funcional correto, alias oficial atualizado. Login HTTP 200, chunk lazy `/assets/ContasPagar-BvnxC47L.js` HTTP 200 (39.726 bytes), health HTTP 200 e endpoint financeiro anônimo HTTP 401. Verificação pública somente leitura; evidências em `docs/deploy/evidence-sprint23cd/`. Um commit documental posterior registra este resultado sem alterar os artefatos funcionais.

URLs: https://novexa-erp.vercel.app/financeiro/contas-pagar e https://163-176-231-214.sslip.io/actuator/health.

Smoke autenticado pendente: CUA retornou lista vazia de apps/navegadores e `browser access host is unavailable`; nenhuma credencial improvisada. Não houve baixa/estorno produtivo de teste. A aprovação visual do Product Owner refere-se à interface local com ajuste final, não a uma transação produtiva testada.

## Consumo e limitações

Monitoramento inicial: zero reinícios, zero HTTP 5xx observados desde o novo processo; CPU 0,15%, memória 1,088 GiB/2 GiB, NetIO 138 kB/42,8 kB na amostra inicial. São snapshots de container, não prova de carga sustentada, bytes SQL ou egress faturável do Supabase. Sem sessão, não há amostra produtiva autenticada dos endpoints financeiros. Egress do provedor não disponível; acompanhar após uso real. Sem novas dependências, polling, imagens ou base64 nos contratos.

## Preservação e pendências

Índice original SHA-256 `674309c892dc3925968d2f7a3acbf4ce50a67fd422ef6d46d62364caf22cac4d` preservado; HEAD, Upload, arquivos não relacionados e worktrees anteriores preservados. Operação feita somente no release adicional autorizado. A revisão automática recusou uma tentativa que incluía correção de fixture no worktree original; a alternativa executada limitou essa correção ao release, sem mudar aqueles testes originais.

Change OpenSpec permanece aberta. Não iniciada Sprint 23E. Pendências: smoke autenticado não destrutivo e acompanhamento de métricas disponíveis após uso; nenhum teste financeiro destrutivo em produção.

**Veredito: SPRINT 23C + 23D + 23D.1 PRODUCTION PARTIAL**. Publicação técnica concluída e validada; smoke autenticado pendente. O commit documental posterior deve preservar exatamente a árvore funcional publicada.

## Arquivos funcionais e de teste do release

- `backend/novexa-api/src/main/java/br/com/novexa/erp/dto/ContaPagarResponseDTO.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/dto/PagamentoMultiorigemContaPagarDTO.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/entity/ContaPagarEntity.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/entity/PagamentoContaPagarEntity.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/entity/StatusContaPagar.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/repository/ContaPagarRepository.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/repository/PagamentoContaPagarRepository.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/ContaPagarService.java`
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/PagamentoContaPagarService.java`
- `backend/novexa-api/src/main/resources/db/migration/V63__contas_pagar_baixas_parciais.sql`
- `backend/novexa-api/src/test/java/br/com/novexa/erp/controller/ContaPagarEncargosPostgresTest.java`
- `backend/novexa-api/src/test/java/br/com/novexa/erp/controller/ContaPagarMultiorigemPostgresTest.java`
- `backend/novexa-api/src/test/java/br/com/novexa/erp/controller/ContaPagarParcialPostgresTest.java`
- `frontend/src/pages/Estoque/EntradaObrigacao.tsx`
- `frontend/src/pages/Financeiro/ContaPagarDrawer.tsx`
- `frontend/src/pages/Financeiro/ContasPagar.tsx`
- `frontend/src/pages/Financeiro/PagamentoContaPagarDialog.tsx`
- `frontend/src/pages/Financeiro/PagamentosContaPagar.tsx`
- `frontend/src/pages/Financeiro/contaPagarCalculos.ts`
- `frontend/src/types/contaPagar.ts`
- `frontend/tests/contas-pagar-multiorigem.test.mjs`
- `frontend/tests/contas-pagar-parciais.test.mjs`
- `frontend/tests/contas-pagar-ux.test.mjs`
- `openspec/changes/sprint23d-contas-pagar-ux-compacta/.openspec.yaml`
- `openspec/changes/sprint23d-contas-pagar-ux-compacta/design.md`
- `openspec/changes/sprint23d-contas-pagar-ux-compacta/proposal.md`
- `openspec/changes/sprint23d-contas-pagar-ux-compacta/specs/contas-pagar-operacao/spec.md`
- `openspec/changes/sprint23d-contas-pagar-ux-compacta/tasks.md`
