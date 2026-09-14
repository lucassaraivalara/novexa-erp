# Smoke E2E do Novexa ERP

## Pré-requisitos

- Node.js e dependências instaladas em `frontend`.
- Backend iniciado em ambiente de desenvolvimento, com PostgreSQL disponível.
- Frontend iniciado em `http://localhost:5173`.
- Playwright instalado no projeto; não é necessário adicionar outra ferramenta.

## Configuração

Defina as variáveis de ambiente sem gravar credenciais no repositório:

```powershell
$env:E2E_BASE_URL = "http://localhost:5173"
$env:E2E_USER_CPF = "CPF_DO_USUARIO_DE_TESTE"
$env:E2E_USER_PASSWORD = "SENHA_DO_USUARIO_DE_TESTE"
```

O smoke usa registros com prefixo `E2E -` e sufixo de timestamp. O ambiente pode acumular esses registros; não há exclusão automática.

## Execução

```powershell
cd frontend
npm run test:e2e
```

O cenário cobre Login, cadastro e edição de Produto, Entrada, Saída, Ajuste e Histórico de Estoque, conferência do saldo no Produto e cadastro/edição de Caixa. Vendas, PDV e movimentação financeira ficam fora desta suíte.