# Frontend — padrões de cadastros, buscas e formulários

Este documento define os padrões do frontend do Novexa ERP, preservando a densidade e a velocidade operacional.

## Ações por ícones

As ações de linha em `AppTable` usam `IconButton` compacto com `Tooltip` e `aria-label` descritivos, reutilizando o rótulo quando não houver tooltip específico. O estado desabilitado deve ser preservado e o ícone deve indicar a operação. A ação primária Novo continua como botão identificado no `PageHeader`; não transformar ações de linha em botões grandes nem remover seus nomes acessíveis.

## Classificação

- **Filtro local:** usado quando a tela já possui a lista necessária em memória. A filtragem é imediata, sem HTTP e sem debounce. Clientes, Empresas, Caixa, Estoque e as tabelas que usam `AppTable` permanecem nessa categoria quando a listagem carregada é a fonte da tela.
- **Busca textual remota:** usada quando o backend pesquisa o catálogo. O termo válido tem no mínimo 2 caracteres e usa debounce de 350 ms.
- **Busca operacional:** deve priorizar velocidade e pode usar debounce de 300 ms quando a consulta for remota. A busca do PDV atual é local e imediata sobre o catálogo carregado, com prioridade para código de barras e código interno.
- **Identificador:** usa o `minLength` definido pelo contrato da tela; não deve herdar automaticamente o limite de uma busca textual.
- **Código de barras:** quando houver leitura direta, pode executar imediatamente, sem debounce, desde que o contrato da tela reconheça o valor.

As constantes compartilhadas ficam em `frontend/src/config/search.ts`. A infraestrutura de busca remota fica em `frontend/src/hooks/useRemoteSearch.ts`.

## Regras de execução

- Digitação agenda uma busca remota somente a partir do mínimo configurado.
- Enter executa imediatamente uma busca válida e cancela o timer pendente.
- Uma lupa, quando existir, deve ter o mesmo comportamento do Enter.
- Campo limpo cancela timer e requisição, invalida resultados antigos e restaura a listagem inicial.
- Termo abaixo do mínimo cancela ou invalida a requisição anterior e não mantém resultados de outro termo.
- O loading aparece somente quando a requisição real começa e termina em sucesso, erro ou cancelamento.
- Requisições antigas não podem sobrescrever o termo atual. A implementação deve usar `AbortController`, `requestId` ou ambos.
- Toda nova busca remota deve voltar à primeira página quando a tela possuir paginação.

## Regras de manutenção

Não converter um filtro local correto em busca remota apenas para aplicar debounce. Não colocar debounce dentro de `AppTable`: a página proprietária da busca conhece a origem dos dados e o contrato do endpoint. Mensagens de erro devem continuar sendo convertidas pelas funções de serviço existentes e não devem expor detalhes técnicos.

Produtos usa busca textual remota com o padrão de 2 caracteres e 350 ms. Clientes, Empresas, Caixa, Estoque e o catálogo atual do PDV usam filtro local imediato. Dados Bancários permanece um shell sem busca ou API fictícia.

# Padrão de Formulários

## Cadastro simples

Cadastros simples usam `PageHeader` + tabela + botão Novo + `Dialog` compacto. O
dialog diferencia `Novo X` de `Editar X`, mantém o primeiro campo útil com
autofocus, indica obrigatoriedade com `required` do MUI e usa `form
onSubmit` para que Enter execute o fluxo natural. Exceções como campos
multiline continuam aceitando Enter para nova linha.

As ações ficam em `FormActions`, com `Cancelar` à esquerda e a ação principal
à direita. O botão Salvar pode ser `type="submit"` e mostra `Salvando...`
durante a requisição. Enquanto salva, Cancelar, fechamento acidental e novos
submits ficam bloqueados.

## Cadastro complexo

Cliente, Produto e Empresa continuam usando dialogs maiores, abas ou seções.
Eles não são reduzidos ao padrão compacto, mas preservam `form onSubmit`,
validação próxima aos campos, loading localizado, proteção contra duplo
submit, valores digitados em caso de erro e fechamento somente após sucesso.

## Erros, cancelamento e sucesso

Validações básicas (obrigatório, formato e limites já definidos pelo contrato)
aparecem junto ao campo. Erros gerais da API usam o mecanismo de mensagem do
service e mantêm o formulário aberto sem limpar valores. Cancelar fecha
diretamente quando não há alterações relevantes; confirmações de descarte
existentes em formulários complexos são preservadas. Após sucesso, a tela
atualiza a listagem, fecha o formulário e mostra o feedback já adotado pela
página.

Novos cadastros devem reutilizar `FormActions` e esse fluxo. Não criar outro
motor genérico, outro loading ou outro padrão de submit sem uma exceção
intencional do domínio.
