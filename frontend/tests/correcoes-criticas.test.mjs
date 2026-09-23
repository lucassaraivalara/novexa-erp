import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@mui/material";
import { AxiosError } from "axios";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { default: PageHeader } = await server.ssrLoadModule("/src/components/ui/PageHeader.tsx");
const { salvarSessao, obterToken } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarClientes, salvarCliente, buscarCliente, mensagemCliente } = await server.ssrLoadModule("/src/services/clienteService.ts");
const { cadastrarProduto, atualizarProduto } = await server.ssrLoadModule("/src/services/produtoService.ts");
await server.close();

let redirecionamentos;
beforeEach(() => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    redirecionamentos = [];
    globalThis.window = { location: { assign: (url) => redirecionamentos.push(url) } };
    salvarSessao({ token: "token-atual", empresa: { id: 7 } });
});

function rejeitar(config, status, headers = {}) {
    throw new AxiosError("Falha da rota", "ERR_BAD_RESPONSE", config, undefined,
        { status, statusText: "Erro", config, headers, data: "Falha da rota" });
}

test("PageHeader renderiza apenas o botão recebido e preserva sua ação", () => {
    let cliques = 0;
    const acao = createElement(Button, { onClick: () => cliques++, variant: "contained" }, "Novo produto");
    const elemento = PageHeader({ titulo: "Produtos", acaoPrincipal: acao });
    const html = renderToStaticMarkup(elemento);
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    assert.equal((html.match(/<\/button>/g) ?? []).length, 1);
    assert.match(html, /Novo produto/);
    // A ação recebida continua sendo a instância renderizada pelo cabeçalho.
    const acoes = elemento.props.children[1].props.children;
    assert.ok(acoes.includes(acao));
    acoes.find((filho) => filho === acao).props.onClick();
    assert.equal(cliques, 1);
});

for (const status of [401, 403, 500]) {
    test(`falha pontual ${status} é propagada à tela sem encerrar a sessão`, async () => {
        api.defaults.adapter = async (config) => rejeitar(config, status, { "www-authenticate": "Bearer" });
        await assert.rejects(listarClientes(7), (erro) => {
            assert.equal(erro.response.status, status);
            assert.ok(mensagemCliente(erro, "Não foi possível carregar os clientes."));
            if (status === 401) assert.match(mensagemCliente(erro, ""), /operação em Clientes/);
            return true;
        });
        assert.equal(obterToken(), "token-atual");
        assert.deepEqual(redirecionamentos, []);
    });
}

test("rejeição explícita do token atual encerra a sessão", async () => {
    api.defaults.adapter = async (config) => rejeitar(config, 401,
        { "www-authenticate": 'Bearer error="invalid_token"' });
    await assert.rejects(api.get("/clientes"));
    assert.equal(obterToken(), null);
    assert.deepEqual(redirecionamentos, ["/login"]);
});

test("resposta atrasada de um token antigo não encerra um novo login", async () => {
    api.defaults.adapter = async (config) => {
        salvarSessao({ token: "token-novo", empresa: { id: 7 } });
        return rejeitar(config, 401, { "www-authenticate": 'Bearer error="invalid_token"' });
    };
    await assert.rejects(api.get("/clientes"));
    assert.equal(obterToken(), "token-novo");
    assert.deepEqual(redirecionamentos, []);
});

test("401 do login não dispara logout global", async () => {
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.Authorization, undefined);
        return rejeitar(config, 401, { "www-authenticate": 'Bearer error="invalid_token"' });
    };
    await assert.rejects(api.post("/auth/login", {}));
    assert.equal(obterToken(), "token-atual");
    assert.deepEqual(redirecionamentos, []);
});

test("listar, criar, buscar e editar clientes enviam o mesmo Bearer e preservam a sessão", async () => {
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        assert.equal(config.headers.Authorization, "Bearer token-atual");
        chamadas.push(`${config.method} ${config.url}`);
        const dados = config.data ? JSON.parse(config.data) : {};
        return { config, status: config.method === "post" ? 201 : 200, statusText: "OK", headers: {},
            data: config.url === "/clientes" && config.method === "get" ? [] : { id: 1, ...dados } };
    };
    assert.deepEqual(await listarClientes(7), []);
    const novo = await salvarCliente({ nome: "Cliente", tipoPessoa: "FISICA" });
    await buscarCliente(novo.id, 7);
    assert.equal((await salvarCliente({ nome: "Cliente editado" }, novo.id)).nome, "Cliente editado");
    assert.deepEqual(chamadas, ["get /clientes", "post /clientes", "get /clientes/1", "put /clientes/1"]);
    assert.equal(obterToken(), "token-atual");
    assert.deepEqual(redirecionamentos, []);
});

test("cadastro e edição de produto não enviam estoqueAtual", async () => {
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(JSON.parse(config.data));
        return { config, status: config.method === "post" ? 201 : 200, statusText: "OK", headers: {}, data: {} };
    };
    const dados = {
        empresaId: 7, codigoInterno: "P-1", codigoBarras: null, nome: "Produto",
        descricao: null, unidadeMedida: "UN", precoCusto: 1, precoVenda: 2,
        estoqueMinimo: 3, controlaEstoque: true, ativo: true, estoqueAtual: 99,
    };

    await cadastrarProduto(dados);
    await atualizarProduto(4, dados);

    assert.equal(chamadas.length, 2);
    assert.equal("estoqueAtual" in chamadas[0], false);
    assert.equal("estoqueAtual" in chamadas[1], false);
    assert.equal(chamadas[0].estoqueMinimo, 3);
});

test("formulário trata saldo como informação e estoque mínimo conforme o controle", async () => {
    const fonte = await readFile(new URL("../src/pages/Produtos/ProdutoForm.tsx", import.meta.url), "utf8");
    assert.match(fonte, /label="Estoque mínimo"/);
    assert.match(fonte, /disabled={!formulario\.controlaEstoque}/);
    assert.match(fonte, /Saldo atual:/);
    assert.doesNotMatch(fonte, /label="Estoque atual"/);
    assert.doesNotMatch(fonte, /alterarCampo\("estoqueAtual"/);
});

test("Dados Bancários organiza Bancos, Agências e Contas em abas sem pedir empresa ao usuário", async () => {
    const navegacao = await readFile(new URL("../src/routes/navigation.tsx", import.meta.url), "utf8");
    const dadosBancarios = await readFile(new URL("../src/pages/Financeiro/DadosBancarios.tsx", import.meta.url), "utf8");
    const bancoForm = await readFile(new URL("../src/pages/Financeiro/BancoForm.tsx", import.meta.url), "utf8");
    const agenciaForm = await readFile(new URL("../src/pages/Financeiro/AgenciaForm.tsx", import.meta.url), "utf8");
    const contaForm = await readFile(new URL("../src/pages/Financeiro/ContaBancariaForm.tsx", import.meta.url), "utf8");
    const caixa = await readFile(new URL("../src/pages/Financeiro/Caixa.tsx", import.meta.url), "utf8");

    assert.match(navegacao, /financeiro\/caixas/);
    assert.match(navegacao, /financeiro\/dados-bancarios/);
    assert.match(dadosBancarios, /Bancos/);
    assert.match(dadosBancarios, /Agências/);
    assert.match(dadosBancarios, /Contas Bancárias/);
    assert.match(dadosBancarios, /<BancoTab/);
    assert.match(dadosBancarios, /<AgenciaTab/);
    assert.match(dadosBancarios, /<ContaBancariaTab/);
    assert.doesNotMatch(bancoForm, /empresaId/);
    assert.doesNotMatch(agenciaForm, /empresaId/);
    assert.doesNotMatch(contaForm, /empresaId/);
    assert.match(agenciaForm, /dados\.filter\(\(b\) => b\.ativo \|\| b\.id === agencia\?\.bancoId\)/);
    assert.match(contaForm, /dados\.filter\(\(a\) => a\.ativo \|\| a\.id === conta\?\.agenciaId\)/);
    assert.match(caixa, /titulo="Caixas"/);
});


test("formas de pagamento possuem rota, menu, service e listagem somente leitura", async () => {
    const navegacao = await readFile(new URL("../src/routes/navigation.tsx", import.meta.url), "utf8");
    const pagina = await readFile(new URL("../src/pages/Financeiro/FormasPagamento.tsx", import.meta.url), "utf8");
    const service = await readFile(new URL("../src/services/formaPagamentoService.ts", import.meta.url), "utf8");

    assert.match(navegacao, /financeiro\/formas-pagamento/);
    assert.match(navegacao, /Formas de Pagamento/);
    assert.match(service, /api\.get<FormaPagamentoResumo\[]>\("\/financeiro\/formas-pagamento"/);
    assert.match(pagina, /cabecalho: "Descrição"/);
    assert.match(pagina, /cabecalho: "Tipo"/);
    assert.match(pagina, /label=\{valor \? "Ativa" : "Inativa"\}/);
    assert.match(pagina, /Nova Forma de Pagamento/);
    assert.match(pagina, /FormaPagamentoForm/);
});

test("AppHeader renderiza a logomarca da empresa autenticada com fallback para o nome", async () => {
    const fonte = await readFile(new URL("../src/components/layout/AppHeader.tsx", import.meta.url), "utf8");

    assert.match(fonte, /sessao\?\.empresa\?\.logomarca/);
    assert.match(fonte, /nomeFantasia\?\.trim\(\) \|\| sessao\?\.empresa\?\.razaoSocial\?\.trim\(\) \|\| "Empresa"/);
    assert.match(fonte, /mostrarLogomarca \? \(/);
    assert.match(fonte, /component="img"/);
    assert.match(fonte, /onError=\{\(\) => setLogomarcaComErro\(true\)\}/);
});

test("cadastro de formas de pagamento usa POST/PUT e preserva o tipo na edição", async () => {
    const service = await readFile(new URL("../src/services/formaPagamentoService.ts", import.meta.url), "utf8");
    const formulario = await readFile(new URL("../src/pages/Financeiro/FormaPagamentoForm.tsx", import.meta.url), "utf8");
    assert.match(service, /method: id \? "PUT" : "POST"/);
    assert.match(service, /\/financeiro\/formas-pagamento\/\$\{id\}/);
    assert.match(formulario, /disabled=\{!!forma\}/);
    assert.match(formulario, /tipoSalvar="submit"/);
});

test("ações de tabela usam ícones com tooltip e acessibilidade", async () => {
    const tabela = await readFile(new URL("../src/components/ui/AppTable.tsx", import.meta.url), "utf8");
    const caixa = await readFile(new URL("../src/pages/Financeiro/Caixa.tsx", import.meta.url), "utf8");

    assert.match(tabela, /<Tooltip key=\{idx\} title=\{acao\.tooltip \?\? acao\.rotulo\}>/);
    assert.match(tabela, /aria-label=\{acao\.tooltip \?\? acao\.rotulo\}/);
    assert.match(caixa, /<EditOutlinedIcon fontSize="small" \/>/);
    assert.match(caixa, /<BlockRoundedIcon fontSize="small" \/>/);
    assert.doesNotMatch(caixa, /icone: <span>Editar<\/span>/);
    assert.doesNotMatch(caixa, /icone: <span>Inativar<\/span>/);
});

test("busca remota preserva o padrão oficial e cancela respostas antigas", async () => {
    const config = await readFile(new URL("../src/config/search.ts", import.meta.url), "utf8");
    const hook = await readFile(new URL("../src/hooks/useRemoteSearch.ts", import.meta.url), "utf8");
    const produtos = await readFile(new URL("../src/pages/Produtos/Produtos.tsx", import.meta.url), "utf8");
    const service = await readFile(new URL("../src/services/produtoService.ts", import.meta.url), "utf8");
    const tabela = await readFile(new URL("../src/components/ui/AppTable.tsx", import.meta.url), "utf8");

    assert.match(config, /REMOTE_SEARCH_MIN_LENGTH = 2/);
    assert.match(config, /REMOTE_SEARCH_DEBOUNCE_MS = 350/);
    assert.match(config, /OPERATIONAL_SEARCH_DEBOUNCE_MS = 300/);
    assert.match(hook, /new AbortController/);
    assert.match(hook, /requestId/);
    assert.match(hook, /normalized\.length < minLength/);
    assert.match(hook, /executeNow/);
    assert.match(produtos, /useRemoteSearch/);
    assert.match(produtos, /onKeyDown:/);
    assert.match(service, /signal\?: AbortSignal/);
    assert.match(tabela, /onKeyDown=\{busca\.onKeyDown\}/);
    assert.match(tabela, /CircularProgress/);
});

test("formulários seguem o padrão de submit, feedback e autofocus", async () => {
    const actions = await readFile(new URL("../src/components/ui/FormActions.tsx", import.meta.url), "utf8");
    const cadastroDialog = await readFile(new URL("../src/components/ui/CadastroDialog.tsx", import.meta.url), "utf8");
    const caixa = await readFile(new URL("../src/pages/Financeiro/CaixaForm.tsx", import.meta.url), "utf8");
    const produto = await readFile(new URL("../src/pages/Produtos/ProdutoForm.tsx", import.meta.url), "utf8");
    const cliente = await readFile(new URL("../src/pages/Clientes/ClienteForm.tsx", import.meta.url), "utf8");
    const empresa = await readFile(new URL("../src/pages/Empresa/EmpresaForm.tsx", import.meta.url), "utf8");

    assert.match(actions, /tipoSalvar\?: "button" \| "submit"/);
    assert.match(actions, /disabled=\{salvando \|\| desabilitado\}/);
    assert.match(caixa, /<Dialog open fullWidth maxWidth="xs"/);
    assert.match(caixa, /<form onSubmit=\{handleSubmit\(aoSalvar\)\}>/);
    assert.match(caixa, /required/);
    assert.match(caixa, /autoFocus/);
    assert.match(caixa, /tipoSalvar="submit"/);
    assert.match(caixa, /onClose=\{salvando \? undefined : onFechar\}/);
    assert.match(produto, /autoFocus=\{!carregandoProduto\}/);
    assert.match(cliente, /required autoFocus label="Nome \/ Razão social"/);
    assert.match(empresa, /autoFocus=\{item\.nome === gruposEmpresa\[0\]\?\.campos\[0\]\?\.nome\}/);
    assert.match(cadastroDialog, /variante: "compact" \| "full"/);
    assert.match(cadastroDialog, /fullScreen=\{telaPequena\}/);
    assert.match(cadastroDialog, /maxHeight: \{ xs: "100%", sm: "84vh" \}/);
    assert.match(cadastroDialog, /overflowY: "auto"/);
    assert.match(cadastroDialog, /disabled=\{salvando \|\| desabilitarSalvar\}/);
    assert.match(produto, /<CadastroDialog[\s\S]*variante="full"/);
    assert.match(cliente, /<CadastroDialog[\s\S]*variante="full"/);
});

test("listagem e formulário de Produtos preservam campos reais e organização visual", async () => {
    const listagem = await readFile(new URL("../src/pages/Produtos/Produtos.tsx", import.meta.url), "utf8");
    const formulario = await readFile(new URL("../src/pages/Produtos/ProdutoForm.tsx", import.meta.url), "utf8");
    const tabela = await readFile(new URL("../src/components/ui/AppTable.tsx", import.meta.url), "utf8");
    const tipo = await readFile(new URL("../src/types/produto.ts", import.meta.url), "utf8");

    assert.match(tipo, /codigoInterno: string \| null/);
    assert.match(tipo, /codigoBarras: string \| null/);
    assert.match(listagem, /cabecalho: "Código interno"/);
    assert.match(listagem, /cabecalho: "Produto"/);
    assert.match(listagem, /alinhar: "right", render: renderPreco/);
    assert.match(listagem, /cabecalho: "Estoque".*alinhar: "right"/s);
    assert.match(listagem, /compacta/);
    assert.match(listagem, /titulo: termoBusca\.trim\(\) \|\| situacao !== "todas" \? "Nenhum produto encontrado" : "Nenhum produto cadastrado"/);
    assert.match(listagem, /Novo produto/);
    assert.match(formulario, /<Typography variant="subtitle2">Estoque<\/Typography>/);
    assert.match(formulario, /<Typography variant="subtitle2">Identificação<\/Typography>/);
    assert.match(formulario, /<Typography variant="subtitle2">Preços<\/Typography>/);
    assert.match(formulario, />Controla estoque<\/Typography>/);
    assert.match(formulario, /label="Estoque mínimo"/);
    assert.match(formulario, /Saldo atual:/);
    assert.match(tabela, /cellPaddingCompact/);
});

test("formulários compartilhados expõem campos e ações acessíveis", async () => {
    const produto = await readFile(new URL("../src/pages/Produtos/ProdutoForm.tsx", import.meta.url), "utf8");
    const caixa = await readFile(new URL("../src/pages/Financeiro/CaixaForm.tsx", import.meta.url), "utf8");
    const forma = await readFile(new URL("../src/pages/Financeiro/FormaPagamentoForm.tsx", import.meta.url), "utf8");
    const empresa = await readFile(new URL("../src/pages/Empresa/EmpresaForm.tsx", import.meta.url), "utf8");

    assert.match(produto, /name="precoVenda"/);
    assert.match(produto, /inputMode: "decimal"/);
    assert.match(produto, /role="button"/);
    assert.match(produto, /name="imagem"/);
    assert.match(produto, /aria-label="Remover imagem do produto"/);
    assert.match(caixa, /autoComplete="off"/);
    assert.match(forma, /autoComplete="off"/);
    assert.match(empresa, /name=\{item\.nome\}/);
    assert.match(empresa, /autoComplete=\{autoComplete\}/);
    assert.match(empresa, /inputMode/);
    assert.match(empresa, /<Button type="button"/);
});

test("filtros e linhas interativas da tabela preservam acessibilidade", async () => {
    const filtros = await readFile(new URL("../src/components/ui/PageFilters.tsx", import.meta.url), "utf8");
    const tabela = await readFile(new URL("../src/components/ui/AppTable.tsx", import.meta.url), "utf8");

    assert.match(filtros, /aria-label=\{`Pesquisar: \$\{busca\.placeholder\}`\}/);
    assert.match(tabela, /aria-label=\{`Pesquisar: \$\{busca\.placeholder\}`\}/);
    assert.match(tabela, /onKeyDown=\{linhaCliqueavel \|\| onLinhaClick \?/);
    assert.match(tabela, /evento\.key === "Enter" \|\| evento\.key === " "/);
    assert.match(tabela, /tabIndex=\{linhaCliqueavel \|\| onLinhaClick \? 0 : undefined\}/);
    assert.match(tabela, /evento\.stopPropagation\(\)/);
    assert.match(tabela, /mensagem="Carregando dados…"/);
});

test("Produtos mantém filtro acessível e tabela densa", async () => {
    const listagem = await readFile(new URL("../src/pages/Produtos/Produtos.tsx", import.meta.url), "utf8");

    assert.match(listagem, /minWidth: \{ xs: "100%", sm: 160 \}/);
    assert.match(listagem, /aria-label": "Filtrar produtos por situação"/);
    assert.match(listagem, /name: "situacao"/);
    assert.match(listagem, /largura: 300, pesquisavel: true, ordenavel: true, render: renderNome/);
    assert.match(listagem, /largura: 160, ordenavel: true, alinhar: "right", render: renderPreco/);
    assert.match(listagem, /tooltip: "Editar produto"/);
    assert.match(listagem, /tooltip: "Inativar produto"/);
});

test("Caixa mantem abas, acoes e modais acessiveis", async () => {
    const caixa = await readFile(new URL("../src/pages/Financeiro/Caixa.tsx", import.meta.url), "utf8");

    assert.match(caixa, /aria-label="[^"]*Caixa"/);
    assert.match(caixa, /caixa-atual-tab/);
    assert.match(caixa, /caixas-anteriores-tab/);
    assert.match(caixa, /aria-labelledby="caixa-abertura-titulo"/);
    assert.match(caixa, /aria-labelledby="caixa-movimento-titulo"/);
    assert.match(caixa, /aria-labelledby="caixa-fechamento-titulo"/);
    assert.match(caixa, /name="saldoInicial"/);
    assert.match(caixa, /name="saldoFinal"/);
    assert.match(caixa, /name="observacao"/);
    assert.match(caixa, /caixa-vazio-titulo/);
    assert.match(caixa, /Nenhuma movimenta.{1,3}o registrada/);
    assert.match(caixa, /type="button"/);
});
