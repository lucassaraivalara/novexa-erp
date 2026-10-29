# Contas a Pagar — juros, multa e desconto

Data: 29/10/2026. Escopo exclusivo de baixa integral e estorno de Contas a Pagar. Publicação autorizada pelo usuário; não executar pagamentos ou estornos produtivos para teste.

## Causa e implementação

Frontend e `ContaPagarService.pagar` comparavam `valorPago` diretamente com o original e emitiam “O pagamento deve corresponder ao valor integral da conta.” O DTO só recebia o total; não existia discriminação persistente de encargos. Não havia pagamento parcial implementado.

O contrato existente passa a aceitar `juros`, `multa` e `desconto` opcionais, zero por omissão. Backend calcula **original + juros + multa − desconto** em BigDecimal e exige que `valorPago` coincida, seja positivo e caiba em NUMERIC(19,2). Valores negativos e mais de duas casas são rejeitados; não há arredondamento implícito nem classificação automática de diferenças. O valor original do título permanece intacto.

A única SAIDA/CONTAS_A_PAGAR debita o total, com locks e transação existentes. V61 acrescenta quatro colunas opcionais de snapshot ao movimento: original, juros, multa e desconto. CHECK exige grupo completo, valores válidos, origem/tipo corretos e soma igual ao débito. Sem backfill ou alteração de migrations antigas. Os campos são imutáveis no mapeamento; observação discrimina os valores para consulta pelo extrato existente. Nenhum segundo lançamento de juros.

Estorno reverte exatamente o valor do movimento, marca-o estornado com usuário/data/motivo e reabre o título na mesma transação. O snapshot permanece após estorno e novo pagamento. Legado sem vínculo continua suportado; legado sem discriminação não recebe classificação inventada. Conta PAGA apresenta saldo em aberto zero mesmo com desconto.

O modal mantém MUI e CampoMonetario, mostra original, encargos separados e total calculado em centavos BigInt, enviado como decimal textual. Compara saldo com o total, preserva campos após erro e apresenta a discriminação no detalhe e no extrato. Conta financeira e data ficam desabilitadas durante envio. Consulta de títulos carrega o movimento no grafo existente, evitando uma consulta adicional por título para os novos campos.

Autorização mantida: pagamento autenticado conforme a política já existente (incluindo OPERADOR/USUARIO); estorno ADMIN/GERENTE. Tenant e usuário vêm do JWT; título, destino e usuário são validados pela empresa. Não foi introduzida uma nova restrição de perfil nem ampliada permissão.

## Validação sintética

- Release isolado: **100 casos backend** aprovados de ContaPagarEncargosPostgresTest, ContaPagarHttpTest, ContaReceberHttpTest e TransferenciaFinanceiraHttpTest. Uma rodada adicional aprovou dois casos de encargos (um reforça tenant já contado e outro acrescenta rollback de estorno): **101 casos financeiros distintos**.
- **3 regressões adicionais** de Caixa/PDV aprovadas: dinheiro sem duplicação, pagamento misto PIX/crédito/dinheiro com cancelamento, painel de caixa com abertura/venda/movimentos/estorno. Total backend: **104 casos distintos**, sem suíte global.
- HTTP real/PostgreSQL descartável: normal, juros, multa, desconto, combinação, centavos; total pago e saldo exatos; duplicidade e concorrência (200/409), saldo insuficiente, destino inativo/externo, tenant, 401/403, original preservado, snapshot/auditoria, retry sem duplicação. Triggers sintéticos provocam falhas após débito e após estorno: rollback preserva título, saldo e movimento.
- V60→V61: Flyway migrate/validate e Hibernate validate aprovados, apenas uma migration pendente; registros legados copiados preservados, snapshots antigos NULL. Instalação vazia também aprovada. Escala >2 é recusada em vez de arredondada.
- **15 testes frontend** aprovados: cálculo exato, limites, desconto quitado, payload/token, saldo, falha com campos preservados, detalhe/extrato, filtros e contratos existentes, desktop/mobile e claro/escuro. Build/TypeScript, lint dos arquivos afetados e diff-check aprovados.
- Nova imagem ARM64 qualificada em PostgreSQL sintético sem rede externa: original 645,00, juros 15,88, pagamento HTTP 200, débito 660,88 e saldo 339,12. Imagem anterior iniciou sobre V61 e estornou via HTTP 200, recompondo 1.000,00 e preservando os encargos. Nenhuma movimentação produtiva usada nessa comprovação.

## Backup e recuperação

Backup `/var/backups/novexa-postgres/novexa-postgres-20261029T060002Z-8249b4df.dump`, SHA-256 `ff68ee6dccd0966e38afee85419e316faa0474cac628407346318f2e4a0e7898`, 1.458.845 bytes. Integridade conferida e restauração integral aprovada em container PostgreSQL 17.6 compatível, sem rede. V61 aplicada somente nessa cópia: fingerprints das **44 tabelas públicas preservados**. Dump não foi baixado nem incorporado ao Git.

Recuperação sem restaurar banco: frontend anterior `9fdb079`, imagem Oracle anterior `sha256:ee3e48a51b64ef3881298138fb60c11a8e8801589c19cb4172f6c9fb109d979d`, Compose original + `/home/ubuntu/novexa-release20-20261028/compose.sprint20.yml`, target60. Compatibilidade da imagem anterior sobre schema61 comprovada em isolamento; não executar downgrade, repair ou reaplicar migrations. Em recuperação, restaurar também o frontend para retirar os novos campos.

## Composição, arquivos e publicação

Baseline remoto revalidado: `9fdb079f8b844561732c4d53dc017667933a2ff4`. Release preparado a partir desse baseline em diretório sem worktree Git, usando índice privado para preservar o staging compartilhado. A 20G.5 local e Upload ficam fora da composição.

Backend: PagamentoContaPagarRequestDTO, ContaPagarResponseDTO, ContaPagarService, ContaFinanceiraService, MovimentacaoFinanceiraEntity, ContaPagarRepository, V61 e teste ContaPagarEncargosPostgresTest. Frontend: ContasPagar, ContaPagarDrawer, ExtratoFinanceiroDrawer, contaPagarCalculos, tipos contaPagar e teste contas-pagar-encargos. Documentos: este relatório, CURRENT_STATE, financeiro, requisitos e arquitetura. Sem mudança de dependências, rotas, Caixa/PDV, Receber ou Transferências.

JAR produtivo SHA-256 `386ef6d74dd21dcca38f04d615ccc7aa929b6c3a46f77c8bbc3ebcca3872e162`, sem configuração do perfil local, seguindo o artefato vigente. Comparação com o JAR Oracle: somente seis classes financeiras e V61 diferem após normalizar finais de linha de recursos; bibliotecas idênticas. Imagem nova `sha256:4f4a77f59a525d9c9e7e88df2008ece0ffd3f95c910357bbcda0f6b57b7fbd44`.

Publicação em preparação: backend compatível deve subir antes do push que aciona a Vercel. Commit, deployment, saúde, Flyway e limitações do smoke serão registrados após a verificação real. Não se declara PRODUCTION READY nesta etapa.

## Preservação

Snapshot inicial de 759 fontes; somente arquivos financeiros autorizados foram editados. Staging SHA-256 `674309c892dc3925968d2f7a3acbf4ce50a67fd422ef6d46d62364caf22cac4d`, HEAD local `71f2ea0224359ad0e886fdc45ab79941f0ce9d17` e três worktrees preservados. Nenhum reset, force push, limpeza de fontes, importação, pagamento ou estorno real de teste. Lazy Loading/lockfile 20H, estoque 20G.4 e trabalhos paralelos preservados.
