# Fornecedor: cadastro backend

Fornecedor e dominio proprio, por empresa, com Entity/DTO/Mapper/Service/Repository existentes evoluidos. Uma unica API de criacao atende cadastro rapido e completo. O frontend já possui a aba Fornecedores de Produtos e cadastro rápido em Entradas de mercadoria manual/XML, selecionando o objeto retornado sem sair da operação. Consultas contextuais e seus limites estão em [entradas-mercadoria.md](entradas-mercadoria.md).

## Contrato

Todas as rotas exigem autenticacao existente. Tenant exclusivamente do JWT; parametros extras empresaId/tenantId nao determinam a operacao. Perfis permanecem os atuais, sem criar permissao administrativa nova para Fornecedor.

| Endpoint | Resultado |
|---|---|
| `POST /fornecedores` | 201 com FornecedorResponseDTO completo e id para selecao imediata |
| `GET /fornecedores/{id}` | 200 com DTO, inclusive inativo; outro tenant/inexistente 404 |
| `PUT /fornecedores/{id}` | 200 com DTO atualizado; ativo omitido preserva situacao; ativo=true reativa |
| `DELETE /fornecedores/{id}` | 204, inativa sem apagar; retry seguro |
| `GET /fornecedores` | PaginaResponseDTO, filtros termo/ativo e page/size/sort no banco |
| `GET /fornecedores/buscar?termo=...` | Array de ate 20 ativos do tenant, ordenados por razaoSocial/id |

Payload minimo aceito:

```json
{"nomeRazaoSocial":"ABC Distribuidora"}
```

O nome canonico existente e `razaoSocial`; `nomeRazaoSocial` e alias de entrada, nao outro campo persistido. A resposta mantem `razaoSocial`. Nome obrigatorio, maximo 150; nao e unico. POST sempre cria ativo=true. PUT segue edicao completa, nao PATCH.

Opcionais: nomeFantasia (150), cpfCnpj (ate 40 antes de normalizar mascara), telefone (30), email (150, validacao basica), cep (8 digitos ou mascara de 9), logradouro (150), numero (20), complemento/bairro/cidade (100), uf (2 letras), observacao (2000). inscricaoEstadual (30) e endereco (255) existentes continuam aceitos/retornados. Strings opcionais vazias viram null; UF e normalizada em maiusculas, CEP sem mascara.

CPF/CNPJ utiliza DocumentoUtils, inclusive digitos verificadores; persiste apenas digitos. Sem documento, tipoPessoa=null; com 11 digitos validos, FISICA; com 14, JURIDICA. Nao exigir escolha manual de tipoPessoa nem documento no cadastro rapido. Documento invalido retorna 400; duplicado no mesmo tenant, inclusive em inativo, retorna 409. Nome igual e permitido; documento igual em empresas distintas tambem.

DTO de manutencao mantem id/empresaId somente para leitura, razaoSocial, nomeFantasia, cpfCnpj, inscricaoEstadual, email, telefone, endereco, ativo e dataCadastro, acrescentando tipoPessoa, endereco estruturado, observacao e dataAtualizacao. DTO enxuto da busca: id, razaoSocial, nomeFantasia, cpfCnpj, telefone. Nao expor Entity.

## Consulta

GET administrativo sempre paginado: page=0, size=25 (1..100), sort=razaoSocial,asc + id,asc. Allowlist: id, razaoSocial, nomeFantasia, cpfCnpj, ativo, dataCadastro, dataAtualizacao. Direcao asc/desc obrigatoria; parametros invalidos retornam 400, sem ajuste silencioso. Desempate id,asc, exceto sort principal por id, que usa sua direcao.

ativo ausente inclui ambos; true/false filtra no banco antes de paginar/count. termo pesquisa razaoSocial/nomeFantasia sem distinguir caixa e documento com ou sem mascara; percentuais/underscores no texto nao sao wildcards. Sem normalizacao de acentos/ranking/pg_trgm. Busca rapida usa a mesma regra, sempre ativo=true e limitada no banco a 20; termo ausente/vazio retorna os primeiros 20 ativos.

**Compatibilidade pendente:** o frontend atual de Contas a Pagar ainda consome GET /fornecedores como array e executa fornecedores.map. O novo envelope paginado exige ajustar esse consumidor; nao usar conversao silenciosa/polimorfismo nem criar endpoint duplicado. Frontend nao foi autorizado neste escopo. Esta incompatibilidade deve ser resolvida antes de publicar o backend junto ao frontend atual.

## Persistencia / historico

V33 aditiva altera a tabela fornecedores criada em V1. Preserva PK, FK de empresa, indices anteriores e a unicidade id/empresa usada pela FK composta de Contas a Pagar da V17. Nenhuma alteracao em Contas a Pagar ou relacionamento novo.

Indice unico parcial por empresa e documento normalizado no banco impede duplicidade, inclusive mascara legada e corrida de criacao; null/vazio nao participa. Sem backfill/deduplicacao. Duplicatas legadas normalizadas dentro do mesmo tenant bloqueiam V33 e exigem regularizacao explicita. Conferir antes do rollout, sem apagar fornecedores automaticamente.

tipoPessoa e dataAtualizacao legados permanecem null ate atualizacao explicita; dataCadastro, endereco e documentos historicos nao sao reescritos pela migration. Novos registros recebem dataCadastro/dataAtualizacao, e edicoes/inativacao atualizam dataAtualizacao. DELETE nao apaga dados nem referencias historicas. Empresa e imutavel na atualizacao JPA; todas as consultas e alteracoes operacionais usam tenant.

## Fornecedores adicionais do Produto — V51

Além do fornecedor principal, um produto pode ter múltiplos fornecedores adicionais com código de referência/fabricante por vínculo (tabela `produto_fornecedor`, constraints com sufixo `_vinc`). Contrato: `fornecedoresAdicionais[{fornecedorId, codigoReferencia}]` no POST/PUT — omissão preserva, lista substitui, vazia remove; resposta inclui os vínculos com o resumo do fornecedor, em lote e sem N+1. Validações antes de persistir: linha sem fornecedor, fornecedor repetido, igual ao principal ou de outro tenant (404). Na duplicação de produto os vínculos adicionais não são copiados. Detalhes em [produtos.md](produtos.md#cadastro-em-abas-e-vínculo-múltiplo-de-fornecedores--v51).

## Fornecedor principal do Produto

Implementação local na `main`, sobre `4e71b92`: a V40 aditiva acrescenta `produtos.fornecedor_principal_id` opcional e FK composta com `empresa_id` para `fornecedores(id,empresa_id)`, reutilizando a unicidade da V17. Cada produto possui no máximo um fornecedor principal; um fornecedor pode atender vários produtos. Não há tabela intermediária, inferência pelos dados existentes ou preenchimento automático. Produtos anteriores permanecem sem fornecedor, com preços, custos e saldos preservados.

`POST /produtos` e `PUT /produtos/{id}` aceitam `fornecedorId` positivo, opcional. Na criação, ausência/null significa sem fornecedor. Na edição, ausência preserva o vínculo, ID válido substitui e `null` explícito remove. O service consulta o fornecedor pela empresa do JWT e rejeita outra empresa/inexistente com 404; ID inválido retorna 400. O contrato de Produto acrescenta `fornecedor: null | {id,razaoSocial,nomeFantasia,ativo}`; não expõe Entity ou dados de outra empresa. A associação é obtida junto da consulta de Produtos, sem consulta HTTP ou fetch adicional por linha, preservando filtros, paginação e ordenação.

O formulário completo de Produto reutiliza o lookup remoto existente de fornecedores ativos. Vínculo a fornecedor posteriormente inativado continua identificado, editável e removível; não se criou restrição de situação no backend para essa associação. Consulta de Produtos mostra o fornecedor e o relatório de preços inclui sua identificação na tela e na impressão de todas as páginas filtradas. Cadastro rápido de Produto mantém seus campos e fluxo anteriores.

**Exclusão e inativação são distintas:** `DELETE /fornecedores/{id}` continua apenas inativando, inclusive com produtos vinculados, preservando seu contrato e referências. Não existe endpoint de exclusão física. A FK da V40 impede exclusão física enquanto qualquer produto, ativo ou inativo, o referenciar; não há cascata nem remoção automática de vínculos.

V40/Flyway/Hibernate validate, atualização V39→V40 com produto pré-existente, tenant e exclusão física validados em PostgreSQL descartável. Resultados em [CURRENT_STATE.md](CURRENT_STATE.md). Não há efeito em Compras, Entradas, Estoque ou Financeiro.

Ainda não implementados: múltiplos fornecedores por produto, Ordem de Compra, Cotação, histórico/tabela de preços e módulo Compras no frontend. Nenhum novo efeito financeiro.
