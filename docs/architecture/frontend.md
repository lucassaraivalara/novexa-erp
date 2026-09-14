# Frontend — padrão de buscas

Este documento define o comportamento esperado para buscas no frontend do Novexa ERP.

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
