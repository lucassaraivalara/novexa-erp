# Produtos

O cadastro existente permanece responsável por preços, códigos, unidade, classificação e fornecedor principal. Estoque atual não é editável por cadastro nem por importação. Classificação opcional e paginação em [arquitetura.md](arquitetura.md#classificação-opcional-do-produto) e [paginacao.md](paginacao.md).

## Importação em lote

Implementação consolidada na main a partir de `4e71b92`, com os vínculos de classificação e fornecedor principal. Importa **somente novos produtos**, por ação de ADMIN em Produtos → Importar Produtos. Não atualiza produtos existentes nem cria Categoria, Subcategoria, Marca ou Fornecedor. Não cria entradas, pagamentos ou movimentos de estoque.

### Contrato

Todas as rotas `/produtos/importacoes` exigem ADMIN; empresa e usuário vêm exclusivamente do JWT. Referência de importação de outra empresa retorna 404.

| Método / rota | Comportamento |
|---|---|
| POST `/produtos/importacoes` | Multipart `arquivo`; lê, valida e persiste a prévia, sem gravar produtos. Retorna 200. |
| GET `/produtos/importacoes/{id}` | Consulta prévia/resultado da empresa. |
| POST `/produtos/importacoes/{id}/confirmar` | Sem payload de produtos. Revalida e cria atomicamente somente as linhas válidas da prévia persistida. |
| POST `/produtos/importacoes/{id}/cancelar` | Cancela prévia sem criar/remover produtos. Repetição segura; confirmada retorna 409. |
| GET `/produtos/importacoes/{id}/erros` | CSV UTF-8 com BOM: linha, situação, nome, código e motivo; inclui inválidas, duplicadas e ignoradas. Protege contra fórmula na abertura do CSV. |

Resposta: `{id,arquivo,estado,validas,invalidas,duplicadas,ignoradas,importados,colunasIgnoradas,linhas}`; cada linha informa número original, situação, mensagem e campos lidos. A prévia inclui dados normalizados de criação, usados apenas pelo backend. Estados: PREVIA, CONFIRMADA e CANCELADA. Prévia/confirmar/cancelar usam a mesma empresa do JWT; não aceitam tenant ou lista de produtos pelo cliente.

### Campos

| Coluna | Destino |
|---|---|
| Nome | nome obrigatório, até 150 caracteres |
| Código | codigoInterno opcional, até 60, normalizado em maiúsculas |
| EAN / GTIN | codigoBarras opcional, até 60, sem espaços |
| Preço | precoVenda obrigatório, não negativo, até duas casas decimais |
| Unidade | unidadeMedida obrigatória, até 10 caracteres, maiúsculas |
| Estoque Min. | estoqueMinimo não negativo, até três casas; ausente = zero |
| Status | ativo; Ativo/Ativa/Sim/True/1 e Inativo/Inativa/Não/False/0; ausente = ativo |
| Categoria | nome exato da categoria da empresa, sem diferenciar caixa |
| Sub Categoria | nome da subcategoria da empresa; exige a categoria correspondente |
| Marca | nome exato da marca da empresa, sem diferenciar caixa |
| Fornecedor Principal | razão social ou nome fantasia exato da empresa; múltiplos candidatos rejeitam a linha |
| NCM | metadado cadastral opcional de oito dígitos |
| CEST | metadado cadastral opcional de sete dígitos |

Vínculos são opcionais e aceitam os cadastros existentes inclusive inativos, seguindo o contrato de Produto. Nomes ausentes não criam cadastros automaticamente. NCM/CEST não implementam validação tributária, cálculo fiscal ou emissão de documentos; pontuação usual é removida, zeros iniciais devem estar preservados no arquivo. A API de Produto retorna esses campos opcionais; edição omissa os preserva e null explícito os remove. Formulários existentes não ganham campos fiscais nesta entrega.

### Duplicidade e confirmação

A política é **rejeitar a linha**, inclusive quando o código/EAN já pertence a produto inativo. Duplicidade no arquivo marca todas as ocorrências repetidas de código/EAN ou linha idêntica; não escolhe uma delas arbitrariamente. Sem identificador, nomes iguais não são tratados como unicidade de produto. Contagens são exclusivas: linha inválida tem prioridade sobre duplicada; linha sem campos importáveis é ignorada. Importar exige confirmação explícita da quantidade válida; inválidas/duplicadas/ignoradas não são gravadas.

O SHA-256 dos bytes e a unicidade `(empresa_id,hash_arquivo)` impedem reenvio duplicado do mesmo arquivo. Mesmo hash confirmado retorna o resultado anterior, inclusive após reinício da API. Repetir confirmação não cria novos produtos. Locks da empresa e do lote serializam importações concorrentes do tenant; FKs e índices únicos de Produto continuam protegendo corridas com o cadastro manual. Falha reverte todo o lote. Catálogo alterado após prévia retorna 409 e exige reenviar/revisar antes de confirmar. Prévia cancelada pode ser gerada novamente pelo upload.

### Limites e segurança

XLS/XLSX: uma única aba. CSV: UTF-8 com/sem BOM ou Windows-1252; delimitador vírgula, ponto e vírgula ou tabulação, aspas e quebras de linha entre aspas. Cabeçalhos ignoram acentos/espaçamento/pontuação. Nome, Preço e Unidade devem existir. Até 2 MB, 2.000 linhas de dados, 64 colunas e 2.000 caracteres por célula. XLSX também tem limite de 20 MB descompactados e 256 entradas ZIP. Fórmulas/erros em campos importáveis são rejeitados, nunca executados; fórmulas em colunas ignoradas não interferem na importação. Identificadores numéricos Excel com mais de 15 dígitos são rejeitados por risco de perda de precisão; use células de texto para códigos/zeros iniciais.

Colunas fora do modelo são listadas como ignoradas, inclusive Estoque Atual, localização, promoção, kit, pontos e exportação para balança. Produtos novos iniciam estoque atual e custo em zero pelas regras existentes. Não há atualização ou movimentação de saldos. A prévia é limitada e persistida como JSON, sem armazenar o arquivo original; não há processo genérico ou infraestrutura de jobs. Registros de importação preservam a referência ao usuário autor.

### Persistência e dependência

V42 aditiva cria `importacoes_produtos` (UUID, empresa, usuário, hash, arquivo, estado, prévia, quantidade e datas) e campos opcionais ncm/cest em Produto. Não modifica migrations aplicadas nem dados dos produtos anteriores. Apache POI `poi-ooxml` 5.5.1 foi acrescentado para XLS/XLSX, sem atualizar as dependências já declaradas; referência da versão em [Apache POI](https://poi.apache.org/download.cgi). XLS exportado sem WindowTwoRecord utiliza leitura de eventos do POI, sem reescrever o arquivo.

Validações e pendências desta entrega em [CURRENT_STATE.md](CURRENT_STATE.md). Testes de interface usam HTTP simulado e não representam homologação real.
