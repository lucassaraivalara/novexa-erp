# Frontend — padrões de cadastros, buscas e formulários

Este documento define os padrões do frontend do Novexa ERP, preservando a densidade e a velocidade operacional.

## Navegacao por dominios

Sidebar organiza Visão geral (acesso direto ao Dashboard), Cadastros (Produtos, Clientes, Fornecedores), Estoque (Saldo e Entradas de mercadoria), Vendas (PDV e Central de Vendas), Financeiro e Configurações. Financeiro preserva as operações Caixas, Contas e saldos (ContaFinanceira), Contas a Pagar, Contas a Receber e Recebimentos de cartão. Configurações substitui Administração e abre diretamente a central `/configuracoes` pelo rodapé, tanto na coluna principal quanto na faixa compacta, com rolagem em janelas baixas.

A central reutiliza PageContainer, PageHeader e listas de links compactas, sem consultas HTTP, busca ou novos formulários. Empresa contém Empresas; Usuários e acesso contém Usuários somente para ADMIN, usando a mesma verificação da rota existente e omitindo a seção para os demais perfis; Financeiro contém Formas de pagamento e Dados bancários. As quatro telas mantêm suas URLs, inclusive `/financeiro/`, destacam Configurações mesmo no acesso direto e oferecem retorno à central no AppHeader. As demais regras de acesso, abas, parâmetros e histórico permanecem. Nenhum endpoint, módulo de negócio ou parâmetro foi criado.

Os cabeçalhos usam os mesmos nomes da central. Empresas identifica dados cadastrais e fiscais; Usuários, os perfis de acesso; Formas de pagamento, nomes, tipos e condições de recebimento. O formulário existente distingue destino do recebimento e destino da liquidação de cartão, orientando o cadastro em Financeiro → Contas e saldos; taxas percentual/fixa e prazo continuam nos mesmos campos de cartão. Dados bancários identifica bancos, agências e contas como identidade bancária, com saldo/extrato em Contas e saldos. Ajuste textual na branch `feat/central-configuracoes`, sobre `7bebd24`; testes, build, lint e homologação desta etapa pendentes por orientação explícita.

Na ausência de destinos ativos permitidos, o formulário de pagamento oferece Contas e saldos em nova aba e Atualizar destinos. No cadastro financeiro BANCO, a ausência de contas bancárias oferece Dados bancários em nova aba e Atualizar contas bancárias. As telas originais permanecem montadas, preservando os dados digitados e a seleção; a atualização recarrega somente as opções pelos services existentes, sem selecionar automaticamente o novo cadastro. Falhas de consulta mantêm o feedback de erro e retry, sem indicar ausência de cadastros. A forma define como pagar; a conta financeira controla saldo/extrato; os dados bancários guardam a identidade. Implementado na mesma branch, sobre `85e5a14`; testes, build, lint e homologação desta navegação pendentes por orientação explícita.

Desktop usa um unico conjunto flutuante, a 8px das bordas, com altura calc(100dvh - 16px), sombra externa unica e raio de 12px apenas no contorno. Faixa navy de 56px e coluna de dominios de 208px compartilham a mesma selecao; painel de funcoes de 264px abre sobre o conteudo sem mudar o espaco reservado do shell. No mobile, a faixa abre diretamente as mesmas funcoes. Clique fora, Escape, fechar ou navegar recolhem o painel; seta direita abre e foca a primeira funcao, seta esquerda/Escape devolvem foco ao acionador. Icones possuem tooltip e nomes acessiveis.

Em telas baixas, a faixa de icones possui rolagem vertical independente, preservando os alvos de 44px e o acesso aos ultimos dominios.

Vender e PDV apontam para /pdv, cujo layout operacional independente permanece. Caixas aponta para /financeiro/caixas sem abrir sessao. Produtos/Fornecedores e Saldo/Entradas de mercadoria usam as mesmas telas existentes; menu, abas, titulo e selecao sincronizam por ?aba=fornecedores e ?aba=entradas. Caixas e Dados Bancarios preservam suas abas. Entrada avulsa identifica a movimentacao isolada de produto, distinta da Entrada manual de mercadoria. Nomes apresentados nao renomeiam dominios, services ou endpoints.

Entradas de mercadoria oferece consultas a Produtos (`/produtos`) e Fornecedores (`/produtos?aba=fornecedores`) em nova aba no formulário manual/XML, preservando os dados e a URL da entrada original. A orientação indica retornar à aba da entrada para continuar; Voltar às entradas fecha o formulário pelo callback existente. Cadastros rápidos continuam no mesmo formulário, sem novas ações de criação. A área Estoque usa Saldo e Entradas de mercadoria também nas abas e títulos, com abas roláveis em telas pequenas. Textos distinguem o catálogo, o recebimento confirmado e a movimentação/ajuste avulso. Detalhes em [entradas-mercadoria.md](entradas-mercadoria.md). Etapa na branch `feat/central-configuracoes`, sobre `8fd6b40`; testes, build, lint e homologação pendentes por orientação explícita.

## Caixas — operação e cadastro

Em `/financeiro/caixas`, a visão inicial Sessão aberta preserva o saldo e as ações de fechamento, suprimento e sangria; Histórico de sessões reúne as sessões encerradas e seu detalhe existente. Cadastro de caixas permanece como ação secundária do cabeçalho, com criação, edição e situação no diálogo existente. Textos distinguem o cadastro físico da sessão operacional e de Contas e saldos (saldo/extrato financeiro). Nenhuma mudança em abertura, seleção de sessão, permissões, cálculos ou PDV. Ajuste visual/textual na branch `feat/central-configuracoes`, sobre `4998ee8`; testes, build, lint e homologação pendentes por orientação explícita.

## PDV - comandos operacionais

`/pdv` apresenta console com topo escuro compacto (empresa, operador e sessao existentes), faixa superior de comandos coloridos e `PdvActionButton` com modo compacto. Inclusao fica em linha: busca unificada por nome/codigo/barras, quantidade, unitario somente leitura e Adicionar pelo mesmo fluxo de Enter. Durante a busca, quantidade indica a inclusao existente de uma unidade e unitario mostra somente o resultado destacado/exato; depois de adicionar, esses campos refletem o item selecionado, cuja quantidade pode ser editada. Carrinho usa linhas de 40px, selecao, controles +/- e remover; a faixa inferior identifica o item atual. Painel direito de 320px (360px em telas largas) mantem cliente, total e Pagar fixos; pagamentos mistos rolam na propria regiao. Em telas menores, comandos ficam no alto, seguidos por inclusao, total/Pagar e lista compacta. Sem novas consultas ou regras de venda.

F2 preserva finalizacao/retry; F3 foca Quantidade do item selecionado (ou ultimo); F4 remove esse item; F5 foca Produto; F6 abre a confirmacao existente de Limpar venda; F7 abre Desconto; F8 Cliente e F9 Observacoes preservados. F4/F7 substituem o antigo mapa Desconto/Entrega; Entrega continua por botao, sem atalho. Enter, setas, Ctrl+Delete, scanner e foco na Quantidade apos adicionar permanecem; Enter na Quantidade retorna a busca. Opcionais abrem dialogo com foco no campo e devolvem foco a busca ao concluir/fechar; Esc fecha primeiro a opcao intermediaria. F10/F11/F12 omitidos: nao ha fluxo dessas acoes no PDV. Nenhuma mudanca nos services, pedido, calculos ou regras de pagamento/estoque/caixa.

Controles +/- editam a mesma quantidade do carrinho em passos de uma unidade, preservando fracionados e sem permitir passo que resulte em zero/negativo. O editor aceita os mesmos valores e validacoes existentes. Os controles nao entram na sequencia de Tab: Quantidade continua seguida por Remover, mantendo o teclado operacional. Esc no editor em linha restaura o valor anterior e devolve foco a busca. F2 no topo e Pagar no painel usam a mesma finalizacao e os mesmos bloqueios.

## PDV - sessao de Caixa

O dialogo consulta GET `/financeiro/caixas/sessoes/abertas`, cujo contrato ja inclui operadorAbertura.id/nome, e compara o titular com `obterSessao().id`. Somente sessoes proprias participam da selecao automatica ou manual. Sem sessao propria, apresenta "Nao ha sessao de caixa aberta para o seu usuario" e mantem o PDV bloqueado ate resolver a abertura existente; opcoes de abertura incluem apenas Caixas ativos sem sessao aberta. Nenhuma mudanca no endpoint empresarial, autenticacao, pagamento ou regra de titularidade do backend.

## Central de Vendas - resumo no detalhe

Detalhe apresenta Total da venda, Pago agora (soma dos pagamentos imediatos REGISTRADO) e A receber (soma dos saldos das ContasReceber vinculadas, nao de seus valores originais). Formas utilizadas ficam em indicadores compactos; PIX REGISTRADO identifica pendente/confirmado pelo campo confirmadoFinanceiramente. Parcelas/vencimentos/status e link Ver em Contas a Receber permanecem. Sem consultas financeiras por linha nem status financeiro persistido em Venda. Falha de pagamentos exibe Pago agora indisponivel, nao zero.

Somente ao abrir detalhe com debito/credito, listarRecebiveis consulta GET `/financeiro/recebiveis` paginado por vendaId (25 por pagina, id asc), sem filtros de status que ocultem cancelados. Vinculo validado por vendaId/pagamentoId/tipo; exibe Aguardando liquidacao, Liquidado, Cancelado ou Recebivel nao localizado. Falha de consulta mostra situacao indisponivel e retry independente, sem interferir nos totais. Consultas antigas sao canceladas ao fechar/trocar detalhe. Cartao permanece em Pago agora quando REGISTRADO e nunca soma ao A receber. Central nao oferece liquidacao, taxas ou snapshots. O resumo esclarece que pagamentos registrados podem aguardar confirmação de PIX ou liquidação de cartão; A receber corresponde às parcelas a prazo.

Detalhe de ContaReceber VENDA_A_PRAZO com vendaId oferece link Ver venda para `/vendas?vendaId=...`. A Central valida ID inteiro positivo seguro e abre o mesmo detalhe pelos services existentes, mesmo fora da pagina atual; falhas respeitam a resposta da API e permitem retry. Fechar o detalhe, por botão ou Escape, remove somente vendaId da URL. Conta manual ou sem vendaId nao oferece o link; baixa, estorno e mensagem de controle pela venda permanecem.

Na branch `feat/central-configuracoes`, sobre `b9e96bb`, os vínculos abrem nova aba para manter filtros, página, ordenação e detalhe da consulta original; os títulos dos links orientam voltar à aba de origem. Os acessos existentes de Venda → Conta a Receber (`contaId`) e Conta a Receber → Venda (`vendaId`) são reutilizados. Venda com cartão oferece uma única ação Ver recebimentos de cartão desta venda para `/financeiro/recebiveis?vendaId=...`. A tela aplica esse filtro no GET paginado existente, em todos os estados, e mantém os demais filtros ao editar/remover a venda; parâmetros não relacionados são preservados. Identificador inválido exibe validação e não consulta uma lista sem contexto. Cada recebível com vendaId válido oferece o detalhe da venda de origem, sem consultas adicionais por linha.

O contrato de cartão permite filtro por venda, sem endpoint de detalhe individual nem filtro por pagamento/recebível; por isso a ação identifica a consulta da venda, sem prometer abrir um recebível específico. Nenhum novo contrato, status, cálculo ou permissão. Testes de navegação/URL ajustados e ampliados, mas não executados; testes, build, lint e homologação desta etapa pendentes por orientação explícita.

## Contas a Receber - Bloco 2

Rota `/financeiro/contas-receber`, no grupo Financeiro, usa a identidade vigente navy/teal com composicao operacional: PageHeader, resumo global, PageFilters e AppTable compacta remota. Cadastro/baixa/confirmacoes reutilizam CadastroDialog; detalhe e historico ficam em drawer responsivo. Nenhum grafico, bloco decorativo ou alteracao global de identidade. Cliente usa ClienteAutocomplete existente (inativos somente no filtro historico); destinos usam pagina remota de contas ativas. Historico completo vem de GET por ID, nunca de recebimentos=[] da pagina. Retry de baixa preserva UUID/payload por empresa/conta em sessionStorage ate resposta conclusiva, bloqueando edicao da tentativa incerta.

Refinamento operacional: resumo compacto com as mesmas cinco metricas, busca acima dos filtros e filtros secundarios recolhiveis em xs. Desktop preserva as oito colunas; em laptop, valor original/recebido ficam no detalhe para priorizar vencimento, saldo, status e acoes. Mobile usa linhas empilhadas com os mesmos dados, Receber/Detalhes com alvo de 44px e controles de ordenacao/paginacao enviados ao backend, sem tabela larga nem tratamento local do catalogo. Drawer destaca saldo antes dos dados/historico e apresenta acoes permitidas ao final; cada baixa identifica seu valor, destino, data e estorno individual. Dialog de recebimento destaca saldo e valor recebido agora, sinalizando recebimento parcial sem etapa adicional. Theme, componentes compartilhados, contratos e regras financeiras preservados.

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

Usuários usa drawer lateral na própria lista, com seções Dados e Acesso. Mantém `form onSubmit`, ações Salvar/Cancelar e confirmação antes de descartar alterações. A seção Acesso descreve os perfis atuais sem controles de permissões granulares.

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
