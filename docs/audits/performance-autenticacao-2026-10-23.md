# Tarefa 14B — Autenticação compacta, 2026-10-23

**AUTH PERFORMANCE READY**, com implementação e validação locais. Nenhum push, deploy, migration ou acesso a produção nesta tarefa. A 14B permanece sem commit, aguardando aprovação.

## 1. Git e preservação da 14A

Branch `main`, HEAD inicial `d9fa41544621012e31affd512a8f67255dbb47e8`. Os sete arquivos da 14A foram conferidos por SHA-256 contra o manifesto final aprovado; builds/testes anteriores ainda correspondem ao mesmo código. Criado somente o commit local **`bbb543fecd460b1292c22a962135c43704721c8e` — `perf(financeiro): elimina consultas N+1 no extrato`**.

Manifesto do commit: MovimentacaoFinanceiraRepository, ContaFinanceiraService, ContaFinanceiraHttpTest, ExtratoFinanceiroPostgresTest, financeiro.md, performance-extrato-2026-10-23.md e apenas a seção 14A do CURRENT_STATE. Staging seletivo do documento compartilhado, sem incorporar seus trechos paralelos. Conferidos diff staged, whitespace e manifesto após o commit.

README, documentação de produção, trechos anteriores do CURRENT_STATE, auditoria original do Financeiro, reconciliação local, backup/cache, imagens e vídeos foram preservados. Nenhuma branch/worktree adicional, reset, restore ou descarte. HEAD final continua `bbb543f`; staging vazio ao término.

## 2. Diagnóstico e consulta responsável

O projeto usa autenticação stateless: `SecurityConfig` registra um `JwtAuthenticationFilter` na cadeia; não há UserDetailsService/AuthenticationManager paralelo. O filtro valida assinatura, expiração e claims em JwtService, cria UsuarioAutenticado e consulta o estado persistido antes de preencher SecurityContext. O principal contém IDs/CPF/perfil, não entidades JPA.

`validarVinculoAtual` usava `UsuarioRepository.findByIdAndEmpresaId`, materializando UsuarioEntity. O relacionamento Usuario → Empresa é EAGER; a consulta secundária buscava todos os campos da empresa, incluindo logomarca. A validação só utiliza versão de revogação, perfil e flags de atividade. O hash de senha e os demais campos carregados também não são necessários nesse caminho.

Login por CPF/senha é outro caminho: `UsuarioService.autenticar` → UsuarioMapper → JwtService. O mapper **inclui intencionalmente a logomarca na resposta de login**, consumida pela sessão/cabeçalho. GET `/empresas/{id}` também a inclui no detalhe. Esses caminhos foram preservados integralmente. Renovação passa pelo mesmo filtro e conserva o limite total e início de sessão existentes.

## 3. Menor alteração aplicada

`UsuarioRepository.buscarContextoSeguranca` usa projeção fechada com cinco campos, sem entidades/associações retornadas. SQL real capturado:

```sql
select u.versao_token, u.ativo, e.id, e.ativo, u.perfil
from usuario u join empresas e on e.id = u.empresa_id
where u.id = ? and e.id = ?;
```

O filtro utiliza essa leitura no lugar da entidade e mantém as mesmas condições: versão persistida versus claim (claim legada ausente = zero), vínculo usuário/empresa, perfil atual e rejeição de usuário/empresa explicitamente inativos. Flags legadas nulas conservam a semântica anterior. Empresa sem vínculo não produz contexto válido. Não se confia apenas nas claims; a consulta ocorre **a cada requisição**, sem cache.

Nenhuma alteração no parser JWT, senha/BCrypt, duração, renovação, modelo de perfis, autorização, DTO, controller, login, sessão frontend, Entity/fetch global ou política financeira. A busca antiga de entidade permanece para seus outros consumidores.

## 4. Método de medição

PostgreSQL **18.6** descartável, loopback 65490, banco novo `novexa_auth_performance_test`, schemas aleatórios por execução; Flyway V58/Hibernate validate. Dados exclusivamente sintéticos, sem backup/cópia de registros reais. Empresa alternada entre logomarca nula e SVG válido de **971.626 bytes**, quatro perfis e segundo tenant.

Comparação isolada em JVMs Java 21 com heap 512 MB, mesma fixture e harness. Antes: classes imutáveis do JAR validado da 14A. Depois: classes compiladas da 14B. Uma execução aquecida descartada e **cinco amostras por caso**, medianas; 18 casos por versão, 108 HTTPs em cada rodada. Nenhuma outra suíte foi executada simultaneamente a essas duas medições isoladas.

Uma subclasse **exclusivamente em src/test**, inserida na cadeia de teste, executa o filtro original e mede o intervalo até chamar o downstream: parsing JWT, leitura e criação do contexto. Contadores Hibernate delimitam statements/entidades dessa etapa. A rota protegida `/audit-auth/contexto` existe somente no teste e não consulta o banco no controller, isolando o custo da autenticação. Nenhum header de medição/endpoint foi adicionado ao produto.

Proxy PostgreSQL 65491/controle 65492 conta bytes banco → API e execuções do protocolo, inclusive BEGIN/COMMIT nas rotas transacionais. Por isso os comandos totais do endpoint não equivalem aos statements da autenticação. Metadata/prepared statements e conexões aquecidas podem variar alguns bytes; não alteram a ausência de logomarca na projeção. Medição sob concorrência não usa deltas globais como se fossem exclusivos de uma thread.

## 5. Antes/depois

### Custo isolado da autenticação, empresa com logomarca

| Perfil | Statements | Entidades Usuario/Empresa | Banco → API, bytes | Tempo autenticação, ms | HTTP total, ms |
|---|---:|---:|---:|---:|---:|
| ADMIN | 2 → **1** | 2 → **0** | 972.121 → **75** | 8,180 → **2,922** | 14,300 → **8,722** |
| GERENTE | 2 → **1** | 2 → **0** | 972.125 → **77** | 8,338 → **2,883** | 14,242 → **9,375** |
| OPERADOR | 2 → **1** | 2 → **0** | 972.127 → **78** | 8,498 → **3,117** | 14,575 → **8,863** |
| USUARIO | 2 → **1** | 2 → **0** | 972.125 → **77** | 8,335 → **2,776** | 14,266 → **8,842** |

Sem logomarca, controle ADMIN: 2→1 statements, 2→0 entidades, 2.468→198 bytes (metadata incluída), autenticação 5,961→3,658 ms e HTTP 14,381→12,530 ms. A nova consulta não depende do tamanho da imagem. Com logomarca, o caso ADMIN reduz cerca de **64%** do tempo mediano de autenticação; isso não é uma previsão de percentil/ganho em produção.

### Endpoints reais, empresa com logomarca

| Endpoint/caso | Comandos totais | Banco → API, bytes | HTTP mediana, ms | JSON, bytes, preservado |
|---|---:|---:|---:|---:|
| `/financeiro/contas-financeiras/resumo` | 5 → 4 | 972.229 → **183** | 16,996 → 11,153 | 54 |
| Extrato 25, projeção 14A | 7 → 6 | 977.250 → **5.204** | 24,804 → 17,698 | 12.611 |
| `/financeiro/caixas/sessoes/{id}/painel` | 13 → 12 | 5.832.816 → 4.860.770 | 53,315 → 48,437 | 400 |
| `/empresas/{id}` | 6 → 5 | 1.944.125 → 972.079 | 29,926 → 23,424 | 972.661 |
| POST `/auth/login`, sem JWT | 4 → 4 | 972.161 → 972.161 | 96,453 → 96,273 | 973.018 |

Login preserva o transporte necessário da imagem, a validação de senha e sua resposta. Detalhe da empresa passa a carregá-la somente para o próprio detalhe. O extrato deixa de ter o custo residual da autenticação identificado na 14A. Não houve redução artificial do JSON.

**Limite confirmado:** Caixas ainda materializa Empresa em relacionamentos do caminho de negócio/locks. A autenticação desse HTTP carrega zero entidades, mas o restante da consulta continua transportando aproximadamente 4,86 MB na fixture. Não se alteraram locks/fetches financeiros nesta tarefa nem se afirma ter eliminado toda logomarca de todas as consultas do ERP. Essa origem de domínio exige avaliação própria se for priorizada.

Os 18 pares de respostas são estruturalmente equivalentes, nos dois estados de logomarca. Somente o token dinâmico foi retirado da comparação de login; assinatura, claims, perfil e uso do token são validados separadamente pelos testes. Existe variação local: extrato sem imagem teve 27,963→29,296 ms apesar da redução de queries/tráfego. Não se promete aceleração temporal em toda leitura pequena.

## 6. Segurança e regressões

`mvnw.cmd clean test` executado com propriedades explícitas dos bancos descartáveis pertinentes: **2.752 casos descobertos, 1.891 aprovados, zero falhas/erros e 861 ignorados por guardas de ambiente**, principalmente outras suítes PostgreSQL/migrations opt-in não habilitadas. Ignorados não são aprovações. Build backend `package -DskipTests` também aprovado.

| Suíte relevante, incluída na execução completa | Casos aprovados | Ambiente |
|---|---:|---|
| AutenticacaoPerformancePostgresTest | **26** | HTTP real/PostgreSQL |
| JwtAuthenticationTest | 53 | WebMvc, expectations preservadas |
| JwtServiceTest / UsuarioServiceTest / UsuarioMapperTest | 12 / 10 / 3 | Testes existentes |
| UsuariosMvpPostgresTest / UsuariosMigrationPostgresTest | 28 / 2 | PostgreSQL, contratos administrativos/versão |
| ConfiguracaoPagamentoAutorizacaoPostgresTest, 10A | 13 | HTTP real/PostgreSQL |
| ExtratoFinanceiroPostgresTest, 14A | **21** | HTTP real/PostgreSQL |
| CaixaPainelPostgresTest | **13** | HTTP real/PostgreSQL |
| ContaFinanceira / Transferencia / ContaPagar / ContaReceber HTTP | 25 / 29 / 10 / 40 | Regressões existentes H2 |
| PoliticasRecebimentoHttpTest / LiquidacaoRecebivelHttpTest | 23 / 49 | Regressões existentes H2 |

O teste PostgreSQL novo comprova: login válido em quatro perfis; CPF/senha incorretos; campos vazios; tokens inválido, assinatura inválida, expirado e ausente; versão revogada; usuário/empresa inativos; alteração de perfil/vínculo; usuário ausente; claims de outro tenant; renovação e limite total de oito horas; flags legadas; leitura/negação por perfil; IDs estrangeiros 404; empresa arbitrária ignorada; oito leituras concorrentes em dois tenants; revogação observada na próxima requisição; logomarca no login/detalhe e ausência de entidade no contexto compacto.

Primeira rodada direcionada: 179 casos, com dois erros **na fixture nova** ao alterar/remover a empresa do responsável que possui sessão de Caixa. A FK composta bloqueou corretamente. Corrigida exclusivamente a seleção do usuário da fixture para usar outro sem histórico, preservando todas as asserções/FKs. A execução completa posterior aprovou os 26 casos novos. No WebMvc, só o stub passou a fornecer a projeção real equivalente; nenhuma expectativa de segurança foi removida ou relaxada.

## 7. Frontend real e testes relacionados

Frontend não modificado. Em Chromium isolado, Vite 65494 apontando somente para API descartável 65493 e banco sintético, **quatro perfis aprovados**: formulário real de login, Dashboard, sessão/empresa corretas, imagem válida carregada, menu de Usuários somente ADMIN, sessão preservada ao recarregar e logout removendo o armazenamento local. Zero erros JavaScript ou HTTP 401/403 inesperados. Tráfego externo bloqueado no harness; nenhum acesso a API de produção.

Testes frontend de perfis, renovação/inatividade, empresa e layout: **36/37 aprovados**. Única falha é estática/preexistente: `layout.test.mjs:234` exige `titulo="Central de Vendas"`, enquanto o código commitado usa `titulo={analise ? "Análise de vendas" : "Central de Vendas"}`. Reprodução independente com o bloco original de teste e arquivos extraídos do **HEAD imutável** confirmou a mesma falha; todos os arquivos envolvidos são idênticos ao HEAD. Nenhuma correção fora do escopo. Aviso de porta HMR 24678 durante testes SSR concorrentes, sem falha funcional associada. Não se apresentam esses 37 testes como uma suíte totalmente verde.

Não repetidos build/lint frontend: nenhuma fonte/contrato frontend foi alterado, e o smoke real/testes pertinentes foram executados. `git diff --check`, revisão dos diffs e preservação do conteúdo paralelo aprovados.

## 8. Arquivos, integridade e limites finais

Alterações da 14B: `repository/UsuarioRepository.java`, `security/JwtAuthenticationFilter.java`, stub de `security/JwtAuthenticationTest.java`, novo `security/AutenticacaoPerformancePostgresTest.java`, este relatório e trechos correspondentes de CURRENT_STATE, arquitetura e financeiro. Nenhum arquivo funcional da 14A foi alterado.

Após o smoke: 60 movimentos sintéticos, soma/saldo R$ 600, zero divergências e constraints pendentes, Flyway V58. Serviços descartáveis parados ao término e dados/evidências preservados; nenhum serviço de produção reiniciado ou configuração permanente alterada. Backend/PostgreSQL locais preexistentes não foram utilizados para teste.

Evidências privadas: `C:\Users\lucas\AppData\Local\Temp\novexa-auth-14b-3v1z3pb0`: manifesto/diff/commit 14A, baseline de alterações paralelas, SQL/proxy, `before` e `after-isolated`, `comparison.json`, XML da suíte completa, logs, reprodução da falha frontend no HEAD, smoke/screenshot por perfil e integridade. JAR validado SHA-256: `5260d26922aebefc556c8c0a1e106ce479fbc23091b1dba7127babcb51105cab`.

Não houve medição em produção/WAN; PostgreSQL local 18.6 versus produção 17.6. Tempos são medianas de cinco amostras aquecidas, não ensaio de capacidade. Sem cache, migração ou mudança de regras, a publicação pode seguir o procedimento existente após aprovação, mas não está executada nem autorizada por este veredito. Permanecem a falha estática de frontend e as leituras de Empresa pertencentes aos serviços de negócio, fora do escopo da autenticação.

**Veredito: AUTH PERFORMANCE READY. Aguardar aprovação para commit da 14B; sem push ou deploy.**
