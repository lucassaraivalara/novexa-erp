# Regras oficiais do Financeiro

- O mesmo dinheiro tem uma única fonte de saldo. CaixaEntity, SessaoCaixa e MovimentacaoCaixa representam dinheiro físico operacional do PDV; ContaFinanceira não substitui esse Caixa.
- ContaFinanceira representa dinheiro disponível. Tipos funcionais: BANCO, COFRE, CARTEIRA_DIGITAL e OUTROS.
- ContaFinanceira BANCO vincula uma ContaBancaria da mesma empresa em relação 1:1. ContaBancaria guarda somente identidade (banco, agência, número, dígito, titular e tipo); saldo e extrato pertencem exclusivamente à ContaFinanceira.
- Novos vínculos exigem conta bancária ativa. A inativação posterior não rompe o vínculo nem impede renomear a ContaFinanceira.
- BANCO legado sem vínculo continua legível e inativável; salvar uma edição exige regularização explícita, sem associação automática por nome.
- CAIXA e ADQUIRENTE são tipos legados: leitura, renomeação e inativação são preservadas, sem novos usos ou conversões automáticas. Seus saldos permanecem no total geral.
- Cartões serão tratados por Recebíveis; ADQUIRENTE não é um novo destino de dinheiro disponível.
- Fechamento de Caixa é conferência operacional; não liquida banco, PIX ou cartão.
- Empresa vem exclusivamente da autenticação/JWT. O vínculo bancário tem FK composta por empresa e unicidade no banco de dados.
- Baixa e estorno de Contas a Pagar continuam alterando ContaFinanceira e MovimentacaoFinanceira atomicamente. Este vínculo cadastral não cria outro saldo nem uma integração com o PDV.
- Novas ContasFinanceiras têm saldoInicialAuditado=true. Saldo inicial positivo gera exatamente uma ENTRADA/SALDO_INICIAL, com usuário autenticado e data real da criação, na mesma transação; o valor já inicializado na conta não é somado novamente. Saldo zero não gera movimento.
- Saldo inicial permanece imutável. SALDO_INICIAL não pode ser criado pelo endpoint manual nem estornado individualmente. Contas anteriores à V22 mantêm saldoInicialAuditado=false, saldos e histórico intactos; regularização explícita fica pendente, sem inventar usuário ou data históricos.
