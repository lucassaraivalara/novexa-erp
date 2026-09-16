import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { criarParametrosVenda, podeCancelarVenda, rotulosStatus } =
    await server.ssrLoadModule("/src/pages/Vendas/centralVendasUtils.ts");
await server.close();

test("envia somente filtros preenchidos para a listagem", () => {
    assert.deepEqual(criarParametrosVenda({ status: "", dataInicial: "", dataFinal: "", clienteId: "" }), {
        status: undefined,
        dataInicial: undefined,
        dataFinal: undefined,
        clienteId: undefined,
    });
    assert.deepEqual(criarParametrosVenda({
        status: "FATURADA",
        dataInicial: "2026-09-01",
        dataFinal: "2026-09-15",
        clienteId: "42",
    }), {
        status: "FATURADA",
        dataInicial: "2026-09-01",
        dataFinal: "2026-09-15",
        clienteId: 42,
    });
});

test("cancelamento fica disponível somente para venda faturada", () => {
    assert.equal(podeCancelarVenda("FATURADA"), true);
    assert.equal(podeCancelarVenda("ABERTA"), false);
    assert.equal(podeCancelarVenda("CANCELADA"), false);
});

test("status possuem rótulos operacionais", () => {
    assert.deepEqual(rotulosStatus, { ABERTA: "Aberta", FATURADA: "Faturada", CANCELADA: "Cancelada" });
});
