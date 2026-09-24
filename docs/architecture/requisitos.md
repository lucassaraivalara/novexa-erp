# Requisitos do Sistema - Novexa ERP

## 1. Introdução

Este documento apresenta os requisitos iniciais do Novexa ERP.

Os requisitos representam as funcionalidades que o sistema deverá possuir para atender às necessidades de gestão empresarial.

---

# 2. Requisitos Funcionais

Requisitos funcionais descrevem as ações que o sistema deverá realizar.

---

## 2.1 Módulo de Usuários

O sistema deverá permitir:

* Cadastro de usuários;
* Login no sistema;
* Controle de acesso;
* Definição de permissões;
* Gerenciamento de perfis de usuários.

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
| FUTURO | Gerir Recebíveis, Contas a Receber e Contas a Pagar, incluindo liquidação, pagamentos e recebimentos |
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

## Fase 3 - Operações

* Estoque;
* Comercial;
* Financeiro.

## Fase 4 - Evolução

* Relatórios;
* Dashboards;
* Módulos específicos por segmento.
