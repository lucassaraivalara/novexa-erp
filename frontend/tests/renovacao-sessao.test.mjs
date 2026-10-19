import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: api } = await server.ssrLoadModule("/src/services/api.ts");
const { expiracaoToken, iniciarRenovacaoSessao } = await server.ssrLoadModule("/src/services/renovacaoSessao.ts");
const { salvarSessao, obterSessao } = await server.ssrLoadModule("/src/utils/auth/sessao.ts");
await server.close();
const token = exp => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(exp / 1000) })).toString("base64url")}.signature`;
let chamadas, verificar, redirecionamentos;
beforeEach(() => {
    const dados = new Map();
    globalThis.localStorage = { getItem: k => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, v), removeItem: k => dados.delete(k) };
    const eventos = new EventTarget();
    globalThis.window = { addEventListener: eventos.addEventListener.bind(eventos), removeEventListener: eventos.removeEventListener.bind(eventos),
        dispatchEvent: eventos.dispatchEvent.bind(eventos), setInterval: fn => { verificar = fn; return 1; }, clearInterval: () => {},
        location: { assign: url => redirecionamentos.push(url) } };
    chamadas = []; redirecionamentos = [];
    api.defaults.adapter = async config => {
        chamadas.push(config);
        return { config, status: 200, statusText: "OK", headers: {}, data: { token: token(Date.now() + 3600000) } };
    };
});
test("token é lido somente para agendar a renovação, sem substituir validação da API", () => {
    assert.equal(expiracaoToken("invalido"), null);
    assert.ok(expiracaoToken(token(Date.now() + 10000)) > Date.now());
});
test("polling não renova; atividade de teclado renova uma vez sem perder a sessão", async () => {
    const anterior = token(Date.now() + 30 * 60000);
    salvarSessao({ token: anterior, empresa: { id: 7 }, id: 1 });
    const parar = iniciarRenovacaoSessao();
    try {
        verificar(); assert.equal(chamadas.length, 0);
        window.dispatchEvent(new Event("keydown"));
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(chamadas.length, 1); assert.equal(chamadas[0].url, "/auth/renovar");
        assert.equal(chamadas[0].headers.Authorization, `Bearer ${anterior}`);
        assert.notEqual(obterSessao().token, anterior); assert.equal(obterSessao().empresa.id, 7);
        window.dispatchEvent(new Event("keydown")); assert.equal(chamadas.length, 1);
    } finally { parar(); }
});
test("sessão expirada encerra acesso com mensagem e sem tentar renovar", () => {
    salvarSessao({ token: token(Date.now() - 10000), empresa: { id: 7 } });
    const parar = iniciarRenovacaoSessao(); parar();
    assert.equal(obterSessao(), null); assert.equal(chamadas.length, 0);
    assert.deepEqual(redirecionamentos, ["/login?sessao=expirada"]);
});
