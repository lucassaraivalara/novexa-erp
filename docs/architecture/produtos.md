# Produtos

## Kit/Combo — composição operacional (V46)

`GET /produtos/composicao/capacidade` autenticado confirma suporte antes de habilitar a criação do composto na interface, evitando incompatibilidade durante publicação desencontrada de frontend/API.

Produto simples permanece padrão. O cadastro completo aceita `composto=true` e `componentes[{produtoId,quantidade,fator,unidade}]`; o cadastro rápido permanece simples. Tipo simples/composto é imutável após criação. Componentes são produtos físicos simples, ativos, com controle de estoque e da empresa do JWT; não são permitidos autorreferência, kits aninhados, duplicidade ou composição vazia. Quantidade × fator indica consumo na unidade de estoque por unidade do Kit/Combo, sem conversão inferida. Na própria unidade física, fator deve ser 1; consumo deve ser representável com três casas decimais. Unidade/controle de componente em uso não podem ser alterados sem revisar a composição.

Edição cria versão nova sem apagar versões anteriores, identificando usuário, data, nomes e unidades. Omissão de componentes preserva a composição vigente. `GET /produtos/{id}/composicoes` consulta o histórico do tenant. Consultas e busca do PDV retornam `composto`, `composicaoVersao` e componentes atuais, consultados em lote; `estoqueAtual` no DTO é disponibilidade calculada para o composto, sem saldo físico próprio. Custo resulta da soma dos custos físicos × consumos; preço de venda continua independente. Relatório de preços identifica Kit/Combo e usa o custo calculado.

O PDV mantém busca por nome/código/EAN, rascunho e pagamento existentes. Quantidade recalcula o consumo previsto; finalização usa a versão conferida, valida a necessidade agregada dos componentes e registra consumos históricos. Mudança de composição exige remover/adicionar o kit antes de finalizar. Cancelamento integral repõe exatamente os consumos persistidos, inclusive após editar a composição, pela mesma transação de reversão financeira existente. Não há devolução parcial ou estorno independente de composição, nem estoque por depósito no contrato atual.

O cadastro normal mantém preços, códigos, unidade, situação, classificação e fornecedor principal. Categoria, Subcategoria, Marca e Fornecedor são opcionais e pertencem à empresa do JWT; subcategoria pertence à categoria selecionada. Campos omitidos na edição são preservados e null explícito remove os vínculos opcionais. Contratos em [arquitetura.md](arquitetura.md), [fornecedores.md](fornecedores.md) e [paginacao.md](paginacao.md).

NCM (oito dígitos) e CEST (sete dígitos) permanecem como metadados opcionais do Produto. Não implementam cálculo fiscal. Cadastro normal, consulta, relatório de preços, estoque e PDV foram preservados.

## Carga inicial operacional única — 2026-10-17

A carga do primeiro cliente foi executada diretamente no PostgreSQL por `scripts/operacoes/carga_inicial_produtos.py`, fora da aplicação. Não existe botão, diálogo, rota ou API de importação de Produtos. O procedimento não é funcionalidade permanente nem utiliza os endpoints antigos.

A planilha original foi somente lida. Das 608 linhas de dados, 606 estavam preenchidas: 528 produtos foram inseridos na empresa identificada pelo ADMIN; 28 linhas rejeitadas, 50 duplicadas e duas vazias ignoradas. Rejeições incluem unidade ausente, CEST sem os sete dígitos e código numérico sem precisão segura. Nenhum valor ausente foi inventado. NCM com código explícito de oito dígitos seguido de descrição foi separado da descrição; não houve inferência fiscal.

Classificação e fornecedores foram resolvidos por nome sem distinguir caixa/espaços laterais, dentro da empresa. Foram criados 3 categorias, 25 subcategorias, 66 marcas e 30 fornecedores para os produtos aptos. Referências ambíguas ou subcategoria incompatível bloqueiam o procedimento. Produtos/códigos/EAN existentes nunca são atualizados; duplicidades dentro do arquivo rejeitam todas as ocorrências.

Antes da produção, Flyway V1–V42 e o script foram executados em PostgreSQL descartável, com rollback e preservação de produto anterior. Sete testes operacionais verificam validação, vínculos, repetição, tenant, ambiguidade e rollback por falha no meio do lote. A prévia de produção foi somente leitura; a gravação exigiu empresa explícita, hash da prévia e backup confirmado pelo operador. A transação única conferiu os dados anteriores, contagens e vínculos antes do commit. Códigos existentes tornam a reexecução segura contra duplicação.

Consulta independente após o commit conferiu os campos e relacionamentos dos 528 produtos. Estoque e custo iniciais ficaram em zero; saldo total zero e movimentos de estoque 0 antes/0 depois. Estoque Atual e colunas fora do mapeamento não foram importados. Nenhuma venda, Entrada, conta, pagamento ou movimento financeiro foi criado.

CSV por linha/produto/campo/motivo e resumos da prévia, gravação e conferência foram salvos fora do repositório. Credenciais vêm somente do ambiente/arquivo externo da VM, capturadas em memória, sem valores no script, Git ou logs. O script é somente leitura por padrão; `rehearse` sempre desfaz as inserções e `apply` é exclusivo do procedimento operacional controlado. Dependências Python são isoladas, sem dependência adicional no frontend/backend.

## Legado da V42

A V42 já aplicada permanece intacta, incluindo `importacoes_produtos`. A tabela técnica está sem registros na conferência desta carga e permanece como legado sem uso pela aplicação, sem Entity, repository ou endpoints. Não foi excluída nem reaproveitada pelo script. Flyway e Hibernate validate continuam ativos; NCM/CEST permanecem no Produto. Nenhuma migration aplicada foi editada ou apagada.
