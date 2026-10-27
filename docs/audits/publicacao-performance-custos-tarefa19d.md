# Publicação da Tarefa 19D — 27/10/2026

**PERFORMANCE PRODUCTION PARTIAL**: backend publicado e saudável; smoke autenticado pendente de sessão disponível. Não foram repetidos testes aprovados.

- Backend: commit `dafff828ba66db3c7dc022ff9cf9664263d507b9`, imagem ARM64 `sha256:0f8ebbf6c87f3a0c16983d6df17ebae62a6e6a365216b013b7603b4102cbfa79`. Comparação integral de `BOOT-INF` com a imagem 19B: somente `RequestIdFilter.class` mudou. Dependências, enhancement da logomarca, regras financeiras e migrations idênticos.
- Oracle: startup às 19:16 UTC; health/liveness/readiness HTTPS 200/UP, zero reinícios e erros críticos na janela observada. Flyway V59; 58 migrations validadas, nenhuma aplicada.
- Ativo: WARN `http_lento` para duração >2.000 ms, substituindo a linha INFO existente, sem duplicá-la. Somente método, template, status, duração e request ID; sem corpo/query/credenciais. Volume observado: 9 linhas para 9 requisições, nenhuma WARN na janela. Rotação Docker mantida em 3 arquivos de 10 MB. Não foi induzida lentidão artificial em produção.
- Métricas Micrometer existentes preservadas; `/actuator/metrics` sem token permanece 401. Guardrails de SQL/bytes/polling são testes de desenvolvimento, não tarefas periódicas produtivas. Checklist e acompanhamento manual do egress não criam monitoramento automático de cobrança.
- Frontend: sem alteração executável ou publicação manual; deployment previamente vigente `dpl_Caopn5zN4B6Bsm7D6bcUGQV6H6ic`, READY, commit `2a663060865fc2d758e7bf764ae01d2f4d8dd33e`. Push ocorre somente após backend saudável; eventual build automático deve ser verificado separadamente.
- Smoke negativo: Empresa, Produtos e Caixa sem token retornaram 401 com request ID; não equivale a smoke autenticado. Abas disponíveis indicavam sessão expirada e duas tentativas de controle falharam em `Emulation.setFocusEmulationEnabled`. Solicitada sessão ao usuário, sem coletar senha. Login positivo, consultas autorizadas e logomarca permanecem pendentes nesta publicação.
- Recuperação: imagem 19B `sha256:bb48883a5da850fc6fa8a9ce6ec68be16305393996d8a7f941f1c8a2747a9659`, arquivada em `/home/ubuntu/novexa-release19d-20261027/recovery-egress19b.tar.gz`; SHA-256 e gzip validados. O override 19B restaura esse backend compatível com V59 sem restaurar banco. Não acionada recuperação.

Override atual: `/home/ubuntu/novexa-release19d-20261027/compose.guardrails19d.yml`, aplicado sobre o Compose original, imagem fixa e target Flyway 59. Tag `novexa-api:prod` alinhada. Checkout remoto preservado.

Manifesto isolado: oito caminhos da 19D (relatório de implementação, AGENTS, produção, seção 19D de CURRENT_STATE, filtro e três testes). Sem frontend, Upload ou migrations. Índice alternativo; staging principal, HEAD e worktrees preservados. Registro de publicação acrescenta somente documentação/evidências. Não houve operações financeiras, modificações Mustache, mudanças de plano, secrets ou Storage. O 402/consumo Supabase não foi reavaliado nesta entrega.

Evidências locais de preparação, manifesto, patch, smoke e preservação: `backend/novexa-api/target/release19d`; evidências de build/qualificação/startup/recuperação também na pasta privada Oracle dessa release. Detalhe dos testes aprovados em [implementação 19D](prevencao-performance-custos-tarefa19d.md).
