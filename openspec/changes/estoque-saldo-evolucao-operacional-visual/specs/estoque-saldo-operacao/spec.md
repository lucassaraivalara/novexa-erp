# Spec Delta

## Purpose

Permitir consultar saldos e executar movimentações e ajustes de estoque com unidades explícitas, conferência clara e feedback contextual, preservando as regras e proteções operacionais existentes do Novexa.

## ADDED Requirements

### Requirement: Grid de saldos com unidade e ações identificáveis
A tela SHALL apresentar produto, código, saldo atual, mínimo, unidade cadastrada e situação, com ações identificáveis e acessíveis. A leitura SHALL seguir a hierarquia e densidade das telas aprovadas do Financeiro, sem somar quantidades de unidades diferentes.

#### Scenario: Consulta de produtos com unidades distintas
- **WHEN** a página contém produtos em UN e KG, inclusive saldo 1,250 e saldo negativo
- **THEN** cada quantidade mostra sua unidade e precisão de até três casas em pt-BR, sem arredondar para inteiro
- **AND** saldo negativo e situação são distinguíveis por texto além da cor

#### Scenario: Produto indisponível para movimentação
- **WHEN** o produto é inativo, sem controle ou Kit/Combo
- **THEN** entrada, saída e ajuste permanecem indisponíveis com explicação específica e o histórico continua consultável
- **AND** Kit/Combo é identificado como disponibilidade calculada pelos componentes

### Requirement: Consulta paginada com filtros recuperáveis
A consulta SHALL manter busca por produto/código, situações existentes, ordenação e paginação remotas, indicar filtros ativos e permitir limpá-los. Estados de carregamento, erro, catálogo vazio e ausência de resultados SHALL ser distintos.

#### Scenario: Filtro sem resultados
- **WHEN** uma busca ou situação não encontra produtos
- **THEN** a tela orienta revisar ou limpar os filtros, sem sugerir que o catálogo está vazio
- **AND** mudanças de busca, filtro, ordenação ou tamanho retornam à primeira página

#### Scenario: Atualização após movimentação
- **WHEN** uma movimentação é confirmada pelo servidor
- **THEN** a página atual é atualizada preservando busca, situação e ordenação, com correção para a última página válida se necessário

### Requirement: Operações individuais curtas e explícitas
O fluxo individual SHALL mostrar produto/código, unidade, saldo atual, quantidade ou novo saldo físico, motivo e saldo previsto. Entrada e saída SHALL usar quantidade positiva; ajuste SHALL representar saldo final não negativo, inclusive zero. Motivo individual SHALL continuar opcional, limitado a 255 caracteres.

#### Scenario: Ajuste físico fracionado
- **WHEN** o operador informa 1,250 como novo saldo de um produto com saldo 5,000
- **THEN** a interface mostra saldo final 1,250 na unidade cadastrada e envia ajuste para esse saldo, sem tratá-lo como acréscimo
- **AND** não exige seleção de empresa, usuário ou unidade já conhecidos

#### Scenario: Saída superior ao saldo
- **WHEN** o servidor recusa uma saída por saldo insuficiente
- **THEN** o fluxo permanece aberto com quantidade e motivo preservados e apresenta a causa junto à operação
- **AND** não aplica à saída manual a permissão de estoque negativo própria da venda

#### Scenario: Confirmação por teclado
- **WHEN** o operador abre e confirma uma operação válida por teclado
- **THEN** o campo de quantidade recebe foco e o envio em andamento bloqueia repetição
- **AND** sucesso só aparece após resposta confirmada; fechar devolve foco ao acionador

### Requirement: Mensagens no contexto da operação
A interface SHALL apresentar erro e recuperação no fluxo que os originou, preservar dados para correção e confirmar sucesso somente após resposta válida. SHALL usar a causa conhecida retornada pela API, sem expor detalhes internos nem afirmar ausência de gravação em falha de comunicação com resultado desconhecido.

#### Scenario: Falha ao carregar histórico ou salvar movimento
- **WHEN** o histórico falha ou a movimentação é recusada
- **THEN** a mensagem aparece no histórico ou formulário correspondente e oferece nova consulta ou correção sem apagar os dados
- **AND** não há sucesso antecipado nem repetição automática de escrita individual

### Requirement: Histórico legível e contextual
O histórico SHALL manter paginação, filtros por tipo, origem e período, ordenação, data/hora oficial, quantidade, saldos anterior/posterior, motivo e responsável. SHALL identificar unidade e preservar os vínculos de origem disponíveis e a consulta de componentes de Kit/Combo.

#### Scenario: Histórico filtrado e período inválido
- **WHEN** o operador consulta um período sem movimentos ou informa início posterior ao fim
- **THEN** a interface diferencia ausência de movimentos de período inválido e permite limpar ou corrigir os filtros
- **AND** filtros alterados retornam à primeira página do histórico

### Requirement: Conferência de ajuste em massa existente
O ajuste em massa SHALL preservar acesso ADMIN, modo de saldo final, motivo obrigatório de até 255 caracteres, limite de 200 produtos e prévia obrigatória. A conferência SHALL evidenciar unidade, saldo anterior, saldo físico final, diferença e situações inválidas ou sem alteração, sem confirmação parcial.

#### Scenario: Edição e confirmação de lote
- **WHEN** o operador altera itens ou valores depois da prévia
- **THEN** a prévia anterior deixa de autorizar confirmação e os dados editados são preservados
- **AND** somente uma prévia válida permite confirmar o conjunto atomicamente

#### Scenario: Conflito e resposta desconhecida
- **WHEN** a confirmação retorna conflito de saldo/última movimentação ou falha de comunicação
- **THEN** conflito solicita nova prévia preservando o rascunho, enquanto resultado desconhecido preserva a mesma chave e payload para retry idempotente
- **AND** sucesso confirmado atualiza os saldos e mantém o fluxo existente para novo ajuste e consulta do histórico, sem duplicar movimentos

### Requirement: Importação com validação e resultado claros
A importação SHALL reutilizar CSV/XLSX, modelo, limite de 2 MiB e 200 linhas, prévia sem gravação e confirmação do lote existente. SHALL apresentar linha, código, produto identificado, saldo, quantidade final, diferença e erros, sem correspondência automática por descrição nem descarte silencioso de inválidos.

#### Scenario: Arquivo com erros
- **WHEN** a planilha contém produto desconhecido, duplicado, quantidade inválida ou excede os limites
- **THEN** a interface informa a causa e como corrigir o arquivo, preservando os dados úteis à revisão
- **AND** linhas inválidas impedem confirmar o conjunto; gerar prévia não altera estoque

#### Scenario: Importação válida
- **WHEN** a prévia válida é confirmada e o servidor responde com sucesso
- **THEN** são mostrados os quantitativos reais de produtos alterados e sem alteração e a consulta de saldos é atualizada
- **AND** falha de rede mantém a chave de confirmação existente para retry sem duplicidade

### Requirement: Compatibilidade com o domínio atual
A evolução SHALL preservar isolamento pela empresa do JWT, permissões e histórico transacional existentes. SHALL conservar as regras atuais de controle empresarial e por produto, sem introduzir conversões, restrições de fração por unidade ou novos bloqueios globais.

#### Scenario: Controle empresarial e movimentação manual
- **WHEN** a configuração empresarial difere do controle cadastrado no produto
- **THEN** a evolução mantém a distinção atual entre política de venda e elegibilidade da movimentação manual, sem alterar configurações ou saldos automaticamente
- **AND** qualquer mudança dessa regra exige aprovação específica do Product Owner

#### Scenario: Responsividade e acesso assistivo
- **WHEN** o operador utiliza teclado ou tela estreita
- **THEN** filtros, ações e confirmações permanecem acessíveis, com nomes, foco visível, contraste do tema e rolagem restrita à tabela quando necessária
- **AND** mensagens e diferenças não dependem somente de cor e não ficam ocultas atrás de diálogos
