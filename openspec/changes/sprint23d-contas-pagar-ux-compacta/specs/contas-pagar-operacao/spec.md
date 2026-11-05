# Spec Delta

## Purpose

Permitir ao pequeno lojista consultar obrigações, compreender valores e executar pagamentos pela tela compacta de Contas a Pagar, preservando os contratos financeiros existentes.

## ADDED Requirements

### Requirement: Leitura dos valores da obrigação
A tela SHALL distinguir Descrição, Valor original, Desembolsado e Saldo pendente, destacando o saldo exigível sem confundir desembolso com principal amortizado.

#### Scenario: Obrigação parcialmente paga com encargos
- **WHEN** uma obrigação de R$ 1.245,87 possui principal amortizado de R$ 500,00 e desembolso vigente de R$ 510,00
- **THEN** a listagem mostra original R$ 1.245,87, desembolsado R$ 510,00 e saldo pendente R$ 745,87, com situação parcialmente paga
- **AND** se vencida, mantém indicação de atraso enquanto houver saldo pendente

### Requirement: Filtros progressivos
A tela SHALL manter busca, situação e intervalo de vencimento acessíveis, disponibilizando fornecedor, categoria e emissão em Mais filtros, sem descartar filtros ativos ao recolher o painel.

#### Scenario: Recolher filtros preenchidos
- **WHEN** o usuário aplica fornecedor e recolhe Mais filtros
- **THEN** a consulta mantém o fornecedor e sinaliza a existência de filtros adicionais ativos
- **AND** Limpar filtros remove todos os critérios e retorna à primeira página

### Requirement: Abrangência dos cinco indicadores
A tela SHALL preservar cinco indicadores globais da empresa autenticada, independentes dos filtros da tabela: Vencidas, A vencer em 7 dias, A vencer em 30 dias, Total em aberto e Pago neste mês. SHALL explicar que 7/30 dias são cumulativos e incluem hoje conforme contrato existente.

#### Scenario: Filtrar a tabela
- **WHEN** o usuário filtra a listagem por fornecedor
- **THEN** os indicadores continuam globais e essa abrangência permanece identificável
- **AND** a ajuda dos intervalos esclarece que a faixa de 30 dias contém a de 7 dias, sem somá-las

### Requirement: Estados confiáveis dos indicadores
Indicadores SHALL distinguir carregamento, resposta válida com zero, ausência de movimento e erro. Uma falha SHALL oferecer recuperação sem apresentar zero como resultado confirmado; eventual valor anterior SHALL ser identificado como desatualizado.

#### Scenario: Carregamento e consulta sem movimento
- **WHEN** a consulta está pendente e depois responde com totais e quantidades zerados
- **THEN** a interface primeiro apresenta carregamento e somente após sucesso exibe zero com mensagem de ausência de movimento

#### Scenario: Falha de consulta
- **WHEN** a consulta dos indicadores falha
- **THEN** a interface informa a falha e oferece tentar novamente, sem mascarar o resultado como ausência de contas
- **AND** falhas de consultas auxiliares não invalidam um resumo recebido com sucesso

### Requirement: Pagamento evidente e compatível
A tela SHALL oferecer ação textual Pagar para obrigações elegíveis, manter quitação integral como padrão e pagamento parcial explícito, preservando encargos, múltiplas origens, proteção de duplo envio e recuperação idempotente existentes.

#### Scenario: Pagar saldo de uma obrigação parcial
- **WHEN** o usuário aciona Pagar numa obrigação parcialmente paga
- **THEN** o formulário abre com quitação integral do residual como padrão e permite escolher pagamento parcial
- **AND** distingue principal a amortizar, desembolso e saldo restante, sem modificar a fórmula financeira existente

### Requirement: Detalhe e histórico por baixa
O painel lateral SHALL apresentar resumo legível da obrigação e histórico paginado por baixa, com principal, encargos, desconto, desembolso, origens, movimentos, responsável e situação disponíveis conforme o contrato. Dados legados ausentes SHALL ser identificados sem reconstrução fictícia.

#### Scenario: Duas baixas com várias origens
- **WHEN** o usuário consulta uma obrigação com duas baixas e três movimentos
- **THEN** o painel apresenta duas operações, cada qual com suas origens, e distingue principal já quitado de desembolso e residual
- **AND** pagamentos antigos continuam acessíveis pelas informações efetivamente disponíveis

### Requirement: Seleção explícita para estorno
Toda ação de estorno agrupado SHALL levar à escolha explícita da baixa no histórico, inclusive quando só houver uma. Antes da confirmação, SHALL identificar baixa, principal e desembolso a reverter e exigir motivo, mantendo autorização e regras existentes.

#### Scenario: Estornar baixa anterior
- **WHEN** um usuário autorizado seleciona a primeira de duas baixas e confirma o motivo
- **THEN** a solicitação identifica somente a baixa escolhida, sem selecionar automaticamente o pagamento atual
- **AND** após sucesso a interface atualiza status, residual, histórico e indicadores, preservando a outra baixa

### Requirement: Experiência compacta e eficiente
A tela SHALL preservar indicadores, tabela e painel lateral, identidade Novexa, navegação por teclado e controles rotulados. SHALL manter filtros/rolagem utilizáveis em desktop e mobile, paginação, carregamento lazy e descarte de respostas obsoletas, sem polling ou consultas por linha.

#### Scenario: Consulta em desktop e mobile
- **WHEN** a experiência é conferida em 1366×768 e 390×844
- **THEN** valores e ações essenciais ficam legíveis e acessíveis, sem sobreposição nem overflow da página; eventual rolagem da tabela fica contida
- **AND** o Product Owner valida densidade, hierarquia de valores e localização de filtros, Pagar e histórico

#### Scenario: Alteração rápida de filtros
- **WHEN** o usuário troca filtros antes da resposta anterior
- **THEN** somente a resposta correspondente à consulta atual atualiza a tabela, sem duplicação involuntária de consultas

### Requirement: Cadastro agrupado e responsivo
O cadastro SHALL organizar os campos existentes em grupos claros de identificação, classificação/datas, valor e observação, usando distribuição horizontal quando houver espaço e empilhamento no mobile, sem acrescentar campos ou alterar validações e persistência.

#### Scenario: Preencher cadastro em desktop e mobile
- **WHEN** o usuário cadastra ou edita uma obrigação em 1366×768 ou 390×844
- **THEN** os mesmos campos e regras permanecem disponíveis em grupos identificáveis, sem cortes ou overflow da página
- **AND** teclado, mensagens de erro e ações de salvar/cancelar continuam acessíveis

### Requirement: Pagamento compacto com valores inequívocos
O modal SHALL reduzir rolagem desnecessária aproveitando espaço horizontal e agrupamento, sem ocultar informação financeira essencial. SHALL destacar desembolso, origens e saldo restante, preservando integral padrão, parcial explícito e recuperação segura da 23C.

#### Scenario: Parcial multiorigem sem perda de contexto
- **WHEN** o usuário informa principal R$ 500,00, juros R$ 15,00 e desconto R$ 5,00 numa obrigação de R$ 1.245,87
- **THEN** o modal distingue amortização R$ 500,00, desembolso R$ 510,00 e residual R$ 745,87, mantendo a distribuição por origem visível ou acessível por rolagem interna
- **AND** adicionar/remover origens, corrigir erros e repetir confirmação incerta preserva o comportamento existente

### Requirement: Cronologia legível de baixas e estornos
O histórico SHALL apresentar datas e sequência de consulta identificáveis, respeitando a paginação existente. SHALL vincular visualmente o estorno à baixa e distinguir data financeira, registro e reversão quando disponíveis, sem inventar dados legados ou saldos históricos.

#### Scenario: Baixa anterior estornada após outra baixa
- **WHEN** o histórico contém duas baixas e um estorno posterior da primeira
- **THEN** cada baixa mantém sua identidade/origens e o estorno aparece associado à primeira com data, motivo e responsável disponíveis
- **AND** a segunda permanece identificada como vigente, sem estorno apresentado como pagamento ou perda de acesso às demais páginas

### Requirement: Hierarquia visual preservando operações
A tela SHALL refinar hierarquia, alinhamento, componentes e ações preservando a identidade Novexa, residual destacado, Pagar evidente e seleção explícita da baixa para estorno. Athom SHALL servir somente como referência de organização, sem importar campos, regras ou funcionalidades.

#### Scenario: Validar o refinamento 23D.1
- **WHEN** o Product Owner avalia a tela refinada em desktop e mobile
- **THEN** cadastro, pagamento, histórico e tabela conservam as capacidades 23C/23D, com informações financeiras legíveis e ações distinguíveis
- **AND** nenhuma nova funcionalidade, campo, regra financeira ou identidade visual do Athom foi incorporada


### Requirement: Ação principal na coluna Ações
A tabela SHALL apresentar o botão textual Pagar como primeira ação de Ações, apenas quando a obrigação puder ser paga. SHALL preservar as ações secundárias compactas e remover a coluna exclusiva Pagamento, sem alterar permissões ou regras financeiras.

#### Scenario: Obrigação elegível e obrigação quitada
- **WHEN** a tabela apresenta uma conta aberta ou parcialmente paga elegível
- **THEN** Pagar é a primeira ação visível em Ações, sem coluna Pagamento
- **AND** contas pagas ou canceladas não apresentam Pagar; as demais ações mantêm seus comportamentos

### Requirement: Grid compacto orientado ao saldo pendente
A tabela SHALL apresentar, nesta ordem: Fornecedor, Documento, Descrição, Vencimento, Status, Saldo pendente, Valor original, Desembolsado e Ações. Categoria e Emissão SHALL permanecer nos detalhes e filtros existentes, sem colunas próprias. Valores monetários SHALL ser alinhados à direita, com saldo pendente destacado e paginação legível.

#### Scenario: Consultar e agir sem alterar regras financeiras
- **WHEN** o usuário consulta uma obrigação no grid
- **THEN** Pagar é a ação principal quando elegível; Visualizar e Editar permanecem acessíveis
- **AND** Cancelar e Estornar são apresentados em menu de três pontos, com os mesmos bloqueios, seleção explícita de baixa e confirmações existentes
- **AND** alterar o tamanho da página retorna à primeira página, preservando consulta paginada remota
