# Auditoria da navegação — 2026-10-14

Escopo: shell gerencial, menu por domínios, rotas/abas vinculadas, teclado e responsividade. Baseline: `e5098dc`, branch `feat/navegacao-dominios`. Nenhuma funcionalidade nova ou alteração de backend, contrato ou identidade visual.

## Resultado

A composição atual corresponde ao padrão textual solicitado: faixa navy de ícones → menu principal → submenu da área. Desktop reúne as três colunas em um contorno flutuante; o submenu sobrepõe o conteúdo sem deslocá-lo. Mobile mantém a faixa e abre diretamente as funções da área. As imagens de referência não estavam disponíveis nesta conversa, portanto não foi possível confirmar correspondência visual com elas.

| Aspecto | Evidência atual |
|---|---|
| Hierarquia | Seis áreas compartilham o mesmo `menuPrincipal`; ícones e coluna principal acionam o mesmo painel. |
| Rotas e abas | Destinos existentes; Fornecedores e Entradas sincronizam URL, aba, título e item ativo. |
| Operação | Vender abre `/pdv` com layout independente; Caixas apenas navega ao cadastro/gestão existente. |
| Permissões | Usuários aparece para ADMIN; a rota também redireciona os demais perfis. A autorização definitiva permanece no backend. |
| Teclado e fechamento | Seta direita abre e foca a primeira função; esquerda/Escape restauram foco. Navegação, botão fechar e clique fora recolhem o painel. |
| Composição responsiva | Capturas Chromium e medidas em 1366×768, 1920×1080, 1024×768 e 390×844; submenu dentro da viewport, sem overflow horizontal nem deslocamento do conteúdo. |

## Falha corrigida

Em viewports baixas, a faixa compacta não permitia rolagem manual até os últimos domínios. O teste com roda do mouse reproduziu a falha antes da correção. `Sidebar.tsx` agora permite rolagem vertical independente e preserva o tamanho dos elementos; teste em 1024×320 e 390×320 confirma acesso à Administração, alvos de 44px e retorno de foco.

## Validação

- 66 testes aprovados: `layout`, `fornecedores-ui`, `estoque` e `entrada-mercadoria`, com componentes reais e HTTP simulado.
- Build/TypeScript aprovados; permanece o aviso existente de bundle maior que 500 kB.
- Lint aprovado, com dois avisos em formulários financeiros não alterados.
- Capturas desktop/mobile inspecionadas; arquivos gerados permanecem ignorados em `node_modules`.

## Limites e pendências

- `frontend/e2e/sidebar.spec.mjs` ainda descreve o menu anterior (Drawer, itens indisponíveis e grupos inicialmente abertos). Esse arquivo não comprova a navegação atual e não foi executado nem reescrito nesta auditoria; os testes direcionados de layout exercitam o shell vigente.
- Não foram executadas a suíte completa, a homologação com backend real ou a comparação com as imagens ausentes.
- Resultado restrito à branch auditada; não houve integração em `main`.
