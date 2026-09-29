import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { salvarSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
const { listarSessoesFechadas, buscarDetalheSessao } = await server.ssrLoadModule("/src/services/caixaService.ts");
await server.close();

test("historico e detalhe usam apenas IDs da sessao, com tenant no token", async () => {
    const armazenamento = new Map();
    globalThis.localStorage = {
        getItem: (chave) => armazenamento.get(chave) ?? null,
        setItem: (chave, valor) => armazenamento.set(chave, valor),
        removeItem: (chave) => armazenamento.delete(chave),
    };
    globalThis.window = { location: { assign() {} } };
    salvarSessao({ token: "token-caixa", empresa: { id: 7 } });
    const chamadas = [];
    api.defaults.adapter = async (config) => {
        chamadas.push(config);
        return { data: [], status: 200, statusText: "OK", headers: {}, config };
    };

    await listarSessoesFechadas();
    await buscarDetalheSessao(42);

    assert.deepEqual(chamadas.map(({ url }) => url), [
        "/financeiro/caixas/sessoes/fechadas",
        "/financeiro/caixas/sessoes/42/detalhe",
    ]);
    assert.ok(chamadas.every(({ headers }) => headers.Authorization === "Bearer token-caixa"));
    assert.ok(chamadas.every(({ params, data }) => !params && !data));
});
