# Requisitos do Sistema - Novexa ERP

## Controle de estoque empresarial — 17B (implementação local)

Novas vendas movimentam estoque apenas com controle empresarial e individual ativos. Desativar/reativar preserva preferências, saldos e movimentos, sem baixas retroativas. Entradas/ajustes explícitos e reversões históricas seguem suas próprias validações. Configuração empresarial reutiliza a autorização ADMIN existente; não amplia privilégios do GERENTE. Precisão, concorrência e snapshots descritos em [estoque.md](estoque.md).

Código interno pode ser omitido no cadastro de Produto: a criação deve persistir um código numérico único por empresa, gerado transacionalmente no backend/PostgreSQL (V47). Código informado mantém a normalização atual e não é substituído; duplicidade é conflito. Edição vazia preserva o código, sem renumerar produtos legados. A mesma geração atende ao procedimento operacional sem código; regras em [produtos.md](produtos.md).

## Ajustes operacionais aprovados — 2026-10-19

MEI é uma opção cadastral de regime tributário, sem implementação de regras fiscais. Consulta de CEP auxilia o endereço de Empresas e permite edição manual e continuidade em caso de indisponibilidade. Sessão JWT tem padrão de uma hora sem renovação, renovação por atividade e limite absoluto padrão de oito horas desde o login. Venda com estoque insuficiente exige autorização por empresa, desativada por padrão, e confirmação explícita do operador, auditada no movimento; demais saídas mantêm bloqueio. Detalhes em [frontend.md](frontend.md) e [estoque.md](estoque.md).

## 1. Introdução

Este documento apresenta os requisitos iniciais do Novexa ERP.

Os requisitos representam as funcionalidades que o sistema deverá possuir para atender às necessidades de gestão empresarial.

---

# 2. Requisitos Funcionais

Listagens administrativas e históricos de crescimento contínuo devem aplicar filtros, ordenação permitida e paginação no banco, com empresa do JWT e desempate por id. Parâmetros inválidos retornam 400. Contratos atuais em [paginacao.md](paginacao.md); catálogos pequenos podem permanecer List.

Requisitos funcionais descrevem as ações que o sistema deverá realizar.

---

## 2.1 Módulo de Usuários

O sistema deverá permitir:

* Cadastro de usuários;
* Login no sistema;
* Controle de acesso;
* Definição de permissões;
* Gerenciamento de perfis de usuários.

Na fase operacional atual, `ADMIN` gerencia usuários; `GERENTE` e `ADMIN` cancelam vendas, registram sangria/suprimento e podem fechar caixas de outros operadores. `OPERADOR` abre caixa e fecha a própria sessão. `USUARIO` permanece como valor legado equivalente a operador. A matriz granular de permissões continua futura.

Gestão MVP: busca paginada por nome/CPF/login/e-mail, filtro ativo/inativo, cadastro, edição, alteração de situação e redefinição de senha. A interface chama o perfil gerencial de Gestor (`GESTOR` aceito como alias do papel `GERENTE` existente). Somente ADMIN administra usuários da própria empresa. Auto-inativação, remoção lógica da própria conta, perda do último ADMIN ativo e alteração destrutiva do ADMIN preservado são bloqueadas; senhas usam BCrypt e a mudança de senha/situação invalida sessões anteriores. Login e e-mail são únicos na empresa. A unicidade global do CPF permanece obrigatória nesta entrega, preservando o login atual por CPF/senha. Gerenciamento de Acessos com permissões por menu/ação permanece fora do MVP entregue. Contrato e migration em [arquitetura.md](arquitetura.md#usuários).

---

## 2.2 Módulo de Clientes

O sistema deverá permitir:

* Cadastro de clientes;
* Alteração de dados cadastrais;
* Consulta de clientes;
* Histórico de movimentações relacionadas ao cliente.

---

## 2.3 Módulo de Produtos

O sistema deverá permitir:

* Cadastro de produtos;
* Alteração de produtos;
* Consulta de produtos;
* Controle de informações como nome, código e preço.
* Importação administrativa XLS/XLSX/CSV com prévia, confirmação explícita e relatório por linha. Cria somente novos produtos, rejeita código/EAN existente e reenvio confirmado não duplica o lote. NCM/CEST são metadados opcionais, sem efeito fiscal; não importa saldo atual. Contrato e limites em [produtos.md](produtos.md).
* Fornecedor principal opcional do mesmo tenant, selecionável no cadastro completo e visível na consulta/relatório. Ausência em edição preserva o vínculo; remoção explícita é permitida. A FK impede excluir fisicamente um fornecedor vinculado, preservando a inativação existente. Sem efeitos operacionais automáticos; contrato em [fornecedores.md](fornecedores.md#fornecedor-principal-do-produto).

Categorias e subcategorias são cadastros administrativos de dois níveis, pertencentes à empresa do JWT, com nome e situação ativa. Nomes são únicos por empresa em cada cadastro, desconsiderando caixa e espaços nas extremidades; a subcategoria exige categoria da mesma empresa. Exclusão de categoria com subcategorias é bloqueada, sem cascata; inativação é independente. Produto pode informar categoria e subcategoria opcionais da mesma empresa; subcategoria exige a categoria correspondente. Edição omissa preserva vínculos e null remove explicitamente. Contratos atuais em [arquitetura.md](arquitetura.md#categorias-e-subcategorias-de-produtos).

Marcas seguem o mesmo padrão de manutenção por empresa, com nome obrigatório, situação e unicidade sem diferenciar maiúsculas/minúsculas. Produto vinculado, mesmo inativo, impede exclusão; inativação da marca preserva o vínculo. Marca é opcional no formulário completo e na API de Produto, com validação da empresa do JWT; o cadastro rápido permanece simples. Contrato em [arquitetura.md](arquitetura.md#marcas-de-produtos).

---

## 2.4 Módulo de Estoque

O sistema deverá permitir:

* Entrada de produtos;
* Saída de produtos;
* Controle de quantidade disponível;
* Histórico de movimentações.

---

## 2.5 Módulo Comercial

O sistema deverá permitir:

* Cadastro de pedidos;
* Registro de vendas;
* Consulta de vendas realizadas;
* Relacionamento entre clientes, produtos e vendas.

---

## 2.6 Módulo Financeiro

As capacidades abaixo distinguem a fundação implementada das etapas planejadas. Reutilizar Pagamento e Caixa cadastral; o estado real e o baseline estão em [CURRENT_STATE.md](CURRENT_STATE.md).

| Estágio | Capacidade requerida |
|---|---|
| IMPLEMENTADO no backend | Administrar formas de pagamento globais, sem empresaId, com descrição, tipo técnico e ativo; preservar códigos/contratos antigos e histórico durante a transição para ID |
| IMPLEMENTADO no backend | Abrir, consultar sessão aberta e fechar Caixa da empresa autenticada; registrar operadores e horários; impedir sessões abertas simultâneas no mesmo Caixa; vincular novas vendas faturadas à sessão, totalizar formas sem inflar dinheiro, registrar suprimento/sangria idempotentes e calcular esperado/diferença no fechamento |
| IMPLEMENTADO na branch feat/conferencia-fechamento-backend | Conferir opcionalmente o fechamento por forma, com snapshots, observacao obrigatoria em divergencias e retry idempotente; contrato legado preservado. Integracao e validacoes em CURRENT_STATE.md |
| PRÓXIMO | Cadastrar condições de pagamento para prazo e parcelamento, sem confundi-las com forma de pagamento |
| PRÓXIMO | Cadastrar Banco, Agência e Conta Bancária com seus relacionamentos e escopo autorizado |
| FUTURO | Produzir os demais efeitos de Pagamento nos destinos bancários, confirmação/baixa e reversões; a entrada de DINHEIRO no Caixa já existe no MVP |
| IMPLEMENTADO no backend da Fase 3A | Gerir Contas a Pagar da empresa autenticada: documento opcional, edição de abertas, pagamento integral com data e Conta Financeira ativa da mesma empresa, SAIDA financeira vinculada, cancelamento e estorno que reverte saldo; vencida e saldo em aberto derivados. Frontend da baixa ainda pendente de adaptação. |
| IMPLEMENTADO na branch feat/contas-financeiras-base e Fase 3A backend | Gerir Contas Financeiras da empresa autenticada com saldo gerencial, entradas/saídas manuais e saídas de Contas a Pagar sem saldo negativo, extrato e estorno motivado sem exclusão; sem integração automática com PDV. |
| IMPLEMENTADO em ContaReceber (Blocos 1/2 + integracao Venda/PDV Bloco 3) | Criar contas manuais e parcelas de Venda; receber parcial/total com N movimentos financeiros e destinos por baixa; estornar movimento individual; consultar pagina/filtros/sort e resumo. Venda combina pagamentos imediatos + parcelasPrazo com cliente obrigatorio e soma exata; prazo nao cria Pagamento nem dinheiro. Cancelamento da Venda estorna baixas e cancela parcelas atomicamente com estoque/pagamentos. Editar/cancelar individualmente somente contas manuais conforme historico. Recebivel de cartao permanece separado. |
| FUTURO | Operar pagamento misto sobre a relação Venda 1:N Pagamento, com validação explícita da composição e dos valores |
| FUTURO | Evoluir cobrança, conciliação e relatórios financeiros avançados após as fundações e integrações |

Movimentacoes de Caixa tratam exclusivamente dinheiro fisico; a sessao tambem totaliza e confere operacionalmente os demais meios, sem liquidacao financeira. Selecionar uma forma, cadastrar uma condição ou registrar um Pagamento não comprova recebimento nem gera, por si só, movimentação financeira. Preservar histórico, idempotência e empresa obtida da autenticação.

Conceitos, exemplos e limites de escopo estão em [financeiro.md](financeiro.md); a sequência de entrega, em [roadmap.md](roadmap.md). Os recursos avançados ali classificados como FUTURO não são requisitos de entrega da próxima fundação.

---

## 2.7 Relatórios

O sistema deverá permitir:

* Visualização de indicadores;
* Relatórios gerenciais;
* Análise das informações do negócio.

---

# 3. Requisitos Não Funcionais

São características de qualidade do sistema.

## Segurança

O sistema deverá possuir:

* Controle de autenticação;
* Proteção dos dados dos usuários;
* Controle de permissões.

## Desempenho

O sistema deverá:

* Possuir boa velocidade de resposta;
* Suportar crescimento da quantidade de dados.

## Manutenção

O sistema deverá:

* Possuir código organizado;
* Seguir boas práticas de desenvolvimento;
* Permitir evolução dos módulos.

## Escalabilidade

A arquitetura deverá permitir:

* Criação de novos módulos;
* Adaptação para diferentes segmentos;
* Expansão das funcionalidades.

---

# 4. Prioridade inicial de desenvolvimento

A primeira versão do Novexa ERP terá como foco:

## Fase 1 - Fundação

* Configuração do projeto;
* Banco de dados;
* Estrutura backend;
* Sistema de usuários.

## Fase 2 - Cadastros principais

* Clientes;
* Produtos;
* Fornecedores.

Fornecedor: somente nome/razao social obrigatorio; documento opcional, validado quando informado e unico por empresa. Cadastro rapido e completo usam a mesma API, com lookup ativo limitado e manutencao paginada. Inativacao preserva historico. Integracao embutida no frontend e modulo operacional de Compras ainda nao implementados. Contrato em [fornecedores.md](fornecedores.md).

## Fase 3 - Operações

* Estoque;
* Comercial;
* Financeiro.

## Fase 4 - Evolução

* Relatórios;
* Dashboards;
* Módulos específicos por segmento.
