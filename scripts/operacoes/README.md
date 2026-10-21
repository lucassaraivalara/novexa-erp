# Carga inicial única de Produtos

Procedimento operacional do primeiro cliente, fora do frontend/backend. Não é API nem recurso permanente. Resultado executado em [produtos.md](../../docs/architecture/produtos.md).

Usar Python 3.12 com `xlrd==2.0.2` e `psycopg[binary]==3.3.6` em ambiente isolado. Nunca salvar credenciais, planilha ou relatórios no Git. O arquivo original não é reescrito.

Compatibilidade V47: linha sem código interno exige a migration aplicada e recebe o código pelo mesmo trigger usado pela API. O script insere os códigos informados antes dos automáticos, mantendo-os intactos. Sem código e sem EAN, nome existente/repetido é duplicidade a revisar; não há atualização ou inferência sobre qual produto reutilizar. Testes novos usam somente registros sintéticos em PostgreSQL descartável. Este ajuste não autoriza nova carga em produção.

1. Confirmar backup do banco correto, API saudável, commit e V42 aplicada.
2. Testar no PostgreSQL descartável migrado por Flyway. Configurar `NOVEXA_CARGA_DSN` somente no ambiente; para os testes, schema `carga_operacional_test` com ADMIN sintético, empresa `900001` e CPF fictício. `NOVEXA_CARGA_CPF` recebe o CPF de teste, sem registrá-lo em logs.
3. Executar `python scripts/operacoes/test_carga_inicial_produtos.py` e ensaiar o arquivo com `--mode rehearse`. O ensaio sempre faz rollback; conferir os registros anteriores após o retorno.
4. Para produção, preencher `NOVEXA_CARGA_CPF` e `NOVEXA_SSH_KEY` privadamente no ambiente. `--production` lê a configuração externa existente da VM por SSH e a mantém somente em memória; não imprimir env ou exceções internas. Banco/schema devem ser `postgres`/`public`. Não trocar destino nem TLS para contornar falhas.
5. Executar com `--mode preview --production --report-dir <pasta-fora-do-repositorio>`. Default também é preview. Conferir contagens, empresa, rejeições e duplicidades; qualquer referência ambígua bloqueia a operação.
6. Somente após a conferência, usar `--mode apply --production --empresa-id <id-conferido> --preview-sha <hash-da-previa> --backup-confirmado --report-dir <pasta-fora-do-repositorio>`. O primeiro argumento é sempre o caminho do XLS. Arquivo/catálogo alterado invalida o hash; não substituir o hash sem revisar outra prévia.
7. Guardar `erros.csv`, `preview-resumo.json`, `apply-resumo.json` e a consulta independente de conferência fora do repositório. Conferir campos/vínculos dos IDs retornados, contagem por empresa e estoque/movimentos antes/depois.

Não atualizar produtos existentes. Não completar unidade ou identificadores ausentes por suposição. A planilha possui códigos/EAN repetidos: todas as ocorrências repetidas são rejeitadas. Vínculos ausentes são criados apenas para linhas aptas e na empresa identificada; ambiguidades bloqueiam tudo. O lote usa uma transação, locks das tabelas cadastrais durante a gravação e constraints reais. Erro antes do commit reverte o lote. Reexecuções rejeitam códigos/EAN já existentes, sem duplicação. Rollback transacional não restaura números consumidos pelas sequences.

Não executar a carga novamente como rotina. Não gerar estoque inicial, movimentos, vendas, Entradas ou registros financeiros por este procedimento. A tabela legada `importacoes_produtos` não é utilizada, editada ou removida.

## Operação histórica — regularização Mustache (empresa 1), 2026-10-21

Operação excepcional já EXECUÍDA e validada em produção. Os artefatos abaixo ficam
registrados como histórico; **não executar novamente**.

1. **Carga de faltantes** (`--acao incluir`): 61 produtos inseridos da planilha
   (606 linhas; 531 já existiam, 14 excluídos por EAN duvidoso, 2 ignorados,
   0 rejeitados). 11 kits novos com composição em `componentes_produto`.
   "Tabaco ACrema 20g" não foi inserido (já existia como componente órfão da
   importação anterior, id 530); o kit referencia o existente.
2. **Regularização** (`--acao regularizar`): 572 custos atualizados da coluna
   "Custo Unitário" (casamento código → EAN → nome, sem inserir produtos) e
   6 pares de palheiro convertidos em kits (V46, quantidade 20).
3. **Renumeração** (`renumera_codigos_internos_empresa_1.sql`): todos os códigos
   internos da empresa 1 renumerados em sequência contígua 1..598 (menor código
   anterior → maior; sem código/não numéricos ao final, por id); EANs de 13
   dígitos que estavam no código interno movidos para `codigo_barras`; barcode
   vazado (igual ao próprio código) limpo; numerador da V47 realinhado para 598
   (próximo código automático = 599). Código alfanumérico "CD091" substituído
   pela sequência. Estoque e movimentações não foram alterados.

Antes da execução, o fluxo completo foi ensaiado em PostgreSQL descartável local
com clone read-only da empresa 1 (17 testes automatizados + pipeline ponta a
ponta). Decisões registradas com o dono: custo importado para todos, EAN fica
com o kit quando repetido, kits sem estoque próprio (V46), 14 linhas de EAN
duvidoso fora desta rodada e unidade vazia padronizada para `UN.` (padrão da
base) de forma declarada no script.

Pendência conhecida: os 14 produtos excluídos por EAN duvidoso e os 20 sem
custo na planilha permanecem como estavam; resolver manualmente no cadastro.

