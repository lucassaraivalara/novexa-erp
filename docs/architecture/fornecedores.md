# Fornecedor: cadastro backend

Fornecedor e dominio proprio, por empresa, com Entity/DTO/Mapper/Service/Repository existentes evoluidos. Uma unica API de criacao atende cadastro rapido e completo. Futuramente o frontend pode abrir um modal dentro de Produto, Conta a Pagar, Compra ou Entrada, criar e selecionar o objeto retornado sem sair da operacao. Nenhuma dessas integracoes novas foi implementada aqui.

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

Ainda nao implementados: ProdutoFornecedor, fornecedor principal, Ordem de Compra, Cotacao, Entrada de Mercadoria, historico/tabela de precos e modulo Compras no frontend. Nenhum novo efeito financeiro.
