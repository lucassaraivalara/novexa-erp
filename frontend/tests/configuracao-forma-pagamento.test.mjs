import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarConfiguracoesFormasPagamento, salvarConfiguracaoFormaPagamento, listarConfiguracoesParaPDV } =
    await server.ssrLoadModule("/src/services/configuracaoFormaPagamentoService.ts");
await server.close();

function configurarSessao() {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    globalThis.window = { location: { assign() {} } };
    salvarSessao({ token: "token-financeiro", empresa: { id: 7 } });
}

test("PDV consulta ativas e preserva multiplas configuracoes dos tipos suportados", async () => {
    configurarSessao();
    const configs = ["DINHEIRO", "PIX", "PIX", "DEBITO", "DEBITO", "CREDITO", "CREDITO", "BOLETO", "TRANSFERENCIA"]
        .map((tipo, i) => ({ id: i + 1, tipo, nomeExibicao: `${tipo} ${i}`, ativo: true }));
    api.defaults.adapter = async config => {
        assert.equal(config.params.situacao, "ativas");
        assert.equal(config.params.empresaId, undefined);
        assert.equal(config.headers.Authorization, "Bearer token-financeiro");
        return { data: configs, status: 200, statusText: "OK", headers: {}, config };
    };
    assert.deepEqual((await listarConfiguracoesParaPDV()).map(c => c.id), [1, 2, 3, 4, 5, 6, 7]);
});

test("service de configuração de pagamento envia payload correto e trata resposta do backend", async () => {
    configurarSessao();
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        if (config.method === "post" && config.url === "/financeiro/configuracoes-formas-pagamento") {
            return {
                data: {
                    id: 42,
                    nomeExibicao: JSON.parse(config.data).nomeExibicao,
                    formaPagamentoId: JSON.parse(config.data).formaPagamentoId,
                    tipo: "PIX",
                    ativo: true,
                    contaFinanceiraDestino: JSON.parse(config.data).contaFinanceiraDestinoId
                        ? { id: JSON.parse(config.data).contaFinanceiraDestinoId, nome: "Banco Teste", tipo: "BANCO", ativo: true }
                        : null,
                    dataCriacao: "2026-09-30T10:00:00",
                    dataAtualizacao: "2026-09-30T10:00:00",
                    taxaPercentual: JSON.parse(config.data).taxaPercentual ?? null,
                    taxaFixa: JSON.parse(config.data).taxaFixa ?? null,
                    prazoRecebimentoDias: JSON.parse(config.data).prazoRecebimentoDias ?? null,
                },
                status: 201,
                statusText: "Created",
                headers: {},
                config,
            };
        }
        if (config.method === "get" && config.url === "/financeiro/configuracoes-formas-pagamento") {
            return { data: [], status: 200, statusText: "OK", headers: {}, config };
        }
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };

    await listarConfiguracoesFormasPagamento("ativas");

    const payload = { nomeExibicao: "PIX Sicredi", formaPagamentoId: 2, ativo: true, contaFinanceiraDestinoId: 5 };
    const resposta = await salvarConfiguracaoFormaPagamento(payload);

    assert.deepEqual(chamadas.map(({ method, url }) => [method, url]), [
        ["get", "/financeiro/configuracoes-formas-pagamento"],
        ["post", "/financeiro/configuracoes-formas-pagamento"],
    ]);
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-financeiro"));
    assert.deepEqual(JSON.parse(chamadas[1].data), payload);
    assert.equal(resposta.id, 42);
    assert.equal(resposta.nomeExibicao, "PIX Sicredi");
    assert.equal(resposta.tipo, "PIX");
    assert.equal(resposta.contaFinanceiraDestino?.tipo, "BANCO");
    assert.ok(resposta.contaFinanceiraDestino?.ativo === true);
    assert.ok("dataCriacao" in resposta);
    assert.ok("dataAtualizacao" in resposta);
    assert.equal(resposta.taxaPercentual, null);
    assert.equal(resposta.taxaFixa, null);
    assert.equal(resposta.prazoRecebimentoDias, null);
});
