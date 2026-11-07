# Spec Delta

## Purpose

Permitir que pequenos lojistas consultem contas e saldos e acessem operações financeiras existentes com clareza, distinguindo registros financeiros, valores a liquidar e dinheiro físico do PDV.

## ADDED Requirements

### Requirement: Consulta com hierarquia operacional
A tela SHALL priorizar indicadores compactos, filtros progressivos e consulta paginada, seguindo a identidade aprovada de Contas a Pagar e Contas a Receber, sem alterar navegação global.

#### Scenario: Consultar contas e filtrar
- **WHEN** o usuário abre a tela e utiliza busca, tipo ou situação
- **THEN** a tabela apresenta Conta, Tipo, Saldo registrado, A liquidar, Situação e Ações; a identificação bancária disponível aparece junto ao nome
- **AND** busca, ordenação e paginação permanecem remotas; os filtros preservam valores ao recolher e retornam à primeira página ao mudar
- **AND** o carregamento, o erro com retry e a ausência de resultados são distinguíveis; a consulta inicial mantém todas as situações, como atualmente

### Requirement: Saldos com abrangência explícita
A tela SHALL distinguir saldo registrado no ERP de valores a liquidar e saldo físico do PDV. O indicador total SHALL manter a agregação atual e informar explicitamente que inclui contas inativas e tipos legados, independentemente dos filtros da tabela.

#### Scenario: Total contém valores de contas inativas e legadas
- **WHEN** a resposta do resumo inclui contas inativas ou tipos legados
- **THEN** seus valores continuam compondo o mesmo total, com a abrangência visível junto ao indicador
- **AND** valores a liquidar não são somados ao saldo registrado; informação ausente ou falha não aparece como zero confirmado
- **AND** a interface não apresenta o saldo como consulta bancária em tempo real nem como dinheiro da sessão do PDV

### Requirement: Extrato como ação principal
A tela SHALL destacar Extrato como ação principal, manter Editar acessível e agrupar as ações secundárias existentes em menu, preservando permissões, elegibilidade e confirmações.

#### Scenario: Consultar ou selecionar uma operação
- **WHEN** o usuário acessa as ações de uma conta
- **THEN** encontra Extrato, edição e menu com recebimentos PIX/cartões, entrada/saída manual, registro de transferência e ativação/inativação conforme o acesso existente
- **AND** consultar ou abrir formulários não grava movimentos; operações sensíveis mantêm os fluxos e confirmações atuais
- **AND** a nomenclatura esclarece que registrar transferência não executa uma transferência bancária real

### Requirement: Cofre recolhível com pendências visíveis
O painel Cofre SHALL iniciar recolhido após a consulta principal. Pendências existentes e falhas de consulta SHALL permanecer visíveis fora do conteúdo recolhido, com acesso direto à consulta/resolução, respeitando as permissões atuais.

#### Scenario: Há pendências com painel fechado
- **WHEN** a consulta existente retorna pendências e o painel está recolhido
- **THEN** a quantidade total de pendências permanece visível, sem depender da página de detalhes aberta
- **AND** a ação de consultar expande a área apropriada sem confirmar entrega, destinação ou movimentação
- **AND** avisos existentes necessários para evitar recolhimento duplicado continuam acessíveis no fluxo de resolução

#### Scenario: Consulta indisponível ou pendências atualizadas
- **WHEN** o resumo de pendências está carregando, falha ou é atualizado após uma ação
- **THEN** a área externa informa carregamento, falha/retry ou atualização, sem afirmar que não há pendências antes de confirmação
- **AND** após sucesso exibe o total atualizado; somente resposta válida com zero permite indicar ausência de pendências

### Requirement: Formulário centralizado com campos existentes
Criação e edição SHALL usar formulário centralizado e responsivo, agrupado em identificação, vínculo bancário e saldos. SHALL preservar campos, valores, validações, regras de tipos legados e contratos atuais, sem edição direta do saldo registrado.

#### Scenario: Criar ou editar conta do tipo Banco
- **WHEN** o usuário seleciona Banco ou edita uma conta existente
- **THEN** compreende a diferença entre nome da conta financeira e identificação bancária, com seleção e atalho ao cadastro bancário existente
- **AND** saldo inicial é informado somente na criação; edição mantém os saldos protegidos como hoje
- **AND** erros preservam o preenchimento e a operação não é enviada em duplicidade; nenhum tipo legado passa a ser permitido para novo cadastro

### Requirement: Eficiência sem ocultar informações relevantes
A reorganização SHALL reutilizar os contratos e resultados disponíveis, sem polling, consultas por linha ou busca duplicada do mesmo resumo. Recolher o Cofre não SHALL impedir a consulta mínima necessária às pendências.

#### Scenario: Abrir e recolher consultas auxiliares
- **WHEN** o usuário abre a página, expande/recolhe o Cofre ou muda filtros rapidamente
- **THEN** históricos e extratos detalhados são consultados apenas quando necessários à área aberta, e respostas obsoletas não substituem os filtros atuais
- **AND** o total de pendências usa o total informado pela consulta, não soma valores da primeira página; dados de empresas diferentes não são reutilizados

### Requirement: Responsividade e interação acessível
A experiência SHALL manter valores, status e ações legíveis em desktop/notebook e mobile, com teclado, foco visível e nomes acessíveis. Ajustes SHALL ficar no escopo desta tela e seus componentes necessários.

#### Scenario: Validar organização aprovada
- **WHEN** o Product Owner avalia a tela em notebook e mobile
- **THEN** formulário, filtros, menus, painel recolhível e paginação permanecem utilizáveis, sem overflow da página ou foco encoberto
- **AND** eventual rolagem horizontal fica contida no grid; a interface não depende apenas de cores para comunicar estados
