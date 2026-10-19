# MVP — relatório final consolidado em 2026-10-18

## Base e classificação

Consolidação documental das quatro etapas posteriores à [auditoria contínua](MVP_AUDITORIA_CONTINUA_2026-10-18.md): fixtures PostgreSQL, expectativas de migration, inspeção autenticada somente leitura e recuperação do banco V43. Inclui a estabilização anterior da fixture H2 de paginação como evidência de base. A auditoria anterior permanece histórica; seus bloqueios resolvidos não devem ser tratados como falhas atuais.

Nenhum teste, build, acesso à produção, alteração funcional, commit, push ou deploy executado para elaborar este relatório. Valores abaixo são resultados capturados nas etapas anteriores, não uma nova medição de disponibilidade. HEAD e referência local `origin/main` consultados nesta consolidação: `e940972`; a referência remota não foi atualizada por fetch nesta tarefa. Aplicado Minimal Work, somente documentação.

| Classificação | Significado neste relatório |
|---|---|
| Corrigido | Causa reproduzida e alteração local aprovada nos testes afetados; publicação indicada separadamente |
| Validado | Evidência positiva no ambiente e limite explicitados; não implica aprovação ponta a ponta |
| Parcialmente validado | Há evidência útil, mas faltam dimensões essenciais da homologação integrada |
| Bloqueado | Condição concreta impede encerrar a etapa indicada |
| Sem evidência suficiente | Não há prova para aprovar; não significa defeito nem funcionalidade ausente |
| Falha preexistente | Ocorrência anterior classificada, com resolução ou limite atual identificado |
| Risco de produção | Limitação operacional ou de rastreabilidade; não significa incidente confirmado |

## A. Problemas corrigidos

| Problema | Causa e correção | Estado atual |
|---|---|---|
| Dez erros H2 de paginação | INSERT JDBC de Venda não executava o inicializador Java de `valor_prazo`; fixture passou a informar zero | Corrigido localmente, 10/10; sem alteração de regra ou migration |
| Cenários negativos PIX em Misto/Prazo | Três preparações tentavam persistir valor inválido ou destino de outro tenant, violando CHECK/FK antes do HTTP | Corrigido somente o snapshot de teste via spy; expectativas HTTP mantidas e constraints verificadas separadamente |
| Limpeza da fixture PIX | Instância manual não recebia o spy `movimentosCaixa`; reset nulo interrompia limpeza e gerava cascata de FKs | Corrigido setup; 27 erros históricos de fixture deixaram de ocorrer, 30/30 casos direcionados aprovados |
| Cinco falhas de versão | Testes atuais esperavam V32/V36; recortes históricos avançavam sem limite até V43 | Corrigido somente o teste: contexto atual V43; históricos novos limitados a V35 e V36, sem downgrade; 5/5 aprovados |

Arquivos locais envolvidos: `PaginacaoHttpTest`, `VendaHttpTest`, `PagamentoPixPostgresTest`, `AdministracaoPostgresTest`, `ContaReceberPostgresTest` e `VendaPrazoPostgresTest`. Correções não publicadas. Nenhum skip novo, redução de cobertura, alteração de regra financeira, contrato ou migration.

As correções funcionais já publicadas de Usuários/V43, PDV, tema, Empresas e sidebar pertencem aos commits anteriores `d601504`, `6be9b58`, `d2d146b`, `9f15343` e `e940972`; não foram reimplementadas nas quatro etapas.

## B. Testes e verificações aprovados

| Execução anterior | Aprovados | Falhas / erros | Ignorados | Limite |
|---|---:|---:|---:|---|
| Fixture de paginação corrigida | 10 | 0 / 0 | 0 | H2 |
| Regressões de paginação/Venda | 185 | 0 / 0 | 2 | Grupos relacionados, incluindo PostgreSQL |
| Fixtures PIX/Misto/Prazo direcionadas | 30 | 0 / 0 | 0 | PostgreSQL descartável |
| Grupos PIX, Misto, Prazo e liquidação após a correção de fixture | 404 | 2 / 0 | 4 | As duas expectativas de migration falhas foram corrigidas e reexecutadas na etapa seguinte |
| Cinco expectativas de migration corrigidas | 5 | 0 / 0 | 0 | PostgreSQL descartável |
| Administração, Receber, Prazo, perfil prod e V43 completos após ajuste de expectativas | 272 | 0 / 0 | 2 | 274 casos; inclui Flyway/Hibernate e startup local |
| Última suíte backend geral isolada em H2 | 1.457 | 0 / 0 | 583 | 2.040 casos; condicionais PostgreSQL não equivalem a aprovação em PostgreSQL |
| Última suíte frontend geral | 449 | 0 / 0 | 0 | HTTP simulado; evidência de interface |

Os grupos se sobrepõem e foram executados em momentos diferentes. Não somar essas linhas como testes únicos nem como uma suíte PostgreSQL geral final. A suíte PostgreSQL completa não foi repetida depois de todas as correções; os grupos diretamente afetados foram aprovados.

Build backend, build frontend, lint e diff check aprovados nas etapas registradas. Lint sem erros, com dois avisos preexistentes `react-hooks/incompatible-library`; build frontend com aviso de chunk acima de 500 kB. Sem repetição dessas validações nesta tarefa documental.

Recuperação: backup V43 restaurado transacionalmente; 36 tabelas, 530 constraints, 96 FKs, zero órfãos, constraints não validadas ou índices inválidos. Usuários e vínculos recuperados, sem duplicidades verificadas de CPF/login/e-mail. Flyway validate confirmou 43 migrations e zero pendentes; Hibernate validate e inicialização da aplicação `e940972` aprovados com conexões somente leitura sobre a cópia restaurada.

## C. Falhas, ignorados e fixtures

- Auditoria PostgreSQL original: 982 aprovados, 5 falhas, 27 erros e 4 ignorados. As 5 falhas e os 27 erros foram classificados e corrigidos localmente nas etapas posteriores; não são bloqueios atuais comprovados.
- Não resta fixture quebrada conhecida nos casos corrigidos. Não há uma nova execução completa que autorize afirmar zero falhas em toda a suíte PostgreSQL atual.
- Os 4 ignorados preexistentes dos grupos PostgreSQL incluem métodos herdados já desabilitados; o último recorte de 274 casos contém 2 deles. Não foram criados skips para liberar a etapa; casos ignorados não são aprovações.
- Os 583 ignorados da execução geral H2 incluem testes condicionais exclusivos de PostgreSQL; foram preservados. H2 não comprova a compatibilidade SQL específica de PostgreSQL.
- Esgotamento inicial de conexões locais: infraestrutura de testes, resolvido nos retries com cache de contextos limitado a 3; não indica falha de produção.
- Não foi comprovada nova regressão funcional nas quatro etapas. Falhas históricas continuam registradas na auditoria datada, sem serem apagadas.

## D. Fluxos essenciais com evidência positiva

No limite dos testes existentes, estão aprovados autenticação/JWT e isolamento, gestão de usuários, cadastros de Produtos/Clientes/Fornecedores, confirmação/cancelamento de Entrada, vínculo explícito Entrada–Pagar, efeitos e reversões de estoque, venda em dinheiro, PIX, cartão/recebíveis, pagamento misto, prazo, Contas a Pagar/Receber e buscas/paginação. PIX/Misto/Prazo/Receber possuem agora grupos relacionados aprovados após os ajustes de fixtures e versões. Isso comprova os cenários backend exercitados; não homologa a operação completa frontend–API–banco.

PDV: testes de interface aprovam digitação/EAN, leitor como teclado, Enter, resultado único/ambíguo, rascunho e foco. Pagamento/finalização com HTTP simulado não comprova integração real. Abertura/fechamento e Dashboard têm evidência H2; cenários PostgreSQL de concorrência operacional não substituem a conferência completa por forma.

### Produção autenticada, somente leitura

Inspeção concluída em 18/10, aproximadamente 22:46–22:54 BRT. Perfil ADMIN ativo e empresa exibida consistentes entre páginas, sem registrar identificadores pessoais. O login POST 200 abaixo foi realizado pelo usuário antes da inspeção; não houve novo login automatizado nem mutação de negócio pelo agente.

Base web: `https://novexa-erp.vercel.app`. Método/status/request ID obtidos dos logs HTTP reais da API. Os logs não contêm query strings; não representam captura integral dos parâmetros ou dos payloads.

| Tela / caminho web | Método e rota real da API | HTTP | Request ID capturado |
|---|---|---:|---|
| Login anterior do usuário | POST `/auth/login` | 200 | `a0264997-e179-40ea-83ff-81715a2d1c91` |
| Usuários `/usuarios` | GET `/usuarios/pagina` | 200 | `6d366adc-9c46-46a5-aa13-8ec26c28c1e6` |
| Produtos `/produtos` | GET `/produtos` | 200 | `d471be2e-1bed-449a-b5c2-b5e185275536` |
| Clientes `/clientes` | GET `/clientes` | 200 | `4ac1e0f4-d8bb-4a12-bff8-6cb178967ff3` |
| Fornecedores `/produtos?aba=fornecedores` | GET `/fornecedores` | 200 | `f8321120-955e-4912-ab69-31bbdd691fb8` |
| Empresas `/empresa` | GET `/empresas/pagina` | 200 | `c0721c19-08cf-4381-ab89-99a5d2fb76fa` |
| Contas e saldos `/financeiro/contas-financeiras` | GET `/financeiro/contas-financeiras/pagina` | 200 | `c5e1d0c8-9d54-48f6-a045-a16d2d67f3ae` |
| Entradas `/estoque?aba=entradas` | GET `/estoque/entradas` | 200 | `3e206e69-eeaa-497f-9307-84b6fc786b35` |
| Estoque `/estoque` | GET `/produtos` | 200 | `d5356ca0-613f-4951-bf23-c2e6100ab0c6` |
| Vendas `/vendas` | GET `/vendas` | 200 | `22ac9fc6-3db3-413c-b58c-0af5b1128d19` |
| Caixa `/financeiro/caixas` | GET `/financeiro/caixas` | 200 | `dad53b9c-be4e-452a-92e1-a45d665d5bde` |
| Dashboard `/dashboard` | GET `/dashboard/resumo` | 200 | `1f5f06ac-a6ed-4a28-b2e9-2d450fa25964` |

Todas essas telas aprovadas para as consultas observadas; nenhuma bloqueada. Console sem mensagens warn/error nos checkpoints capturados. Listagens sem busca abriram, estados vazios foram observados e filtros/ordenação exercitados conforme controles existentes. Paginação além da primeira página comprovada em Produtos, Estoque e Fornecedores; listas pequenas/vazias não comprovam páginas posteriores. Dashboard e Caixa da mesma sessão mostraram dinheiro esperado de R$ 100, sem duplicação da abertura. Nenhum abrir/fechar caixa, pagar, vender ou modificar cadastro executado.

Sessão autenticada pendente da auditoria anterior: resolvida para esta inspeção de leitura. Isolamento por outro tenant em produção: sem evidência suficiente; consistência da empresa exibida não prova resistência a token de outra empresa. Há evidência automatizada local de isolamento.

## E. Fluxos parcialmente validados

| Item | Evidência existente | Falta |
|---|---|---|
| Operação completa do PDV | Interface simulada e integrações backend locais | Frontend real + API + PostgreSQL descartável, venda e reversão com efeitos conferidos |
| Fluxo financeiro integrado | Dinheiro, PIX, cartão, misto, prazo e baixas testados no backend | Homologação operacional integrada do recorte usado no piloto, sem confundir pagamento registrado com recebimento confirmado |
| Fechamento por forma de pagamento | Conferência completa em H2 e concorrência operacional em PostgreSQL | Evidência da conferência completa com persistência PostgreSQL |
| Leitor e ergonomia real | Scanner simulado como teclado e viewports automatizados | Leitor físico e uso operacional real |
| Recuperação integral da instalação | `public` V43 restaurado e aplicação validada | Roles/grants, outros schemas, Storage, configuração de infraestrutura e recuperação na mesma versão 17.6 não exercitados |

São lacunas de validação; não foi comprovada ausência das funcionalidades centrais. Gerenciamento de Acessos por menu/ação não existe no recorte entregue e permanece futuro, sem bloquear o MVP por si só.

## Comparação dos ambientes

| Camada | Última evidência disponível | Classificação / diferença |
|---|---|---|
| Main local | HEAD `e940972`; correções de testes e documentação ainda no worktree, com alterações alheias preservadas | Corrigido localmente; trabalho não publicado não integra o commit |
| GitHub | `main=e940972`, confirmado por ls-remote na auditoria; referência local ainda igual nesta consolidação | Validado naquela captura; sem nova consulta remota nesta tarefa |
| Vercel | Deployment `2cecns7sfKqgvtLY955rLAzwonjf`, Production/Ready/Current, source `e940972` | Validado naquela captura; frontend público e consultas autenticadas posteriores funcionaram |
| VM | Checkout `9f15343`; diff de backend até `e940972` vazio, reconferido localmente para o relatório | Diferença de revisão, sem divergência funcional de backend comprovada |
| Imagem/container | Imagem sem label Git; container running/zero reinícios, também observado na verificação do backup | Container validado nas capturas; sem evidência suficiente do commit exato embutido na imagem |
| Readiness | GET `/actuator/health/readiness` HTTP 200/UP; request ID `017c6f5b-1499-4b12-9418-fa44a1caeb89`, capturado na auditoria | Confirmado naquela medição, não repetido nesta tarefa documental |
| Banco | Consulta somente leitura confirmou PostgreSQL 17.6, `public` V43, 43 migrations bem-sucedidas, nenhuma falha | Validado; nenhuma migration aplicada em produção nas quatro etapas |
| Backup | Novo custom `novexa-public-v43-20261018-230016.dump`, 223.829 bytes; JSON com data/checksum/evidências fora do Git | Compatível com V43, restaurado em PostgreSQL 18.6; backup V42 anterior preservado |

Vercel e main publicados estão alinhados nas evidências disponíveis. O checkout antigo da VM não é prova de incompatibilidade: as mudanças posteriores são de frontend. Sem label da imagem não se pode afirmar o hash exato do binário em execução. Nenhum erro HTTP capturado nas consultas autenticadas; isso não prova os contratos mutáveis completos.

## F. Bloqueios reais para encerramento do piloto

1. Sem evidência suficiente de homologação operacional ponta a ponta do núcleo venda–pagamento–estoque–caixa/financeiro em ambiente seguro.
2. Conferência completa de fechamento por forma ainda sem comprovação específica em PostgreSQL.
3. Elegibilidade fiscal do piloto depende do uso pretendido: emissão fiscal não deve ser presumida disponível. A decisão é necessária se o piloto exigir essa emissão.

Não permanecem como bloqueios comprovados: as fixtures corrigidas, as cinco expectativas antigas, sessão ADMIN para consultas, incompatibilidade do backup com V43 ou readiness da medição registrada. Não há falha de integração conhecida sem classificação; há dimensões sem evidência suficiente.

## G. Riscos de produção

- Prontidão operacional não demonstrada por leitura: o snapshot restaurado tinha zero configurações de formas de pagamento por empresa, contas bancárias e contas financeiras. Isso não é prova de bug, mas não autoriza afirmar que os meios de pagamento estão preparados para uso no piloto.
- Imagem sem revisão Git verificável e checkout da VM anterior ao frontend dificultam rastrear a versão efetiva, mesmo com ausência de diff funcional de backend comprovada.
- Backup cobre somente `public` e o instante da captura; não é PITR nem recuperação completa do Supabase/Storage. Restauração 17.6 → 18.6 aprovada não certifica restauração em 17.6. Nenhum rollback em produção foi realizado.
- Banco local restaurado removido, instância encerrada e porta fechada; arquivos temporários dos clusters parados continuam em `Temp/novexa-recovery-20261018`. Exclusão recursiva rejeitada pela revisão automática com motivo `blocked by policy`; remoção física permanece pendente.
- Publicar o worktree inteiro incluiria alterações não relacionadas. Correções locais precisam de revisão seletiva antes de qualquer publicação autorizada.
- Estado de disponibilidade e backup é pontual; não foi executado teste de carga, de desastre completo ou de operação contínua.

## H. Próximos passos obrigatórios

1. Homologar o núcleo operacional com frontend real e PostgreSQL descartável, usando os testes existentes e o recorte de pagamentos do piloto. Conferir persistência, confirmação, cancelamento/reversão e ausência de efeitos antecipados. Não criar dados de produção para preencher essa lacuna.
2. Completar a evidência PostgreSQL da conferência de fechamento por forma. Isso é validação essencial financeira, não uma exigência de cobertura completa de todo o produto.
3. Definir o recorte fiscal e conferir a configuração operacional mínima do piloto antes de uso real. Decisões ou configuração não foram executadas nesta consolidação.
4. Remover manualmente os arquivos temporários bloqueados e manter backup/metadados protegidos fora do Git. Planejar recuperação da infraestrutura/Storage conforme necessidade do piloto, sem restaurar em produção como teste.
5. Quando houver autorização própria, revisar e publicar somente correções de testes/documentação da tarefa, preservando os demais diffs. Nesta entrega não houve publicação.

Suíte PostgreSQL geral após todas as correções pode consolidar a evidência global; não foi executada nem contada como aprovada aqui. Não se exige criar cenários novos de outros domínios ou repetir Guardian Review para encerrar esta documentação.

## I. Melhorias futuras

Gerenciamento de Acessos granular, otimização medida do bundle, metadado de revisão na imagem, revisão pontual de mensagens de erro versus vazio em Produtos, ergonomia com leitor físico e reconciliação de trechos históricos do roadmap. Recursos fiscais, TEF, conciliação e offline continuam sujeitos ao escopo e decisões de produto; não são autorização para implementação.

## J. Liberação

**Não apto para considerar aprovada a homologação integral do piloto. CONTRACT READY global permanece pendente.** Correções de testes, leitura autenticada e recuperação V43 estão comprovadas; a pendência atual é de validação integrada operacional/financeira e do fechamento completo em PostgreSQL, além da decisão fiscal quando aplicável. Não há fundamento para declarar toda a produção defeituosa, nem para declarar todo o MVP liberado.

Somente este relatório, o resumo do CURRENT_STATE e a referência no roadmap foram alterados nesta consolidação. Auditorias históricas, código, testes, dados, migrations e configurações preservados. Sem commit, push ou deploy.

## Complemento — homologação local somente leitura (2026-10-19)

Este complemento preserva a consolidação histórica de 18/10 acima. Base local `main/e940972`, com alterações anteriores do worktree preservadas. Consultas exclusivamente em `localhost:5432/novexa_erp`, PostgreSQL 18.6, schema V43, com `default_transaction_read_only=on` e transações `READ ONLY`. Sem acesso à VM, Supabase ou produção, novas operações de venda/pagamento, importação, alteração de dados, migration, commit, push ou deploy. Não foram expostos CPF, login, e-mail, credenciais ou conteúdo de tokens.

### Evidência e limite temporal

Encontrados 1 empresa, 3 usuários, 44 produtos, 41 vendas, 45 itens, 41 pagamentos, 52 movimentos de estoque, 44 movimentos de Caixa, 1 movimento financeiro, 0 recebíveis, 0 Contas a Receber e 5 conferências de fechamento. A última venda é a 57, de **06/10/2026**, anterior à preparação local de 19/10. A sessão 17 está aberta, com saldo inicial de R$ 100 e nenhuma venda. Não foi identificada uma venda nova que comprove o roteiro atual de homologação.

O ADMIN 1 ativo pertence à empresa 1 ativa e é o usuário dos registros históricos abaixo. Isso não comprova login ou isolamento via JWT no navegador nesta etapa. Na preparação anterior, os produtos 8 (P004/EAN 7891000000042, UN, R$ 3,00, estoque 20) e 19 (P015/EAN 7891000000158, UN, R$ 2,00, estoque 31) foram selecionados para reutilização; não houve inclusão no PDV ou finalização comprovada. A origem desses produtos na planilha Mustache não foi comprovada; nenhuma planilha foi necessária ou acessada.

### Conferência dos registros existentes

Classificações dizem respeito à evidência e ao limite indicado, sem converter histórico em homologação da versão atual.

| Item | Classificação | Evidência local |
|---|---|---|
| Usuário e empresa vinculados | Aprovado com ressalva | ADMIN 1 e empresa 1 ativos; vendas, sessão, produto e movimento pertencem à mesma empresa. Login atual e teste adversarial de JWT não realizados nesta conferência |
| Produto, código interno e EAN | Aprovado | Produto 14, Barra de Cereal 25g, UN, código P010, EAN 7891000000103, ativo; código/EAN únicos na empresa |
| Venda e itens em dinheiro | Aprovado com ressalva | Venda histórica 53 FATURADA, item 74, 1 UN × R$ 3,50 = R$ 3,50; desconto/troco zero. Subtotal, total e pagamento conferem; não é uma venda nova |
| Estoque antes/depois do dinheiro | Aprovado | Movimento persistido 78, SAIDA/VENDA: 25 → 24, quantidade 1, vinculado ao item 74 |
| Pagamento e movimento de Caixa | Aprovado com ressalva | Pagamento 37 DINHEIRO, R$ 3,50; exatamente um movimento VENDA, ID 56, sessão 15. Nenhum movimento bancário, recebível ou Conta a Receber dessa venda |
| Venda e itens PIX | Aprovado com ressalva | Venda histórica 57 FATURADA, item 78, produto 14, 2 UN × R$ 3,50 = R$ 7,00; pagamento 41 REGISTRADO, configuração PIX 1 e destino bancário 1 |
| Estoque antes/depois do PIX | Aprovado | Movimento 82, SAIDA/VENDA: 6 → 4, quantidade 2; estoque atual do produto 14 igual a 4. Cadeia 25 → 24 → 22 → 16 → 6 → 4 dos movimentos 78–82 coerente |
| PIX pendente separado de dinheiro confirmado | Aprovado com ressalva | Pagamento 41 sem movimento de Caixa e sem movimento financeiro de confirmação; registro/fechamento não creditou banco. Não comprova confirmação posterior |
| Confirmação PIX e transferência bancária | Não testado | Nenhuma execução operacional atual identificada; não repetir nem criar operações para preencher a lacuna nesta tarefa |
| Cartão e recebível atual | Não testado | Venda histórica 55 de 30/09, R$ 21,00, sem efeito de Caixa/banco e sem recebível. V29 foi aplicada localmente em 01/10; esse legado não comprova nem reprova geração atual de recebível, nem autoriza backfill |
| Boleto e geração de Conta a Receber | Não testado | Nenhum registro local correspondente; não presumir oferta operacional de boleto. Prazo já testado no backend é um contrato distinto |
| Lançamento financeiro correspondente | Aprovado com ressalva | Fontes atuais são Pagamento/MovimentacaoCaixa/MovimentacaoFinanceira/Recebivel, conforme o meio. Há 40 lançamentos legados; venda 53 tem um, venda 57 não tem. Ausência de novo LancamentoFinanceiro não é erro: domínio legado read-only, fora da fonte de saldo atual |
| Saldo bancário | Aprovado | Conta financeira 1 BANCO: saldo inicial/atual R$ 1.000, um único movimento ENTRADA/SALDO_INICIAL de R$ 1.000, nenhum PIX creditado; não somar abertura duas vezes |
| Saldo físico do Caixa | Aprovado | Sessão 15: R$ 100 iniciais + R$ 3,50 em dinheiro = R$ 103,50 finais. Sessão 16: R$ 100 iniciais = finais. Sessão 17: esperado R$ 100, ainda aberta. Evento SUPRIMENTO de abertura excluído do acréscimo, conforme regra atual |
| Fechamento por forma já realizado | Aprovado com ressalva | Sessão 15 POR_FORMA: dinheiro R$ 103,50, PIX R$ 42, débito R$ 21; sessão 16: dinheiro R$ 100 e PIX R$ 7. Cinco valores informados iguais aos esperados; totais por forma reconciliados com pagamentos. Evidência de persistência histórica PostgreSQL, não de execução atual do fechamento |
| Ausência de duplicidade operacional | Aprovado com ressalva | Zero grupos repetidos de chave de venda por empresa, sequência de pagamento por venda, movimento de estoque reutilizado por item, movimento VENDA de Caixa por pagamento e movimento financeiro por pagamento. Códigos/EAN dos produtos 8/14/19 únicos. Dois grupos de produtos potencialmente equivalentes, já identificados na preparação, impedem afirmar catálogo inteiro sem duplicidade |
| Consistência dos vínculos | Aprovado com ressalva | Zero divergências empresariais no recorte das vendas 53/55/57, itens, produtos, movimentos e sessões. Preparação anterior verificou 96 FKs sem órfãos; leitura não substitui teste de acesso com JWT de outra empresa |
| PDV atual, autenticação válida, reversão e operação integrada | Não testado | Nenhuma nova execução frontend → API → PostgreSQL identificada nesta homologação; browser local anterior aguardava login. Não atribuir ao teste atual vendas antigas nem simulações HTTP |

Não houve item classificado como Reprovado por defeito funcional atual comprovado. Ressalvas e itens Não testados não constituem aprovação integral.

### Testes já executados, sem repetição

- Preparação do ambiente local de 18–19/10: 89 testes backend relacionados; suíte geral H2 com **1.459 aprovados, zero falhas/erros e 583 ignorados** condicionais/preexistentes; 4 testes frontend de login e 2 testes de configuração local aprovados. Grupos sobrepostos não devem ser somados.
- Builds backend/frontend, lint e diff check aprovados na preparação. Mantidos os dois avisos preexistentes de React Hook Form e o aviso de bundle. Readiness local HTTP 200/UP, frontend HTTP 200 e consulta protegida sem token HTTP 401 capturados anteriormente; não foram repetidos para este complemento e não comprovam login válido.
- Integrações PostgreSQL e frontend geral históricas permanecem descritas em B/C acima, com seus limites. Testes com HTTP simulado não comprovam o fluxo integrado; testes PostgreSQL condicionais ignorados na suíte H2 não contam como aprovados em PostgreSQL.
- Nesta execução: somente consultas de leitura, revisão documental e `git diff --check`; sem novos testes mutáveis ou builds.

### Conclusão local e próximo passo

**MVP ainda não liberado como homologado integralmente para o piloto; CONTRACT READY global pendente.** A consistência dos registros históricos e a configuração local permitem avançar para validação integrada controlada, mas não substituem a execução autenticada da versão atual. O fechamento histórico agora possui evidência PostgreSQL; falta comprovar o fluxo atual pela aplicação, não recriar os fechamentos existentes.

Próximo passo: **nova validação local autorizada e delimitada**, com credenciais fornecidas pelo usuário diretamente na interface, reutilizando cadastros disponíveis e registrando os IDs da operação exercitada. Cobrir somente meios do recorte do piloto, respectivos efeitos/reversões e fechamento atual. Confirmar o recorte fiscal se exigido. Não há falha nova comprovada que justifique correção agora, nem evidência para substituir essa etapa por publicação.

Roadmap sem mudança de etapa. Atualizados somente CURRENT_STATE e este complemento; alterações anteriores preservadas. Nenhum dado local ou de produção alterado, nenhum registro criado, nenhum commit, push ou deploy.

## Homologação manual posterior e gate de publicação (2026-10-19)

Posteriormente ao complemento anterior, o usuário confirmou o fluxo principal homologado localmente: login, busca por código interno/EAN, venda finalizada e efeitos conferidos. Leitura posterior do PostgreSQL local comprovou a venda **58**, de 19/10 às 10:50, FATURADA, empresa 1/usuário ADMIN 1/sessão 17: item 79, produto 14, 1 × R$ 3,50, total/recebido R$ 3,50 e troco zero. Movimento de estoque **83**, SAIDA/VENDA, de 4 para 3; pagamento **42** DINHEIRO; exatamente um movimento de Caixa **59**, VENDA de R$ 3,50; nenhum movimento bancário do pagamento. A execução manual foi do usuário; o agente não repetiu a operação. Não foram capturados HTTP/request IDs dessa venda nem novamente exercitados os meios financeiros não usados.

| Gate anterior ao commit | Resultado |
|---|---|
| Backend H2/configuração: perfil local/prod, fixture de paginação, dinheiro, cancelamento e guarda de valor PIX | 34 aprovados, zero falhas/erros/ignorados |
| PostgreSQL 18 descartável, porta 15439, banco separado da homologação | 10 aprovados, zero falhas/erros/ignorados; Flyway V1–V43, Hibernate validate, startup prod, probes/CORS/401, cinco expectativas de versão e CHECK de valor PIX |
| Frontend: login, PDV/buscas, Empresas e sidebar | 114 aprovados, zero falhas/ignorados, com HTTP simulado |
| Build backend após os testes e build frontend | Aprovados |
| Lint e diff check | Sem erros; dois avisos anteriores de React Hook Form e avisos de bundle/npm permanecem |
| Backup existente V43 | 223.829 bytes; SHA-256 confere com metadados; restauração, Flyway e Hibernate anteriormente aprovados |

Os testes PostgreSQL usaram instância local descartável, sem apontar para `novexa_erp` ou produção. Nenhum teste novo, migration, alteração de contrato ou regra de Caixa/pagamento/estoque. Não executado roteiro adversarial multiempresa nesta etapa; os resultados históricos de isolamento acima permanecem com seus próprios limites. Suíte completa não repetida. Avisos existentes de suporte Flyway/PostgreSQL 18 e de instrumentação Mockito não representam falha nos cenários aprovados.

O fluxo local em dinheiro passa a **Aprovado com ressalva**: operação confirmada pelo usuário e persistência real conferida; sem nova captura automatizada do navegador nessa venda. A pendência anterior de inexistência de uma venda atual foi resolvida para esse recorte. PIX confirmado, cartão/liquidação, boleto, fechamento operacional atual e demais dimensões continuam com as classificações anteriores; não extrapolar a liberação de dinheiro para todos os meios. Publicação autorizada do recorte validado; não constitui declaração de CONTRACT READY global ou homologação integral de todos os fluxos financeiros.

Somente configuração local não sensível, fixtures relacionadas e documentação necessária selecionadas para publicação. AGENTS, lockfile, referências, vídeos, capturas, secrets, dumps, exclusão local do exemplo e auditoria de buscas independente ficam preservados fora do commit. GitHub/Vercel/VM e smoke de produção serão conferidos depois do push; não há resultado de deploy presumido neste registro pré-publicação.
