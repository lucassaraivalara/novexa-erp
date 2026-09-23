# Novexa ERP — Contexto do sistema

- Produto: ERP web para pequenos comércios, com PDV rápido, operação simples e gestão clara.
- Público: conveniência, tabacaria, suplementos, padaria, cafeteria e pequenos comércios semelhantes.
- Princípio: "O operador precisa de velocidade. O gestor precisa de informação."

Fluxo principal do MVP:
Login → abrir caixa → PDV → venda → pagamento → estoque → sessão de caixa → central de vendas → fechamento → dashboard.

Prioridade atual:
consolidar o fluxo PDV ↔ Venda ↔ Pagamento ↔ Sessão de Caixa ↔ Fechamento ↔ Dashboard.

Conceitos oficiais:
- Venda = o que foi vendido.
- Pagamento = como foi recebido.
- Caixa = ponto operacional do PDV.
- Sessão de Caixa = operação entre abertura e fechamento.
- Dados Bancários = Banco, Agência e Conta Bancária.
- Estoque = controle físico dos produtos.

Já existem no projeto:
- autenticação/JWT
- multiempresa
- Empresa
- Produto
- Cliente
- Estoque
- Venda
- Pagamento
- Formas de Pagamento
- Caixa
- Sessão de Caixa
- suprimento
- sangria
- fechamento
- Central de Vendas
- Dashboard
- Banco
- Agência
- Conta Bancária

Pós-MVP / não antecipar agora:
- NFC-e/NF-e
- TEF
- offline/PWA
- mobile
- conciliação bancária
- CNAB
- contas a pagar completas
- contas a receber completas
- compras avançadas
- BI avançado
- integrações externas não essenciais

Regra:
antes de criar novos módulos, priorizar fechar fluxos completos já existentes.

Não criar novo conceito genérico de Conta Financeira agora.
Não misturar Caixa do PDV com Dados Bancários.

## Como consultar a documentação

Comece pelas regras de [AGENTS.md](../../AGENTS.md).
Leia somente os documentos necessários ao escopo da tarefa.

| Documento | Responsabilidade | Quando consultar |
|---|---|---|
| [visao-produto.md](visao-produto.md) | Visão, objetivos e princípios de experiência | Decisões de produto, telas e fluxos |
| [arquitetura.md](arquitetura.md) | Backend, frontend, módulos, relacionamentos e integrações | Mudanças estruturais ou entre domínios |
| [requisitos.md](requisitos.md) | Requisitos e regras funcionais | Implementação ou alteração de comportamento |
| [financeiro.md](financeiro.md) | Arquitetura financeira e regras de destino dos pagamentos | Pagamentos, Caixa, bancos, recebíveis e liquidação |
| [CURRENT_STATE.md](CURRENT_STATE.md) | Estado implementado, limitações e pendências verificadas | Planejamento e retomada de tarefas |
| [frontend.md](frontend.md) | Padrões de cadastros, ações por ícones, busca/debounce e formulários/feedback | Implementação ou revisão do frontend |
| [roadmap.md](roadmap.md) | Sequência de evolução e dependências | Escolha das próximas tarefas |
| [Auditorias](../audits/) | Evidências históricas e diagnósticos | Investigação de um achado específico |

Os documentos devem distinguir comportamento implementado de arquitetura alvo. Um item descrito no roadmap ou na arquitetura alvo não comprova implementação.

## Regras transversais

- O frontend não determina a empresa da operação.
- Movimentações de estoque devem preservar saldo e histórico.
- Faturamento deve integrar Venda, Estoque e Financeiro com consistência e proteção contra duplicidade.
- Forma de pagamento não é destino financeiro:
  - dinheiro → Caixa físico;
  - PIX/transferência → Conta Bancária;
  - débito/crédito → Recebível → liquidação bancária;
  - boleto → Conta a Receber → baixa bancária.
- A complexidade financeira deve ser processada nos bastidores, mantendo o PDV simples.

Consulte os documentos de domínio para os detalhes e o CURRENT_STATE.md para saber quais desses fluxos já estão implementados.

## Uso de evidências e atualização

Antes de corrigir um problema citado em auditoria ou tarefa anterior, confirme sua existência no código atual.

Se código e documentação divergirem, registre a diferença. O código comprova o comportamento implementado; as decisões oficiais definem o comportamento desejado.

Ao concluir uma mudança relevante:
- atualize CURRENT_STATE.md com o resultado verificado;
- atualize o documento do domínio se houver mudança arquitetural;
- atualize o roadmap se uma etapa ou dependência tiver mudado.

Evite duplicar o mesmo conteúdo em vários documentos. Este arquivo deve permanecer como resumo e guia de leitura.
