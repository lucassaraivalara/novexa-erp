# Central de Vendas — diagnóstico temporal em produção, 2026-10-21

## Estado confirmado

- `main`, `origin/main` e checkout Oracle: `f9e73e402be7dbb1f5c2d98f5186fb99d1791fa0`, descendente de `fe1e606`.
- GitHub registra deployment Vercel **Production / success** para esse commit. Alias público retorna HTTP 200 e entrega `/assets/index-DaZT3Jj6.js`, contendo `America/Sao_Paulo`. A inspeção autenticada da página Vercel não foi concluída por indisponibilidade do controle da aba; não foi capturado o rótulo Ready nessa interface.
- Container `novexa-api`: imagem `sha256:c659c1f05a20472785d4273db9252dcae8e58c5cbcc2d6dfadea742f6b210deb`, iniciado às `2026-10-21T15:06:54.148619832Z`, zero reinícios. Startup completo às `12:07:21` de Brasília.
- Logs reais: `Horário oficial Novexa: America/Sao_Paulo; zona JVM: America/Sao_Paulo`; schema public V50; JPA inicializado. Variáveis TZ e opção JVM correspondem à zona oficial, sem alteração de configuração.
- SHA-256 das classes em execução e do JAR local validado são iguais: `TempoNovexa.class` = `da96346423922fea4aa4259d915aeffbd0df0509f567951ab7937c5cfc5b3389`; `VendaEntity.class` = `98b1b50ebbddc1796657e49d004cb47ba867652abb7f2c20e2534d133c0d0747`. A verificação leu o JAR do container em memória, sem substituir arquivos.
- Health interno e público capturados com HTTP 200 e `{"status":"UP","groups":["liveness","readiness"]}`. Request ID público: `80ae068c-74a2-47ca-8121-f1542a531149`.

## Caminho observado

Consulta ao banco `postgres`, schema `public`, empresa 1 identificada inequivocamente como a empresa ativa exibida na sessão do frontend. Consultas SELECT; segunda conferência executada em `BEGIN READ ONLY` e encerrada com ROLLBACK, confirmando `transaction_read_only=on`. Credenciais usadas somente em memória, sem exibição ou gravação.

| Camada | Evidência real |
|---|---|
| Banco | `vendas.id=130`: `data_hora=2026-10-21T14:03:07.540712`; primeiro Pagamento `2026-10-21T14:03:07.755344`. Tipo PostgreSQL `timestamp without time zone`. |
| Horário independente | `now() AT TIME ZONE 'America/Sao_Paulo'` retornou `2026-10-21T12:37:55.413543` na conferência. A hora da venda está adiantada em relação ao momento da consulta. |
| API/serialização | Código em execução confirmado: `VendaResponseDTO`/`VendaResumoDTO` passam `LocalDateTime` diretamente, sem conversão; novo relógio explícito em `VendaEntity`. **Corpo JSON autenticado da requisição não foi capturado nesta execução**; não apresentar inferência do código como captura HTTP. |
| Frontend | Sessão existente mostra a venda #130 na lista e no detalhe como `21/10/2026, 14:03`, o mesmo horário civil do banco. O formato não aplica outra subtração/conversão ao valor observado. |
| Dados novos | Não há nova venda identificada após o último deploy: ID máximo 130; 61 FATURADA e uma CANCELADA, nenhuma ABERTA. Logs atuais, desde o startup, não contêm POST de criação/faturamento em `/vendas`. |

O desvio observado já existe no valor armazenado da venda #130; não foi comprovado erro adicional da formatação atual. Isso **não comprova** que uma venda nova em produção esteja correta. Foi solicitada ao usuário uma venda normal posterior às 12:07 com ID e horário real para completar a prova banco → JSON → tela. Não foi criada venda fictícia, rascunho ou operação financeira.

## Histórico

Investigação aprofundada e correção histórica permanecem pendentes da validação de registro novo. Inventário consultado: 62 vendas, de `2026-10-19T16:26:03.050318` a `2026-10-21T14:03:07.540712`, incluindo uma cancelada. **Esse intervalo não é uma faixa de erro comprovada**, nem demonstra que todos tenham +3h. Há indício diretamente observado na venda #130 e em seu pagamento; faltam referências independentes de horário por registro para definir primeira/última ocorrência afetada, quantidade exata, outras tabelas e mistura de registros corretos/incorretos. Nenhum UPDATE histórico foi preparado ou executado.

## Testes e limites

Execução direcionada no baseline `f9e73e4`: oito testes de data/hora aprovados (sem offset/com offset, UTC/Los Angeles/Tóquio/Brasília, virada do dia e parâmetros de filtro), mais detalhe da Central e contrato de filtros aprovados. Um teste adicional de layout real não passou ao aguardar o nome do cliente visível; falha envolve a apresentação responsiva no baseline, não foi atribuída ao fuso nem corrigida nesta tarefa. Sem suíte completa ou alteração funcional para fazer testes passarem.

Não há correção nova comprovada a publicar. Não houve alteração de código, migrations, configuração remota ou dados; nenhum commit/push/deploy realizado nesta investigação. Não declarar resolução definitiva enquanto faltar a prova com uma venda nova e a captura do JSON autenticado.
