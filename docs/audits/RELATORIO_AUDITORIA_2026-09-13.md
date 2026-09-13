# Relatório consolidado de auditoria — Novexa ERP

**Data:** 13/09/2026  
**Natureza:** consolidação documental de três auditorias e das decisões de negócio do responsável pelo produto.  
**Objetivo:** estabelecer uma referência para estabilização e evolução do ERP, distinguindo implementação observada, pendências de revalidação e arquitetura alvo.

## 1. Fontes, critérios e limites

| Referência | Origem | Documento e evidências utilizadas |
|---|---|---|
| R1 | Chat embutido do VS Code, identificado pelo usuário como provavelmente Copilot | “Relatório de Auditoria — Novexa ERP”; seções 5–13: módulos, duplicidade de itens, financeiro, migrations e execuções de testes |
| R2 | Kilo Code no VS Code; origem corrigida expressamente pelo usuário, inicialmente atribuída ao Codex Astra | “AUDITORIA COMPLETA — NOVEXA ERP (Atualizada)”; seções 2, 5–13: workspace, venda aberta, endpoints, testes e riscos |
| R3 | Codex | “Relatório de auditoria — Novexa ERP”; seções 2, 6–13: mudanças concorrentes, evidências de código, testes executados e limitações |
| U1 | Responsável pelo produto | Decisões financeiras na conversa “Planejar evolução do ERP” e no pedido desta consolidação |

Os três anexos originais, todos datados de 13/09/2026 e enviados como `Texto colado.txt`, foram consultados. As referências R1/R2/R3 remetem a esses documentos; U1 é autoridade sobre a arquitetura financeira desejada, não prova de implementação.

**Não foi feita uma nova auditoria do código ou do banco nesta consolidação.** “Confirmado” significa sustentado pelas auditorias no estado que elas observaram. Não certifica o HEAD atual, uma implantação ou o funcionamento em produção. As auditorias ocorreram com alterações concorrentes; R3 registra que não conseguiu validar a revisão final.

Critérios:

- Convergência entre fontes confirma a existência histórica de uma estrutura, não sua completude operacional.
- Resultados de comandos têm mais peso que classificações genéricas como “concluído”.
- Divergências são explicitadas; ausência de menção não equivale a ausência de implementação.
- Achados de uma única fonte e hipóteses de concorrência são identificados como tais.
- Não são adotados percentuais de conclusão nem prazos sem base verificável.

## 2. Resumo executivo

O Novexa possui cadastros, autenticação JWT, isolamento multiempresa implementado, estoque transacional e PDV integrado à finalização direta de vendas. O financeiro registra um lançamento básico por venda, e Caixa possui cadastro.

O principal problema é a consolidação do fluxo operacional: dois modelos de item de venda coexistem, a venda aberta não está integrada à API/PDV e o Codex identificou finalização que mantém o status `ABERTA`. Não há comprovação de uma revisão integrada com backend, build frontend, migrations e operação ponta a ponta aprovados.

A arquitetura financeira oficial exige separar dinheiro físico, recursos bancários e valores ainda a receber. O lançamento atual `RECEBIDO`/`A_RECEBER` não implementa essa separação. Portanto, a existência do PDV e de um registro financeiro não comprova que o ERP esteja pronto para operação comercial completa.

## 3. Estado atual confirmado nas fontes

### 3.1 Base tecnológica e organização

R1, R2 e R3 convergem em Java 21, Spring Boot 3.5.4, Maven, PostgreSQL, JPA/Hibernate, Flyway, Spring Security e JWT. O frontend utiliza React 19, TypeScript, Vite, Material UI, React Router, Axios, React Hook Form e Yup. Há testes backend e frontend; Playwright está presente no ecossistema, mas o fluxo E2E referenciado não foi comprovado como operacional.

O backend é um monólito organizado em camadas técnicas:

```text
React → serviços frontend/Axios → API REST
                                → Controller → Service → Repository/JPA → PostgreSQL
                                → DTOs, mappers, segurança e tratamento de erros
```

Java 25 e Spring Boot 3.5.12 não integram o baseline definido pelo usuário e não constavam no POM auditado por R3. Versões menores do frontend divergem entre os relatórios; a referência de reprodução deve ser o manifesto e o lockfile da revisão integrada, sem upgrade implícito.

### 3.2 Situação por módulo

| Módulo | Implementação observada | Limite operacional | Fontes |
|---|---|---|---|
| Autenticação | Login por CPF/senha, BCrypt, JWT, sessão stateless, principal com empresa/usuário/perfil e interceptor Axios | Autorização por perfil e revogação imediata não consolidadas | R1/R2/R3 |
| Empresa | Cadastro amplo, dados fiscais, endereço, logomarca, geocodificação e frontend | Provisionamento de novo tenant não constitui onboarding completo | R1/R3; R2 confirma cadastro |
| Usuário | CRUD backend vinculado à empresa, CPF, senha e perfil | Frontend operacional ausente; permissões insuficientes | R1/R2/R3 |
| Produto | CRUD, códigos, preço, ativo, controlaEstoque, estoqueAtual e estoqueMinimo | Formulário e contrato de saldo precisam ser alinhados | R1/R2/R3; detalhe em R3 |
| Cliente | Cadastro, documentos, contatos, endereços, inativação e frontend | Limite de crédito cadastral não implica gestão de crédito ou contas a receber | R1/R2/R3 |
| Fornecedor | CRUD backend por empresa | Tela ausente em R1/R3; R2 não a verificou em detalhe. Compras não integradas | R1/R2/R3 |
| Estoque | Entrada, saída, ajuste, histórico e integração com Produto/Venda | Tela placeholder; sem fluxo completo de inventário e gestão | R1/R2/R3 |
| Venda | Finalização direta e lógica parcial de venda aberta | Dois caminhos não consolidados; cancelamento/estorno ausentes | R1/R2/R3 |
| Item de venda | VendaItem e ItemVendaEntity; tabelas venda_itens e itens_venda | Representações concorrentes, sem migração/conversão consolidada | R1/R2/R3 |
| Financeiro | LancamentoFinanceiro vinculado à venda | Registro bruto; sem destinos, liquidação, taxas e conciliação | R1/R2/R3 |
| Caixa | Cadastro com empresa, descrição e ativo; CRUD/inativação | Sem movimentações, saldo ou entrada automática de dinheiro; frontend com validação pendente | R1/R2/R3 |
| Dados Bancários | Nenhuma implementação identificada | Banco, agência, conta e movimentos pendentes | R1/R2/R3 |
| Dashboard/relatórios | Dashboard com valores fixos/placeholders | Sem indicadores reais e relatórios operacionais consolidados | R1/R2/R3 |

### 3.3 Estoque

As três fontes descrevem movimentação transacional com lock pessimista, validação de saldo insuficiente, saldo anterior/posterior e histórico. O saldo materializado fica em `ProdutoEntity.estoqueAtual`. Os endpoints de entrada, saída, ajuste e histórico por produto existem.

R3 detalha que `AJUSTE` define o saldo final, incluindo zero, e que empresa/operador vêm do principal autenticado. Também observa implementação de baixa dentro de `VendaService`, separada do serviço de movimentação manual. A integração existe, mas suas garantias precisam ser uniformizadas e testadas no código integrado.

### 3.4 Vendas

**Fluxo direto:** carrinho local no PDV → `POST /vendas` → `VendaService.finalizar(...)` → persistência da venda, baixa/histórico de estoque e lançamento financeiro. Há cliente opcional, validação de produto/preço, desconto, total, pagamento, troco, locks e idempotência. R3 registra que esses efeitos estão previstos na mesma transação; não há fundamento para afirmar ausência de transação.

**Venda aberta:** métodos de serviço para criar venda, adicionar/remover itens, alterar quantidade, aplicar desconto e vincular/remover cliente. Os controllers auditados expunham apenas finalização direta e consulta por ID, sem os endpoints desse segundo caminho. Carrinho em `sessionStorage` não equivale a venda aberta persistida no servidor.

**Duplicidade:** a finalização direta usa `VendaItem`/`venda_itens`, enquanto a venda aberta usa `ItemVendaEntity`/`itens_venda`. R3 também encontrou a resposta HTTP baseada apenas na coleção do primeiro caminho. Isso exige unificação de domínio e preservação dos dados antes de ampliar a API.

**Preço histórico:** R3 identificou preço unitário nos dois modelos e nome do produto em `VendaItem`. A conclusão de R2 de que preço histórico inexiste não deve ser reproduzida. A pendência é preservar e harmonizar os snapshots existentes.

### 3.5 Financeiro e Caixa existentes

`LancamentoFinanceiroEntity` registra empresa, venda, forma, valor, data/hora e situação. Os relatórios descrevem dinheiro/PIX como `RECEBIDO` e débito/crédito como `A_RECEBER`.

Esse registro não prova entrada no Caixa, crédito bancário ou recebível operacional com liquidação. Não foram identificados movimentos de Caixa, conta bancária de destino, adquirente integrada, parcelas, taxas ou conciliação. Boleto e transferência são requisitos da arquitetura alvo, sem implementação comprovada nas auditorias.

### 3.6 Segurança e multiempresa

Controllers e consultas usam o contexto autenticado para restringir dados por empresa; há testes de isolamento relatados. Isso não comprova cobertura integral de todos os caminhos.

A regra oficial é `JWT → UsuarioAutenticado → empresaId`. O frontend não determina o tenant. Um `empresaId` enviado pelo cliente não pode substituir a empresa autenticada. Autenticação e presença de um perfil no token não significam autorização administrativa efetiva.

## 4. Cruzamento das divergências e revalidação necessária

### 4.1 Matriz de reconciliação

| Tema | Comparação das fontes | Conclusão consolidada |
|---|---|---|
| Testes frontend | R2 declara ausência; R1 e R3 registram 20 aprovados | Há testes frontend. Não equivalem a E2E de venda real; reexecutar na revisão integrada |
| E2E do PDV | R2/R3 apontam referência a e2e/pdv.spec.mjs inexistente | Script/configuração E2E operacional precisam ser conferidos e corrigidos |
| Compilação backend | R1/R2 registram teste inválido; R3 viu falha e posterior substituição por outro agente | A falha ocorreu na compilação de testes; execução final inconclusiva. Não afirmar que o erro continua nem que foi validado |
| Frontend Caixa | R2 descreve CRUD funcional; R1/R3 registram falha de build e lint | Tela implementada não significa entrega compilável. Revalidar tipos de Caixa/AppTable, interface vazia e aviso do formulário |
| Preço histórico | R2 marca ausente; R3 identifica campos nos dois modelos | Ausência total refutada pela evidência mais específica; preservar snapshots na consolidação |
| Status após finalização | R2 chama finalização de funcional; R3 identifica persistência como ABERTA | Defeito observado por R3, de alto impacto; reproduzir no código integrado e corrigir se persistir |
| Isolamento por empresa | R2 sugere brecha por parâmetro; R1/R3 descrevem tenant derivado do JWT | Parâmetro em método interno não prova exploração HTTP. Validar endpoints e caminhos internos, sem declarar vazamento comprovado |
| JWT expirado | R2 aponta validarAssinatura; R3 descreve validação e limitações de sessão | Retorno de helper isolado não prova aceitação de token expirado. Testar o filtro/endpoint completo |
| V5 | As fontes a observaram sem rastreamento; R3 registra mudanças posteriores | Situação histórica, não estado atual do Git. Não presumir que basta versionar a V5 tal como foi encontrada |
| Worktree e HEAD | R2 chama worktree Kilo de ativo; R3 o identifica como outro worktree e registra alterações concorrentes | Confirmar diretório, branch e hash antes de usar qualquer resultado como baseline |

### 4.2 Achados que exigem validação dirigida

| Prioridade | Ponto | Evidência e verificação necessária |
|---|---|---|
| P0 | Revisão reproduzível | Registrar branch, hash, alterações locais e versões; repetir compilação/testes backend, testes frontend, build e lint sem gravações concorrentes |
| P0 | Venda faturada como ABERTA | R3, seção 6: finalizar venda e verificar status persistido, resposta e impossibilidade de edição após faturamento |
| P0 | Duplicidade de itens | Mapear dados, leituras, gravações, DTOs e totalização das duas tabelas antes de escolher a migração |
| P0 | Flyway/PostgreSQL | Conferir histórico real de migrations, checksums, V3/V5 e inicialização em banco limpo e banco atualizado |
| P1 | Sobrescrita de estoque | R3 infere risco na edição cadastral sem versionamento/lock equivalente; hipótese não reproduzida. Testar edição concorrente com movimentação |
| P1 | Edição de venda aberta | R3 aponta ausência de proteção concorrente e desconto não revalidado após redução/remoção de itens; testar perda de atualização e total negativo |
| P1 | Caminhos internos sem tenant | R3 viu updateStatus por ID sem empresa, sem endpoint público correspondente; rastrear chamadas e exigir isolamento no caminho completo |
| P1 | Atividade e autorização | Validar usuário/empresa/produto inativos, cliente inativo na venda aberta e permissões ADMIN/USUARIO |
| P1 | Ciclo do JWT | Testar expiração, inativação, exclusão, troca de senha/perfil e definir política de invalidação |
| P1 | CPF e integridade | R3 aponta unicidade global apenas no serviço, sem constraint correspondente na V1; confirmar regra e banco efetivo |
| P2 | Contrato Produto/frontend | R3 observa estoqueAtual editável/enviado e ignorado pelo backend; evitar confirmação enganosa de alteração de saldo |
| P2 | Escala e UX | Validar catálogo carregado no navegador, paginação/histórico e operação integral do PDV por teclado |

P0 indica estabilização e integridade antes de ampliar o fluxo; P1 deve ser resolvido conforme o escopo antes de operação real; P2 trata evolução operacional. A classificação não afirma que hipóteses já foram reproduzidas.

### 4.3 Banco e testes: limites específicos

As fontes identificam V1 cadastral, V2 de movimentações de estoque, V3 de vendas/itens/financeiro, V4 de caixas e V5 de ajustes para vendas abertas. R3 observou alteração histórica de V3, com potencial divergência de checksum em bancos que executaram a versão anterior.

A V5 relatada remove restrições e permite campos nulos. Sua adequação precisa ser avaliada por status: uma venda aberta pode estar incompleta, mas uma faturada precisa satisfazer as invariantes de totalização e pagamento. Não atribuir a simples versionamento da V5 uma garantia de correção de schema.

R3 também sinaliza ausência de `flyway-database-postgresql` no POM auditado. Conferir a resolução de dependências e a inicialização real antes de classificar isso como falha efetiva do ambiente.

Grande parte dos testes usa H2 com `create-drop`; isso não valida a evolução real via Flyway/PostgreSQL. R3 menciona `VendaHttpTest` com Flyway/validate, cuja execução não foi concluída. Contagens de arquivos/anotações não são resultados de testes.

Os resultados históricos disponíveis são: 20 testes frontend aprovados em R1/R3; build e lint frontend com falhas; compilação de testes backend interrompendo a primeira tentativa e repetição final sem resultado em R3. Nenhum desses comandos foi executado novamente nesta consolidação.

## 5. Arquitetura alvo — regras oficiais do usuário

### 5.1 Regra fundamental

**Forma de pagamento não é destino financeiro.** Forma, situação de recebimento e destino devem ser conceitos distintos. Dinheiro e PIX podem estar recebidos e, ainda assim, afetar patrimônios operacionais diferentes.

| Forma | Efeito financeiro esperado | Destino/etapa seguinte | Caixa físico |
|---|---|---|---|
| Dinheiro | Movimento de entrada ou saída de numerário | Caixa identificado | Sim |
| PIX | Movimento bancário conforme recebimento/pagamento confirmado | Conta bancária identificada | Não |
| Transferência | Movimento bancário conforme recebimento/pagamento confirmado | Conta bancária identificada | Não |
| Cartão de débito | Gera recebível da adquirente | Liquidação posterior em conta bancária | Não |
| Cartão de crédito | Gera recebível, com parcelas/vencimentos quando aplicável | Liquidação posterior em conta bancária | Não |
| Boleto | Gera conta a receber | Baixa/liquidação e movimento em conta bancária | Não |

Selecionar PIX no PDV não é, por si só, comprovação bancária. O mecanismo de confirmação ainda precisa ser definido. Cartão não aumenta o saldo bancário disponível na autorização; boleto emitido não equivale a boleto recebido.

### 5.2 Responsabilidades financeiras

- **Caixa:** cadastro e controle exclusivo de dinheiro físico, entradas, pagamentos em dinheiro, sangrias, suprimentos, ajustes e saldo. Abertura, fechamento e conferência são evolução futura conforme o modelo operacional escolhido.
- **Dados Bancários:** banco, agência e conta bancária vinculada à empresa.
- **Movimentação Bancária:** entradas e saídas efetivas da conta, com origem e referência.
- **Recebíveis:** valores de cartão ainda não liquidados, com adquirente, prazos e parcelas quando aplicáveis.
- **Contas a Receber:** obrigações de recebimento futuro, incluindo boleto.
- **Contas a Pagar:** obrigações futuras de pagamento; a baixa afeta Caixa ou conta conforme o meio efetivamente utilizado.

Essas responsabilidades são alvo. A existência de `LancamentoFinanceiro` e de um cadastro de Caixa não significa que estejam implementadas.

### 5.3 Experiência do PDV

O operador escolhe opções usuais de pagamento. O backend aplica o fluxo financeiro correspondente, sem exigir criação manual de lançamentos, recebíveis ou movimentações.

O mapeamento para Caixa, conta bancária e adquirente deve vir de configuração operacional válida. A regra para escolher entre múltiplos destinos ainda precisa ser definida; não deve ser inventada silenciosamente a cada venda. A falta de configuração deve gerar orientação clara, sem registrar uma operação em destino incorreto.

Relatórios futuros precisam permitir separar forma, situação, Caixa físico, conta bancária e recebíveis pendentes. A liquidação de um recebível não representa uma segunda venda ou nova receita da mesma operação.

## 6. Arquitetura alvo — recomendações de implementação

Esta seção traduz U1 e os achados em propostas técnicas. Nomes de entidades, cardinalidades, mecanismos de integração e migrations ainda dependem de decisão e validação no repositório.

### 6.1 Venda e ItemVenda

Adotar uma representação canônica de item, preservando produto, quantidade, preço aplicado, descontos e histórico. A escolha entre reaproveitar `VendaItem` ou `ItemVendaEntity` depende do inventário de dados e contratos; não excluir automaticamente uma das tabelas.

O ciclo deve garantir:

```text
ABERTA → FATURADA → CANCELADA
```

- `ABERTA`: admite edição validada de itens, desconto e cliente; sem efeitos definitivos de estoque/financeiro.
- `FATURADA`: totais e pagamentos validados; efeitos únicos de estoque e financeiro; itens e valores operacionalmente imutáveis.
- `CANCELADA`: histórico preservado e efeitos revertidos conforme o estágio financeiro; sem exclusão dos registros originais.

O descarte/cancelamento de venda ainda aberta deve ter regra própria, sem estornar efeitos que não ocorreram. `FATURADA` aqui descreve o estado operacional proposto e não comprova emissão fiscal.

Preservar a agilidade do PDV direto é compatível com um domínio único. Se vendas abertas persistidas forem adotadas, seus endpoints devem usar as mesmas regras de finalização e totalização. A decisão não é simplesmente expor todos os métodos atuais antes de consolidar o modelo.

### 6.2 Pagamento e lançamento financeiro

Formalizar Pagamento como responsabilidade separada da Venda: forma, valor aplicado, situação, momento, origem e referências de destino ou obrigação futura. Para dinheiro, distinguir valor entregue, troco e valor líquido aplicado à venda.

O atual `LancamentoFinanceiro` pode ser evoluído ou mantido como registro de origem, desde que não seja confundido com saldo de Caixa, crédito bancário ou título liquidado. Definir seu papel antes de criar registros paralelos que dupliquem valores.

Pagamentos mistos, taxas, antecipações e liquidações parciais requerem contratos próprios; são evoluções a especificar, não funcionalidades confirmadas ou decisões já encerradas.

### 6.3 Integração e integridade

```text
Venda validada → faturamento → baixa/histórico de estoque
                            → Pagamento
                               ├─ dinheiro → MovimentoCaixa
                               ├─ PIX/transferência → MovimentoBancário
                               ├─ débito/crédito → Recebível → liquidação bancária
                               └─ boleto → Conta a Receber → baixa bancária
```

Reutilizar as regras existentes, com consistência transacional dos efeitos locais e idempotência de finalização, liquidação e cancelamento. Chamadas externas futuras exigem tratamento próprio de falhas; não se presume que uma transação de banco reverta uma operação de adquirente.

Cancelamento precisa distinguir obrigação ainda pendente de pagamento já liquidado. No primeiro caso, cancelar/reverter a obrigação; no segundo, registrar devolução/estorno financeiro apropriado, preservando vínculo com a operação original. Evitar duplicação de estoque, entrada ou estorno ao repetir a requisição.

### 6.4 Evolução do schema

Flyway permanece como mecanismo de evolução e Hibernate em `validate`. Antes de novas migrations: verificar o histórico aplicado, resolver divergências de V3/V5 e reservar versões disponíveis. Não modificar migration já aplicada nem presumir que V6 seja o próximo número seguro.

A consolidação de itens deve mapear os dados das duas tabelas, preservar referências e snapshots, reconciliar totais e só então retirar a estrutura antiga de uso. Validar tanto banco limpo quanto atualização de base existente. As entidades financeiras alvo exigirão migrations próprias depois da definição de seus contratos.

## 7. Roadmap recomendado e critérios de aceite

| Fase | Entrega | Dependência | Critério de conclusão |
|---|---|---|---|
| 0 — Estabilização | Revisão integrada identificada, build/lint/testes reproduzíveis | Inventário de alterações locais e trabalhos concorrentes | Resultados vinculados ao mesmo hash; falhas e interrupções resolvidas |
| 1 — Schema e venda | V3/V5 reconciliadas, ItemVenda canônico e ciclo de status coerente | Fase 0 e inventário dos dados | Migração sem perda; faturamento persiste FATURADA; edição posterior rejeitada |
| 2 — Estoque | Regras consistentes entre venda, movimentação e cadastro | Modelo de venda definido | Sem baixa duplicada, saldo perdido ou efeitos parciais em falha |
| 3 — Pagamentos | Contratos de forma, situação, destino e obrigações | Fases 1–2 | Roteamento financeiro especificado e testado, sem duplicação de valores |
| 4 — Caixa e banco | Dinheiro no Caixa; PIX/transferência em conta | Fase 3 e configurações de destino | Movimentos rastreáveis, saldos coerentes e nenhum meio bancário no Caixa físico |
| 5 — Recebíveis e títulos | Débito/crédito com liquidação; boleto com conta a receber | Pagamentos e conta bancária | Liquidação única; pendências não aumentam disponibilidade bancária antecipadamente |
| 6 — Cancelamento e PDV | Estornos por estágio, comprovante e E2E do fluxo integrado | Domínios envolvidos implementados | Reenvio, falha e cancelamento preservam histórico e consistência |
| 7 — Gestão | Estoque visual, telas restantes, indicadores e relatórios | Contratos e dados confiáveis | Visões reconciliadas por empresa, forma, destino e situação |

Autorização e isolamento devem acompanhar cada fase e ser validados antes da operação real. Projetar o cancelamento desde a consolidação de Venda e implementá-lo junto aos efeitos correspondentes; a fase 6 fecha a validação integrada, não adia todas as regras de reversão. Contas a Pagar e compras entram em escopo próprio após os contratos financeiros básicos.

## 8. Checklist de revalidação e entrega operacional

- [ ] Registrar branch, hash e estado local sem alterações concorrentes durante a validação.
- [ ] Conferir baseline Java/Spring e dependências resolvidas do frontend.
- [ ] Confirmar testes backend, testes frontend, build e lint no mesmo estado integrado.
- [ ] Validar Flyway/PostgreSQL em base limpa e atualização de base existente.
- [ ] Consolidar itens com preservação de histórico, relações e totais.
- [ ] Comprovar finalização FATURADA, bloqueio de edição e idempotência.
- [ ] Testar rollback local e concorrência entre vendas, movimentações e cadastro de Produto.
- [ ] Testar acesso cruzado entre empresas, autorização e política de sessão.
- [ ] Garantir que dinheiro movimente apenas Caixa físico e que troco não infle o recebimento líquido.
- [ ] Garantir que PIX/transferência usem conta bancária e confirmação definida.
- [ ] Garantir que débito/crédito permaneçam recebíveis até liquidação.
- [ ] Garantir que boleto gere conta a receber até a baixa.
- [ ] Testar repetição de liquidação/cancelamento sem duplicar efeitos.
- [ ] Executar E2E versionado do PDV, incluindo teclado, falha de comunicação e reenvio.
- [ ] Reconciliar relatórios com movimentos e obrigações, sem contar liquidação como nova venda.

## 9. Coordenação e manutenção desta referência

Para trabalho com vários agentes, usar branches/worktrees separados, responsáveis por módulos e um responsável pela sequência de migrations. Alterações em VendaService, entidades/DTOs de Venda, modelos de item, estoque e migrations dependentes exigem coordenação. Separar frontend/backend só permite trabalho paralelo seguro após definir contratos e arquivos compartilhados.

Preservar alterações legítimas e revisar stash/arquivos não rastreados antes de qualquer limpeza. Não atualizar dependências globais nem remover testes, tabelas ou migrations apenas para eliminar um bloqueio aparente.

Este relatório é uma fotografia documental de 13/09/2026. Ao revalidar, registrar hash, ambiente, verificações e resultados. Atualizar o estado corrente na documentação do projeto e alterar a arquitetura financeira somente mediante nova decisão explícita do responsável pelo produto.
