# Publicacao do Novexa: backend / Docker (Render e Cloud Run)

Perfil implementado: `prod`, Java 21 / Spring Boot 3.5.4, PostgreSQL e migrations Flyway versionadas no repositorio. Este guia prepara a publicacao; nao comprova deploy nem homologacao do piloto. Frontend, regras financeiras e migrations existentes nao sao alterados.

## Configuracao e secrets

Ativar `SPRING_PROFILES_ACTIVE=prod`. Sem perfil explicito, `application-default.properties` preserva a importacao local de `config/application-local.properties`; `prod` nao importa esse arquivo. Nao misturar os perfis `prod` e `default`. O Dockerfile ativa `prod` por padrao e nao copia `config`, `.env` ou credenciais.

| Variavel | Uso / regra |
|---|---|
| `DB_URL` | JDBC PostgreSQL, banco dedicado ao ambiente. Sem usuario/senha na URL. |
| `DB_USERNAME` | Usuario com privilegios somente no banco/schema Novexa. |
| `DB_PASSWORD` | Secret obrigatorio, nunca no Git, Dockerfile, argumento de build ou comando literal. |
| `JWT_SECRET` | Secret aleatorio de no minimo 32 bytes UTF-8; diferente por ambiente. |
| `JWT_EXPIRATION_MS` | Expiracao positiva, padrao 900000 (15 minutos). |
| `CORS_ALLOWED_ORIGINS` | Origens HTTPS exatas separadas por virgula, sem caminho, barra final, wildcard ou credenciais. Ex.: `https://novexa-erp-prod.web.app`. Incluir somente os dominios realmente utilizados. |
| `SUPABASE_URL` | Origem HTTPS do storage, sem barra final. |
| `SUPABASE_SECRET_KEY` | Secret de storage; somente backend. Nunca chave secreta em `VITE_*`. |
| `SUPABASE_BUCKET` | Bucket ja provisionado com politica de acesso revisada. |
| `PORT` | Injetada pelo Render ou Cloud Run; padrao local 8080. |
| `DB_POOL_MAX` / `DB_POOL_MIN` | Padroes 5 / 0 por instancia. Ajustar ao limite global do banco. |
| `DB_CONNECTION_TIMEOUT_MS` | Padrao 5000; deve ser maior que o timeout de validacao de 2000 ms. |
| `GEOCODING_URL` / `GEOCODING_USER_AGENT` | Opcionais, seguem contrato existente; URL vazia preserva preenchimento manual. |

No Cloud Run, usar Secret Manager com versoes numericas fixas para `DB_PASSWORD`, `JWT_SECRET` e `SUPABASE_SECRET_KEY`. A service account do Cloud Run recebe `Secret Manager Secret Accessor` apenas nesses secrets; nao distribuir arquivo de chave de service account. Rotacionar secrets criando nova revisao. Trocar `JWT_SECRET` invalida tokens anteriores. Arquivos ignorados nao protegem um secret ja commitado: revisar diff/historico e rotacionar qualquer credencial exposta.

Antes de inicializar datasource/Flyway, startup rejeita propriedades obrigatorias vazias, JWT curto, banco nao PostgreSQL, CORS nao HTTPS/generico e overrides inseguros de Hibernate/Flyway. A mensagem de validacao informa a propriedade, nunca seu valor. Hikari e JwtService validam seus limites adicionais.

## Banco / migrations

- Usar banco exclusivo por ambiente; testar primeiro em staging, nunca contra producao para homologar.
- Garantir backup e restauracao testada antes de publicar. Em base antiga, conferir CPFs normalizados duplicados antes da V32; nao apagar usuarios nem realizar backfill automatico para contornar a constraint.
- Antes da V33, conferir documentos de fornecedores normalizados duplicados dentro do mesmo tenant. Havendo conflito, regularizar explicitamente; nao deduplicar/apagar fornecedores automaticamente. Conferir a compatibilidade do consumidor frontend em [fornecedores.md](../architecture/fornecedores.md).
- `ddl-auto=validate`, Flyway habilitado, `validate-on-migrate=true`, `baseline-on-migrate=false`, `clean-disabled=true`. Schema desconhecido, checksum divergente ou incompatibilidade Hibernate deve impedir startup.
- Nunca editar migration aplicada, usar `clean` ou `repair` para esconder divergencia. Baseline de banco preexistente exige procedimento revisado fora do startup automatico.
- O MVP migra durante startup usando a coordenacao existente do Flyway. Provisionar permissoes DDL no schema para o usuario usado nessa etapa; nao conceder superuser. Futuramente separar usuario de migration/runtime requer mudar o procedimento de deploy, nao desligar validacao silenciosamente.
- Usar conexao PostgreSQL direta ou pooler em modo session para migrations; nao usar pooler transaction com locks de sessao do Flyway. Manter rede privada quando disponivel ou TLS com verificacao de certificado para banco publico. Configurar CA/`sslmode=verify-full` conforme o provedor; nao usar conexao publica sem protecao.
- Dimensionar `DB_POOL_MAX * instancias simultaneas de todas as revisoes` mais jobs/manutencao abaixo do limite de conexoes. Revisoes antigas e novas coexistem no rollout. Limitar `max-instances` e concorrencia do Cloud Run; nao aumentar pool/escala sem medir.
- `minimum-idle=0`, timeout de conexao 5s, validacao 2s, idle 10min e max-lifetime 30min sao valores iniciais, nao tuning homologado de carga. Revisar timeouts de rede do provedor.

## Seguranca / erros

JWT, perfis e isolamento tenant existentes permanecem. Sem HTTP Basic, formulario/session ou usuario de seguranca gerado em `prod`. CORS nao substitui autenticacao e nao bloqueia chamadas diretas fora do browser.

API envia CSP restritiva, Referrer-Policy, nosniff, frame DENY e headers de cache existentes. HSTS e emitido quando a requisicao e reconhecida como HTTPS. `server.forward-headers-strategy=native` permite reconhecer TLS terminado no proxy confiavel; nao expor o container diretamente a proxies nao confiaveis nem ampliar `internal-proxies` para `.*`. Cloud Run atende HTTPS e termina TLS fora do container.

Erros funcionais e status 400/401/403/404/409 permanecem; JSON/tipos malformados retornam 400. Erro inesperado retorna 500 generico com orientacao para informar `X-Request-ID`, sem SQL, senha, stacktrace ou mensagem interna. Os detalhes automaticos de erro do servidor estao desabilitados. Logs de infraestrutura/startup podem conter diagnostico interno: restringir IAM, retencao e exportacao do Cloud Logging.

## Health / observabilidade

Endpoints GET publicos, na mesma porta da API e sem JWT:

- `/actuator/health`: status agregado, sem componentes/detalhes de banco.
- `/actuator/health/liveness`: estado da aplicacao, sem dependencia de banco para evitar reinicios em cascata.
- `/actuator/health/readiness`: estado da aplicacao + banco; DOWN retorna 503.

Somente health e exposto; env/configprops/loggers/metrics nao sao publicados. Os grupos podem aparecer por nome no health agregado, sem dados internos. A probe HTTP deve apontar para readiness durante startup e liveness apos startup. Cloud Run nao equivale automaticamente a um load balancer Kubernetes que verifica readiness continuamente; conferir quais probes foram configuradas na revisao.

Toda resposta recebe `X-Request-ID`: um valor de 1..64 caracteres `[A-Za-z0-9._-]` recebido e reutilizado; ausente/invalido gera UUID. Nao e identificador de autenticacao nem de idempotencia financeira. CORS permite/expoe esse header. MDC e limpo/restaurado ao terminar a requisicao.

Logs JSON em stdout possuem `severity`, `requestId`, metodo, template da rota, status e duracao. Negacoes antes do controller usam `route=unmapped`. Nao registrar bodies, query strings, Authorization, CPF, senha ou tokens. Consultar `jsonPayload.requestId` no Cloud Logging; criar alertas de taxa de 5xx, falha de probes, reinicios e conexoes esgotadas. Erros inesperados registram tipo da excecao, nao sua mensagem/payload.

## Render / Docker

Criar um Web Service conectado a `lucassaraivalara/novexa-erp` com:

| Campo | Configuracao |
|---|---|
| Runtime / Language | `Docker` |
| Branch | `main` |
| Root Directory | `backend/novexa-api` |
| Dockerfile Path | `./Dockerfile` (relativo ao Root Directory) |
| Docker Build Context | `.` (relativo ao Root Directory) |
| Docker Command | Sem override; usar o ENTRYPOINT da imagem |
| Health Check Path | `/actuator/health/readiness` |

Cadastrar no ambiente do servico: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SUPABASE_BUCKET`. Os valores reais ficam somente no Render; nao criar `.env` versionado, argumentos de build ou defaults de secrets. O Dockerfile ja define `SPRING_PROFILES_ACTIVE=prod`; nao substituir por `default` nem ativar os dois perfis.

`DB_URL` deve ser JDBC (`jdbc:postgresql://HOST:PORT/DATABASE`), nao uma URI `postgres://`/`postgresql://` fornecida pelo painel. Usuario e senha ficam nas variaveis separadas. Revisar TLS/rede conforme a secao Banco / migrations, usando conexao compativel com Flyway.

`JWT_EXPIRATION_MS`, `GEOCODING_URL` e `GEOCODING_USER_AGENT` sao opcionais. `PORT` vem da plataforma; a aplicacao escuta `0.0.0.0` e preserva `server.port=${PORT:8080}`. `EXPOSE 8080` documenta o fallback, nao fixa a porta do processo.

Depois do primeiro deploy do Vercel, definir `CORS_ALLOWED_ORIGINS` com a origem HTTPS real do frontend, sem caminho/barra final, separando multiplas origens por virgula. Nao usar URL inventada, wildcard ou credenciais no codigo. A URL HTTPS do Supabase tambem nao deve conter barra final.

GET `/actuator/health`, `/actuator/health/liveness` e `/actuator/health/readiness` ja sao publicos pela SecurityConfig existente, sem detalhes internos no perfil `prod`. Readiness inclui banco e retorna 503 quando indisponivel; liveness verifica somente o estado da aplicacao. O Render aceita respostas HTTP 2xx/3xx no caminho de health check e tambem utiliza falhas consecutivas para reiniciar instancias: monitorar indisponibilidade compartilhada do banco. Nenhuma politica de seguranca foi relaxada.

Para validar a imagem em uma maquina com Docker, executar em `backend/novexa-api`:

```powershell
.\mvnw.cmd clean package -DskipTests
docker build -t novexa-api-render .
```

O build nao inicia a aplicacao nem precisa de secrets. Inicializacao/health devem ser homologados somente apos fornecer as variaveis obrigatorias e um banco seguro de staging; nao executar smoke contra producao. Preparacao dos arquivos nao comprova deploy no Render, build da imagem, scan ou comportamento sob SIGTERM.

## Build / Cloud Run

Na raiz `backend/novexa-api`, apos testes aprovados:

```powershell
.\mvnw.cmd -DskipTests package
docker build --platform linux/amd64 -t novexa-api:prod .
```

Imagem multi-stage Maven/JDK 21 no build (compilacao pelo Maven Wrapper do repositorio), Temurin JRE 21 no runtime, sem secrets, executada como usuario 10001. Entrypoint exec-form entrega SIGTERM ao Java. `PORT` e dinamica, bind `0.0.0.0`. Shutdown graceful usa 8s por fase; Cloud Run concede janela de 10s apos SIGTERM. Validar requisicao em andamento no container antes de liberar trafego. Retrys continuam seguindo idempotencia do dominio; graceful shutdown nao garante completar uma transacao maior que a janela da plataforma.

Fixar digest da imagem publicada e fazer scan de vulnerabilidades; nao assumir que a tag da imagem base e imutavel. Nao foi adicionada dependencia ou versao nova ao projeto.

Exemplo de deploy, executado pelo responsavel de publicacao apos substituir os placeholders. Nao executar contra projeto desconhecido. `env-prod.yaml` contem somente variaveis nao secretas e fica fora do repositorio; secrets sao referenciados pelo nome/versao.

```powershell
gcloud run deploy NOVEXA_SERVICE --project PROJECT_ID --region REGION --image IMAGE_AT_DIGEST --service-account SERVICE_ACCOUNT --port 8080 --cpu 1 --memory 1Gi --concurrency 20 --max-instances 3 --timeout 60 --env-vars-file env-prod.yaml --set-secrets "DB_PASSWORD=DB_PASSWORD_SECRET:VERSION,JWT_SECRET=JWT_SECRET_SECRET:VERSION,SUPABASE_SECRET_KEY=STORAGE_SECRET:VERSION" --startup-probe "httpGet.path=/actuator/health/readiness,httpGet.port=8080,periodSeconds=10,timeoutSeconds=5,failureThreshold=24" --liveness-probe "httpGet.path=/actuator/health/liveness,httpGet.port=8080,periodSeconds=30,timeoutSeconds=5,failureThreshold=3" --allow-unauthenticated --no-traffic
```

Incluir `SPRING_PROFILES_ACTIVE: prod`, `DB_URL`, `DB_USERNAME`, `CORS_ALLOWED_ORIGINS`, `SUPABASE_URL` e `SUPABASE_BUCKET` no arquivo nao secreto. Ajustar rede/VPC de acesso ao banco conforme infraestrutura escolhida. As capacidades acima sao ponto inicial conservador, nao teste de carga. O acesso publico do Cloud Run permite login/probes/browser; as rotas de negocio continuam exigindo JWT/perfil na aplicacao.

Publicar primeiro sem trafego em servico de staging com banco isolado. Mesmo uma revisao sem trafego pode executar migrations: nao apontar smoke para banco produtivo. Em producao, revisar compatibilidade com a revisao antiga antes do rollout; rollback de imagem nao desfaz migration. Validar a revisao por URL/tag ou promover trafego conforme procedimento do ambiente.

## Checklist de publicacao

- [ ] Branch/commit revisado; testes direcionados, package e diff check aprovados; confirmar limitacoes da suite completa.
- [ ] Build Docker, scan e execucao como non-root aprovados no ambiente com Docker.
- [ ] Secrets fora do Git/imagem/frontend; service account e IAM minimo revisados; versoes de secrets fixadas.
- [ ] Banco correto, backup/restauracao, rede/TLS, permissoes, CPFs e capacidade de conexoes conferidos.
- [ ] Migrations Flyway versionadas e Hibernate validate aprovados em staging; nenhuma alteracao de migration antiga.
- [ ] Empresa e ADMIN inicial provisionados por procedimento autorizado, sem seed de senha/secrets em Git; login e acesso administrativo conferidos.
- [ ] CORS permite apenas dominio aprovado; origem nao permitida negada; header X-Request-ID acessivel no browser.
- [ ] Probes 200 em banco disponivel; readiness 503 com banco indisponivel e liveness nao reinicia por falha compartilhada de banco.
- [ ] Confirmar PORT dinamica, proxy HTTPS/HSTS, memoria, concorrencia, escala maxima e graceful shutdown sob SIGTERM.
- [ ] Login, JWT real, perfis, tenant e E2E operacional/financeiro homologados com frontend real em staging.
- [ ] Logs/alertas e acesso ao suporte por request ID revisados, sem payload/PII ou secrets.
- [ ] Promover trafego gradualmente; observar 5xx, latencia, conexoes e integridade; plano de rollback documentado.

## Referencias oficiais

- [Docker no Render](https://render.com/docs/docker): runtime, build e secrets fora da imagem.
- [Monorepo no Render](https://render.com/docs/monorepo-support): Root Directory e caminhos relativos.
- [Health checks no Render](https://render.com/docs/health-checks).
- [Contrato do container Cloud Run](https://docs.cloud.google.com/run/docs/container-contract): PORT, bind, TLS e shutdown.
- [Probes Cloud Run](https://docs.cloud.google.com/run/docs/configuring/healthchecks).
- [Secret Manager no Cloud Run](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
- [Spring Boot 3.5: Actuator](https://docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html), [logging](https://docs.spring.io/spring-boot/3.5/reference/features/logging.html) e [graceful shutdown](https://docs.spring.io/spring-boot/3.5/reference/web/graceful-shutdown.html).
