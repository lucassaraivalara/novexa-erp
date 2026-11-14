# Design

## Context

Ver `proposal.md` e `specs/pdv-taxa-entrega/spec.md` para motivação e contrato. Hoje o rascunho e `totais` estão em `frontend/src/pages/Vendas/pdv.ts`; `Vendas.tsx` já possui o diálogo Endereço / instruções de entrega. `ValorMonetarioPDV` usa `normalizarValorMonetario`, em que digitar `1` representa R$ 1,00. A taxa exige entrada por centavos sem alterar o comportamento dos campos de desconto e pagamento.

No backend, `VendaRequestDTO` finaliza a venda por `POST /vendas`; `FaturamentoVendaDTO` finaliza uma venda aberta por `POST /vendas/{id}/faturar`. `VendaService` recalcula itens e desconto, valida `totalEsperado` e distribui o total nos pagamentos e parcelas a prazo. `VendaEntity` e `VendaResponseDTO` não têm campo separado para entrega. O cancelamento integral valida pagamentos e contas a receber contra `Venda.total` e reverte os efeitos existentes na mesma transação.

Os arquivos de venda do frontend (`Vendas.tsx`, `PagamentoVendaDialog.tsx`) e do backend (`VendaService.java`, `CancelamentoVendaService.java`) já têm alterações locais. As migrations V65 a V70 também estão presentes como arquivos não rastreados; V70 consta como consumida na change de `productRef`. A branch atual é `main`, um commit à frente e 28 atrás de `origin/main`. O workflow atribui a reserva e integração de migrations a Codex Astra e exige uma única reserva ativa.

## Goals / Non-Goals

**Goals:**

- Manter a taxa em um campo próprio do rascunho e do histórico da venda.
- Fazer o backend calcular e validar o total em todos os caminhos de faturamento existentes.
- Reutilizar os efeitos de pagamento, caixa, recebíveis e cancelamento já vinculados ao total da venda.
- Preservar compatibilidade de requests antigos e de retries com a mesma chave de idempotência.
- Validar persistência e integração em PostgreSQL descartável antes de qualquer proposta de release.

**Non-Goals:**

- Criar item de produto para representar a entrega, movimentação financeira autônoma, baixa de estoque ou lançamento em caixa separado.
- Definir incidência tributária, emissão fiscal de venda ou reembolso de taxa em devolução parcial.
- Alterar preço, desconto, pagamentos, política de estoque, contas financeiras ou outros módulos fora do necessário para totalizar a venda.
- Executar a migration em banco operacional, publicar ou fazer deploy.

## Decisions

1. **Representar a taxa como valor da Venda, separado de subtotal e desconto.** Adicionar `taxaEntrega` ao modelo e aos contratos de criação/consulta. O total será `subtotal - desconto + taxaEntrega`. Requisições sem o campo equivalem a zero. Isso preserva o cadastro de produtos e os históricos existentes; criar um produto fictício misturaria receita de mercadoria, preço e estoque.

2. **Usar entrada por centavos apenas para a taxa.** Adicionar ao campo de taxa uma interpretação de dígitos em centavos, iniciada em zero, reaproveitando o componente visual existente sem alterar seu parser padrão. A alternativa de mudar `normalizarValorMonetario` foi descartada porque alteraria campos já usados em desconto e pagamento.

3. **Aplicar a fórmula nas duas rotas existentes de faturamento.** `POST /vendas` recebe a taxa no `VendaRequestDTO`; `POST /vendas/{id}/faturar` a recebe no `FaturamentoVendaDTO`. O backend normaliza ausência para zero, valida sinal e escala, persiste a taxa e compara o total esperado com o valor recalculado. As operações de edição de venda aberta também devem preservar a taxa já persistida ao recalcular subtotal, desconto e total.

4. **Preservar a assinatura de idempotência legada.** Os dois DTOs participam do resumo persistido da requisição. `toString` ou a assinatura canônica só incluirá a taxa quando ela for diferente de zero; ausente e zero mantêm a representação anterior. Assim, um retry antigo sem taxa não conflita apenas pela adição do campo.

5. **Manter um único fluxo de pagamento e reversão.** A taxa integra `Venda.total`; a soma das formas de pagamento e das parcelas a prazo continua igualando esse total. Caixa, PIX, cartões, recebíveis, contas a receber e cancelamento usam os registros existentes. Não criar movimento financeiro próprio para a taxa. O detalhe da venda apresenta a taxa separada e os totais comerciais existentes incluem a taxa por derivarem de `Venda.total`.

6. **Adicionar coluna sem reinterpretar o histórico.** A V71 foi autorizada excepcionalmente para testes isolados, sem liberar a reserva para produção. A migration adiciona `taxa_entrega NUMERIC(19,2) NOT NULL DEFAULT 0`, restrição não negativa e substitui a constraint antiga do total pela fórmula com taxa. Registros existentes recebem zero e mantêm subtotal, desconto, total, pagamentos e saldos. A reserva formal depende da integração de V70 e da conferência dos demais ambientes.

7. **Manter tratamento fiscal fora do escopo atual.** O Product Owner aprovou que a taxa seja comercial, componha o total e os pagamentos, sem criar classificação tributária. A inspeção encontrou importação de XML de entrada, mas nenhum fluxo de emissão fiscal de venda no caminho atual.

8. **Isolar a implementação das alterações locais.** Não editar os arquivos compartilhados que já estão modificados nem integrar migrations não rastreadas por conveniência. Antes de implementar, solicitar autorização para um worktree dedicado sobre um baseline de integração confirmado; transportar somente as mudanças necessárias após coordenação com seus responsáveis. O novo worktree não deve presumir que `origin/main` contém o estado local validado.

## Risks / Trade-offs

- **[Retry antigo pode divergir após mudança no DTO]** Manter ausente/zero fora da assinatura idempotente legada e testar a repetição da mesma chave antes e depois do novo campo.
- **[Uma operação pode continuar usando a fórmula antiga]** Cobrir criação direta, faturamento de venda aberta, alteração de desconto/itens e validação dos pagamentos com testes de serviço e HTTP.
- **[Campo de centavos pode afetar outros valores monetários]** Restringir a nova interpretação à taxa e testar `1`, `15` e `150`; preservar os campos existentes de desconto e pagamento.
- **[Totais gerenciais passam a incluir a taxa]** Os indicadores baseados em `Venda.total` refletirão o valor comercial da venda, enquanto o campo separado preserva a possibilidade de análise futura. Não criar indicador novo nesta mudança.
- **[Conflito de versão Flyway ou arquivos concorrentes]** Confirmar baseline e reserva única com o responsável antes de criar a migration; validar checksums e a cadeia completa em PostgreSQL descartável.
- **[Alterações locais podem ser sobrescritas ou misturadas]** Não implementar no worktree atual sem isolamento autorizado e coordenação dos arquivos de PDV, Venda e migrations.

## Migration Plan

Reserva provisória autorizada pelo usuário para testes isolados: V71, `taxa_entrega` da change `pdv-taxa-entrega`, responsável pela execução Copilot, branch `feat/pdv-taxa-entrega`. A V70 permanece sem commit e sem confirmação de encerramento da reserva. A aprovação é uma exceção para o teste local, não libera a versão para produção. Nos worktrees registrados e nas referências Git disponíveis não foi encontrada V71; outros ambientes não foram confirmados.

1. Confirmar o baseline compartilhado, a situação da V70 e a ausência de outra reserva ativa; solicitar ao responsável a reserva formal da próxima versão. Não assumir V71 livre.
2. Criar uma migration aditiva com valor zero para registros existentes e constraint não negativa. Não alterar migrations anteriores nem executar comandos Flyway em banco real nesta tarefa.
3. Aplicar e validar a cadeia completa em PostgreSQL descartável representativo, incluindo Hibernate `ddl-auto=validate`, dados históricos de Venda e compatibilidade de checksum.
4. Após autorização e confirmação da sequência Flyway, aplicar a migration, publicar o backend e depois o frontend. A ausência do campo mantém clientes antigos compatíveis. Planejar rollback considerando vendas já gravadas com taxa positiva: versões antigas podem não processá-las corretamente. Não remover schema nem dados automaticamente.
5. Entregar evidências de teste e checklist operacional. Qualquer aplicação em produção, homologação ou banco operacional exige autorização e processo de release separados.

## Open Questions

Nenhuma decisão de produto necessária para o escopo descrito permanece pendente. A reserva Flyway e a autorização do worktree são pré-condições de execução, não decisões funcionais.
