# Frontend — padrões de cadastros, buscas e formulários

## Contas e saldos — PIX e cartões por destino

A listagem mostra saldo disponível e previsão a liquidar separadamente. A ação “PIX e cartões” da conta abre consulta paginada no drawer; “Ver PIX e cartões” consulta todos os destinos. O resumo inclui todas as páginas, separa históricos sem destino e sinaliza previsão incompleta quando faltar líquido histórico. Falha de consulta apresenta erro e retry, sem substituir indisponibilidade por saldo zero.

O drawer apresenta A LIQUIDAR/LIQUIDADO, configuração usada, destino histórico, venda em nova aba, bruto, taxas, líquido, previsão e auditoria do movimento. ADMIN/GERENTE confirmam PIX ou liquidam cartão com diálogo explícito e endpoints existentes; demais perfis apenas consultam. Retry, bloqueio síncrono contra duplo envio, foco, Escape, rolagem em telas estreitas e tokens claro/escuro seguem os componentes existentes. Central de Vendas passa a exibir o destino também para cartão; extrato identifica PIX confirmado e cartão liquidado. Sem mudança no PDV ou no fechamento.

## Composição de Produtos (Kit/Combo)

O formulário completo oferece tipo composto, busca remota de componentes físicos, quantidade/unidade/fator, remoção e histórico versionado. Cadastro rápido permanece simples. Campos digitados são preservados em erro; componentes não carregados não são sobrescritos. Produtos, Estoque, busca/carrinho do PDV e impressão identificam o composto e sua disponibilidade/custo calculados. O carrinho apresenta consumo previsto recolhível e recalcula com a quantidade, sem gravar estoque. Central de Vendas apresenta consumo histórico, custo e IDs de saída/reversão. Operações avulsas de estoque e seleção para Entrada excluem Kit/Combo. Layout, temas, pagamento, atalhos e rotas existentes são reutilizados.

## Dinheiro em cofre (2026-10-19)

Contas e saldos inclui painel compacto com saldo COFRE, entradas/saídas confirmadas, pendências por sessão, histórico de recolhimentos/troco e extrato paginado com depósitos/contrapartes. A conta permanece na listagem existente. Fechamento e sangria oferecem destinação opcional, responsável, observação e confirmação explícita; fechar sem informar destino não credita cofre. Devolução para troco usa sessão aberta e confirmação gerencial. Nenhuma conta ou sessão é criada automaticamente. Regras e contratos em [financeiro.md](financeiro.md#dinheiro-em-cofre--v45). A validação funcional em produção será realizada pelo cliente, sem movimentações reais pelo agente.

## Empresas, CEP e sessão operacional (2026-10-19)

Regime Tributário oferece MEI na criação, edição e listagem, sem inferir regras ou valores fiscais. O formulário administrativo também oferece a autorização empresarial de venda com estoque insuficiente, desativada por padrão; o PDV exige confirmação explícita conforme [estoque.md](estoque.md).

No endereço de Empresas, informar oito dígitos consulta `GET /enderecos/cep/{cep}` após debounce. O backend consulta [ViaCEP](https://viacep.com.br/) com limites de conexão/leitura de 2/3 segundos; erros 400, 404 e 503 oferecem preenchimento manual. Logradouro, bairro, cidade e UF continuam editáveis; resposta atrasada não sobrescreve campos alterados durante a consulta nem outro CEP. Número e complemento não são inferidos, e indisponibilidade do provedor não impede salvar dados preenchidos manualmente.

JWT passa a usar o padrão de uma hora, com renovação autenticada por atividade de teclado/leitor, clique/toque ou rolagem via `POST /auth/renovar`. Polling não renova. O início original assinado limita a sessão a oito horas; após expiração é necessário login e o rascunho local do PDV é preservado. Tokens continuam sujeitos à assinatura, empresa, usuário ativo, perfil e versão de revogação existentes. Parâmetros operacionais em [produção](../deploy/producao.md).

Este documento define os padrões do frontend do Novexa ERP, preservando a densidade e a velocidade operacional.

## Navegacao por dominios

Sidebar organiza Visão geral (acesso direto ao Dashboard), Cadastros (Produtos, Clientes, Fornecedores), Estoque (Saldo e Entradas de mercadoria), Vendas (PDV e Central de Vendas), Financeiro e Configurações. Financeiro preserva as operações Caixas, Contas e saldos (ContaFinanceira), Contas a Pagar, Contas a Receber e Recebimentos de cartão. Configurações substitui Administração e abre diretamente a central `/configuracoes` pelo rodapé, tanto na coluna principal quanto na faixa compacta, com rolagem em janelas baixas.

A central reutiliza PageContainer, PageHeader e listas de links compactas, sem consultas HTTP, busca ou formulários próprios. Empresa contém Empresas; Usuários e acesso contém Usuários somente para ADMIN, usando a mesma verificação da rota existente e omitindo a seção para os demais perfis; Financeiro contém Formas de pagamento e Dados bancários; Produtos contém Categorias e subcategorias e Marcas. Os destinos destacam Configurações mesmo no acesso direto e oferecem retorno à central no AppHeader. As telas anteriores mantêm suas URLs e regras de acesso, inclusive `/financeiro/`, abas, parâmetros e histórico.

Os cabeçalhos usam os mesmos nomes da central. Empresas identifica dados cadastrais e fiscais; Usuários, os perfis de acesso; Formas de pagamento, nomes, tipos e condições de recebimento. O formulário existente distingue destino do recebimento e destino da liquidação de cartão, orientando o cadastro em Financeiro → Contas e saldos; taxas percentual/fixa e prazo continuam nos mesmos campos de cartão. Dados bancários identifica bancos, agências e contas como identidade bancária, com saldo/extrato em Contas e saldos. Ajuste textual na branch `feat/central-configuracoes`, sobre `7bebd24`; testes, build, lint e homologação desta etapa pendentes por orientação explícita.

Na ausência de destinos ativos permitidos, o formulário de pagamento oferece Contas e saldos em nova aba e Atualizar destinos. No cadastro financeiro BANCO, a ausência de contas bancárias oferece Dados bancários em nova aba e Atualizar contas bancárias. As telas originais permanecem montadas, preservando os dados digitados e a seleção; a atualização recarrega somente as opções pelos services existentes, sem selecionar automaticamente o novo cadastro. Falhas de consulta mantêm o feedback de erro e retry, sem indicar ausência de cadastros. A forma define como pagar; a conta financeira controla saldo/extrato; os dados bancários guardam a identidade. Implementado na mesma branch, sobre `85e5a14`; testes, build, lint e homologação desta navegação pendentes por orientação explícita.

Desktop usa um unico conjunto flutuante, a 8px das bordas, com altura calc(100dvh - 16px), sombra externa unica e raio de 12px apenas no contorno. Faixa navy de 56px e coluna de dominios de 208px compartilham a mesma selecao; painel de funcoes de 264px abre sobre o conteudo sem mudar o espaco reservado do shell. No mobile, a faixa abre diretamente as mesmas funcoes. Clique fora, Escape, fechar ou navegar recolhem o painel; seta direita abre e foca a primeira funcao, seta esquerda/Escape devolvem foco ao acionador. Icones possuem tooltip e nomes acessiveis.

`Fixar menu` distingue preferência persistida (`novexa-menu-fixed`) de abertura temporária. No desktop, fixado mantém a sidebar em 264px e reserva 280px no shell; desfixado recolhe para a faixa de 56px, reservando somente 72px com as margens externas. Hover e abertura de funções expandem por sobreposição, sem aumentar a reserva do conteúdo. Desfixar limpa a abertura temporária imediatamente; sair, clicar fora, Escape e navegar também a recolhem. O foco retorna ao acionador compacto quando a coluna é removida. O switch possui label clicável, alvo de 44px e foco visível; a transição respeita movimento reduzido. Mobile mantém sua faixa e submenus existentes, sem alterar a preferência de desktop.

Correção validada sobre `9f15343` (2026-10-18): regressão reproduziu sidebar ainda em 264px após desfixar. Após o ajuste, 33 testes de shell/navegação/tema aprovados (`sidebar-fixar`, `layout`, `dark-mode`), incluindo persistência, navegação, teclado, submenus, geometria de tabela/formulário e ausência de overflow da página. Conferidos claro, escuro e automático em 1440×900, 1024×640, 1024×320, 390×844, 390×480 e 320×320, com dados fictícios/HTTP simulado; o smoke de produção após a publicação é conferido separadamente na entrega. Build frontend, lint e diff check aprovados; permanecem os dois avisos anteriores de React Hook Form e o aviso de bundle grande. Nenhuma regra de negócio ou dado alterado.

Em telas baixas, a faixa de icones possui rolagem vertical independente, preservando os alvos de 44px e o acesso aos ultimos dominios.

Vender e PDV apontam para /pdv, cujo layout operacional independente permanece. Caixas aponta para /financeiro/caixas sem abrir sessao. Produtos/Fornecedores e Saldo/Entradas de mercadoria usam as mesmas telas existentes; menu, abas, titulo e selecao sincronizam por ?aba=fornecedores e ?aba=entradas. Caixas e Dados Bancarios preservam suas abas. Entrada avulsa identifica a movimentacao isolada de produto, distinta da Entrada manual de mercadoria. Nomes apresentados nao renomeiam dominios, services ou endpoints.

Entradas de mercadoria oferece consultas a Produtos (`/produtos`) e Fornecedores (`/produtos?aba=fornecedores`) em nova aba no formulário manual/XML, preservando os dados e a URL da entrada original. A orientação indica retornar à aba da entrada para continuar; Voltar às entradas fecha o formulário pelo callback existente. Cadastros rápidos continuam no mesmo formulário, sem novas ações de criação. A área Estoque usa Saldo e Entradas de mercadoria também nas abas e títulos, com abas roláveis em telas pequenas. Textos distinguem o catálogo, o recebimento confirmado e a movimentação/ajuste avulso. Detalhes em [entradas-mercadoria.md](entradas-mercadoria.md). Etapa na branch `feat/central-configuracoes`, sobre `8fd6b40`; testes, build, lint e homologação pendentes por orientação explícita.

## Categorias e subcategorias de Produtos

`/configuracoes/categorias-produtos` oferece as abas Categorias e Subcategorias (`?aba=subcategorias`), preservando os demais parâmetros ao trocar a aba. Reutiliza PageContainer, PageHeader, PageFilters, AppTable e CadastroDialog, com criação/edição de nome e situação; subcategoria exige categoria da empresa. Busca por nome com debounce/cancelamento, situação, ordenação e paginação são remotas; subcategorias permite filtrar por categoria. O seletor pesquisa até 25 categorias por consulta, incluindo inativas e permitindo alcançar nomes fora da primeira página, sem carregar o cadastro inteiro.

Conflitos mantêm os dados digitados. Exclusão definitiva exige confirmação e informa o bloqueio quando a categoria tem subcategorias; inativação fica no formulário e não altera automaticamente os filhos. Erros de consulta têm retry e não são exibidos como ausência de cadastros. A nova rota segue os perfis autenticados de Produtos; a seção Usuários mantém sua restrição atual. Contrato e regras em [arquitetura.md](arquitetura.md#categorias-e-subcategorias-de-produtos). O formulário completo, a consulta e o relatório de Produtos agora utilizam esses cadastros, conforme a seção Classificação do Produto.

## Marcas de Produtos

Configurações → Produtos → Marcas abre `/configuracoes/marcas-produtos`, mantendo Configurações ativa e retorno pelo AppHeader também no acesso direto. Usa os mesmos PageContainer, PageHeader, PageFilters, AppTable e CadastroDialog de Categorias. Busca por nome com debounce/cancelamento, situação (Ativas/Inativas/Todas), ordenação e paginação são aplicadas no backend; começa em Ativas. O debounce é agendado apenas quando o termo muda em relação à busca aplicada; a montagem da tela não reinicia a página após o usuário avançar. O formulário cria/edita nome e situação, permitindo inativar e reativar. Conflitos preservam os dados digitados; falha de consulta oferece retry, sem indicar cadastro vazio.

Exclusão exige confirmação, explica o impedimento por produtos ativos ou inativos e mostra o motivo retornado pela API sem remover a linha em caso de erro. Perfis existentes de Produtos preservados, sem empresa no payload e sem carregar cadastros na central. Marca opcional está disponível no cadastro completo, consulta e relatório de Produtos. Contrato e vínculo estrutural em [arquitetura.md](arquitetura.md#marcas-de-produtos).

## Classificação do Produto

O formulário completo permite categoria, subcategoria e marca opcionais. Os seletores pesquisam até 25 registros por consulta, mantêm a seleção atual inclusive inativa e oferecem retry quando a consulta falha. Subcategorias são consultadas pela categoria; trocar ou limpar categoria limpa explicitamente a subcategoria. Limpar envia null. Cadastro rápido não recebe esses campos.

Consulta e relatório mostram os nomes da classificação junto ao produto, sem consultas por linha. Filtros por categoriaId, subcategoriaId e marcaId são remotos e retornam à página zero. A impressão inclui a classificação abaixo do nome, preserva os filtros capturados e carrega todas as páginas antes de liberar impressão. Não há alteração de preço, custo, estoque ou permissões.

## Fornecedor principal do Produto

O formulário completo de Produto oferece Fornecedor principal opcional pelo FornecedorAutocomplete e lookup `/fornecedores/buscar`, sem carregar o cadastro inteiro. Salva apenas `fornecedorId`; limpar o campo envia `null`. Fornecedor inativo previamente vinculado permanece selecionado e identificado pela orientação do campo. Falhas do lookup têm feedback/retry no formulário de Produto, preservando seleção e dados; demais usos do componente mantêm o comportamento anterior. Cadastro rápido não ganha campo nem etapa adicional.

Produtos mostra o fornecedor abaixo do nome, com indicação de inativo ou Não informado, sem consulta por linha nem aumento de largura da tabela. Ao abrir edição, o formulário usa o detalhe atualizado recebido da API, evitando manter um fornecedor antigo da listagem. Filtros, abas e parâmetros permanecem. Contrato e integridade em [fornecedores.md](fornecedores.md#fornecedor-principal-do-produto).

## Relatório fixo de preços de Produtos

Introduzido na branch `feat/central-configuracoes`, sobre `1d28116`, o Relatório de preços é ação secundária do cabeçalho de Produtos. O diálogo reutiliza AppTable, PageFilters e os componentes atuais, com rolagem no conteúdo e retorno ao cadastro preservado. Exibe nome, código interno/SKU, unidade, preço de venda, custo, situação e fornecedor principal (acrescentado na etapa Produto→Fornecedor). Ausência de fornecedor aparece como “—”. Busca em Nome ou Código interno/SKU, situação Ativos/Inativos/Todas e ordenação ascendente/descendente por produto, código interno, preço de venda ou situação são executadas no backend. Página e tamanho são remotos; filtro, tamanho e ordenação retornam à página zero. Categoria, subcategoria e marca são filtros remotos opcionais. Ordenação por custo/unidade/fornecedor permanece ausente.

URL e parâmetros preservados: `GET /produtos?busca=...&campoBusca=nome|codigoInterno&situacao=ativos|inativos|todos&page=0&size=25&sort=nome,asc`, com `{items,page,size,totalItems,totalPages}` e os campos de Produto, incluindo `precoCusto` e agora `fornecedor` opcional. Permissões de consulta existentes e empresa pelo JWT; não há parâmetro para selecionar outra empresa. A nova coluna usa os dados da própria resposta, sem requisições por produto; PDV permanece inalterado.

Preparar impressão/PDF abre uma janela e percorre **todas** as páginas dos filtros/ordem capturados no início, usando o mesmo GET com `size=100`. A impressão só é liberada após completar o resultado; não usa apenas a página exibida. A janela contém empresa, filtros, ordem, quantidade, horário e sete colunas fixas, incluindo custo interno e fornecedor principal. O usuário imprime ou salva como PDF pela função nativa do navegador. Não se adicionaram biblioteca, gerador de PDF, CSV ou motor de relatórios. Nomes de produtos e fornecedores são inseridos como texto, sem interpretar HTML.

Falhas HTTP, mudança de sessão/empresa, itens de empresa diferente, duplicatas ou contagens inconsistentes fecham a preparação e mostram erro. Fechar o diálogo cancela a carga; pop-up bloqueado orienta liberar a janela. O contrato não oferece snapshot transacional: alterações simultâneas que mantenham quantidade/IDs podem produzir dados de instantes diferentes. O relatório completo ocupa memória do navegador, sem infraestrutura de processamento em segundo plano.

Validação sobre `c32231a`: `node --test tests/relatorio-precos.test.mjs` aprova 11 testes no navegador com HTTP simulado; `node --test tests/paginacao.test.mjs tests/busca-coluna.test.mjs tests/app-table.test.mjs tests/filtros-padrao.test.mjs` aprova os 18 testes relacionados existentes. Verifica abertura pelo cadastro real, filtros, sort/page remotos, 201 ativos em três páginas, seis colunas, bloqueio de impressão durante a carga, falhas HTTP/resultado incompleto/duplicata/contagem/empresa/sessão, cancelamento, pop-up bloqueado e acesso pelos perfis existentes. Sem sessão, a rota continua redirecionando ao login. Nenhuma requisição informa empresaId; o isolamento real e a paginação do GET existente foram revisados no controller/service/repository, sem alteração ou homologação backend nesta rodada.

Capturas conferidas em 1920×1080, 1366×768, 390×844 e 1366×320, sem overflow horizontal do diálogo; a tabela mantém rolagem horizontal em mobile, conteúdo e paginação são alcançáveis pela rolagem vertical, ações permanecem visíveis e Escape devolve o foco ao acesso original. A janela separada contém o resultado completo e gera PDF no Chromium; a chamada a `window.print` foi verificada por instrumentação, sem teste de impressora física. Artefatos locais ignorados em `frontend/node_modules/etapa7-validacao/`.

Build e lint aprovados após corrigir a nulidade de `window.open` na função de conferência da janela; somente os avisos anteriores de bundle grande e React Hook Form permanecem. Diff revisado e `git diff --check` aprovado. Validação frontend concluída neste escopo; CONTRACT READY pendente, sem execução de testes backend ou das suítes gerais já pendentes. Não houve novo contrato ou ampliação de acesso.

## Recebimentos de cartão — previsão e liquidação

A listagem prioriza situação, data prevista, bruto, taxas e líquido previsto. Liquidação registrada mostra exclusivamente `valorLiquidoRecebido` e `dataLiquidacao` retornados pela API, sem substituir ausências por valores previstos; em cancelados com auditoria de liquidação, identifica Registro histórico. Tipo, parcela e configuração compartilham uma célula secundária, preservando a ordenação por tipo; data da venda, filtro por venda e link de origem permanecem. A ação Liquidar mantém a condição existente de perfil gerencial e status PENDENTE. Nenhum cálculo, status, data ou contrato alterado. Ajuste visual na branch `feat/central-configuracoes`, sobre `6e7e1e2`; testes, build, lint e homologação pendentes por orientação explícita.

## Contas a Pagar e Contas a Receber — consulta e ações

As tabelas apresentam vencimento, saldo pendente e situação antes dos valores históricos e dados complementares. Pagar/Receber aparecem primeiro nas ações da linha, em cor primária; Nova conta usa ação secundária, mantendo a manutenção cadastral distinta da baixa financeira. Contas a Pagar descreve o pagamento integral e identifica explicitamente Cancelar conta e Estornar pagamento nas confirmações; Contas a Receber preserva baixa parcial/total, cancelamento conforme origem e estorno individual no histórico. Links para a venda e demais acessos financeiros existentes permanecem. Ajuste visual/textual na branch `feat/central-configuracoes`, sobre `3d23ca8`; testes, build, lint e homologação pendentes por orientação explícita.

## Contas e saldos — operação e identidade bancária

Contas e saldos mantém os resumos de saldo e a tabela existentes; Extrato, Movimentar e Transferir aparecem primeiro nas ações da conta, em cor primária. Editar e Alterar situação permanecem discretos, e Nova conta usa ação secundária no cabeçalho, sem etapas adicionais. Dados bancários já identifica sua responsabilidade cadastral (bancos, agências e identificação das contas), sem saldo próprio. Nomes, URLs e acessos contextuais existentes foram preservados. Ajuste visual/textual na branch `feat/central-configuracoes`, sobre `e88fe18`; testes, build, lint e homologação pendentes por orientação explícita.

## Caixas — operação e cadastro

Em `/financeiro/caixas`, a visão inicial Sessão aberta preserva o saldo e as ações de fechamento, suprimento e sangria; Histórico de sessões reúne as sessões encerradas e seu detalhe existente. Cadastro de caixas permanece como ação secundária do cabeçalho, com criação, edição e situação no diálogo existente. Textos distinguem o cadastro físico da sessão operacional e de Contas e saldos (saldo/extrato financeiro). Nenhuma mudança em abertura, seleção de sessão, permissões, cálculos ou PDV. Ajuste visual/textual na branch `feat/central-configuracoes`, sobre `4998ee8`; testes, build, lint e homologação pendentes por orientação explícita.

## PDV - comandos operacionais

Fluxo de pagamento (2026-10-19): montar/revisar carrinho → **Finalizar venda** (F2) → escolher pagamento no diálogo → **Confirmar pagamento**. Somente a confirmação envia `POST /vendas`; abrir, voltar, Escape e fechar pelo fundo não gravam venda, estoque ou financeiro. Campos, troco, misto, prazo, rascunho por sessão, Kit/Combo e UUID de retry são reutilizados. A autorização de estoque insuficiente retorna ao pagamento e exige a confirmação final. O diálogo prende Tab/Shift+Tab, foca a primeira forma, devolve foco ao acionador ao voltar e mantém total e ações fora da área rolável. Após sucesso, foco retorna à busca; após erro, à mensagem. F2 dentro do pagamento não envia a venda.

Revisão de 2026-10-18: digitação de EAN/código interno e leitor que envia teclas com Enter já funcionavam. Preservados endpoint `/produtos/buscar`, pedido de venda, atalhos F2–F9, rascunho por operador/sessão e foco na Quantidade após inclusão. Quando um mesmo código corresponde ao EAN de um produto e ao código interno de outro, a inclusão agora exige escolha na lista, com orientação anunciada; código exato único continua direto. Busca informa carregamento às tecnologias assistivas e ausência de resultados é um status contextual. F5/retorno à busca também a trazem à área visível após rolagem.

Comandos existentes agrupados por responsabilidade: Produto/Adicionar em azul, Quantidade/Desconto em laranja, Cliente/Observações/Entrega em roxo, Finalizar venda/Confirmar pagamento em verde e cancelamento/saída em vermelho. Texto, ícone, atalho e estados acessíveis permanecem. Total e Finalizar venda compartilham o rodapé do painel; no mobile o rodapé adere à parte inferior durante a rolagem, inclusive em 390×480. Pagamentos mantêm seus campos existentes no diálogo, com rolagem própria das formas/parcelas. Sem alteração de API, cálculo ou efeito financeiro/estoque.

`/pdv` apresenta console com topo escuro compacto (empresa, operador e sessao existentes), faixa superior de comandos coloridos e `PdvActionButton` com modo compacto. Inclusao fica em linha: busca unificada por nome/codigo/barras, quantidade, unitario somente leitura e Adicionar pelo mesmo fluxo de Enter. Durante a busca, quantidade indica a inclusao existente de uma unidade e unitario mostra somente o resultado destacado/exato; depois de adicionar, esses campos refletem o item selecionado, cuja quantidade pode ser editada. Carrinho usa linhas de 40px, selecao, controles +/- e remover; a faixa inferior identifica o item atual. Painel direito de 320px (360px em telas largas) mantem cliente, total e Finalizar venda fixos; pagamentos mistos rolam no dialogo de pagamento. Em telas menores, comandos ficam no alto, seguidos por inclusao e lista compacta; total/Finalizar venda ficam no rodape aderente. Sem novas consultas ou regras de venda.

F2 abre a etapa de pagamento, inclusive para conferir uma tentativa pendente; F3 foca Quantidade do item selecionado (ou ultimo); F4 remove esse item; F5 foca Produto; F6 abre a confirmacao existente de Limpar venda; F7 abre Desconto; F8 Cliente e F9 Observacoes preservados. F4/F7 substituem o antigo mapa Desconto/Entrega; Entrega continua por botao, sem atalho. Enter, setas, Ctrl+Delete, scanner e foco na Quantidade apos adicionar permanecem; Enter na Quantidade retorna a busca. Opcionais abrem dialogo com foco no campo e devolvem foco a busca ao concluir/fechar; Esc fecha primeiro a opcao intermediaria. F10/F11/F12 omitidos: nao ha fluxo dessas acoes no PDV. Nenhuma mudanca nos services, pedido, calculos ou regras de pagamento/estoque/caixa.

Controles +/- editam a mesma quantidade do carrinho em passos de uma unidade, preservando fracionados e sem permitir passo que resulte em zero/negativo. O editor aceita os mesmos valores e validacoes existentes. Os controles nao entram na sequencia de Tab: Quantidade continua seguida por Remover, mantendo o teclado operacional. Esc no editor em linha restaura o valor anterior e devolve foco a busca. F2 no topo e Finalizar venda no painel abrem o mesmo pagamento. Confirmar pagamento envia o pedido pelos bloqueios existentes.

## PDV - sessao de Caixa

O dialogo consulta GET `/financeiro/caixas/sessoes/abertas`, cujo contrato ja inclui operadorAbertura.id/nome, e compara o titular com `obterSessao().id`. Somente sessoes proprias participam da selecao automatica ou manual. Sem sessao propria, apresenta "Nao ha sessao de caixa aberta para o seu usuario" e mantem o PDV bloqueado ate resolver a abertura existente; opcoes de abertura incluem apenas Caixas ativos sem sessao aberta. Nenhuma mudanca no endpoint empresarial, autenticacao, pagamento ou regra de titularidade do backend.

## Central de Vendas - resumo no detalhe

Detalhe apresenta Total da venda, Pagamentos registrados (soma dos pagamentos imediatos REGISTRADO) e A receber (soma dos saldos das ContasReceber vinculadas, nao de seus valores originais). Formas utilizadas ficam em indicadores compactos; PIX REGISTRADO identifica pendente/confirmado pelo campo confirmadoFinanceiramente. Parcelas/vencimentos/status e link Ver em Contas a Receber permanecem. Sem consultas financeiras por linha nem status financeiro persistido em Venda. Falha de pagamentos exibe Pagamentos registrados indisponivel, nao zero.

Somente ao abrir detalhe com debito/credito, listarRecebiveis consulta GET `/financeiro/recebiveis` paginado por vendaId (25 por pagina, id asc), sem filtros de status que ocultem cancelados. Vinculo validado por vendaId/pagamentoId/tipo; exibe Aguardando liquidacao, Liquidado, Cancelado ou Recebivel nao localizado. Falha de consulta mostra situacao indisponivel e retry independente, sem interferir nos totais. Consultas antigas sao canceladas ao fechar/trocar detalhe. Cartao permanece em Pagamentos registrados quando REGISTRADO e nunca soma ao A receber. Central nao oferece liquidacao, taxas ou snapshots. O resumo esclarece que pagamentos registrados podem aguardar confirmação de PIX ou liquidação de cartão; A receber corresponde às parcelas a prazo.

Na branch `feat/central-configuracoes`, sobre `393954d`, o detalhe identifica Situação comercial e separa Itens da venda, Pagamentos e Contas a receber · Parcelas a prazo em seções nomeadas. O rótulo Pagamentos registrados substitui Pago agora somente na Central, sem mudar sua soma; faturamento não é apresentado como confirmação financeira. A listagem já priorizava identificação, data, cliente, total e situação; a consulta recebe destaque primário, enquanto cancelar permanece discreto na linha e mantém confirmação destrutiva. Vínculos financeiros, ações permitidas, filtros, paginação e PDV preservados. Testes existentes ajustados ao novo rótulo, sem execução; testes, build, lint e homologação desta apresentação pendentes por orientação explícita.

Detalhe de ContaReceber VENDA_A_PRAZO com vendaId oferece link Ver venda para `/vendas?vendaId=...`. A Central valida ID inteiro positivo seguro e abre o mesmo detalhe pelos services existentes, mesmo fora da pagina atual; falhas respeitam a resposta da API e permitem retry. Fechar o detalhe, por botão ou Escape, remove somente vendaId da URL. Conta manual ou sem vendaId nao oferece o link; baixa, estorno e mensagem de controle pela venda permanecem.

Na branch `feat/central-configuracoes`, sobre `b9e96bb`, os vínculos abrem nova aba para manter filtros, página, ordenação e detalhe da consulta original; os títulos dos links orientam voltar à aba de origem. Os acessos existentes de Venda → Conta a Receber (`contaId`) e Conta a Receber → Venda (`vendaId`) são reutilizados. Venda com cartão oferece uma única ação Ver recebimentos de cartão desta venda para `/financeiro/recebiveis?vendaId=...`. A tela aplica esse filtro no GET paginado existente, em todos os estados, e mantém os demais filtros ao editar/remover a venda; parâmetros não relacionados são preservados. Identificador inválido exibe validação e não consulta uma lista sem contexto. Cada recebível com vendaId válido oferece o detalhe da venda de origem, sem consultas adicionais por linha.

O contrato de cartão permite filtro por venda, sem endpoint de detalhe individual nem filtro por pagamento/recebível; por isso a ação identifica a consulta da venda, sem prometer abrir um recebível específico. Nenhum novo contrato, status, cálculo ou permissão. Testes de navegação/URL ajustados e ampliados, mas não executados; testes, build, lint e homologação desta etapa pendentes por orientação explícita.

## Contas a Receber - Bloco 2

Rota `/financeiro/contas-receber`, no grupo Financeiro, usa a identidade vigente navy/teal com composicao operacional: PageHeader, resumo global, PageFilters e AppTable compacta remota. Cadastro/baixa/confirmacoes reutilizam CadastroDialog; detalhe e historico ficam em drawer responsivo. Nenhum grafico, bloco decorativo ou alteracao global de identidade. Cliente usa ClienteAutocomplete existente (inativos somente no filtro historico); destinos usam pagina remota de contas ativas. Historico completo vem de GET por ID, nunca de recebimentos=[] da pagina. Retry de baixa preserva UUID/payload por empresa/conta em sessionStorage ate resposta conclusiva, bloqueando edicao da tentativa incerta.

Refinamento operacional: resumo compacto com as mesmas cinco metricas, busca acima dos filtros e filtros secundarios recolhiveis em xs. Desktop preserva as oito colunas; em laptop, valor original/recebido ficam no detalhe para priorizar vencimento, saldo, status e acoes. Mobile usa linhas empilhadas com os mesmos dados, Receber/Detalhes com alvo de 44px e controles de ordenacao/paginacao enviados ao backend, sem tabela larga nem tratamento local do catalogo. Drawer destaca saldo antes dos dados/historico e apresenta acoes permitidas antes do historico; cada baixa identifica seu valor, destino, data e estorno individual. Dialog de recebimento destaca saldo e valor recebido agora, sinalizando recebimento parcial sem etapa adicional. Theme, componentes compartilhados, contratos e regras financeiras preservados.

## Modo escuro — camadas e contraste (2026-10-18)

Ajuste visual sobre `6be9b58`. `theme/darkTokens.ts` centraliza fundo navy, rail/sidebar/header, superfície, elevação, input, cabeçalho de tabela, bordas, texto e estados semânticos. Tema claro, dimensões e navegação preservados. Preferência claro/escuro/automático continua no `ThemeModeProvider` existente, sem alteração de persistência ou autenticação.

`theme.ts` aplica superfícies sem gradiente automático do Paper, elevação discreta, teal primário, cores tonais legíveis de sucesso/erro/aviso/informação, placeholders, disabled, foco, menus, autocomplete, alertas, chips e modais. Sidebar escura tem seleção teal tonal e bordas discretas; header possui camada própria. AppTable resolve cabeçalho/bordas no tema ativo em vez de usar os valores claros congelados no import de layoutTokens. PDV reutiliza os mesmos componentes e ações, com tokens por modo, separadores discretos e atalho disabled legível. Dashboard adapta somente cores locais de títulos/valores e superfícies; indicadores e contratos permanecem iguais.

Validação automatizada local, com HTTP simulado: Produtos, Clientes, Fornecedores, Usuários, Empresas, Configurações e PDV em 1440×900, 1024×640, 390×844 e 390×480; Dashboard adicional em desktop/mobile. Testes verificam alternância claro/escuro/automático, ausência de overflow externo, cabeçalhos sem faixas brancas, contraste calculado mínimo 4,5:1 para texto normal e estados semânticos, hover, seleção, foco por teclado, campos vazios/preenchidos/erro/disabled, tabelas vazias/com registros, dropdown, drawer e modal. Capturas ficam em `frontend/node_modules/.vite-dark-mode-tests`, fora do Git. Esses testes não equivalem a homologação de produção nem a certificação integral de acessibilidade de todas as telas. Nenhum dado real, regra, API, dependência ou backend alterado por este ajuste visual.

Resultado: 192 testes relacionados aprovados (componentes, cadastros, navegação, PDV, Dashboard e modo escuro), build frontend aprovado, lint sem erros e `git diff --check` aprovado. Permanecem dois avisos preexistentes de `react-hooks/incompatible-library` nos formulários financeiros e o aviso de tamanho do bundle; não foram alterados nesta tarefa.

## Fundacao visual Novexa

Theme e a fonte principal da identidade: base neutra #F6F8F7/#FFFFFF, texto #101828/#5D6B7A, divider #E4E8EC e primary #0E7C66. Inter existente preservada, sem novas fontes/dependencias. Tipografia fixa h4 28px/600, h6 18px/600, body 15/14px e caption/overline 12px, sem tracking negativo ou dimensionamento por viewport. visualTokens.numeric disponibiliza tabular-nums.

Controles usam raio 8px, superficies 12px, dialogs 16px e chips pill. Sombras leves de superficie e elevacao de dialog; botoes contained sem sombra. OutlinedInput padroniza TextField/Select sem duplicar seletores. layoutTokens preserva suas chaves e dimensoes de layout, reutilizando identidade/raios/sombras/tipografia do theme. ThemeProvider/CssBaseline existentes em main.tsx permanecem; App.tsx/index.css nao exigiram mudanca.

Esta fundacao nao redesenha paginas ou componentes compartilhados, nem altera contratos, PDV/Login, rotas, services ou types. Sidebar escura/hardcodes e overrides locais continuam temporarios e nao viraram tokens da nova identidade. Validacao visual de Dashboard/Vendas/Clientes em desktop/mobile com dados simulados; integracao real nao foi exercitada nessa verificacao.

## Linguagem visual ERP baseada nas referencias

A direcao atual substitui a experiencia excessivamente plana: sidebar navy com bloco verde de marca e selecao verde clara, area principal #F7F9FB, superficies brancas com raio 10px e sombra discreta, controles 6px e dialogs 10px. Botoes primarios verdes solidos, secundarios outline/pilula e badges tonais compactos. Raios passados via sx usam unidades px para evitar a multiplicacao pelo shape do MUI, inclusive StatCard. CadastroDialog apresenta paineis internos outlined como secoes com divisor, sem caixas aninhadas decorativas.

Sidebar agora segue a composicao flutuante por dominios descrita acima, preservando marca, faixa navy e selecao mint. No Dashboard, a topbar saúda pelo nome da sessão e mostra empresa/iniciais reais; busca global, sino e seletor de período não são apresentados por não existirem como funções. Seis KPIs vêm somente de `/dashboard/resumo`; Caixa e ações rápidas ocupam a primeira faixa em proporção aproximada 2:1, seguidos por últimas vendas e alertas de estoque baixo na mesma proporção. A tabela reutiliza as cinco vendas da consulta paginada, sem coluna de pagamento porque o resumo não inclui essa informação; PIX pendente e cartões previstos não são inferidos. Entrada de mercadoria abre a aba existente via `?aba=entradas`. Em desktop largo os KPIs formam uma linha; em 1024px passam a 3+3; mobile usa duas colunas e empilha os blocos sem overflow. PDV mantém seus controles e regras. Nenhum contrato ou API foi alterado.

## Ações por ícones

As ações de linha em `AppTable` usam `IconButton` compacto com `Tooltip` e `aria-label` descritivos, reutilizando o rótulo quando não houver tooltip específico. O estado desabilitado deve ser preservado e o ícone deve indicar a operação. A ação primária Novo continua como botão identificado no `PageHeader`; não transformar ações de linha em botões grandes nem remover seus nomes acessíveis.

## Classificação

- **Filtro local:** usado em catálogos pequenos mantidos como List, como Empresas e Caixas. A filtragem é imediata, sem HTTP e sem debounce.
- **Busca textual remota:** consultas paginadas usam debounce de 350 ms, filtros e ordenação no banco. Clientes, Produtos, Estoque e Contas a Pagar aceitam os termos previstos nos seus contratos, sem mínimo adicional de tamanho. useRemoteSearch mantém o mínimo de 2 caracteres nos consumidores de busca por array.
- **Busca operacional:** PDV usa consultas remotas limitadas de Produto/Cliente, sem preload de catalogos. Digitacao usa useRemoteSearch (350 ms, minimo 2 caracteres), cancelamento e protecao contra respostas antigas. Enter prioriza codigo de barras/interno exato; sem match exato, adiciona o resultado destacado na lista aberta, por padrao ou pelas setas. Sem resultado exibido, Enter/leitor cancela o debounce e consulta imediatamente qualquer codigo nao vazio, mesmo curto, sem adicionar match parcial ainda nao exibido. Busca vazia orienta no campo; sem resultado apresenta somente feedback contextual, limpo ao trocar/limpar o termo. Adicionar preserva foco e selecao da Quantidade; Enter retorna a busca. Sem matching local por nome.
- **Identificador:** usa o `minLength` definido pelo contrato da tela; não deve herdar automaticamente o limite de uma busca textual.
- **Código de barras:** quando houver leitura direta, pode executar imediatamente, sem debounce, desde que o contrato da tela reconheça o valor.

As constantes compartilhadas ficam em `frontend/src/config/search.ts`. A infraestrutura de busca remota fica em `frontend/src/hooks/useRemoteSearch.ts`.

## Regras de execução

- Digitação agenda uma busca remota somente a partir do mínimo configurado.
- Enter executa imediatamente uma busca válida e cancela o timer pendente.
- Uma lupa, quando existir, deve ter o mesmo comportamento do Enter.
- Campo limpo cancela timer e requisição, invalida resultados antigos e restaura a listagem inicial.
- Termo abaixo do mínimo cancela ou invalida a requisição anterior e não mantém resultados de outro termo.
- O loading aparece somente quando a requisição real começa e termina em sucesso, erro ou cancelamento.
- Requisições antigas não podem sobrescrever o termo atual. A implementação deve usar `AbortController`, `requestId` ou ambos.
- Toda nova busca remota deve voltar à primeira página quando a tela possuir paginação.

## Regras de manutenção

Não converter um filtro local correto em busca remota apenas para aplicar debounce. Não colocar debounce dentro de `AppTable`: a página proprietária da busca conhece a origem dos dados e o contrato do endpoint. Mensagens de erro devem continuar sendo convertidas pelas funções de serviço existentes e não devem expor detalhes técnicos.

Clientes, Produtos, Estoque, Central de Vendas, Contas a Pagar e Extrato usam paginação server-side. `AppTable.ordenacaoRemota` mantém a ordem enviada pelo banco. Após alterações, recarregar a página atual. Contratos e consumidores que permanecem List em [paginacao.md](paginacao.md). PDV usa buscas remotas limitadas e preserva cliente opcional, limpeza/selecao e leitor imediato, sem carregar catalogos completos.

## Busca por coluna em Produtos, Clientes e Estoque

No cadastro completo de Produto, Código interno continua opcional e informa que será gerado ao cadastrar; o frontend envia null e exibe somente o valor retornado pela API. Na edição, vazio preserva o código atual. Produto legado sem código recebe orientação para identificação manual; na lista aparece “Sem código interno”. O cadastro rápido permanece sem campo adicional e utiliza a mesma geração do PostgreSQL (V47), descrita em [produtos.md](produtos.md).

Produtos permite selecionar Código interno ou Produto pelo botão textual
do cabeçalho. O chip removível de PageFilters indica o campo ativo; o texto digitado
é mantido ao trocar de coluna ou retornar à busca geral. A coluna restringe a busca
ao campo informado no backend; a busca geral inclui nome/código interno/barras.
Situação usa filtro próprio. Busca ignora caixa, sem normalização de acentos.

Com coluna ativa, a busca continua remota, com debounce e cancelamento de consultas
anteriores. Limpar/trocar campo retorna à primeira página. Salvar/inativar recarrega
a página atual do backend, preservando filtros e ordenação.

A API opcional `AppTable.buscaPorColuna` controla o campo e a seleção; as colunas
usam `pesquisavel` e `ordenavel` independentemente. O texto e a seta são botões
separados; a seta alterna ordenação crescente/decrescente sem selecionar a busca.
`PageFilters.campoBuscaAtivo` recebe o rótulo e a remoção do chip, devolvendo foco
ao campo. Sem essas propriedades, os consumidores preservam seu comportamento.

Clientes aplica o mesmo padrão remotamente às colunas Código, Nome / Razão social,
Nome fantasia, CPF/CNPJ, Cidade / UF e Telefone. Situação continua exclusivamente
como filtro próprio. A ordenação é independente do campo ativo da busca e ocorre
antes da paginação.

Estoque aplica busca por coluna somente a Produto e Código, mantendo a busca geral
remota. Estoque atual e Estoque mínimo permitem ordenação no banco; Situação é
filtro global no backend. O histórico tem paginação e filtros próprios.

## Apresentacao do Login

O Login utiliza duas colunas no desktop, painel navy/esmeralda e formulario
branco com marca N compartilhada. Em telas menores que 900px, o formulario
precede o bloco institucional. Os indicadores do painel sao ilustrativos,
nao dados financeiros reais. A validacao de CPF, payload, sessao persistida,
erros e redirecionamento permanecem inalterados; mostrar/ocultar senha
preserva o comportamento existente.

Recuperacao de senha e suporte nao possuem destino configurado: os controles
visuais permanecem desabilitados com explicacao em tooltip. Manter conectado
aparece marcado e desabilitado, refletindo a persistencia atual obrigatoria;
nao introduz uma preferencia de autenticacao. Estes fluxos dependem de
definicao funcional posterior. Testes Chromium cobrem validacao, retry,
payload, sessao, duplo submit e breakpoints 1440/1024/390px.

## Rascunho operacional do PDV

sessionStorage usa chave por empresa, operador e sessao de caixa. A restauracao espera a sessao atual ser resolvida, rejeita dados de outra sessao e ignora rascunhos vazios. Venda em andamento sobrevive ao refresh; sucesso e Limpar venda removem o salvo, sem recriar estado vazio. Voltar ao ERP nao limpa a venda. Tentativa de faturamento incerta preserva chaveRequisicao/payload para retry e bloqueia limpeza. Vender na sidebar compartilha o icone de carrinho das acoes Nova venda, enquanto Central de Vendas usa icone de consulta.

## Central de Vendas - listagem gerencial

A listagem usa PageHeader e PageFilters, com filtros responsivos e acao Limpar
filtros (remove status, periodo e cliente, retornando a primeira pagina sem
alterar ordenacao ou tamanho da pagina). Desktop preserva AppTable; entre
900px e 1199px, a sessao aparece junto do identificador da venda. Abaixo de
900px, linhas empilhadas mantem status, cliente, data, sessao, total e acoes,
com controles de ordenacao e paginacao remotas. Chips e botoes com tooltip
reutilizam o padrao gerencial. Detalhe financeiro, calculos, permissoes e
confirmacao de cancelamento permanecem inalterados. Testes Chromium cobrem
layout real em 1440/1024/390px, limpeza de filtros e fluxos mobile.

## Foco no carrinho do PDV

O foco automatico na Quantidade apos adicionar/incrementar um produto e aplicado em useLayoutEffect, depois do commit dos itens, com selecao explicita do valor atualizado. Nao depende de requestAnimationFrame ocorrer depois do render. A regressao do PDV atrasa o scheduler em contexto isolado e preserva as assercoes de foco, selecao e retorno a busca por Enter/Esc.

## Configuracoes empresariais no PDV

O formulario de configuracoes exige conta financeira destino para DEBITO/CREDITO, como PIX/TRANSFERENCIA, usando o service existente e contas ativas BANCO/CARTEIRA_DIGITAL. O destino atual inativo continua visivel e pode ser mantido na edicao, conforme contrato backend. DINHEIRO/BOLETO nao enviam destino residual ao trocar tipo. Cartao legado sem destino exibe aviso na lista/editor: pode ser inativado sem conta, mas salvar ativo/reativar exige escolha explicita. Sem backfill ou alteracao de snapshots antigos; tenant nunca compoe o payload. Erros de consulta e ausencia de contas sao diferenciados; sem contas, orienta cadastro separado. Validacao por React Hook Form/Yup, com mensagens junto ao campo; layout aprovado preservado.

PDV consulta configuracoes ativas da empresa autenticada e permite multiplas opcoes de DINHEIRO, PIX, DEBITO e CREDITO, mostrando nomeExibicao. BOLETO e TRANSFERENCIA nao aparecem. O pedido envia configuracaoFormaPagamentoId junto do enum legado (DINHEIRO/PIX/CARTAO_DEBITO/CARTAO_CREDITO). Dinheiro conserva valor recebido e troco; selecionar PIX nao confirma recebimento financeiro automaticamente.

Select nativo e listener de teclado com estado atual preservam selecao e F2. Dialog de finalizacao mostra nomeExibicao. Testes unitarios e quatro cenarios Playwright com HTTP simulado cobrem opcoes, payload, teclado e troco; a validacao financeira real usa PostgreSQL.

No PDV, DINHEIRO pede somente Recebido em dinheiro. O valor aplicado e derivado em centavos: cobre ate o saldo deixado por PIX/cartao/A prazo, limitado ao recebido; o excedente em dinheiro vira troco, inclusive no pagamento misto. Aplicado a venda e texto discreto, e Troco aparece somente quando positivo. PIX/cartao e parcelas mantem seus valores, sem redistribuicao automatica; excesso dessas formas continua bloqueado. Adicionar forma inicia somente o restante nao distribuido e preserva o recebido. O contrato permanece o mesmo: DINHEIRO envia valor aplicado e valorRecebido bruto. Backend, regras financeiras e retry nao mudaram.

Valor aplicado, Recebido em dinheiro e valores das parcelas a prazo reutilizam ValorMonetarioPDV, exclusivo desta tela. Inteiros representam reais; virgula decimal, ponto decimal com ate duas casas e agrupamento brasileiro de milhares sao aceitos na digitacao/colagem. O texto e preservado durante a edicao e formatado em pt-BR ao perder foco; foco seleciona o valor, sem mascara de centavos ou saltos de cursor. Normalizacao entrega decimal com ponto ao rascunho existente; entrada invalida permanece bloqueada, sem arredondamento silencioso. Campo vazio conserva a semantica anterior. Quantidade, desconto, formato do payload e componente monetario foram preservados.

# Padrão de Formulários

## Cadastro simples

Cadastros simples usam `PageHeader` + tabela + botão Novo + `Dialog` compacto. O
dialog diferencia `Novo X` de `Editar X`, mantém o primeiro campo útil com
autofocus, indica obrigatoriedade com `required` do MUI e usa `form
onSubmit` para que Enter execute o fluxo natural. Exceções como campos
multiline continuam aceitando Enter para nova linha.

As ações ficam em `FormActions`, com `Cancelar` à esquerda e a ação principal
à direita. O botão Salvar pode ser `type="submit"` e mostra `Salvando...`
durante a requisição. Enquanto salva, Cancelar, fechamento acidental e novos
submits ficam bloqueados.

## Cadastro complexo

Usuários usa drawer lateral na própria lista, com seções Dados e Acesso. Mantém `form onSubmit`, ações Salvar/Cancelar e confirmação antes de descartar alterações. Cadastro envia a senha inicial sem removê-la do payload ou aparar seus espaços; edição normal não envia senha, e redefinição usa somente PATCH de senha. Nome, CPF, login, e-mail, senha inicial, perfil e situação reutilizam os campos MUI; senha permite mostrar/ocultar. Login é identificação interna, com orientação explícita de que o acesso continua pelo CPF. Gestor reutiliza o papel GERENTE; sem controles granulares.

Busca por nome/CPF/login/e-mail, filtro de situação, ordenação e paginação usam GET `/usuarios/pagina`, com debounce de 350 ms e cancelamento de respostas antigas. Salvar ou alterar situação recarrega a página remota com os filtros mantidos. Conflitos preservam o formulário; sessão expirada e falta de permissão possuem mensagens próprias; falha de consulta oferece retry e não é apresentada como lista vazia. A inativação exige confirmação tanto na lista quanto no formulário. A situação fica bloqueada para a conta conectada e para o ADMIN preservado; este também tem CPF/perfil protegidos no formulário. O backend mantém a validação de último ADMIN e dos demais bloqueios. Retorno a Configurações e restrição de rota para ADMIN permanecem. Drawer com corpo rolável e rodapé acessível em desktop, notebook, mobile e janela baixa; referência Olist usada para hierarquia e ações, sem adicionar campos corporativos ou alterar o shell navy/verde.

Cliente, Produto e Empresa continuam usando dialogs maiores, abas ou seções.
Eles não são reduzidos ao padrão compacto, mas preservam `form onSubmit`,
validação próxima aos campos, loading localizado, proteção contra duplo
submit, valores digitados em caso de erro e fechamento somente após sucesso.

## Erros, cancelamento e sucesso

Validações básicas (obrigatório, formato e limites já definidos pelo contrato)
aparecem junto ao campo. Erros gerais da API usam o mecanismo de mensagem do
service e mantêm o formulário aberto sem limpar valores. Cancelar fecha
diretamente quando não há alterações relevantes; confirmações de descarte
existentes em formulários complexos são preservadas. Após sucesso, a tela
atualiza a listagem, fecha o formulário e mostra o feedback já adotado pela
página.

Novos cadastros devem reutilizar `FormActions` e esse fluxo. Não criar outro
motor genérico, outro loading ou outro padrão de submit sem uma exceção
intencional do domínio.
