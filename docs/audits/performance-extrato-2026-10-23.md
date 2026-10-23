# Tarefa 14A — Projeção do extrato financeiro, 2026-10-23

**EXTRATO PERFORMANCE READY**, validado localmente em PostgreSQL descartável. Sem commit, push, deploy ou acesso a produção nesta tarefa. Esta correção trata somente F1/P1 da [auditoria do Financeiro](performance-financeiro-2026-10-23.md), preservada como diagnóstico histórico.

## Baseline e escopo

- `main`, HEAD `d9fa41544621012e31affd512a8f67255dbb47e8`, inalterado durante a execução. O JAR anterior imutável da Tarefa 13 corresponde ao código funcional `3d9cf78`; não há diferenças de backend/frontend entre esse commit e o HEAD documental.
- Preservadas as alterações anteriores em README, CURRENT_STATE e documentação de produção, assim como auditorias, script/cache de backup, imagens e vídeos não rastreados. Nenhum staging ou descarte. CURRENT_STATE recebeu somente a seção desta correção, mantendo o conteúdo anterior.
- Implementação limitada a `MovimentacaoFinanceiraRepository.listarPagina` e ao mapeamento dessa página em `ContaFinanceiraService`. Controller, DTO, entidades, frontend, escritas, locks, scheduler, regras financeiras e migrations permanecem inalterados.

## Causa e solução

GET `/financeiro/movimentacoes-financeiras` consultava `select m from MovimentacaoFinanceiraEntity m ...` e convertia cada entidade com `MovimentacaoFinanceiraResponseDTO.de`. A conversão acessava `transferencia.contaDestino/contaOrigem.nome`: um SELECT por transferência e leituras de contas distintas. Associações EAGER materializavam Empresa/logomarca, mesmo que ausentes do pequeno JSON final.

A consulta agora constrói diretamente o **mesmo record de 22 campos**, com joins escalares para nome da conta, usuário, usuário de estorno e contas da transferência. LEFT JOIN preserva os vínculos opcionais; CASE seleciona destino para SAIDA e origem para ENTRADA. IDs de recebível, título e UUID continuam presentes sem materializar esses agregados. Nenhuma Empresa é selecionada na leitura do extrato. O caminho anterior `DTO.de(entity)` continua disponível aos outros consumidores.

`countQuery` explícita reutiliza os mesmos predicados, sem joins de apresentação. Mantidos empresa do JWT, verificação de existência/tenant da conta com 404, filtros inclusivos, whitelist de sort, limite 1–100 e desempate por ID. Os joins são para associações singulares, sem multiplicação de linhas. Vínculos entre empresas continuam protegidos pelas FKs existentes.

## Método e dados

PostgreSQL **18.6**, loopback 65490, banco `novexa_extrato_performance_test`, criado por cópia da fixture **sintética** descartável da auditoria. Não foi copiado ou acessado o banco original `novexa_erp`. Flyway V58 e Hibernate validate aprovados no boot dos dois JARs e no schema isolado do teste.

Fixture congelada entre JARs: dois tenants, quatro perfis, 101 contas no tenant principal, 100 transferências com as duas pontas, 177 movimentos manuais e 500 recebimentos parciais; total 877 movimentos. Uma transferência e um movimento manual marcados como estornados, com auditoria completa e saldos recalculados apenas na fixture. Empresa contém logomarca sintética de 971.611 bytes. Nenhum índice ou constraint foi removido.

API descartável 65493; proxy TCP contador 65491/controle 65492. Para cada um dos **27 casos HTTP**, uma execução aquecida descartada e três amostras; tempos são medianas, não percentis de produção. Contador soma execuções do protocolo PostgreSQL, incluindo BEGIN/COMMIT e autenticação, e bytes PostgreSQL → API. Não equivale exclusivamente a SELECTs. Teste Hibernate mede separadamente prepared statements e entidades.

## Medições antes/depois

Bytes de banco/comandos abaixo são medianas das três amostras. MB em base decimal. Corpo JSON é idêntico em cada par; não se reduziu o contrato para obter o ganho.

| Página/caso | Comandos antes → depois | Banco → API, bytes antes → depois | HTTP mediana, ms antes → depois | JSON, bytes |
|---|---:|---:|---:|---:|
| Transferências, 10 contrapartes distintas | 29 → **7** | 12.644.655 → **977.234** | 77,46 → **34,57** | 5.513 |
| Transferências, 25 contrapartes distintas | 59 → **7** | 27.226.118 → **978.293** | 131,85 → **42,58** | 13.687 |
| Transferências, 50 contrapartes distintas | 109 → **7** | 51.536.018 → **984.393** | 201,83 → **19,46** | 27.312 |
| Manual, 10 linhas | 9 → 7 | 2.917.992 → 974.307 | 41,97 → 38,15 | 5.281 |
| Manual, 25 linhas | 10 → 7 | 3.892.682 → 977.525 | 44,13 → 33,25 | 13.137 |
| Manual, 50 linhas | 10 → 7 | 3.897.111 → 982.804 | 33,11 → 42,22 | 26.170 |
| Global, 25 linhas, sem filtro de conta | 58 → 6 | 27.226.124 → 978.299 | 112,51 → 26,65 | 13.765 |

No caso de 25 contrapartes: **88,1% menos comandos, 96,4% menos tráfego interno e 67,7% menos tempo mediano**. Dez → cinquenta contrapartes mantém sete comandos; aumenta apenas o volume escalar da página. Sem filtro de conta não há consulta de existência, portanto seis comandos. Páginas incompletas podem dispensar count pelo comportamento já existente do Spring Data.

Há variação temporal local: manual de 50 linhas, entrada em conta com um movimento e alguns sorts ficaram mais lentos em milissegundos, apesar de menos tráfego/consultas. Não se promete melhora de latência em toda leitura pequena. A evidência principal é a eliminação do crescimento linear do cenário de transferências, com paridade funcional e redução de tráfego.

EXPLAIN ANALYZE/BUFFERS somente no descartável, 25 linhas: consulta raiz antiga **0,048 ms**, nova projeção com joins **0,294 ms**. Esses tempos pontuais excluem as leituras secundárias do ORM e o transporte; a raiz antiga isolada não representa os 59 comandos. A projeção faz mais trabalho útil numa consulta e elimina as viagens individuais. Nenhuma lacuna de índice foi comprovada; **não há migration**.

## Equivalência e testes

**27/27 pares de respostas dos JARs anterior/novo byte a byte idênticos**, todos HTTP 200: manual/transferência/misto nos tamanhos 10/25/50; global; ponta de entrada; segunda página; página excedida; estornadas/ativas; período; recebimentos; cinco campos de ordenação nas duas direções. Cada versão recebeu 108 GETs medidos/aquecidos, sem alteração dos dados entre elas.

| Suíte final relevante | Testes | Falhas/erros/ignorados |
|---|---:|---:|
| ExtratoFinanceiroPostgresTest, HTTP real, última execução ampliada | **21** | 0 / 0 / 0 |
| ContaFinanceiraHttpTest, H2/MockMvc | 25 | 0 / 0 / 0 |
| TransferenciaFinanceiraHttpTest, H2/MockMvc | 29 | 0 / 0 / 0 |
| ContaPagarHttpTest, H2/MockMvc | 10 | 0 / 0 / 0 |
| ContaReceberHttpTest, H2/MockMvc | 40 | 0 / 0 / 0 |
| **Total de casos distintos aprovados** | **125** | **0 / 0 / 0** |

A primeira rodada combinada aprovou 124 casos (20 do novo teste e 104 existentes). Depois da ampliação exclusiva da fixture/teste para PIX e recebível liquidado, os 21 casos PostgreSQL foram repetidos e aprovados; código funcional permaneceu idêntico. Não se somam as repetições como novos casos.

O teste novo usa schema aleatório/Flyway, HTTP com porta aleatória e exige propriedade explícita apontando a loopback e ao banco de teste nomeado. Compara todos os campos com o caminho anterior de entidades/`DTO.de`, não com outra instância da projeção. Cobre também:

- Páginas 10/25/50, página seguinte, vazia e excedida; contagens e desempate estável.
- Período inclusivo e limites isolados, tipo, origem, situação, conta e todos os sorts permitidos.
- Nomes das duas pontas, valores/sinais, estorno/operador/motivo/data e campos opcionais nulos.
- PIX, recebível liquidado com ID não nulo e conta a receber com UUID, preservando valores e vínculos.
- ADMIN/GERENTE/OPERADOR/USUARIO: leitura permitida; conta estrangeira 404, listagem global isolada, empresa arbitrária ignorada, não autenticado 401, parâmetros inválidos 400.
- Budget constante: **cinco prepared statements e no máximo duas entidades** por HTTP filtrado com 10/25/50 contrapartes. As duas entidades são da autenticação, não dos movimentos.

Falha inicial explicada: um teste H2 executava escrita e MockMvc GET no mesmo contexto transacional, esperando `100` da entidade ainda em memória. A projeção lê a coluna NUMERIC(19,2), devolvendo `100.00` (interpretado pelo JsonPath como `100.0`). Adicionados flush/clear antes da leitura e expectativa da escala persistida, preservando a igualdade monetária. **O mesmo teste ajustado passou também contra as classes imutáveis do JAR anterior**, em execução independente no diretório privado. Nenhuma regra financeira/serializador foi alterado para satisfazer o teste.

Build `mvnw.cmd clean package -DskipTests` aprovado após os testes direcionados; teste PostgreSQL final compilado/executado depois. Não foi repetida a suíte completa nem builds/lint frontend: frontend e contrato não mudaram, comprovados pela paridade HTTP. `git diff --check` e revisão final aprovados.

Para repetir os testes, primeiro disponibilizar **exclusivamente** o PostgreSQL descartável com o banco indicado; executar em `backend/novexa-api`, Java 21:

```powershell
.\mvnw.cmd "-Dnovexa.test.extrato.jdbc-url=jdbc:postgresql://127.0.0.1:65490/novexa_extrato_performance_test" "-Dtest=ExtratoFinanceiroPostgresTest,ContaFinanceiraHttpTest,TransferenciaFinanceiraHttpTest,ContaPagarHttpTest,ContaReceberHttpTest" test
```

Sem a propriedade, o teste PostgreSQL é ignorado por proteção e isso não constitui validação. O banco/cluster de medição foi parado e preservado; não substituir a URL pela do banco original ou de produção.

## Integridade, evidências e limites

Fixture de medição ao final: **zero** divergências de saldo, de recebimentos e de tenant nos vínculos; 877 movimentos/100 transferências, imagem mantida, constraints validadas e schema V58. Infraestrutura descartável parada ao término, dados/evidências preservados. PostgreSQL original, backend/Vite locais existentes e serviços remotos não foram reiniciados ou modificados.

Diretório privado de evidências: `C:\Users\lucas\AppData\Local\Temp\novexa-extrato-14a-hieo53mo`. Inclui baseline Git/hashes, enriquecimento da fixture, proxy, métricas/SQL/JSON de cada caso, `comparison.json`, planos, XML/logs de testes, verificação H2 com classes anteriores, build, JAR novo e integridade final. JAR novo SHA-256: `9ad6aea9df26c3d0364cb6a411997dbe65f537ae728b52f0c4e412ca76ff7e17`. Tokens utilizados são exclusivamente sintéticos e não integram o repositório.

Permanece aproximadamente **uma logomarca por HTTP na autenticação** (F3/P2 da auditoria), sem multiplicação por linha nesta leitura. Não corrigir esse componente transversal dentro do extrato. O método legado não paginado continua existente, sem expandir o escopo para outros consumidores. Não houve medição pós-deploy ou WAN; fixture adversarial não representa necessariamente o número atual de contas do cliente. Produção usa PostgreSQL 17.6, ensaio local 18.6. Ganhos em produção precisam ser conferidos após publicação autorizada.

**Veredito: EXTRATO PERFORMANCE READY. Implementação e validação locais concluídas; integração/publicação permanecem sem execução.**
