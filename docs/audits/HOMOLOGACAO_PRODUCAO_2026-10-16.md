# Homologação de produção e inspeção pré-limpeza — 2026-10-16

Continuação da [avaliação do MVP](MVP_AVALIACAO_2026-10-16.md). Referência de código local: `main`/`a9164aa`; não foi possível conferir o commit da imagem Java implantada na Oracle. Frontend acessado: `https://novexa-erp.vercel.app`.

**Resultado: homologação geral pendente.** As onze telas solicitadas foram acessadas com sessão autenticada, sem salvar cadastros, confirmar Entrada, movimentar estoque/caixa, faturar venda ou registrar baixa. Foi encontrada divergência funcional no resumo de dinheiro esperado do Dashboard. Inspeção do banco e verificação de backup bloqueadas por falta de acesso administrativo identificado. Nenhum dado apagado.

## Identificação e limites da evidência

- Usuário exibido: `a**`; empresa exibida: `E****** T****`. As telas mantiveram a mesma identificação. Esses são nomes apresentados pela sessão, **não uma identificação pelo CPF solicitado**.
- CPF alvo registrado apenas de forma mascarada: `***.***.**6-63`. Não foi consultado no banco; não há confirmação inequívoca do usuário, empresa ou IDs a preservar. Não assumir que o nome mostrado no frontend comprova o vínculo.
- O navegador disponível permite DOM, captura visual e console, mas não oferece captura Network/headers ou envio direto de requisição autenticada. **Os status HTTP e X-Request-ID das chamadas autenticadas não foram capturados.** Não inferidos como 200 a partir da tela. Nenhum X-Request-ID foi apresentado nas telas visitadas.
- As leituras de console disponíveis retornaram listas vazias para erros/avisos nas consultas conferidas. Isso descreve o console capturado pela ferramenta, não uma auditoria de todas as respostas HTTP.
- Conferência desktop: largura efetiva de 1920 px, sem overflow horizontal do documento nas consultas medidas. Tentativa adicional de viewport móvel não se aplicou à aba do Novexa (DOM permaneceu em 1920 px); não contabilizada como aprovação mobile. Ao final houve interrupção do controle do navegador; a remoção do override temporário também não pôde ser confirmada. Não houve alteração de tema ou preferência persistida.
- A abertura por teclado de Financeiro com seta direita focou Caixas. A conferência posterior de Escape/retorno de foco foi interrompida e não é contabilizada como aprovação.

## Resultados por tela

HTTP da API e X-Request-ID: **não capturados em todas as linhas abaixo**. Nenhum erro/aviso foi retornado pelo console capturado durante as consultas. Aprovação de leitura da interface não significa aprovação das mutações financeiras ou do fluxo completo.

| Tela | Resultado observado em produção | Classificação / conclusão |
|---|---|---|
| Dashboard | Resumo renderizado; zero vendas faturadas hoje, zero clientes ativos e uma sessão aberta. Dinheiro esperado mostrado como R$ 200,00. | **Bug funcional:** difere dos R$ 100,00 da tela da mesma sessão de Caixa. Demais indicadores apenas conferidos visualmente. |
| Produtos | Consulta concluída sem alerta, paginação `0–0 de 0` no filtro inicial de ativos. Formulário Novo produto abriu com identificação, preços e estoque; cancelado sem enviar cadastro. | **Aprovado para consulta/abertura do formulário.** Cadastro, relatório e operação com produto real não homologados nesta rodada. |
| Contas e saldos sem busca | Campo de busca vazio; resumo zerado e lista `0–0 de 0`, sem mensagem de erro. | **Aprovado para leitura da interface sem busca.** Erro anterior não reproduzido visualmente; status/payload HTTP e versão Java ainda não conferidos. |
| Clientes | Listagem concluída, sem alerta, `0–0 de 0` no filtro inicial de ativos. | **Aprovado para consulta.** Sem cadastro/edição ou validação com outro tenant. |
| Fornecedores | Aba correta em `/produtos?aba=fornecedores`, `0–0 de 0`, estado vazio com acesso a cadastro, sem alerta. | **Aprovado para consulta e navegação.** Filtros vigentes não equivalem a inventário completo do banco. |
| Entrada de mercadoria | Consulta `0–0 de 0`; Entrada manual abriu. Links de Produtos/Fornecedores possuem `target="_blank"`; retorno à lista sem salvar. | **Aprovado para consulta/formulário/retorno.** Confirmação, cancelamento, obrigação financeira e XML não executados em produção nesta rodada. |
| Estoque | Aba Saldo, tabela e paginação `0–0 de 0`, sem alerta após carregamento. | **Aprovado para consulta.** Sem produto para consultar histórico ou homologar movimentação. |
| PDV | Acesso por Vender preserva `/pdv`, shell operacional e seleção automática da sessão existente. Busca de termo de homologação retornou “Nenhum produto encontrado para esta busca”; termo limpo. Venda permaneceu com zero itens e finalização bloqueada. | **Pendência de configuração/dados:** sem produtos e sem formas configuradas, não há homologação de venda comum. Não foi enviada venda. |
| Central de Vendas | Identificação/data/cliente/total/status e filtros renderizados; `0–0 de 0` no filtro inicial Faturada. | **Aprovado para consulta.** Sem venda para validar detalhe, cancelamento ou links financeiros nesta rodada. |
| Caixa | Uma sessão aberta, dinheiro esperado R$ 100,00, saldo inicial R$ 100,00 e suprimentos operacionais zerados. Timeline apresenta um registro de suprimento de abertura. Histórico de sessões sem encerradas. Ações de fechar, suprimento e sangria visíveis; cadastro secundário. | **Aprovado para apresentação da sessão/histórico; divergência com Dashboard registrada.** Nenhuma abertura, movimentação ou fechamento executado. |
| Contas a Pagar | Consulta `0–0 de 0`, sem alerta. Nova conta abriu com descrição, vencimento, valor, fornecedor e dados opcionais; cancelada sem salvar. | **Aprovado para consulta/formulário.** Nenhum pagamento, cancelamento ou estorno executado. |
| Contas a Receber | Consulta `0–0 de 0`, colunas de vencimento/saldo/status e atualização disponíveis, sem alerta após carregamento. | **Aprovado para consulta.** Nenhuma criação, baixa ou estorno executado. |

Também consultada Formas de pagamento para investigar as opções do PDV: zero configurações, estado “Nenhuma configuração encontrada”, sem alerta. O seletor do PDV apresentava apenas a opção sistêmica A prazo. Não se trata de comprovação de falha HTTP ou de permissão; é ausência de configuração observada no tenant da sessão.

## Bug funcional encontrado: dinheiro esperado divergente

Evidência: o Dashboard apresenta R$ 200,00 para a sessão aberta; a tela Caixas apresenta R$ 100,00 para a mesma sessão e usuário. Não houve mutação realizada pelo agente entre as consultas. A tela operacional separa saldo inicial e suprimentos, enquanto a timeline mostra a abertura como evento.

O código atual explica a diferença:

- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/SessaoCaixaService.java:45`: abertura positiva registra evento de saldo inicial.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/CaixaOperacionalService.java:132`: `registrarSaldoInicial` grava SUPRIMENTO identificado como abertura.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/CaixaOperacionalService.java:219`: resumo operacional desconsidera esse evento na soma de suprimentos e acrescenta saldo inicial uma única vez.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/service/DashboardService.java:56` e `:69`: inclui SUPRIMENTO na agregação e acrescenta saldo inicial novamente.
- `backend/novexa-api/src/main/java/br/com/novexa/erp/repository/MovimentacaoCaixaRepository.java:24`: agregação não distingue o suprimento de abertura dos manuais.

Classificação: **bug funcional de consulta**, com risco de apresentar informação gerencial incorreta. Não há evidência nesta inspeção de alteração de dinheiro, saldo persistido, pagamento ou estoque. A correspondência exata com a imagem implantada ainda exige logs/versão da API, mas a divergência visual e o defeito no código local foram comprovados. Correção pendente de tarefa autorizada; nenhum código alterado.

## Contagens observadas: interface, não inventário SQL

| Domínio/consulta | Contagem exibida |
|---|---:|
| Produtos — ativos | 0 |
| Clientes — ativos | 0 |
| Fornecedores — filtro inicial | 0 |
| Entradas — filtros iniciais | 0 |
| Estoque — filtros iniciais | 0 |
| Vendas — Faturada | 0 |
| Contas e saldos — sem busca | 0 |
| Contas a Pagar — filtros iniciais | 0 |
| Contas a Receber — filtros iniciais | 0 |
| Sessões abertas | 1 |
| Sessões encerradas no histórico consultado | 0 |
| Eventos na timeline da sessão aberta | 1 |
| Configurações de formas de pagamento | 0 |

Não há contagens de todos os usuários, empresas, inativos, pagamentos, recebíveis, históricos ou registros dependentes. **Não usar esta tabela para comprovar que o banco está vazio ou definir exclusão.**

## Inspeção da VM/banco: bloqueada antes da conexão

Verificações realizadas sem abrir valores de credenciais:

- `~/.ssh` contém somente `known_hosts` e `known_hosts.old`; não há `config`/alias ou chave nessa pasta. Metadados conferidos com acesso de leitura autorizado, sem ler chaves privadas.
- `ssh-add -l` informou ausência de agente disponível. A presença de `ssh.exe` e `psql.exe` locais não fornece autenticação na VM ou no banco.
- A aba Oracle disponível está na tela de Acesso à Conta do Oracle Cloud, com campos de usuário/senha; não há console de VM autenticado acessível por essa sessão.
- Solicitado usuário/host e caminho de chave já existente, ou terminal autenticado. Não solicitados senha, conteúdo de chave, token ou dump; nenhuma tentativa com usuário/host presumidos.

Consequências:

| Verificação obrigatória | Resultado |
|---|---|
| Banco/schema usados pela API | Não identificados na instância; arquitetura documentada prevê Supabase, sem comprovação do datasource atual. |
| Usuário do CPF alvo e empresa associada | Não identificados inequivocamente no banco; inspeção interrompida. |
| Inventário/contagens SQL por domínio | Não executado. |
| Foreign keys do schema real | Não consultadas; migrations locais não comprovam o schema em produção. |
| Backup recente e verificável | Não foi possível consultar existência, data, integridade ou restauração; não afirmar que exista ou que esteja ausente. |
| Método de backup disponível | Não confirmado na VM/provedor. `pg_dump`/`pg_restore` em ambiente isolado é uma possibilidade técnica a verificar, não um backup realizado/disponibilidade comprovada. |

Não foram executados testes/build/lint novamente, acesso ao banco, backup, DELETE, TRUNCATE, alteração de sequência, migration, mudança de configuração, commit, push ou deploy. Somente documentação da inspeção foi atualizada; `git diff --check` executado.

## Bloqueios restantes

1. Corrigir a divergência Dashboard/Caixa em tarefa autorizada e validar a mesma sessão nos dois resumos, sem alterar movimentos financeiros.
2. Completar o fluxo principal com dados/configurações autorizados: catálogo e formas indisponíveis impediram a venda comum. Consultas vazias não homologam confirmação/cancelamento de Entrada, faturamento/baixa de estoque, pagamento ou fechamento.
3. Capturar status/payload/X-Request-ID das requisições autenticadas por ferramenta de Network ou logs administrativos seguros; não coletar tokens para contornar a limitação.
4. Disponibilizar acesso administrativo existente para inspeção somente leitura. Confirmar usuário/empresa, schema, contagens e FKs reais.
5. Verificar backup recente e restauração comprovada antes de planejar qualquer limpeza. Nesta etapa o usuário autorizou apenas inspeção: **nenhuma exclusão será executada**.
