# AGENTS.md — Princípios do Produto Novexa ERP

## Visão do produto

O Novexa ERP é um ERP para pequenas e médias empresas, com foco inicial em comércio, conveniência e operações de frente de caixa.

O produto deve equilibrar dois objetivos:

1. Operação extremamente rápida.
2. Gestão administrativa e financeira forte.

Princípio central:

> O operador precisa de velocidade.
> O gestor precisa de informação.

A complexidade de gestão deve existir no backend e nas áreas gerenciais sem tornar as operações do dia a dia burocráticas.

---

## Princípios obrigatórios de UX e produto

### 1. Operações frequentes devem exigir poucos passos

Fluxos como:

- venda;
- busca de produto;
- recebimento;
- abertura/fechamento de caixa;
- movimentações rápidas;

devem exigir o menor número razoável de cliques e decisões.

Antes de adicionar uma etapa ao fluxo operacional, avaliar se ela é realmente necessária.

---

### 2. Não perguntar o que o sistema já sabe

Se uma informação puder ser inferida automaticamente pelo contexto, não pedir que o operador informe novamente.

Exemplos:

- empresa vem do usuário autenticado;
- usuário vem da autenticação;
- data/hora vêm do sistema;
- caixa atual pode vir da sessão operacional;
- estoque pode ser movimentado automaticamente pela venda.

---

### 3. Controle forte nos bastidores

Uma operação simples na interface pode gerar múltiplos registros internos.

Exemplo:

Finalizar venda pode automaticamente:

- registrar Venda;
- registrar ItemVenda;
- baixar estoque;
- registrar movimento de estoque;
- registrar recebimento;
- registrar movimento de caixa;
- gerar conta a receber quando aplicável;
- alimentar relatórios;
- alimentar indicadores.

Não obrigar o operador a executar manualmente essas etapas quando elas puderem ser automatizadas.

---

### 4. Não confundir ERP completo com interface complicada

O Novexa pode possuir regras de negócio robustas sem expor toda essa complexidade ao usuário operacional.

Configurações avançadas devem ficar em áreas administrativas apropriadas.

Não colocar campos gerenciais ou técnicos no PDV apenas porque existem no domínio.

---

### 5. Priorizar o caminho principal

O fluxo mais comum deve ser o mais rápido.

Exceções podem possuir etapas adicionais.

Exemplo:

Venda comum:
Produto → Pagamento → Finalizar.

Casos especiais podem abrir opções adicionais:

- desconto;
- cliente;
- venda a prazo;
- observação;
- entrega;
- outras exceções.

Não fazer o fluxo comum pagar o custo das exceções.

---

### 6. Segurança não deve gerar burocracia desnecessária

Segurança, autenticação e isolamento multiempresa devem funcionar principalmente nos bastidores.

Exemplo correto:

JWT → identifica usuário → identifica empresa automaticamente.

Exemplo indesejado:

pedir ao operador que escolha sua empresa em cada operação.

---

### 7. Diferenciar área operacional de área gerencial

ÁREA OPERACIONAL:
- rápida;
- objetiva;
- poucos campos;
- atalhos;
- foco em execução.

ÁREA GERENCIAL:
- relatórios;
- filtros;
- indicadores;
- análises;
- auditoria;
- financeiro;
- configurações.

Não aplicar a mesma densidade de informação às duas áreas.

---

### 8. Antes de implementar uma nova regra

Pergunte:

1. Isso melhora controle, segurança ou informação?
2. Isso adiciona passos ao fluxo operacional?
3. O sistema consegue fazer isso automaticamente?
4. Essa configuração poderia ficar fora do PDV?
5. Existe uma forma mais simples para o usuário?

Se uma regra aumentar a burocracia operacional sem benefício claro, não implementar automaticamente.

Apresente a decisão antes.

---

## Prioridades atuais do produto

A ordem geral é:

1. segurança e isolamento multiempresa;
2. estoque funcional;
3. venda/PDV rápido;
4. caixa;
5. integração entre venda, estoque e caixa;
6. financeiro;
7. dashboard;
8. relatórios gerenciais;
9. permissões avançadas;
10. otimizações e recursos adicionais.

Não antecipar funcionalidades avançadas se elas atrasarem o núcleo operacional.

---

## Regra especial para o PDV

O PDV deve ser tratado como uma interface operacional de alta velocidade.

Objetivo ideal para uma venda comum:

Buscar/adicionar produto
→ escolher pagamento
→ finalizar.

Cliente deve ser opcional quando a regra permitir.

Informações administrativas devem ser preenchidas automaticamente sempre que possível.

Ao propor qualquer alteração no PDV, priorize:

- velocidade;
- teclado/leitor de código de barras;
- poucos cliques;
- foco automático;
- feedback imediato;
- prevenção de erros sem excesso de confirmações.

---

## Regra de desenvolvimento

Não reescrever funcionalidades existentes apenas por preferência técnica.

Preservar código funcional quando adequado.

Fazer alterações pequenas, testáveis e rastreáveis.

Não avançar para módulos fora do escopo da tarefa atual.

Se uma implementação tecnicamente correta entrar em conflito com os princípios de simplicidade operacional do Novexa, sinalize o conflito antes de executá-la.


## Regra para auditorias, prompts antigos e trabalho entre agentes

Antes de implementar qualquer correção baseada em:

- auditoria anterior;
- prompt antigo;
- sugestão de outro agente;
- diagnóstico feito antes de mudanças recentes;

valide no estado atual do repositório se o problema ainda existe.

Não reimplementar funcionalidades já corrigidas.

Não desfazer soluções atuais apenas porque outro prompt descreve um estado anterior do projeto.

Quando assumir uma tarefa iniciada por outro agente:

- princípios do produto;
- Java 21 / Spring Boot 3.5.4;
- React/TS/Vite/MUI;
- empresa vem do JWT;
- Flyway controla schema;
- Hibernate validate;
- não alterar migration aplicada;
- não atualizar dependências sem autorização;
- preservar código funcional;
- trabalhar somente no domínio da tarefa;
- verificar trabalho existente antes de implementar;
- múltiplos agentes trabalham em paralelo;
- ler docs/architecture/SYSTEM_CONTEXT.md antes de mudanças arquiteturais.

## Arquitetura financeira obrigatória

Forma de pagamento não é destino financeiro.

- Dinheiro movimenta exclusivamente Caixa físico.
- PIX e transferência movimentam Conta Bancária.
- Débito e crédito geram Recebíveis até a liquidação em Conta Bancária.
- Boleto gera Conta a Receber até a baixa/liquidação.
- Selecionar uma forma de pagamento não comprova, por si só, o recebimento.

O operador escolhe a forma de pagamento. O backend determina o fluxo conforme configuração válida, sem exigir lançamentos manuais no PDV.

Estas regras representam a arquitetura alvo; verificar o que já existe antes de implementar.

## Execução econômica e coordenação entre agentes

- Começar pelos arquivos diretamente relacionados à tarefa.
- Ler outros arquivos somente quando necessários para concluir com segurança.
- Consultar a documentação do domínio envolvido; antes de mudanças arquiteturais, ler também `docs/architecture/SYSTEM_CONTEXT.md`.
- Tratar auditorias como evidências históricas e revalidar seus achados no código atual.
- Cada tarefa deve delimitar objetivo, arquivos ou domínio, dependências e critério de conclusão.
- Usar branch e worktree separados quando houver agentes trabalhando em paralelo.
- Não alterar simultaneamente arquivos compartilhados sem coordenação.
- Centralizar a reserva de números e a integração de migrations em um responsável.
- Rodar primeiro os testes relacionados; ampliar a validação conforme o impacto.
- Ao concluir, informar apenas o que mudou, o que foi validado e eventuais pendências.
- Parar ao concluir o escopo. Não iniciar a próxima tarefa automaticamente.


## Atualização da documentação após alterações

A tarefa só está concluída quando a documentação afetada estiver coerente com o resultado entregue.

Antes de finalizar, avalie o impacto da alteração:

| Alteração realizada | Documento a revisar e atualizar quando afetado |
|---|---|
| Funcionalidade concluída, correção relevante ou nova limitação identificada | `docs/architecture/CURRENT_STATE.md` |
| Mudança em módulos, relacionamentos, contratos ou integrações | `docs/architecture/arquitetura.md` |
| Mudança em regras ou requisitos funcionais | `docs/architecture/requisitos.md` |
| Mudança em pagamentos, Caixa, bancos, recebíveis ou liquidação | `docs/architecture/financeiro.md` |
| Etapa concluída, nova dependência ou mudança de sequência | `docs/architecture/roadmap.md` |
| Decisão aprovada sobre objetivos ou princípios do produto | `docs/architecture/visao-produto.md` |
| Novo documento, mudança de referência ou regra transversal | `docs/architecture/SYSTEM_CONTEXT.md` |
| Mudança de instalação, configuração ou execução | `README.md` |

### Regras

- Atualize somente os documentos impactados, com a menor alteração necessária.
- Não marque como concluído algo apenas planejado, parcialmente implementado ou sem validação suficiente.
- Diferencie implementação atual, arquitetura alvo e pendências.
- Registre o que foi validado e eventuais limitações, sem transformar a documentação em transcrição da execução.
- Não altere decisões oficiais de produto para justificar uma implementação divergente.
- Preserve auditorias datadas como registros históricos. Registre correções e evolução no estado atual.
- Evite duplicação: mantenha o detalhe no documento responsável e use referências nos demais.
- Na entrega, informe quais documentos foram atualizados ou indique que não houve impacto documental.

### Trabalho simultâneo entre agentes

Quando documentos compartilhados tiverem um responsável pela integração, os agentes de implementação devem entregar as atualizações necessárias no resumo, sem editar esses arquivos simultaneamente.

O responsável pela integração deve aplicar as atualizações após validar o resultado consolidado e antes de encerrar a etapa.