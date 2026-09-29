import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { podeGerenciarUsuarios, podeExecutarAcaoGerencial, podeFecharSessao } =
    await server.ssrLoadModule("/src/utils/auth/perfis.ts");
await server.close();

test("administrador gerencia usuários e executa ações gerenciais", () => {
    assert.equal(podeGerenciarUsuarios("ADMIN"), true);
    assert.equal(podeExecutarAcaoGerencial("ADMIN"), true);
    assert.equal(podeFecharSessao("ADMIN", 1, 2), true);
});

test("gerente executa ações gerenciais sem gerenciar usuários", () => {
    assert.equal(podeGerenciarUsuarios("GERENTE"), false);
    assert.equal(podeExecutarAcaoGerencial("GERENTE"), true);
    assert.equal(podeFecharSessao("GERENTE", 1, 2), true);
});

for (const perfil of ["OPERADOR", "USUARIO"]) {
    test(`${perfil} fecha apenas a própria sessão e não executa ações gerenciais`, () => {
        assert.equal(podeGerenciarUsuarios(perfil), false);
        assert.equal(podeExecutarAcaoGerencial(perfil), false);
        assert.equal(podeFecharSessao(perfil, 1, 1), true);
        assert.equal(podeFecharSessao(perfil, 1, 2), false);
    });
}

test("sessão sem perfil não expõe fechamento de caixa", () => {
    assert.equal(podeFecharSessao(undefined, 1, 1), false);
});
