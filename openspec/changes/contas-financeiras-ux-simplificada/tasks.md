# Tasks

## 1. Consulta e indicadores — frontend

- [x] 1.1 Reorganizar ContasFinanceiras com grid na ordem especificada, Extrato principal, Editar acessível e menu secundário; verificar por testes de UI que permissões, bloqueios, confirmações e ausência de gravação ao consultar foram preservados.
- [x] 1.2 Expor filtros progressivos pelos contratos existentes, mantendo situação inicial, busca e paginação remotas; verificar filtros/tamanho retornando à primeira página e descarte de respostas obsoletas.
- [x] 1.3 Compactar indicadores e separar saldo registrado/previsão/PDV, com nota de total global incluindo inativas/legados; verificar valores equivalentes aos atuais e estados loading/erro/zero com fixtures, registrando a semântica de apresentação no documento frontend afetado.

## 2. Cadastro e edição — frontend

- [x] 2.1 Reapresentar os campos/handlers atuais em CadastroDialog centralizado, agrupando identificação, vínculo e saldos; verificar criação/edição Banco e legado com os mesmos payloads, campos protegidos e validações existentes, sem novos tipos ou campos.
- [x] 2.2 Preservar dados após falha, retorno do cadastro bancário, foco e bloqueio de duplo envio; verificar interação por teclado e tentativas recuperáveis em testes dirigidos do formulário, documentando apenas o padrão visual alterado quando necessário.

## 3. Cofre — apresentação e consultas existentes

- [x] 3.1 Manter cabeçalho e alertas persistentes com conteúdo recolhível após a tabela; verificar pendências maiores que a página, zero confirmado, loading, falha/retry e acesso à resolução sem gravação automática.
- [x] 3.2 Separar consulta mínima de pendências de histórico/extrato sob demanda, com um único estado de consulta e atualização após ações; verificar contagem de requests ao abrir/recolher, reaproveitamento da primeira página, cancelamento e isolamento de contexto, sem polling.
- [x] 3.3 Preservar confirmações e avisos de entrega/destinação/troco e permissões atuais; verificar em fixtures que os fluxos existentes mantêm payloads e não registram movimentos só por expandir o painel.

## 4. Fechamento local — integração e Product Owner

- [x] 4.1 Executar somente testes frontend afetados e verificações TypeScript/lint necessárias; build quando pertinente. Conferir o diff para ausência de backend, contratos, agregações, migrations, dependências e alterações paralelas; registrar resultados concisos no estado/documentação afetados e atualizar esta lista.
- [x] 4.2 Apresentar ao Product Owner notebook (1366×768) e mobile (390×844), conferindo rolagem local, menus, foco, formulário centralizado, rótulos de saldos e pendências visíveis com Cofre fechado; registrar aprovação ou pendências sem declarar validação ainda não realizada.

## Workflow follow-up

- Estas tarefas só começam após aprovação da proposta e novo pedido de APPLY. Nesta etapa de proposta não executar testes da aplicação.
- Manter a change aberta após implementação até validação operacional; não iniciar release, commit, push, deploy ou arquivamento automaticamente.
