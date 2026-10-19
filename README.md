## Desenvolvimento local no Windows, sem Docker

Use Java 21, Node/npm e PostgreSQL instalados no Windows. Banco, API e Vite são processos separados. O perfil Spring `local` aponta exclusivamente para `jdbc:postgresql://localhost:5432/novexa_erp`, API `http://localhost:8080` e frontend `http://localhost:5173`. Não use credenciais, dados ou endpoints de produção.

### 1. PostgreSQL

Neste computador o serviço existente é `postgresql-x64-18`. Confira antes de iniciar; não instale outra instância nem apague bancos:

```powershell
Get-Service postgresql-x64-18
# Somente se estiver parado, em PowerShell como administrador:
Start-Service postgresql-x64-18
```

O usuário local existente é `postgres`. Para conferir a conexão sem colocar senha no comando:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5432 -U postgres -W -d postgres -c 'SELECT datname FROM pg_database WHERE datname=''novexa_erp'';'
```

Somente se `novexa_erp` não existir, crie-o com o comando abaixo. Não recrie um banco existente:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h localhost -p 5432 -U postgres -W novexa_erp
```

Flyway cria/atualiza as tabelas no startup da API; Hibernate somente valida (`ddl-auto=validate`). Não use `create`, `update`, `clean`, `repair` ou baseline automático para contornar incompatibilidades. Antes de atualizar um banco local com dados importantes, preserve um backup local.

### 2. Backend

Diretório: `C:\Users\lucas\IdeaProjects\novexa-erp\backend\novexa-api`.

```powershell
cd C:\Users\lucas\IdeaProjects\novexa-erp\backend\novexa-api
if (!(Test-Path config/local-secrets.properties)) {
    Copy-Item config/application-local.example.properties config/local-secrets.properties
}
```

Edite somente o arquivo privado `config/local-secrets.properties`, ignorado pelo Git:

- `LOCAL_DB_USERNAME`: usuário do PostgreSQL local; default `postgres`.
- `LOCAL_DB_PASSWORD`: senha desse usuário local. Se `DB_PASSWORD` já estiver definido corretamente no Windows, remova a linha `LOCAL_DB_PASSWORD` para usar essa variável como fallback.
- `LOCAL_JWT_SECRET`: chave aleatória própria do ambiente local, com pelo menos 32 bytes; nunca reutilize a chave de produção.

Para gerar a chave e gravá-la diretamente no arquivo privado, sem exibi-la:

```powershell
$localRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
$localKeyBytes = New-Object byte[] 32
$localRandom.GetBytes($localKeyBytes)
$localRandom.Dispose()
$localKey = [Convert]::ToBase64String($localKeyBytes)
$localSettings = (Get-Content config/local-secrets.properties) -replace '^LOCAL_JWT_SECRET=.*$', ('LOCAL_JWT_SECRET=' + $localKey)
[IO.File]::WriteAllLines((Join-Path (Get-Location) 'config/local-secrets.properties'), $localSettings, (New-Object Text.UTF8Encoding($false)))
Remove-Variable localKey,localKeyBytes,localSettings
```

As variáveis `LOCAL_DB_USERNAME`, `LOCAL_DB_PASSWORD` e `LOCAL_JWT_SECRET` também podem ser fornecidas pelo ambiente do processo, sem arquivo. O arquivo antigo `config/application-local.properties` é legado do perfil default e foi preservado; o perfil explícito `local` não o importa. `DB_URL`, `SUPABASE_URL` e chaves genéricas de produção não definem os destinos desse perfil local.

Iniciar:

```powershell
.\mvnw.cmd '-Dspring-boot.run.profiles=local' spring-boot:run
```

Readiness local, incluindo conexão com banco:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health/readiness
```

Parar: `Ctrl+C` no terminal do backend, ou Stop na IDE. A API fica vinculada a loopback; não é publicada na rede. Não há criação automática de empresa/ADMIN: use apenas credenciais de usuários locais já existentes. Banco vazio permite validar startup/readiness, mas não comprova login bem-sucedido.

Storage externo e geocodificação ficam sem destino remoto neste perfil. O bean de Storage recebe endereço de loopback não atendido; upload/remoção de imagens não está disponível sem um serviço local separado. Não configure Supabase de produção para testar essas ações.

O frontend existente também solicita uma fonte do Google Fonts. Em validação sem rede externa, bloqueie essa solicitação e use o fallback do navegador; isso não impede a comunicação com a API local. As fontes não foram redesenhadas ou substituídas nesta configuração.

### 3. Frontend

Diretório: `C:\Users\lucas\IdeaProjects\novexa-erp\frontend`. `frontend/.env.example` já contém a URL local correta. Use uma variável do terminal ou copie esse exemplo para `.env.local`, sem sobrescrever arquivo privado existente:

```powershell
cd C:\Users\lucas\IdeaProjects\novexa-erp\frontend
$env:VITE_API_URL = 'http://localhost:8080'
npm.cmd run dev
```

Abra `http://localhost:5173`. No PowerShell, `npm.cmd` evita bloqueio de execução do `npm.ps1`; equivale a `npm run dev`. Se a porta estiver ocupada, encerre somente o processo conhecido ou use `npm.cmd run dev -- --port 5173 --strictPort` para falhar explicitamente. O CORS local permite `http://localhost:5173` e `http://127.0.0.1:5173`. Pare com `Ctrl+C` ou Stop na IDE.

As dependências já instaladas podem ser reutilizadas. Em um checkout novo, execute `npm.cmd ci`; não atualize versões/lockfile para iniciar o ambiente.

### 4. IntelliJ IDEA

As três configurações compartilhadas já existem em `.run/`:

| Configuração | Diretório / execução | Configuração local |
|---|---|---|
| Backend | `backend/novexa-api`, Maven `spring-boot:run` | Opção Maven explícita `-Dspring-boot.run.profiles=local`; Java 21; secrets no arquivo privado acima |
| Frontend | `frontend/package.json`, npm `run dev`, argumentos `-- --port 5173 --strictPort` | `VITE_API_URL=http://localhost:8080`; falha se 5173 estiver ocupada, sem mudar silenciosamente de porta |
| Novexa Full Stack | Compound de Backend + Frontend | Reutiliza as duas configurações; não inicia PostgreSQL nem aguarda readiness |

Inicie o serviço PostgreSQL antes do Backend/Full Stack. O Compound existente é compatível com a configuração da IDE deste projeto; se a edição da IDE não oferecer npm/Compound, use os dois terminais separados. Não salve secrets nas configurações compartilhadas de `.run/`. O frontend pode abrir antes da API; aguarde readiness antes de tentar autenticar.

Na IntelliJ, selecione **Backend** no seletor de execução e clique em Run (triângulo verde); aguarde `http://localhost:8080/actuator/health/readiness` retornar 200/UP. Depois selecione **Frontend** e Run, abrindo `http://localhost:5173`. Para iniciar os dois de uma vez, selecione **Novexa Full Stack** e Run. O Compound dispara as duas configurações existentes, sem garantir ordem de prontidão: banco primeiro e API pronta antes do login continuam necessários. Use Stop nas execuções do Backend/Frontend para encerrá-las; isso não para o serviço PostgreSQL.

Validação pela IDE em 19/10/2026: Backend e Frontend iniciaram separadamente; o Full Stack também iniciou ambos, com readiness 200/UP e frontend 200. O conector de automação retornou erro ao capturar o processo agregado do Compound, apesar dos filhos iniciados e confirmados pela árvore de processos/HTTP. Isso limita a captura agregada pelo conector; não houve falha de startup dos dois serviços. Uma consulta protegida pelo cliente Axios real do frontend recebeu 401 sem token, sem expor credenciais; não comprova acesso autenticado 200.

Para parar o banco, encerre antes o backend e os demais clientes locais; somente se não houver outro uso do serviço, em PowerShell como administrador:

```powershell
Stop-Service postgresql-x64-18
```

### 5. Testes e builds locais

No backend, execute testes sem herdar perfil `local`/`prod` da configuração de execução. Os defaults exclusivos de teste usam H2 em memória, não importam o arquivo privado e apontam Storage para loopback. Integrações PostgreSQL condicionais continuam exigindo URL explícita de banco/schema descartável; não aponte esses testes para o banco de desenvolvimento com dados nem para produção.

```powershell
cd C:\Users\lucas\IdeaProjects\novexa-erp\backend\novexa-api
Remove-Item Env:SPRING_PROFILES_ACTIVE -ErrorAction SilentlyContinue
.\mvnw.cmd '-Dtest=LocalProfileConfigurationTest,ProductionConfigTest,JwtAuthenticationTest,JwtServiceTest' test
.\mvnw.cmd test
.\mvnw.cmd -DskipTests package

cd C:\Users\lucas\IdeaProjects\novexa-erp\frontend
$env:VITE_API_URL = 'http://localhost:8080'
node --test tests/login.test.mjs
npm.cmd run build
npm.cmd run lint

cd C:\Users\lucas\IdeaProjects\novexa-erp
git diff --check
```

Os testes frontend de login usam HTTP simulado e não comprovam integração. A validação do ambiente deve também abrir o frontend contra a API local real, conferir CORS, readiness e a resposta de `/auth/login`, sem criar registros ou acessar produção.

## Execucao e publicacao

Frontend Vercel: usar `frontend` como Root Directory, `npm run build` e output `dist`. `frontend/vercel.json` encaminha acessos diretos das rotas SPA para `index.html`. A gestao de usuarios fica em `/usuarios` (sessao com perfil ADMIN); sem sessao, o frontend redireciona para `/login`. Alteracoes no rewrite exigem novo deploy do frontend.

Backend: Java 21, Spring Boot 3.5.4 e PostgreSQL. Estrategia atual: frontend no Vercel, backend Docker em VM Oracle Cloud e banco/Storage no Supabase; Render abandonado. Perfil `prod`, secrets externos, Compose, Nginx/HTTPS e checklist em [docs/deploy/producao.md](docs/deploy/producao.md).

# \# Novexa ERP

# 

# Sistema ERP empresarial desenvolvido pela Novexa Tecnologia.

# 

# \## Sobre o projeto

# 

# O Novexa ERP é uma plataforma de gestão empresarial criada para centralizar processos administrativos, financeiros e operacionais em uma única solução.

# 

# O objetivo é construir um ERP moderno, escalável e preparado para atender empresas de diferentes segmentos.

# 

# \## Objetivo

# 

# Criar uma solução completa contendo:

# 

# \* Gestão de usuários

# \* Controle financeiro

# \* Gestão de estoque

# \* Cadastro de clientes

# \* Relatórios gerenciais

# \* Integrações futuras

# 

# \## Arquitetura do projeto

# 

# O projeto será dividido em:

# 

# ```text

# Frontend

# React

# 

# &#x20;       ↓

# 

# Backend

# Java + Spring Boot

# 

# &#x20;       ↓

# 

# Banco de Dados

# PostgreSQL

# ```

# 

# \## Tecnologias

# 

# \### Backend

# 

# \* Java

# \* Spring Boot

# \* JPA/Hibernate

# 

# \### Frontend

# 

# \* React

# \* TypeScript

# 

# \### Banco de dados

# 

# \* PostgreSQL

# 

# \### Ferramentas

# 

# \* Git

# \* GitHub

# \* IntelliJ IDEA

# 

# \## Estrutura do projeto

# 

# ```text

# novexa-erp

# 

# ├── backend

# ├── frontend

# ├── database

# ├── docs

# └── scripts

# ```

# 

# \## Roadmap inicial

# 

# \* \[x] Configuração do repositório

# \* \[x] Estrutura inicial do projeto

# \* \[ ] Documentação completa

# \* \[ ] Configuração backend

# \* \[ ] Primeiro módulo ERP

# \* \[ ] Banco de dados

# \* \[ ] Deploy

# 

# \## Status do projeto

# 

# Em desenvolvimento.

# 

# \---

# 

# Desenvolvido por Novexa Tecnologia.



