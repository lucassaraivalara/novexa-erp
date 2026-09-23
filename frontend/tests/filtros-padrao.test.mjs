import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const fontes = Object.fromEntries(await Promise.all([
    ["produtos", "../src/pages/Produtos/Produtos.tsx"],
    ["clientes", "../src/pages/Clientes/Clientes.tsx"],
    ["empresas", "../src/pages/Empresa/Empresa.tsx"],
    ["caixas", "../src/pages/Financeiro/Caixa.tsx"],
    ["formas", "../src/pages/Financeiro/FormasPagamento.tsx"],
    ["bancos", "../src/pages/Financeiro/BancoTab.tsx"],
    ["agencias", "../src/pages/Financeiro/AgenciaTab.tsx"],
    ["contas", "../src/pages/Financeiro/ContaBancariaTab.tsx"],
].map(async ([nome, caminho]) => [nome, await readFile(new URL(caminho, import.meta.url), "utf8")])));

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { filtrosIniciais } = await server.ssrLoadModule("/src/pages/Vendas/centralVendasUtils.ts");
await server.close();

test("cadastros iniciam filtrados por ativos", () => {
    assert.match(fontes.produtos, /useState\("ativas"\)/);
    assert.match(fontes.clientes, /useState\("ativos"\)/);
    assert.match(fontes.empresas, /useState\("ativas"\)/);
    assert.match(fontes.caixas, /useState\("ativos"\)/);
    assert.match(fontes.formas, /useState\("ativas"\)/);
    assert.match(fontes.bancos, /useState\("ativos"\)/);
    assert.match(fontes.agencias, /useState\("ativos"\)/);
    assert.match(fontes.contas, /useState\("ativos"\)/);
});

test("todos os cadastros preservam opções para todas e inativos", () => {
    for (const fonte of Object.values(fontes)) {
        assert.match(fonte, /<MenuItem value="tod(?:as|os)">Tod(?:as|os)/);
        assert.match(fonte, /<MenuItem value="inativ(?:as|os)">Inativ(?:as|os)/);
    }
});

test("central de vendas inicia em faturadas e preserva todos", async () => {
    assert.equal(filtrosIniciais.status, "FATURADA");
    assert.match(await readFile(new URL("../src/pages/Vendas/CentralVendas.tsx", import.meta.url), "utf8"),
        /<MenuItem value="">Todos<\/MenuItem>/);
});
