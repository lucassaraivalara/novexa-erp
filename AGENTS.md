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