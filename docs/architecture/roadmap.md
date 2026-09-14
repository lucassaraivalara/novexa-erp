# Roadmap do Projeto - Novexa ERP

## 1. Objetivo

Este documento apresenta o planejamento de evolução do Novexa ERP.

O roadmap organiza as principais fases de desenvolvimento do produto, permitindo uma construção estruturada e incremental.

A numeração geral agrupa o escopo do produto; não exige concluir todos os recursos listados antes de iniciar a próxima fundação financeira. O estado implementado é registrado em [CURRENT_STATE.md](CURRENT_STATE.md). A sequência financeira atualizada está na Fase 7, com distinção entre IMPLEMENTADO, PRÓXIMO e FUTURO.

---

# Fase 1 - Fundação do Projeto

Objetivo:

Criar a base técnica e organizacional do sistema.

Status:

Consultar [CURRENT_STATE.md](CURRENT_STATE.md) para o estado implementado e as limitações verificadas.

Entregas:

* Criação do repositório Git;
* Estrutura inicial do projeto;
* Configuração do ambiente de desenvolvimento;
* Documentação inicial do produto;
* Definição da arquitetura.

---

# Fase 2 - Estrutura Backend

Objetivo:

Construir a base da aplicação utilizando Java e Spring Boot.

Entregas:

* Criação do projeto Spring Boot;
* Configuração do banco de dados;
* Organização das camadas da aplicação;
* Configuração das APIs REST;
* Preparação da estrutura modular.

---

# Fase 3 - Sistema de Usuários

Objetivo:

Criar o controle de acesso ao sistema.

Entregas:

* Cadastro de usuários;
* Login;
* Autenticação;
* Controle de permissões;
* Perfis de acesso.

---

# Fase 4 - Cadastros Principais

Objetivo:

Criar a base de informações do ERP.

Entregas:

* Cadastro de clientes;
* Cadastro de fornecedores;
* Cadastro de produtos;
* Cadastro de categorias.

---

# Fase 5 - Módulo Comercial

Objetivo:

Criar os processos relacionados às vendas.

Entregas:

* Orçamentos;
* Pedidos;
* Vendas;
* Histórico comercial.

---

# Fase 6 - Módulo Estoque

Objetivo:

Controlar movimentações de produtos.

Entregas:

* Entrada de produtos;
* Saída de produtos;
* Controle de saldo;
* Histórico de movimentações.

---

# Fase 7 - Módulo Financeiro

Objetivo:

Evoluir a gestão financeira incrementalmente, preservando a velocidade operacional e as separações definidas em [financeiro.md](financeiro.md).

## 7.1 Fase atual — IMPLEMENTADO

Base de referência: `integracao/pagamento-frontend-baseline`, reunindo Pagamento (`aeaec2e`), arquitetura (`4efddaa`) e frontend até `6be4a18`. Validações em [CURRENT_STATE.md](CURRENT_STATE.md); incorporação na `main` ainda pendente.

* Venda consolidada: ABERTA → FATURADA, com itens históricos e proteção contra duplicidade;
* Estoque consolidado: saldo/histórico, movimentações e integração com faturamento;
* Caixa cadastral, exclusivamente dinheiro físico;
* Fundação de Pagamento: registro no faturamento e consulta, com modelo 1:N e contrato atual de um pagamento por venda.
* Frontend Financeiro > Cadastros: Caixa funcional e Dados Bancários apenas como shell de navegação, sem implementar os cadastros bancários da próxima fase.

O lançamento financeiro temporário continua por compatibilidade. Não representa a implantação dos destinos financeiros oficiais. Limitações e validações existentes permanecem em CURRENT_STATE.md.

## 7.2 Próxima fundação — PRÓXIMO

1. Tipo/Forma de Pagamento: distinguir comportamento de cadastro configurável da empresa, preservando os contratos e o histórico atuais.
2. Condição de Pagamento: cadastro de prazos/parcelamento, separado da forma e sem regras de crédito ou cobrança avançada.
3. Banco: cadastro da instituição.
4. Agência: cadastro vinculado ao Banco.
5. Conta Bancária: cadastro apoiado em Banco/Agência e no escopo autorizado da empresa.

Reutilizar o cadastro de Caixa existente. Entregar cada fundação em tarefa pequena; cadastrar não deve gerar movimentações. Contratos backend devem estar CONTRACT READY antes do frontend dependente. A integração dos commits concluídos no baseline precede o início das tarefas dependentes.

## 7.3 Depois — FUTURO

* Integração DINHEIRO → Caixa físico, com Movimentação de Caixa;
* Integração PIX/TRANSFERÊNCIA → Conta Bancária, com Movimentação Bancária;
* Recebíveis de DÉBITO/CRÉDITO e posterior liquidação bancária;
* Contas a Receber, incluindo o fluxo de BOLETO e sua baixa;
* Contas a Pagar e seus efeitos financeiros.

As integrações dependem das configurações cadastrais e dos domínios correspondentes. Substituir os efeitos temporários gradualmente, preservando rastreabilidade, atomicidade e idempotência, sem duplicar lançamentos.

## 7.4 Mais tarde — FUTURO

* Cobrança, carteira, boleto avançado e CNAB;
* Conciliação bancária;
* Fluxo financeiro gerencial e relatórios financeiros avançados.

Política de crédito, bloqueios automáticos, cobrança avançada, portal B2B e força de vendas permanecem fora da próxima fundação, conforme os limites de financeiro.md. Não implementar infraestrutura futura apenas para antecipar esses recursos.

---

# Fase 8 - Evolução do Produto

Objetivo:

Preparar o Novexa ERP para crescimento.

Possíveis evoluções:

* Dashboards;
* Indicadores de negócio;
* Integrações externas;
* Implantação em nuvem;
* Módulos específicos por segmento.

---

# Estratégia de implantação

O Novexa ERP será desenvolvido utilizando uma arquitetura preparada para ambiente cloud.

A primeira implantação será realizada em ambiente local, permitindo validação do produto com clientes reais sem dependência de internet.

A arquitetura deverá permitir futura migração para infraestrutura em nuvem mantendo a organização dos módulos e da aplicação.
