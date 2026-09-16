import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { AxiosError } from "axios";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const {
    listarBancos,
    salvarBanco,
    listarAgencias,
    salvarAgencia,
    listarContasBancarias,
    salvarContaBancaria,
    mensagemDadosBancarios,
} = await server.ssrLoadModule("/src/services/dadosBancariosService.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
await server.close();

beforeEach(() => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    globalThis.window = { location: { assign: () => undefined } };
    salvarSessao({ token: "token-dados-bancarios", empresa: { id: 7 } });
});

test("services usam os endpoints reais e nunca acrescentam empresaId", async () => {
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        const dados = config.data ? JSON.parse(config.data) : undefined;
        chamadas.push({ method: config.method, url: config.url, dados });
        assert.equal(config.headers.Authorization, "Bearer token-dados-bancarios");
        assert.equal(dados?.empresaId, undefined);
        return { config, status: config.method === "post" ? 201 : 200, statusText: "OK", headers: {}, data: [] };
    };

    await listarBancos();
    await salvarBanco({ numero: "001", nome: "Banco", cnab: null, ativo: true });
    await salvarBanco({ numero: "001", nome: "Banco", cnab: null, ativo: false }, 1);
    await listarAgencias(1);
    await salvarAgencia({ bancoId: 1, numero: "1000", digito: null, contato: null, telefone: null, cidade: null, ativo: true });
    await salvarAgencia({ bancoId: 1, numero: "1000", digito: null, contato: null, telefone: null, cidade: null, ativo: false }, 2);
    await listarContasBancarias({ agenciaId: 2, bancoId: 1, tipo: "CORRENTE", ativo: true });
    await salvarContaBancaria({ agenciaId: 2, numero: "123", digito: null, titular: null, tipo: "CORRENTE", ativo: true });
    await salvarContaBancaria({ agenciaId: 2, numero: "123", digito: null, titular: null, tipo: "POUPANCA", ativo: false }, 3);

    assert.deepEqual(chamadas.map(({ method, url }) => `${method} ${url}`), [
        "get /financeiro/bancos",
        "post /financeiro/bancos",
        "put /financeiro/bancos/1",
        "get /financeiro/agencias",
        "post /financeiro/agencias",
        "put /financeiro/agencias/2",
        "get /financeiro/contas-bancarias",
        "post /financeiro/contas-bancarias",
        "put /financeiro/contas-bancarias/3",
    ]);
});

test("filtros de listagem seguem os nomes aceitos pelo backend", async () => {
    const parametros = [];
    api.defaults.adapter = async (config) => {
        parametros.push(config.params);
        return { config, status: 200, statusText: "OK", headers: {}, data: [] };
    };

    await listarAgencias(9);
    await listarContasBancarias({ agenciaId: 8, bancoId: 7, tipo: "POUPANCA", ativo: false });

    assert.deepEqual(parametros, [
        { bancoId: 9 },
        { agenciaId: 8, bancoId: 7, tipo: "POUPANCA", ativo: false },
    ]);
});

for (const [status, mensagem] of [
    [400, "O numero e obrigatorio."],
    [404, "Agencia nao encontrada."],
    [409, "Ja existe uma conta cadastrada."],
]) {
    test(`mensagem do backend ${status} permanece compreensivel`, () => {
        const erro = new AxiosError("Falha", "ERR_BAD_RESPONSE", {}, undefined, {
            status,
            statusText: "Erro",
            config: {},
            headers: {},
            data: mensagem,
        });
        assert.equal(mensagemDadosBancarios(erro, "Falha padrao"), mensagem);
    });
}

test("formularios preservam vinculo inativo atual e titular e opcional", async () => {
    const agenciaForm = await readFile(new URL("../src/pages/Financeiro/AgenciaForm.tsx", import.meta.url), "utf8");
    const contaForm = await readFile(new URL("../src/pages/Financeiro/ContaBancariaForm.tsx", import.meta.url), "utf8");
    const contaTab = await readFile(new URL("../src/pages/Financeiro/ContaBancariaTab.tsx", import.meta.url), "utf8");

    assert.match(agenciaForm, /b\.ativo \|\| b\.id === agencia\?\.bancoId/);
    assert.match(contaForm, /a\.ativo \|\| a\.id === conta\?\.agenciaId/);
    assert.doesNotMatch(contaForm, /titular: yup[\s\S]*?required\("O titular/);
    assert.match(contaForm, /titular: dados\.titular\?\.trim\(\) \|\| null/);
    assert.match(contaTab, /agencia === "todas" \|\| c\.agenciaId === Number\(agencia\)/);
});
