# Produtos

## Cadastro em abas e vínculo múltiplo de fornecedores — V51

O cadastro completo de Produto foi reorganizado em abas por responsabilidade — **Dados gerais**, **Preços e estoque**, **Fornecedores**, **Kit/Combo** e **Fiscal** — usando o slot de navegação do `CadastroDialog` (Tabs MUI), sem alterar rotas, contratos de salvamento ou o modo de cadastro rápido (que permanece sem abas). A validação do formulário leva o foco para a aba do primeiro campo com erro. O padrão é reutilizável para futuros cadastros; os demais cadastros não foram reformulados.

Além do fornecedor principal (`produtos.fornecedor_principal_id`, V40), um produto pode ter **múltiplos fornecedores adicionais**, cada um com seu código de referência/fabricante. A V51 cria a tabela `produto_fornecedor` (empresa, produto, fornecedor, `codigo_referencia`), com FKs compostas `(id, empresa_id)` no padrão das migrations anteriores e unicidade `(produto_id, fornecedor_id)`. Os nomes das constraints usam o sufixo `_vinc` para não colidir com a V40. Nenhuma migration aplicada foi alterada.

`ProdutoRequestDTO` aceita `fornecedoresAdicionais[{fornecedorId, codigoReferencia}]`. Na criação e na edição, a omissão do campo preserva os vínculos existentes (flag por setter, mesmo padrão do fornecedor principal); lista explícita substitui a anterior; lista vazia remove todos. Validações no backend, antes de persistir: fornecedor obrigatório por linha, sem duplicidade, não pode repetir o principal e deve pertencer à empresa do JWT (404 caso contrário). A resposta passa a incluir `fornecedoresAdicionais[{fornecedor, codigoReferencia}]`, carregados em lote com join fetch, sem N+1 na listagem e na busca.

Na **duplicação**, o fornecedor principal segue o comportamento atual de ser copiado para revisão; os vínculos adicionais não são copiados, pois o código de referência é específico do vínculo original. Não há impacto em estoque, PDV, financeiro ou nas regras de Kit/Combo.

## Duplicação e código interno — V50

A ação **Duplicar** na listagem consulta o produto da empresa autenticada e abre o mesmo formulário de cadastro com dados cadastrais para revisão. Salvar utiliza o `POST /produtos` existente: cria outro ID com estoque inicial zero, sem copiar código interno, EAN, imagem, saldo, movimentos, auditoria ou histórico. Produto inativo pode servir de base, mas o novo nasce ativo. Kit/Combo não copia composição nem custo calculado; o novo inicia simples e os componentes devem ser configurados explicitamente se o usuário optar por criar outro composto. NCM/CEST e demais dados cadastrais aceitos pelo formulário podem ser revisados. O produto de origem permanece intacto. Não há endpoint de duplicação que grave automaticamente.

Na duplicação, **Gerar automaticamente** envia código nulo ao cadastro atual; **Informar manualmente** exige um código válido. O backend valida duplicidade na empresa e o índice único `(empresa_id,codigo_interno)` protege a corrida. A V50 mantém o trigger e o numerador por empresa da V47, mas códigos manuais novos deixam de avançar o numerador. O automático continua incrementando sob lock e pula códigos manuais já existentes, sem `MAX + 1` no cadastro. Os valores de numerador já acumulados antes da V50 não são reduzidos, pois não existe proveniência segura para separar números automáticos de manuais antigos. Produtos e códigos legados não são renumerados. O script operacional de importação continua usando o mesmo trigger: código informado é preservado; sem código, recebe automático.

## Código interno automático — V47 (histórico)

Código vazio/nulo/somente espaços na criação recebe um número decimal positivo, sem prefixo ou zeros adicionados. `produto_codigo_numeradores` foi inicializado na V47 pelos códigos numéricos existentes, sem atualizar produtos. Até a V49, códigos manuais numéricos avançavam o numerador; a V50 altera essa regra apenas para operações futuras. O limite continua sendo 60 caracteres.

O trigger `atribuir_codigo_interno_produto` executa na transação do INSERT. UPSERT/UPDATE bloqueiam o numerador da empresa até commit/rollback, inclusive no primeiro cadastro concorrente; o índice único existente `(empresa_id,codigo_interno)` permanece como proteção final. Valores numéricos informados/importados avançavam o controle até a V49; após a V50, não o avançam. O numerador não retrocede ao editar, inativar ou excluir um produto. Falha da transação reverte produto e numerador. Não há MAX + 1 durante o cadastro.

Na criação de Kit/Combo, componentes são bloqueados em ordem de ID antes do INSERT/numerador, reutilizando o bloqueio existente de composição. Essa ordem evita inversão com edição concorrente do código de um componente, sem mudar a composição ou a movimentação de estoque.

A API mantém `codigoInterno`; Hibernate lê o valor atribuído pelo banco antes da resposta. Códigos informados mantêm a normalização anterior (trim/maiúsculas); duplicidade é rejeitada com 409. Códigos só de pontuação ou com caracteres de controle são inválidos. Edição com código ausente/vazio preserva o atual; edição explícita continua permitida, com validação de duplicidade. Produtos legados sem código permanecem sem código até edição explícita: não há renumeração nem saneamento retroativo de dados. A listagem os identifica como “Sem código interno”, sem traço que possa ser confundido com código.

Cadastro completo, rápido, duplicação e Kit/Combo usam o mesmo INSERT, sem numerador no frontend. Busca por código no PDV, filtros, ordenação textual, paginação e referências por ID de venda/estoque permanecem iguais. A V47/V50 não cria saldo, composição, movimento ou efeito financeiro.

O script operacional único também utiliza o trigger, sem API/tela de importação. Linhas com código são inseridas antes das linhas sem código, prevenindo colisões com códigos informados mais adiante no arquivo. Código ausente exige V47 aplicada; códigos/EAN existentes continuam rejeitados, nunca atualizados. Sem código e sem EAN, nome já existente/repetido bloqueia a linha como duplicada, evitando reenvio ambíguo. Nenhuma planilha real foi importada nesta alteração.

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
