# Tarefa 17 — Auditoria da Gestão de Estoque

Data: 26/10/2026, America/Sao_Paulo. **STOCK MANAGEMENT AUDIT COMPLETE.**

Auditoria concluída significa diagnóstico e planejamento fundamentados, não aprovação do módulo sem ressalvas. Foi confirmado um defeito de precisão/reversão em conversões de Entrada, além de inconsistências pontuais e lacunas de implantação. Nenhuma correção foi implementada. Nenhum dado da Mustache foi consultado novamente, ajustado ou reprocessado.

## 1. Resumo executivo

O núcleo deve ser evoluído, não reconstruído. Já existem saldo materializado, movimentos transacionais, ajuste por saldo físico, entradas manuais e XML, conversão por fornecedor, composição versionada de kits, baixa no faturamento, reversões históricas, paginação e filtros por tenant. Concorrência, idempotência dos processos de Venda/Entrada e rollback possuem cobertura relevante, inclusive PostgreSQL real.

**A prioridade conceitual não está integralmente implementada:** existe `Produto.controlaEstoque`, mas não existe uma configuração empresarial geral para ativar/desativar estoque. `Empresa.permitirVendaEstoqueNegativo` é outra regra: autoriza a exceção de venda sem saldo, mediante confirmação. Não equivale a desligar o controle. A expressão `empresa.controlaEstoque && produto.controlaEstoque` não pode ser avaliada hoje.

**Principal defeito comprovado nesta auditoria:** a quantidade de Entrada e o fator de fornecedor aceitam três casas cada, mas seu produto pode exigir mais de três. `EntradaMercadoriaService.confirmar` não exige representação exata antes de movimentar. PostgreSQL arredonda a quantidade e o saldo; o cancelamento compara o movimento arredondado com o produto exato e é bloqueado. Reprodução HTTP: `0,003 × 0,5 = 0,0015`, movimento persistido `0,002`, saldo `1,002` a partir de `1,000`, confirmação 200 e cancelamento 409.

**Outros fatos comprovados:** entrada manual em produto inativo retorna 201 pela API, embora a tela a desabilite; inativação por DELETE não passa pelo registro de auditoria usado pelo PUT; repetição do mesmo POST manual registra movimentos distintos. Este último é ausência de garantia de idempotência, não prova de duplicação involuntária em produção.

**Implantação:** um cliente consegue cadastrar produtos e informar saldos por ajustes individuais, sem SQL. Falta uma experiência integrada para habilitação empresarial, preparação/revisão de saldos em lote e inventário. Não há importação de estoque CSV/XLSX na aplicação. A carga operacional antiga de produtos e a importação XML de mercadoria são recursos distintos e não devem ser confundidos com inventário/importação de saldos.

**Próxima implementação recomendada: Tarefa 17A**, começando pela validação exata da conversão de Entrada e pela sua reversão, sem ampliar precisão do banco ou reparar históricos. Depois, 17B deve completar a configuração e implantação com cuidado especial para kits.

## 2. Escopo, fontes e preservação

### Git auditado

- Branch local: `main`; HEAD `71f2ea0224359ad0e886fdc45ab79941f0ce9d17`.
- Há 172 caminhos modificados/untracked no baseline, incluindo frontend da padronização, documentação e arquivos operacionais paralelos. O staging contém documentação e versões parciais de componentes; foi preservado byte a byte.
- Worktrees existentes preservados: principal, Kilo destacado em `8bb9aa0` e composição de publicação destacada em `cc25222f`.
- O frontend publicado por tarefa anterior está em `cc25222f`; esta auditoria examinou o worktree atual, com seus arquivos locais. Não avançou a branch local nem buscou integrar alterações.
- Backend de estoque e teste com expectativa V47 examinados permanecem iguais ao HEAD local. Os defeitos descritos não foram introduzidos por esta auditoria.
- Somente este relatório foi criado no repositório. Nenhum staging, commit, push, deploy, alteração funcional ou migration.

### Fontes e método

Foram lidos AGENTS.md, SYSTEM_CONTEXT.md, regras de coordenação, documentação de Estoque, Produtos, Entradas e os relatórios [T16](auditoria-operacional-mustache-producao-2026-10-25.md) e [T16A](investigacao-historica-mustache-2026-10-25.md). Referências históricas foram confrontadas com código e testes atuais. Minimal Work limitou a leitura ao domínio e suas integrações. Impeccable e Web Design Guidelines orientaram a revisão operacional do código de interface; não houve redesenho.

Foi criado **um cluster PostgreSQL 18.6 novo no TEMP**, limitado a `127.0.0.1:56374`, banco `novexa_audit17`, com dados sintéticos. Não é o serviço PostgreSQL local original nem uma restauração da Mustache. Testes usam schemas próprios; o smoke HTTP usou `smoke17` e API exclusivamente em `127.0.0.1:53191`. Importação local de configurações foi substituída por um recurso inexistente opcional; datasource, JWT e storage receberam parâmetros sintéticos. Não houve acesso ao Supabase ou à Oracle.

Docker não está disponível no PATH; isso não impediu a validação com binários locais do PostgreSQL em cluster descartável. Nenhuma instalação ou configuração permanente foi alterada. A API foi executada com as classes atuais compiladas pelo Maven e bibliotecas existentes, em processo isolado.

A captura inicial da saída de `pg_ctl start` excedeu 60 segundos, embora o log já registrasse o servidor pronto. A conexão explícita confirmou banco, porta e versão do cluster temporário antes dos testes; não houve nova inicialização sobre os dados nem tentativa de reparar um banco existente. O encerramento posterior desse cluster retornou sucesso.

O schema de smoke contém **43 tabelas incluindo o histórico Flyway**, 57 migrations versionadas aplicadas com sucesso, versão final **58**, Hibernate validate e inicialização Spring aprovados. Não há V54 na sequência atual; nenhuma migration foi modificada. O health de readiness não está disponibilizado nesse profile de teste (404); a inicialização e os endpoints funcionais HTTP foram efetivamente exercitados, sem declarar aquele health aprovado.

Não houve benchmark de capacidade, acesso produtivo ou nova investigação histórica. As conclusões de performance e UX não observadas em runtime são identificadas como riscos/limitações.

## 3. Mapa da implementação existente

Os caminhos Java abaixo têm prefixo `backend/novexa-api/src/main/java/br/com/novexa/erp/`.

| Área | Componentes principais | Comportamento encontrado |
|---|---|---|
| Produto/saldo | `entity/ProdutoEntity.java:117–130`, `dto/ProdutoRequestDTO.java:75–86`, `service/ProdutoService.java`, `mapper/ProdutoMapper.java` | Quantidade/saldo/mínimo NUMERIC(19,3), custo/preço NUMERIC(19,2), controle individual; cadastro não aceita estoque atual como campo editável |
| Política empresarial | `entity/EmpresaEntity.java:54–60`, `EmpresaRequestDTO`, `EmpresaResponseDTO`, `service/EmpresaService.java:135–136` | Somente permissão de venda negativa; não há habilitação empresarial geral |
| Núcleo de movimentos | `service/MovimentacaoEstoqueService.java`, `entity/MovimentacaoEstoqueEntity.java`, DTOs, mapper e repository homônimos | ENTRADA soma, SAIDA subtrai, AJUSTE define saldo final; usuário/tenant do contexto, produto bloqueado e transação única |
| API de movimento | `controller/MovimentacaoEstoqueController.java` | POST `/estoque/movimentacoes/entrada`, `/saida`, `/ajuste`; GET `/produto/{produtoId}` paginado |
| Vendas/PDV | `service/VendaService.java:220–378`, `service/ComposicaoProdutoService.java`, `service/CancelamentoVendaService.java` | Venda direta e faturamento de ABERTA convergem no mesmo núcleo; saída ao faturar, não ao incluir item no rascunho |
| Entradas/Compras | `EntradaMercadoriaService`, `EntradaMercadoriaController`, entidades Entrada/Item, `EntradaMercadoriaRepository` | RASCUNHO → CONFIRMADA → CANCELADA; fornecedor e até 200 produtos; quantidade/custo históricos, vínculos de movimentos e reversão |
| XML | `EntradaXmlService`, `NfeXmlParser`, `EntradaXmlPreviewDTO`, `EntradaXmlImportacao.tsx` | Preview sem escrita; matching tenant-safe por GTIN e código do fornecedor; revisão e criação pelo fluxo existente de Entrada |
| Kits | `ComposicaoProdutoService`, `ComponenteProdutoEntity`, `ConsumoKitVendaEntity` e repositories | Versões, fatores até seis casas, consumo exato em três casas, agregação com itens avulsos, snapshots e reversão original |
| Auditoria cadastral | `ProdutoAuditoriaEntity`, `ProdutoAuditoriaRepository`, `ProdutoService.atualizar/registrarAuditoria` | Registra mudança de controle, ativo e versão de composição pelo PUT com usuário; não é uma trilha automática de toda alteração SQL/API |
| Frontend | `pages/Estoque/{Estoque,EntradasMercadoria,EntradaMercadoriaForm,EntradaMercadoriaItens,EntradaXmlImportacao}.tsx` | Abas Saldo/Entradas, busca, filtros e paginação; diálogos para movimento/histórico; formulário manual/XML reutilizado |
| Cadastros/PDV | `pages/Produtos/{ProdutoForm,ComposicaoProdutoCampos}.tsx`, `pages/Empresa/EmpresaForm.tsx`, `pages/Vendas/{Vendas.tsx,pdv.ts}` | Controle individual, avisos críticos, composição; política de negativo na Empresa; confirmação de insuficiência no PDV |
| Services frontend | `services/estoqueService.ts`, `services/entradaMercadoriaService.ts`, `services/produtoService.ts` | Consumem APIs existentes, sem enviar empresa/usuário para decidir tenant do movimento |

Migrations diretamente relacionadas: V1 (Produto/Empresa), V2 (movimentos), V6 (vínculos/faturamento), V34 (Entradas e FKs), V37 (obrigação financeira explícita), V40/V51 (vínculos cadastrais), V44 (negativo confirmado), V46 (kits), V47/V50 (código de produto), V52 (fator fornecedor), V53 (auditoria de Produto), V56/V57 (histórico comercial de data/unidade). V58 trata parcelamento do consumidor, não habilitação de estoque.

## 4. Controle por empresa e produto

### Matriz conceitual versus implementação

| Empresa desejada | Produto | Controle efetivo desejado | Situação atual |
|---|---|---|---|
| Ativado | Ativado | Ativado | Comportamento existente para produto simples: valida saldo e gera baixa |
| Ativado | Desativado | Desativado | Venda simples não baixa; movimento avulso/Entrada do produto é rejeitado |
| Desativado | Ativado | Desativado | **Não representável**: falta flag empresarial; produto continua controlado |
| Desativado | Desativado | Desativado | Estado empresarial não representável; comportamento sem baixa decorre apenas do produto |

Não há quatro cenários executáveis da matriz empresarial; não foram inventados campos ou tratadas as duas linhas ausentes como testes aprovados. A consulta do schema mostrou apenas `empresas.permitir_venda_estoque_negativo` como coluna de estoque. Entidade, DTOs, service, formulário de Empresa e migrations concordam com essa constatação.

### Controle individual, desligamento e reativação

`ProdutoService.atualizar:227–260` preserva o saldo e altera o flag; registra usuário/data/valores anterior e novo quando a requisição passa pelo controller atual. No HTTP sintético, desligar e religar manteve saldo `5,000`, cinco movimentos e criou duas auditorias de controle. Não houve baixa retroativa.

Produto nasce com saldo zero (`ProdutoEntity:123–124,144–159`); `ProdutoMapper.preencherDados` não recebe saldo atual. `ProdutoService.atualizar` não atribui estoque atual. Portanto ativar controle de produto que já existia exige contagem/entrada/ajuste adequado; não reconstitui as vendas sem controle.

Componente usado em composição vigente não pode perder controle ou mudar unidade: `ComposicaoProdutoService.validarAlteracaoFisica`. Kit força `controlaEstoque=true` e não tem saldo físico próprio. A inativação pode bloquear suas vendas posteriores, com mensagens específicas.

**Dependência para 17B:** não basta acrescentar um `if` empresarial no faturamento. `consumos_kit_venda.movimento_id` é NOT NULL na V46 e `CancelamentoVendaService:57–58` bloqueia kit sem consumo histórico. Permitir kit comercial sem baixa empresarial exige representar de forma confiável a dispensa de baixa e preservar sua composição/histórico, sem fazer um kit legítimo parecer corrompido. Decidir/reutilizar snapshots existentes antes da implementação; não inferir um novo modo para registros antigos.

Também é necessário decidir se, com empresa desligada, Entradas/Ajustes ficam bloqueados ou podem preparar uma implantação controlada. Reversões devem continuar baseadas na movimentação original, não no flag cadastral atual. Nenhuma política nova foi aplicada nesta auditoria.

## 5. Fluxos de movimentação e integridade

| Fluxo | Origem e efeito | Transação, repetição e tenant | Diagnóstico |
|---|---|---|---|
| Cadastro/edição de produto | Sem movimento; saldo inicial zero; edição cadastral preserva saldo | Produto/empresa identificados pelo JWT; edição/composição usa locks e DynamicUpdate | Reutilizável; não usar cadastro para alterar estoque |
| Saldo inicial individual | AJUSTE/AJUSTE, quantidade significa novo saldo, inclusive zero | Núcleo bloqueia produto e grava usuário, data e saldo anterior/posterior | Existe; falta fluxo de implantação em lote e classificação explícita da origem inicial |
| Entrada/saída avulsa | ENTRADA/MANUAL ou SAIDA/MANUAL | POST transacional com lock de produto; DTO limita três casas | Correto em casos básicos; produto inativo aceito pela API e sem deduplicação de retry |
| Ajuste físico | AJUSTE/AJUSTE substitui o saldo pela contagem informada | Lock serializa gravação, não torna uma contagem antiga compatível com vendas posteriores | Existe; sem documento de contagem, revisão em lote ou estorno vinculado de ajuste |
| Entrada de mercadoria | ENTRADA/COMPRA de `quantidade × fator`; atualiza último custo por unidade | Locks Entrada/fornecedor/produtos; ID original por item; confirmação repetida não duplica | Correto para conversões representáveis; falha de precisão detalhada na seção 6 |
| XML | Preview → revisão → rascunho → mesma confirmação de Entrada | Parser limitado, proteção contra entidades externas, unicidade de NF-e por tenant | Infraestrutura real reutilizável; não é importação de estoque CSV/XLSX |
| Compra/pedido | Pedido/ordem de compra não encontrado como fluxo implementado separado | Entrada representa recebimento físico; obrigação a pagar é ação explícita | Não criar outro módulo de recebimento para suprir implantação |
| Venda no PDV | SAIDA/VENDA de produto simples controlado; consumo de componentes para kit | Lock operador/venda/produtos, valida totais/saldo e grava tudo na mesma transação | Mesma regra de estoque da venda fora do PDV |
| Venda fora do PDV | ABERTA sem baixa; faturar executa o núcleo compartilhado | Chave/resumo e lock evitam duplo faturamento; financeiro/caixa falhos fazem rollback | Cobertura real PostgreSQL exercitada |
| Produto simples sem controle | Sem movimento e sem vínculo de baixa no item | Não exige disponibilidade física; cancelamento não inventa reposição | Comportamento permitido, não indício automático de erro |
| Kit | Saídas por componente, sem saldo de kit; necessidades agregadas com itens avulsos | IDs ordenados, versão esperada, consumo e custo históricos, unicidade por item/componente/movimento | Correto nas suítes, inclusive alteração posterior da composição |
| Cancelamento de venda | ENTRADA/CANCELAMENTO da saída original | Lock de venda; operação repetida retorna cancelada; valida tenant/produto/quantidade do original; rollback integral | Reverte mesmo após produto deixar de controlar; não usa composição atual |
| Cancelamento de Entrada | SAIDA/CANCELAMENTO da entrada original | Repetição não duplica; saldo insuficiente bloqueia; vínculos financeiros revalidados | Reversão histórica preservada, mas conversão arredondada pode impedir cancelar |
| Histórico | Somente leitura, sem recalcular estoque | Produto/empresa validados; filtros e sort permitidos; size de 1 a 100 e desempate por ID | Vínculos de Entrada e kit buscados em lote; auditoria de cadastro tem lacunas |

Não foi encontrado estorno genérico de movimento avulso com referência única ao original. Registrar um movimento compensatório manual é possível, mas não equivale a reversão vinculada, autorizada e idempotente. Não há exclusão de movimento exposta nesses controllers.

### Estoque negativo

O padrão empresarial é bloquear. `VendaService:328–335` calcula insuficiências agregadas e exige simultaneamente permissão empresarial e `confirmarEstoqueInsuficiente=true`. `MovimentacaoEstoqueService.movimentarSaidaVenda` reaplica a permissão; flag de exceção fica no movimento, com CHECK da V44. O PDV distingue a empresa que permite confirmar daquela que bloqueia (`Vendas.tsx:443–449`). Apenas a saída de Venda possui essa exceção; saída manual e cancelamento de Entrada continuam impedidos de produzir negativo.

Os seis testes selecionados de Venda em PostgreSQL incluem a confirmação, venda sem controle, fracionamento, disputa do último saldo, repetição e rollback. A política não foi alterada nem interpretada como habilitação empresarial de estoque.

## 6. Problemas comprovados e riscos priorizados

### P1 — Conversão de Entrada arredonda estoque e impede cancelamento

**Código:** `EntradaMercadoriaService.confirmar:102–109`, `cancelar:125–132`; `MovimentacaoEstoqueService.aplicarMovimentacao`; `FornecedorVinculoDTO`; V52; colunas NUMERIC(19,3) de Produto/Movimento.

Entradas e fator do fornecedor têm até três casas, mas sua multiplicação pode ter seis. Diferentemente do consumo de kit, que aplica `setScale(3, UNNECESSARY)`, o caminho de Entrada envia o produto exato ao núcleo e deixa o banco arredondar.

| Passo HTTP real no cluster descartável | Esperado para integridade | Observado |
|---|---|---|
| Produto controlado, fator fornecedor `0,5`, saldo inicial `1,000` | Dados representáveis individualmente | Cadastro/ajuste aceitos |
| Criar Entrada com quantidade `0,003`, custo `10,00` | Rascunho válido ou indicação explícita de conversão não representável | 201; fator preservado no item |
| Confirmar | Rejeitar antes de efeitos se `0,0015` não cabe no estoque, ou exigir revisão explícita | 200; movimento `0,002`, saldo `1,002` |
| Cancelar | Reversão exata ou confirmação nunca ter ocorrido | 409: `Movimentacao original inconsistente.`; Entrada permanece CONFIRMADA |

**Impacto:** quantidade física contabilizada diferente do produto exato e recebimento que não pode ser revertido pelo fluxo normal. Não há evidência de que esse cenário tenha ocorrido na Mustache. Sua reprodução é atual e sintética.

**Menor correção recomendada, não implementada:** validar representabilidade e limites de quantidade efetiva antes de qualquer efeito, com mensagem orientativa; usar a mesma quantidade validada na confirmação e comparação/reversão. Não aumentar escala, reduzir o fator silenciosamente ou arredondar para fazer o teste passar. Testar conversões exatas/inexatas, valor mínimo/zero por arredondamento, overflow, múltiplos itens, rollback e cancelamento. Para legado que porventura já tenha esse padrão, apenas diagnosticar separadamente; não reprocessar dados automaticamente.

### P2 — Produto inativo recebe entrada avulsa pela API

**Código:** `MovimentacaoEstoqueService.validarProdutoControlaEstoque` verifica composto/controle, mas não ativo; `Estoque.tsx:185–187` desabilita ações de produto inativo; `EntradaMercadoriaService.validarProduto:198–201` exige ativo para novas Entradas.

**Reprodução:** inativar produto (204), POST `/estoque/movimentacoes/entrada` retorna 201 e aumenta saldo `5,000 → 6,000`. Há inconsistência entre a operação disponibilizada na tela e a API. Reversões históricas intencionalmente ignoram alterações cadastrais e devem continuar funcionando.

**Recomendação:** confirmar a política para novas operações avulsas e aplicá-la de forma consistente no backend, preservando os métodos específicos de reversão. Não extrapolar esta observação para proibir estorno de produto inativo.

### P2 — Inativação pelo DELETE não registra auditoria cadastral

**Código:** `ProdutoController.inativar:145–151` chama `ProdutoService.inativar:328–332` sem usuário; a auditoria de `ativo` está em `atualizar:257–260`.

**Reprodução:** duas alterações de controle via PUT geraram duas linhas de auditoria; DELETE retornou 204, marcou inativo e deixou zero registros de alteração do campo `ativo`. O frontend usa esse caminho na ação de inativação (`Produtos.tsx:175,359`). A V53 prevê a rastreabilidade de mudanças críticas, mas esse caminho não a produz.

**Recomendação:** reutilizar o mecanismo atual e a identidade do usuário do JWT na inativação; não criar outra infraestrutura de auditoria nem apagar histórico.

### P2 — Lacunas de implantação e repetição manual

- Não existe controle empresarial geral nem fluxo unificado de ativação/reativação. Alterar todos os flags individuais para simular um desligamento destrói a preferência de cada produto e pode invalidar kits.
- POSTs avulsos não têm chave de requisição/identificação da operação. Dois pedidos idênticos de entrada retornaram 201/201 e saldo final `2,000`. O frontend impede clique simultâneo enquanto salva, mas não resolve resposta perdida/reenvio. Não é defeito de idempotência de Venda/Entrada: esses processos têm seus próprios mecanismos e passaram.
- Motivo de movimento é opcional no request; o preenchimento é sugerido, não obrigatório. Deve haver decisão de negócio proporcional ao risco para ajustes, sem adicionar burocracia ao PDV.
- AJUSTE grava a contagem atual, mas não possui versão da leitura/contagem. Lock protege o saldo durante o commit; não detecta que houve venda entre contar fisicamente e confirmar. Trata-se de limite do ajuste pontual, não falha dos testes de serialização.

### P2/P3 — UX e rastreabilidade, por inspeção

- `Estoque.tsx:159–172,199,237–248`: mensagens de falha são colocadas no Alert da página, fora do Dialog que permanece aberto. Há risco de erro ficar atrás do modal e fora de seu contexto acessível. Fato de estrutura JSX confirmado; efeito em leitor de tela não exercitado nesta auditoria. Recomenda-se mensagem contextual no diálogo e foco apropriado em futura correção pontual.
- O histórico disponibiliza link persistido para Entrada e kit. A venda simples não ganha link por esse caminho: `MovimentacaoEstoqueMapper` não preenche vendaId e `buscarVendasKitOrigem` cobre kits. O item de Venda contém o vínculo inverso reutilizável. Não extrair ID interpretando motivo livre.
- O histórico usa nome atual do Produto e não possui unidade histórica própria no movimento. Alteração da unidade de produto simples que não está em composição não tem a mesma proteção dos componentes. A unidade comercial da Venda já tem snapshot V57; isso não demonstra unidade histórica de todo movimento de estoque. Política de mudança de unidade com saldo/histórico requer decisão e testes específicos; não se afirmou perda observada em produção.
- Falta orientação integrada para começar a controlar um produto antigo sem supor que o saldo herdado represente contagem física.

### Qualidade de testes — expectativa Flyway desatualizada

`KitProdutoPostgresTest.schemaAtualV47Validado:25` executa `flyway.validate()` e depois exige versão `47`; o schema atual correto está em `58`. O arquivo é idêntico ao HEAD. É a única falha da rodada dirigida, não uma migration quebrada. Não foi corrigida nem omitida da contagem. Outras expectativas antigas de V44 no teste completo de Venda existem no código, mas não foram executadas nesta rodada selecionada; não são falhas novas declaradas sem execução.

## 7. Classificação das funcionalidades

| Funcionalidade | Situação | Evidência | Recomendação |
|---|---|---|---|
| Controle por empresa | **AUSENTE** | Empresa/DTOs/schema/formulário só contêm permissão de negativo | 17B, sem simular desligamento alterando todos os Produtos |
| Controle por produto | **EXISTENTE E CORRETA** no recorte validado | Flag, PUT auditado, venda sem controle, HTTP de desligar/religar sem movimentos | Preservar preferência individual e proteções de componente |
| Controle efetivo combinado | **AUSENTE** | Não há operando empresarial geral | Implementar após definir efeitos em kits/Entradas/reversões |
| Estoque negativo | **EXISTENTE E CORRETA** no recorte validado | V44, confirmação 409/aceite, testes PostgreSQL | Preservar permissão + confirmação e separação de operações manuais |
| Saldo inicial | **PARCIALMENTE IMPLEMENTADA** | Cadastro zero + ajuste individual auditado | Implantação/revisão em lote, sem backfill de vendas |
| Entrada/recebimento manual e XML | **EXISTENTE COM PROBLEMAS** | Ciclo e concorrência passam; conversão inexata reproduz defeito | Corrigir quantidade efetiva antes de ampliar uso |
| Ajuste manual por entrada/saída | **EXISTENTE COM PROBLEMAS** | Núcleo funciona; inativo aceito e retry sem identificação | Política de ativo, deduplicação proporcional e motivo |
| Ajuste por saldo físico | **PARCIALMENTE IMPLEMENTADA** | AJUSTE define novo saldo e preserva trilha | Acrescentar revisão/conflito de contagem quando operacionalmente necessário |
| Ajuste em massa | **AUSENTE** como operação de ajuste | Nenhum endpoint/tela de ajuste em lote; Entrada multi-item não é inventário | Reutilizar núcleo de movimento, não inventar compra/fornecedor |
| Habilitar controle em massa | **AUSENTE** na aplicação | Edição individual e scripts operacionais históricos, sem UI/API de lote | Após configuração empresarial e decisões de auditoria |
| Importação CSV/XLSX de estoque | **AUSENTE** como funcionalidade do produto | Sem tela/endpoint/service; carga antiga ignora saldos | Reaproveitar validações/parser de dados úteis, com preview e confirmação próprios |
| Importação XML de mercadoria | **EXISTENTE E CORRETA** quanto ao fluxo avaliado, com a ressalva de conversão da Entrada | Parser/matching/revisão e suíte Entrada; leitura de código do parser | Manter infraestrutura; não criar importador paralelo de recebimento |
| Inventário físico completo | **AUSENTE** | Sem entidade/API/tela de sessão de contagem; só ajuste individual | Evolução leve sobre lote/contagem, com regra para concorrência |
| Histórico e auditoria | **PARCIALMENTE IMPLEMENTADA** | Movimento e vínculos Entrada/kit; auditoria V53 parcial | Cobrir inativação, esclarecer origem/unidades e consulta cadastral |
| Kits | **EXISTENTE E CORRETA** no recorte atual | Suíte PG e validação exata em três casas; snapshots e cancelamento | Reutilizar; avaliar dependência antes de estoque empresarial desligável |
| Pedido/ordem de compra | **AUSENTE** como módulo separado | Recebimento via Entrada; docs distinguem evolução futura | Não é requisito para sanar os defeitos/implantação atuais |

“Existente e correta” se limita às regras, código e cenários auditados; não é certificação universal. Funcionalidades ausentes foram procuradas em frontend, backend, entidades, controllers, services e ferramentas operacionais antes da classificação.

## 8. Importação, lote e inventário — reaproveitamento real

O script `scripts/operacoes/carga_inicial_produtos.py` e sua documentação de Produtos representam carga operacional, não importador SaaS. Há leitura de planilha, validação de códigos/unidades, tratamento de duplicidade e relatórios. Estoque inicial dessa carga foi zero; coluna de estoque não foi importada. **Não executar ou transplantar seu acesso SQL de produção para uma tela.** Algoritmos de validação, casos de teste e mensagens podem ser reutilizados após separar particularidades da carga original.

A V42 criou `importacoes_produtos`, mas não foi encontrada Entity/repository/API/tela atual usando-a. A mera existência da tabela não significa importação implementada nem obriga reutilizá-la sem avaliar seu contrato. XML existente já oferece preview, matching, resolução de pendências, rascunho e confirmação: são padrões e componentes reaproveitáveis, preservando a diferença entre recebimento com fornecedor e ajuste/inventário.

Para inventário, nenhum dos oito passos solicitados possui um documento de processo persistido hoje: iniciar sessão, selecionar escopo, registrar contagens, comparar/revisar diferenças, aprovar/finalizar, consultar histórico do inventário e lidar com vendas concorrentes. O AJUSTE resolve apenas a aplicação pontual de saldo físico e deixa histórico de movimento. A interface de múltiplos itens da Entrada pode inspirar revisão de linhas, mas não deve gerar uma compra fictícia ou dívida para lançar saldo inicial.

## 9. Segurança e qualidade técnica

### Permissões efetivas

`config/SecurityConfig.java` tem fallback `.anyRequest().authenticated()`. Controllers de estoque/produto não acrescentam restrição de perfil para os endpoints examinados.

| Operação | ADMIN | GERENTE | OPERADOR | USUARIO | Evidência |
|---|---|---|---|---|---|
| Movimento avulso/ajuste e consulta de estoque | Permitido | Permitido | Permitido | Permitido | POST de entrada retornou 201 para os quatro perfis no HTTP sintético; regra comum de segurança |
| Cadastro/edição/inativação de produto e seu controle | Permitido | Permitido | Permitido | Permitido | SecurityConfig/controller; não há role específica nesses caminhos |
| Entrada/confirmar/cancelar recebimento | Permitido | Permitido | Permitido | Permitido | Segurança e documentação atuais seguem usuário autenticado; testes de tenant/estado |
| Alterar Empresa/política negativa | Permitido | Negado | Negado | Negado | Regras POST/PUT/PATCH/DELETE de `/empresas/**` exigem ADMIN |
| Cancelar venda faturada | Permitido | Permitido | Negado | Negado | Regra explícita POST `/vendas/{id}/cancelar` |

A Tarefa 17 não definiu matriz administrativa nova para estoque. O acesso amplo a ajustes/controle é uma **decisão de negócio e risco a revisar**, não uma violação automática de uma regra ADMIN/GERENTE já implementada para pagamentos. Não se propõe copiar permissões financeiras indiscriminadamente para o operador do estoque.

### Tenant, transações e precisão

- Empresa/usuário vêm do JWT, e a autenticação consulta vínculo atual. HTTP com token válido da outra empresa recebeu 404 para histórico do produto.
- Núcleo de movimentos consulta produto/usuário por empresa e verifica vínculos. Cancelamento busca o original e compara explicitamente empresa/produto antes de reverter. Essa busca por ID não foi tratada como vazamento sem considerar a validação posterior.
- FKs compostas de Entrada/composição e unicidades protegem vínculos; testes PostgreSQL de restrições e isolamento passaram. Produto/Venda/Entrada possuem locks ordenados e refresh após espera.
- `@Transactional` preserva saldo, movimento, item, status e efeitos integrados. Concorrência não depende de arredondamento em JavaScript. O uso de `BigDecimal` é correto, mas não substitui a validação de escala do produto de dois decimais na Entrada.
- Quantidades: três casas; fator de kit: seis, com consumo final exato em três; fator de fornecedor: três; custo/preço no domínio atual: duas. Não há custo médio implementado para ser refeito nesta tarefa. Não exigir quatro casas para um preço persistido que aceita duas.
- Reversões históricas não devem ser bloqueadas pelo simples desligamento/inativação posterior; os métodos específicos existentes já atendem essa necessidade.

### Consultas e performance — fatos versus riscos

- Saldos, produtos e movimentos já são paginados no servidor, com whitelist de sort, limite 100 e desempate por ID (`util/Paginacao.java:12–20`). A tela usa 10/25/50, debounce e AbortController; histórico é carregado ao abrir, sem polling periódico próprio.
- Vínculos de Entrada e kit são obtidos em lote pelos IDs da página. Não há busca de origem por linha nesse mecanismo. Classificação por saldo/estoque mínimo ocorre antes do count no repository de Produto.
- `MovimentacaoEstoqueRepository.listarPagina` retorna entidades e `MovimentacaoEstoqueEntity` tem relações ManyToOne com carregamento padrão EAGER. `ProdutoEntity.empresa` também é EAGER e Empresa contém logomarca. Há risco de custo de relações e consultas por usuários distintos, apesar da projeção JWT já otimizada.
- Fórmulas correlacionadas calculam disponibilidade/custo de kits, inclusive filtros/ordenação. Crescimento deve ser medido com volume representativo antes de trocar queries ou criar índice.
- Não foram medidos nesta tarefa bytes banco/API, N+1 efetivo, latência do cliente ou saturação. Os problemas antigos de Caixas/Financeiro não são automaticamente atribuídos ao Estoque. Não se recomenda cache entre tenants ou aumento de pool sem medição.

## 10. Experiência operacional e acessibilidade

**Pontos positivos:** abas claras Saldo/Entradas, rótulo “Novo saldo físico” no AJUSTE, preview do saldo, quantidade brasileira com até três casas, explicação de kit sem saldo próprio, estados negativo/baixo/sem controle, filtros remotos, links de origem em nova aba, rascunho e revisão antes de confirmar mercadoria. Produto possui confirmação orientativa ao desligar controle; o PDV explica bloqueio/aceite de insuficiência e preserva fluxo rápido, foco e teclas existentes.

**Lacunas operacionais:** não há indicador/ação de controle empresarial geral; reativação individual não guia contagem inicial; ajuste não agrupa uma contagem com revisão; não há lote nem importação de saldos. Um comerciante pode operar hoje sem SQL, mas precisa ativar e ajustar cada produto, além de registrar recebimentos regularmente. Isso não resolve implantação volumosa com poucas etapas.

**Revisão de código:** controles têm labels e os diálogos de Estoque usam `aria-labelledby`; AJUSTE usa CampoQuantidade, possui entrada manual e Enter para confirmar; há mensagens e tokens MUI de tema. A tabela tem largura mínima 900 e contêiner de consulta; isso não prova ausência de overflow da página em todos os dispositivos. Não se declarou contraste AA, leitor de tela, foco móvel ou tema escuro aprovados apenas pela leitura.

O detector Impeccable sobre Estoque, EntradaMercadoriaForm e EntradaMercadoriaItens retornou `[]`. Isso é resultado mecânico, não certificação visual/acessível. A revisão consultou [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), com atenção a contexto de erro, labels, teclado e responsividade. Não foi atribuída pontuação visual quantitativa sem evidência de renderização equivalente.

Os testes frontend exercitaram funções/contratos e cenários com navegador/API simulada em Entradas/Produtos; não equivalem a uma sessão manual completa do módulo em celular físico nem à integração frontend inteira com o novo PostgreSQL. As duas verificações opcionais de integração/visual de Produto ficaram ignoradas e estão listadas abaixo.

## 11. Testes executados e limitações

### Backend — uma rodada dirigida

| Classe/seleção | Total descoberto | Aprovados | Falhas | Erros | Ignorados | Ambiente |
|---|---:|---:|---:|---:|---:|---|
| EntradaMercadoriaPostgresTest | 60 | 60 | 0 | 0 | 0 | PostgreSQL 18.6, Flyway V58/Hibernate validate |
| KitProdutoPostgresTest, incluindo herdados | 162 | 159 | 1 | 0 | 2 | PostgreSQL 18.6; falha exclusivamente versão 47 esperada |
| VendaEstoquePostgresTest, seis métodos selecionados | 6 | 6 | 0 | 0 | 0 | PostgreSQL 18.6 |
| MovimentacaoEstoqueHttpTest | 24 | 24 | 0 | 0 | 0 | MockMvc/H2 descartável |
| EstoqueConcorrenciaTest | 15 | 15 | 0 | 0 | 0 | H2, conexões/transações independentes |
| MovimentacaoEstoqueServiceTest | 19 | 19 | 0 | 0 | 0 | Unitário/Mockito |
| **Total da rodada** | **286** | **283** | **1** | **0** | **2** | **Maven retornou falha; suíte não está verde** |

A classe Kit herda casos de Venda; não somar novamente seus métodos como outra rodada. Os dois ignorados são disputas de fechamento de Caixa desabilitadas no teste-base com justificativa de dependência PostgreSQL; a anotação herdada permaneceu desabilitando-os mesmo nessa subclasse PG. Não foram contados como aprovados. Os testes dirigidos de concorrência de Entrada e disputa de saldo de Venda efetivamente executados são evidência separada.

Seleção de Venda: `dinheiroGravaVendaEstoqueEFinanceiroUmaVezMesmoAoRepetir`, `estoqueInsuficienteExigeParametroEConfirmacaoSemEfeitosAntesDoAceite`, `produtoSemControleNaoMovimentaEstoqueEQuantidadeFracionadaArredondaPorItem`, `doisOperadoresNaoVendemMesmoSaldo`, `cancelamentoPreservaVendaEReverteEfeitosSemDuplicarNoRetry`, `falhaNoSegundoProdutoRevertePrimeiraBaixaSemCriarPagamento`.

Entrada cobriu confirmação/cancelamento repetidos, disputas reais, criação idempotente, confirmar versus editar/cancelar, rollback, vínculos por tenant/produto e constraints. Kit cobriu composição, consumo agregado, precisão rejeitada, histórico e cancelamento. Não foi criada nem enfraquecida nenhuma asserção.

### Frontend — uma rodada dirigida

Comando: `node --test tests/estoque.test.mjs tests/entrada-mercadoria.test.mjs tests/kit-produtos.test.mjs tests/produto-campos-form.test.mjs`.

**65 testes descobertos: 63 aprovados, zero falhas, dois ignorados.** Os ignorados são integração HTTP/PG e evidência visual opcionais de Produto sem parâmetros de ativação. Não somar os 255 de uma auditoria anterior a esta contagem. Não houve suíte global, build ou lint novo: nenhum código foi alterado e a dúvida principal exigia testes de domínio/HTTP, não recompilação do frontend inteiro.

### HTTP adicional com API e PostgreSQL reais

Treze cenários agrupados foram registrados fora das suítes acima: saldo inicial por AJUSTE; entrada para quatro perfis; tenant externo; desligar/religar Produto; inativação sem auditoria; entrada em inativo; confirmação/cancelamento com conversão inexata; rejeição de produto sem controle; repetição de POST manual. Alguns cenários usam várias requisições; não são treze testes JUnit nem treze requisições totais.

Tokens foram exclusivamente sintéticos, assinados para a API isolada, e o filtro real validou usuário/empresa/perfil no banco descartável. Isso não é teste de login por senha nem uso de credencial de cliente. Os resultados defeituosos foram preservados como achados, não reclassificados como testes funcionais aprovados.

### Cobertura ainda necessária em futuras correções

- Matriz empresarial completa e reativação: não executável antes da implementação da configuração ausente.
- Conversão inexata/overflow: adicionar regressões automatizadas ao corrigir; hoje comprovada por HTTP/SQL no descartável.
- Política de ativo, auditoria de DELETE, papel permitido para ajuste, motivo obrigatório e retry manual: contratos e testes focados conforme decisão.
- Desligamento empresarial com kit e posterior cancelamento, sem reescrever histórico.
- Contagem com vendas concorrentes, lote, importação e aprovação: dependem dos fluxos ainda ausentes.
- UX de erro em modal, leitor de tela, teclado e dispositivos reais: revisar onde a inspeção estática apontou lacuna.

## 12. Relação com a Mustache e documentação histórica

As T16/T16A são evidências anteriores, não novos resultados produtivos. A T16A vinculou a hipótese histórica de 57 itens/34 vendas ao desligamento manual documentado de flags individuais durante a implantação, sem prova individual do estado de cada item. Não se gerou baixa retroativa nem se concluiu que ausência de vínculo atual autoriza reparar registros.

Os 95 negativos foram explicados naquela amostra por saídas desde base zero sem entradas de compra, com saldos coerentes com os movimentos consultados e política permissiva. Isso sustenta a necessidade de uma implantação de estoque compreensível, não um algoritmo automático para “corrigir” o saldo da loja. Esta tarefa não refez aquela coleta.

A documentação contém seções históricas/arquitetura alvo misturadas: `estoque.md` ainda descreve cancelamento/negativo como futuros em trechos antigos, embora cabeçalhos e código implementem esses fluxos; `entradas-mercadoria.md` contém descrição antiga de matching só por GTIN, enquanto `EntradaXmlService:52–68` já usa código do fornecedor. O relatório registra o comportamento atual sem sobrescrever documentos paralelos. Atualizações desses trechos devem acompanhar a futura integração responsável, sem apagar auditorias datadas.

## 13. Roadmap mínimo recomendado

Nenhuma tarefa abaixo foi iniciada. As propostas são condicionadas a autorização própria.

| Ordem/tarefa | Problema e impacto | Solução mínima e reaproveitamento | Dependências/risco | Prioridade e aceite |
|---|---|---|---|---|
| **17A — Correções comprovadas** | Conversão arredonda saldo e bloqueia reversão; inativação/auditoria e API de inativo inconsistentes; teste V47 antigo | Validação exata de quantidade efetiva em Entrada/núcleo; manter fatores/snapshots e reversão; reutilizar auditoria e alinhar política de ativo. Atualizar apenas expectativas comprovadamente antigas | Sem migration presumida; preservar inversões históricas e transação financeira. Decidir escopo de nova operação em inativo | **P1/MVP imediato**, complexidade baixa/média. Conversão inexata rejeitada sem efeitos; exata confirma/cancela; concorrência/tenant/retry passam; registro do responsável na inativação; suíte relevante sem falhas escondidas |
| **17B — Controle e implantação** | Sem habilitação empresarial; desligamento por editar todos os flags prejudica preferências/kits | Configuração real por empresa com leitura centralizada do controle efetivo; preservar flags individuais; orientação de ativação/reativação e ajuste inicial existente; reutilizar Produto/Movimento/Entrada e contexto JWT | Decidir padrão de novas empresas e preservar comportamento das existentes; representar dispensa de baixa de kit e permitir cancelamento histórico; possível migration aditiva somente após contrato | **P1/MVP**, complexidade média, risco médio/alto em kits. Quatro linhas da matriz, caixa/financeiro preservados, reativação sem retroatividade, tenant/perfis/auditoria e cancelamentos em cada transição |
| **17C — Ajustes e implantação em lote** | Individual é demorado e sem revisão conjunta; retry/contagem podem perder contexto | Preview de múltiplos produtos com saldo lido, físico informado, diferença, motivo/usuário e confirmação idempotente; chamar núcleo existente sob locks ordenados e detectar conflito de leitura | Depois de 17A; política de papéis/motivos e atomicidade do lote aprovadas. Sem fornecedor ou dívida fictícios; não confundir ajuste absoluto com delta | **P2/MVP importante**, complexidade média. Revisão antes de gravar, erro por linha, zero duplicidade, conflitos concorrentes explícitos, histórico e saldo por tenant coerentes |
| **17D — Importação de estoque** | Não há CSV/XLSX para contagem/saldo inicial | Alimentar o mesmo preview/validação da 17C por planilha; identificar por código/SKU/código de barras conforme cadastro, bloquear ambiguidades/duplicatas, revisar escala/unidade | Reaproveitar testes/algoritmos úteis do script e padrões XML; não expor seu SQL. Avaliar biblioteca já disponível antes de qualquer dependência nova | **P2**, complexidade média. Arquivo inválido/ambíguo não grava; preview não altera saldo; confirmação/retry auditáveis; precisão e tenant preservados |
| **17E — Inventário físico leve** | Sem ciclo de contagem e decisão sobre vendas durante contagem | Evoluir a revisão da 17C com escopo, contagens e conclusão rastreável; revalidar alterações desde a leitura e exigir reconciliação, sem inventar saldo retroativo | Depois de validar uso dos lotes com comerciantes. Reutilizar AJUSTE, histórico e UI, sem segundo motor de estoque ou depósitos não requeridos | **P2/evolução após implantação básica**, complexidade média/alta por concorrência. Contagem/revisão/aprovação e histórico claros; venda concorrente não é sobrescrita silenciosamente |

17D deve ser apenas outra origem do mesmo processo de revisão/confirmação da 17C, não um segundo importador de estoque. Se 17C já resolver a contagem simples, adiar uma sessão persistida mais complexa de 17E até comprovar necessidade. Não criar módulo de compras, reservas, depósitos, custo médio ou integração multicanal para concluir esses recortes.

### Decisões de negócio antes de 17B/17C

1. Padrão de controle de novas empresas e preservação do comportamento já existente; não desligar tenants automaticamente.
2. Efeitos de estoque empresarial desligado em kits, recebimentos e ajustes preparatórios; reversão sempre respeita o evento original.
3. Perfis para ajustes e alterações críticas, motivos exigidos e confirmação proporcional ao risco; não burocratizar o PDV.
4. Ajuste em lote integral ou aceitação explícita por linha, limite de itens e tratamento de contagem desatualizada.
5. Política de unidade com histórico/saldo e identificação inequívoca de produtos em importação.

## 14. Encerramento

O módulo é reutilizável e cobre grande parte da operação diária. As lacunas de implantação não justificam reconstrução nem reparo da Mustache. Não foi demonstrado P0 produtivo nesta tarefa; foi confirmado **P1 atual no caminho de conversão de Entrada**, reproduzível e prioritário.

O ambiente sintético foi encerrado ao final, sem interromper o PostgreSQL local original ou serviços existentes. Evidências de testes, SQL, HTTP e preservação ficaram no TEMP `novexa-stock-audit17-jr_7j0jg`; o relatório contém os resultados essenciais para não depender da retenção desses arquivos.

Conferência final: HEAD/branch, bytes do índice, arquivos preexistentes modificados/untracked e worktrees preservados; apenas este relatório acrescentado. O relatório e o diff existente foram conferidos quanto a whitespace; nenhuma mudança paralela foi incluída em staging. Não foram alterados CURRENT_STATE.md ou documentos compartilhados: a restrição desta tarefa autoriza apenas este relatório.

**STOCK MANAGEMENT AUDIT COMPLETE. Próxima tarefa: 17A, correção mínima da precisão e cancelamento de Entradas, com regressões reais PostgreSQL. Aguardar autorização; não iniciar automaticamente.**
