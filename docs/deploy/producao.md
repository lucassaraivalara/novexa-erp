# Publicacao do Novexa: Oracle Cloud VM / Docker

Perfil implementado: `prod`, Java 21 / Spring Boot 3.5.4, PostgreSQL e migrations Flyway versionadas no repositorio. Este guia prepara a publicacao; nao comprova deploy nem homologacao do piloto. Frontend, regras financeiras e migrations existentes nao sao alterados.

Estrategia atual: **Vercel (React/Vite) -> Oracle Cloud VM Ubuntu (Nginx/HTTPS -> Docker/Spring Boot) -> Supabase (PostgreSQL + Storage)**. Render foi abandonado; `2b6a027` e `bc1ca42` sao historico, nao instrucoes atuais. Cloud Run tambem nao e destino desta etapa. Uma VM, um backend, sem PostgreSQL local, Redis, Kubernetes ou nova automacao CI/CD.

## Configuracao e secrets

Ativar `SPRING_PROFILES_ACTIVE=prod`. Sem perfil explicito, `application-default.properties` preserva a importacao local de `config/application-local.properties`; `prod` nao importa esse arquivo. Nao misturar os perfis `prod` e `default`. O Dockerfile ativa `prod` por padrao e nao copia `config`, `.env` ou credenciais.

| Variavel | Uso / regra |
|---|---|
| `DB_URL` | JDBC PostgreSQL, banco dedicado ao ambiente. Sem usuario/senha na URL. |
| `DB_USERNAME` | Usuario com privilegios somente no banco/schema Novexa. |
| `DB_PASSWORD` | Secret obrigatorio, nunca no Git, Dockerfile, argumento de build ou comando literal. |
| `JWT_SECRET` | Secret aleatorio de no minimo 32 bytes UTF-8; diferente por ambiente. |
| `JWT_EXPIRATION_MS` | Expiracao positiva, padrao 900000 (15 minutos). |
| `CORS_ALLOWED_ORIGINS` | Origem HTTPS real do frontend Vercel; multiplas origens separadas por virgula, sem caminho, barra final, wildcard ou credenciais. |
| `SUPABASE_URL` | Origem HTTPS do storage, sem barra final. |
| `SUPABASE_SECRET_KEY` | Secret de storage; somente backend. Nunca chave secreta em `VITE_*`. |
| `SUPABASE_BUCKET` | Bucket ja provisionado com politica de acesso revisada. |
| `PORT` | Configuravel; Compose usa 8080 por padrao, mantendo publicacao somente em loopback. |
| `JAVA_TOOL_OPTIONS` | Opcional: substitui integralmente os defaults de memoria/GC da imagem. |
| `DB_POOL_MAX` / `DB_POOL_MIN` | Padroes 5 / 0 por instancia. Ajustar ao limite global do banco. |
| `DB_CONNECTION_TIMEOUT_MS` | Padrao 5000; deve ser maior que o timeout de validacao de 2000 ms. |
| `GEOCODING_URL` / `GEOCODING_USER_AGENT` | Opcionais, seguem contrato existente; URL vazia preserva preenchimento manual. |

Secrets ficam em `/etc/novexa/novexa-api.env` na VM, fora do checkout, com acesso somente root (arquivo 600, diretorio 700). Usar Compose via sudo; acesso ao Docker equivale a privilegios root e permite inspecionar o ambiente do container. Nao distribuir secrets em terminal, logs, tickets ou saida de `docker inspect`/`compose config`. Rotacionar secrets editando o arquivo e recriando o container; trocar `JWT_SECRET` invalida tokens anteriores. Arquivos ignorados nao protegem um secret ja commitado: revisar diff/historico e rotacionar qualquer credencial exposta.

Antes de inicializar datasource/Flyway, startup rejeita propriedades obrigatorias vazias, JWT curto, banco nao PostgreSQL, CORS nao HTTPS/generico e overrides inseguros de Hibernate/Flyway. A mensagem de validacao informa a propriedade, nunca seu valor. Hikari e JwtService validam seus limites adicionais.

## Banco / migrations

- Usar banco exclusivo por ambiente; testar primeiro em staging, nunca contra producao para homologar.
- Garantir backup e restauracao testada antes de publicar. Em base antiga, conferir CPFs normalizados duplicados antes da V32; nao apagar usuarios nem realizar backfill automatico para contornar a constraint.
- Antes da V33, conferir documentos de fornecedores normalizados duplicados dentro do mesmo tenant. Havendo conflito, regularizar explicitamente; nao deduplicar/apagar fornecedores automaticamente. Conferir a compatibilidade do consumidor frontend em [fornecedores.md](../architecture/fornecedores.md).
- `ddl-auto=validate`, Flyway habilitado, `validate-on-migrate=true`, `baseline-on-migrate=false`, `clean-disabled=true`. Schema desconhecido, checksum divergente ou incompatibilidade Hibernate deve impedir startup.
- Nunca editar migration aplicada, usar `clean` ou `repair` para esconder divergencia. Baseline de banco preexistente exige procedimento revisado fora do startup automatico.
- O MVP migra durante startup usando a coordenacao existente do Flyway. Provisionar permissoes DDL no schema para o usuario usado nessa etapa; nao conceder superuser. Futuramente separar usuario de migration/runtime requer mudar o procedimento de deploy, nao desligar validacao silenciosamente.
- Usar conexao PostgreSQL direta ou pooler em modo session para migrations; nao usar pooler transaction com locks de sessao do Flyway. Manter rede privada quando disponivel ou TLS com verificacao de certificado para banco publico. Configurar CA/`sslmode=verify-full` conforme o provedor; nao usar conexao publica sem protecao.
- Dimensionar `DB_POOL_MAX * containers simultaneos` mais jobs/manutencao abaixo do limite de conexoes. O Compose usa um backend; nao aumentar pool/replicas sem medir. Defaults 5/0 preservados.
- `minimum-idle=0`, timeout de conexao 5s, validacao 2s, idle 10min e max-lifetime 30min sao valores iniciais, nao tuning homologado de carga. Revisar timeouts de rede do provedor.

## Seguranca / erros

JWT, perfis e isolamento tenant existentes permanecem. Sem HTTP Basic, formulario/session ou usuario de seguranca gerado em `prod`. CORS nao substitui autenticacao e nao bloqueia chamadas diretas fora do browser.

API envia CSP restritiva, Referrer-Policy, nosniff, frame DENY e headers de cache existentes. HSTS e emitido quando a requisicao e reconhecida como HTTPS. `server.forward-headers-strategy=native` permite reconhecer TLS terminado no Nginx confiavel; nao expor o container diretamente a proxies nao confiaveis nem ampliar `internal-proxies` para `.*`. O proxy sobrescreve headers encaminhados; conferir reconhecimento de HTTPS/HSTS na VM sem relaxar seguranca.

Erros funcionais e status 400/401/403/404/409 permanecem; JSON/tipos malformados retornam 400. Erro inesperado retorna 500 generico com orientacao para informar `X-Request-ID`, sem SQL, senha, stacktrace ou mensagem interna. Os detalhes automaticos de erro do servidor estao desabilitados. Logs de infraestrutura/startup podem conter diagnostico interno: restringir acesso SSH/Docker e copias dos logs.

## Health / observabilidade

Endpoints GET publicos, na mesma porta da API e sem JWT:

- `/actuator/health`: status agregado, sem componentes/detalhes de banco.
- `/actuator/health/liveness`: estado da aplicacao, sem dependencia de banco para evitar reinicios em cascata.
- `/actuator/health/readiness`: estado da aplicacao + banco; DOWN retorna 503.

Somente health e exposto; env/configprops/loggers/metrics nao sao publicados. Os grupos podem aparecer por nome no health agregado, sem dados internos. Verificar readiness apos startup e liveness para o estado do processo. `restart: unless-stopped` reinicia por saida/reboot, nao por health DOWN: nao criar reinicio automatico por indisponibilidade compartilhada do banco. SecurityConfig permanece intacta.

Toda resposta recebe `X-Request-ID`: um valor de 1..64 caracteres `[A-Za-z0-9._-]` recebido e reutilizado; ausente/invalido gera UUID. Nao e identificador de autenticacao nem de idempotencia financeira. CORS permite/expoe esse header. MDC e limpo/restaurado ao terminar a requisicao.

Logs JSON em stdout possuem `severity`, `requestId`, metodo, template da rota, status e duracao. Negacoes antes do controller usam `route=unmapped`. Nao registrar bodies, query strings, Authorization, CPF, senha ou tokens. Usar logs Docker/Compose e acompanhar 5xx, probes, reinicios e conexoes esgotadas. Erros inesperados registram tipo da excecao, nao sua mensagem/payload.

## VM Ubuntu e instalacao Docker

Provisionar Ubuntu Server 24.04 LTS em Oracle Cloud, Ampere A1 (`aarch64`) ou x86_64. Planejar pelo menos 4 GiB de RAM para SO, Nginx, runtime limitado a 2 GiB e build Maven; isso e ponto inicial, nao dimensionamento homologado. Reservar disco para imagens/build e logs. Usar IP publico estavel, subnet com rota para Internet Gateway e SSH por chave, com acesso administrativo restrito.

Comandos abaixo sao para executar **na VM nova**, nao na maquina local. Se ja houver Docker/containerd, revisar conflitos conforme documentacao oficial antes de instalar; nao remover dados/servicos existentes automaticamente.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx ufw certbot python3-certbot-nginx
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker nginx
sudo docker version
sudo docker compose version
uname -m
```

Exigir Compose >= 2.30 para `env_file.format: raw` e Docker Engine atualizado (>= 28 para protecao de portas publicadas em loopback). Nao conceder grupo Docker indiscriminadamente. O build seleciona a arquitetura nativa da VM; nao fixar amd64 no Ampere. Tags atuais `maven:3.10.0-eclipse-temurin-21-noble` e `eclipse-temurin:21-jre-jammy` declaram `arm64v8`/amd64 nos metadados oficiais. Build ARM64 real ainda precisa ser validado na VM; preservar Java 21/Maven Wrapper/non-root/ENTRYPOINT exec-form. Nao assumir tags imutaveis; registrar imagem/digest e revisar vulnerabilidades antes de liberar trafego.

## Checkout e ambiente externo

```bash
git clone https://github.com/lucassaraivalara/novexa-erp.git
cd novexa-erp
git checkout main
git pull --ff-only origin main
cd backend/novexa-api
sudo install -d -m 700 /etc/novexa
sudo touch /etc/novexa/novexa-api.env
sudo chmod 600 /etc/novexa/novexa-api.env
sudoedit /etc/novexa/novexa-api.env
```

Se repositorio privado, configurar acesso Git autorizado na VM sem token na URL ou no historico do shell. Preencher o arquivo externo privadamente: linhas `CHAVE=valor`, **sem aspas**, sem comentarios no fim da linha. `raw` preserva `$` e aspas literalmente, evitando interpolacao das senhas. Exemplo abaixo nao contem valores secretos e nao e suficiente para iniciar a aplicacao:

```dotenv
SPRING_PROFILES_ACTIVE=prod
DB_URL=
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=
CORS_ALLOWED_ORIGINS=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SUPABASE_BUCKET=
```

Usar valores reais do Supabase existente, sem alterar banco/schema. `DB_URL` deve ser JDBC (`jdbc:postgresql://HOST:PORT/DATABASE`), nao URI `postgres://`; usuario/senha separados. Para VM IPv4-only, usar o endpoint **session pooler** fornecido pelo painel quando a conexao direta exigir IPv6; nao adivinhar host/usuario e nao trocar para transaction pooler. Preservar contrato Flyway e TLS com verificacao do servidor. Se precisar de CA, armazenar fora do Git e montar somente o certificado publico read-only via override Compose, com `sslrootcert` apontando para caminho interno; nunca desativar validacao do banco para contornar rede.

`CORS_ALLOWED_ORIGINS` recebe a origem HTTPS definitiva do Vercel; `SUPABASE_URL` recebe a origem HTTPS real, sem barra final. `JWT_EXPIRATION_MS`, `GEOCODING_URL`, `GEOCODING_USER_AGENT` e parametros Hikari existentes continuam opcionais.

## Memoria e Compose

Defaults runtime: `-Xms256m -Xmx1g -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError`. Heap explicito nao cresce conforme toda a RAM da VM; G1 e apropriado como ponto inicial Java 21, sem tuning adicional. Foram removidos heap 64/256 MiB, metaspace 128 MiB, code cache 32 MiB, direct memory 16 MiB e Serial GC do Render Free.

Para override completo, adicionar `JAVA_TOOL_OPTIONS=...` no arquivo externo, incluindo limites desejados e `-XX:+ExitOnOutOfMemoryError`; recriar o container com `up -d --force-recreate`. O Compose nao redefine essa variavel. Seu limite inicial de container e 2 GiB (heap + memoria nativa); nao equivale a teste de carga nem garante startup se a VM estiver sem recursos. Medir RSS, pausas e latencia antes de ajustar. Maven build nao recebe os limites/secrets do runtime.

`compose.prod.yml` sobe somente `novexa-api`, com restart `unless-stopped`, logs rotacionados 10 MiB x 3, stop grace 20s e mapeamento `127.0.0.1:8080:8080`. Propriedades Spring continuam `server.port=${PORT:8080}` e bind `0.0.0.0` dentro do container. Compose fixa perfil prod e sincroniza PORT com a porta interna; nao confiar em PORT divergente no env_file.

Overrides operacionais do Compose sao variaveis do shell (nao do env_file): `NOVEXA_ENV_FILE` (default `/etc/novexa/novexa-api.env`), `NOVEXA_MEMORY_LIMIT` (default `2g`) e `NOVEXA_CONTAINER_PORT` (default `8080`, host continua loopback:8080). Com sudo, usar `sudo env NOVEXA_MEMORY_LIMIT=... docker compose -f compose.prod.yml ...`; manter os mesmos overrides em todos os comandos de deploy. Nao aumentar heap sem deixar margem nativa e recursos para o SO.

Primeiro validar com Supabase de staging e variaveis corretas; iniciar o container executa Flyway automaticamente. Nao fazer smoke contra banco produtivo. Em `backend/novexa-api`:

```bash
sudo docker compose -f compose.prod.yml config --quiet
sudo docker compose -f compose.prod.yml build --pull
sudo docker compose -f compose.prod.yml up -d
sudo docker compose -f compose.prod.yml ps
sudo docker compose -f compose.prod.yml logs --tail=100 novexa-api
curl --fail http://127.0.0.1:8080/actuator/health/readiness
```

`config --quiet` valida sem imprimir secrets. Aguardar startup antes do curl; 503/readiness exige investigar banco/configuracao. Nao iniciar sem variaveis obrigatorias. Runtime non-root e shutdown graceful Spring 8s por fase preservados; validar SIGTERM/requisicao em andamento na VM, sem presumir que 20s cobrem qualquer transacao.

## Firewall Oracle e Ubuntu

Na Security List ou NSG da VNIC: permitir ingress TCP 22 somente do CIDR administrativo; 80/443 das redes publicas atendidas. Se IPv6 estiver habilitado, revisar regras IPv6 tambem. Nao abrir ingress 8080 nem 5432. Permitir egress necessario para DNS, HTTPS (Supabase Storage/apt/registries/Let's Encrypt) e PostgreSQL no endpoint externo escolhido; nenhuma regra torna PostgreSQL local necessario.

Revisar `sudo ufw status verbose`, `sudo iptables -S` e regras existentes da imagem Oracle antes de mudar firewall. Nao limpar/resetar regras Oracle ou bloquear servicos reservados. Manter sessao SSH atual e console de recuperacao disponiveis; liberar seu IP correto antes de habilitar UFW. Na VM nova usando UFW:

```bash
read -r -p 'CIDR administrativo real para SSH: ' ADMIN_CIDR
sudo ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
sudo ufw status verbose
```

Regras UFW nao substituem NSG/Security List nem regras preexistentes da VM; confirmar acesso externo e remover permissoes genericas de SSH somente apos testar uma segunda conexao. Docker pode contornar regras UFW para portas publicadas: manter bind `127.0.0.1`, nunca `0.0.0.0:8080`. Sem 5432 publico/local.

## Nginx e HTTPS

Criar DNS A do **dominio real da API** para o IP publico da VM. Publicar AAAA somente com IPv6 funcionando ponta a ponta. Substituir `API_DOMAIN` abaixo antes de usar; nao ha dominio ficticio configurado na aplicacao. Criar `/etc/nginx/sites-available/novexa-api` com `sudoedit`:

```nginx
server {
    listen 80;
    server_name API_DOMAIN;
    server_tokens off;
    client_max_body_size 3m;
    access_log off;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header Forwarded "";
    }
}
```

O proxy sobrescreve headers enviados pelo cliente; nao adicionar CORS no Nginx, pois a API ja o controla. `client_max_body_size` preserva teto de request 3 MiB existente. Access log desabilitado neste site para nao registrar query strings/PII; diagnostico continua em stdout da API. O bloco HTTP e apenas bootstrap de certificado: **nao publicar uso da API/frontend antes do HTTPS**.

```bash
sudo ln -s /etc/nginx/sites-available/novexa-api /etc/nginx/sites-enabled/novexa-api
sudo nginx -t
sudo systemctl reload nginx
read -r -p 'Dominio real da API: ' API_DOMAIN
sudo certbot --nginx -d "$API_DOMAIN" --redirect
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
curl --fail "https://$API_DOMAIN/actuator/health/readiness"
```

O symlink e criado uma unica vez; se ja existir, revisar em vez de sobrescrever. Certbot emite certificado Let's Encrypt e configura redirect HTTP -> HTTPS. DNS/80/443 precisam estar acessiveis para validacao/renovacao. Confirmar certificado valido, renovacao automatica, HTTPS/HSTS e porta 8080 inacessivel externamente. No Vercel, a URL da API deve ser HTTPS do dominio real; nenhuma alteracao frontend nesta tarefa. Nao adicionar autenticacao basica que quebre CORS/probes nem relaxar SecurityConfig.

## Logs, reboot e novas versoes

```bash
sudo docker logs --tail=100 -f novexa-api
sudo docker compose -f compose.prod.yml logs --tail=100 -f novexa-api
sudo docker stats --no-stream novexa-api
sudo systemctl is-enabled docker nginx
```

Docker habilitado + `unless-stopped` recuperam o container apos reboot. Um container parado manualmente continua parado; usar `compose up -d` para retomar. Confirmar reboot controlado na homologacao, TLS e readiness apos retorno. Nao adicionar systemd separado para a aplicacao nem stack de observabilidade.

Atualizar a partir do checkout limpo na VM, preservando o arquivo externo e validando backup/compatibilidade das migrations antes de publicar:

```bash
git status -sb
git pull --ff-only origin main
cd backend/novexa-api
sudo docker compose -f compose.prod.yml build --pull
sudo docker compose -f compose.prod.yml up -d --force-recreate
sudo docker compose -f compose.prod.yml logs --tail=100 novexa-api
curl --fail http://127.0.0.1:8080/actuator/health/readiness
```

Executar git a partir da raiz (se estiver no backend, retornar antes do `cd`). Recriar aplica mudancas no env_file; `restart` sozinho nao atualiza variaveis. Build ocorre antes de substituir o container; este fluxo tem breve indisponibilidade e nao promete zero downtime. Registrar commit/imagem anterior para rollback revisado; rollback de imagem nao desfaz migration. Nao usar reset/clean/rebase/force para atualizar. Nenhum CI/CD novo.

## Checklist de publicacao

- [ ] Branch/commit revisado; testes direcionados, package e diff check aprovados; confirmar limitacoes da suite completa.
- [ ] Build Docker, scan e execucao como non-root aprovados no ambiente com Docker.
- [ ] Secrets fora do Git/imagem/frontend; permissoes 600/700 e acesso SSH/Docker restritos.
- [ ] Banco correto, backup/restauracao, rede/TLS, permissoes, CPFs e capacidade de conexoes conferidos.
- [ ] Migrations Flyway versionadas e Hibernate validate aprovados em staging; nenhuma alteracao de migration antiga.
- [ ] Empresa e ADMIN inicial provisionados por procedimento autorizado, sem seed de senha/secrets em Git; login e acesso administrativo conferidos.
- [ ] CORS permite apenas dominio aprovado; origem nao permitida negada; header X-Request-ID acessivel no browser.
- [ ] Probes 200 em banco disponivel; readiness 503 com banco indisponivel e liveness nao reinicia por falha compartilhada de banco.
- [ ] Confirmar loopback:8080, NSG/firewall, DNS, HTTPS/HSTS, renovacao TLS, memoria e graceful shutdown sob SIGTERM.
- [ ] Login, JWT real, perfis, tenant e E2E operacional/financeiro homologados com frontend real em staging.
- [ ] Logs/alertas e acesso ao suporte por request ID revisados, sem payload/PII ou secrets.
- [ ] Reboot/restart testados; observar 5xx, latencia, conexoes e integridade; plano de rollback revisado.

## Referencias oficiais

- [Opcoes JVM Java 21](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html): heap, metaspace, code cache, buffers diretos e GC.
- [Docker Engine no Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
- [Compose: services](https://github.com/compose-spec/compose-spec/blob/main/05-services.md): env_file raw, memoria, portas e restart.
- [Portas Docker](https://docs.docker.com/engine/network/port-publishing/): loopback e limites de versoes antigas.
- [Imagens oficiais Maven](https://github.com/docker-library/official-images/blob/master/library/maven) e [Temurin](https://github.com/docker-library/official-images/blob/master/library/eclipse-temurin): arquiteturas das tags.
- [Oracle: regras de rede](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm).
- [Nginx reverse proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).
- [Certbot](https://github.com/certbot/certbot/blob/master/certbot/docs/using.rst): Nginx, renovacao e dry-run.
- [Supabase: conexao PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).
- [Spring Boot 3.5: Actuator](https://docs.spring.io/spring-boot/3.5/reference/actuator/endpoints.html), [logging](https://docs.spring.io/spring-boot/3.5/reference/features/logging.html) e [graceful shutdown](https://docs.spring.io/spring-boot/3.5/reference/web/graceful-shutdown.html).
