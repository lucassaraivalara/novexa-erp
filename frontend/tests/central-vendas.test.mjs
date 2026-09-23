import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { criarParametrosVenda, podeCancelarVenda, rotulosStatus } =
    await server.ssrLoadModule("/src/pages/Vendas/centralVendasUtils.ts");
const { mensagemVenda } = await server.ssrLoadModule("/src/services/vendaService.ts");
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

test("cancelamento usa diálogo acessível com loading, erro e atualização", async () => {
    const fonte = await readFile(new URL("../src/pages/Vendas/CentralVendas.tsx", import.meta.url), "utf8");

    assert.doesNotMatch(fonte, /window\.confirm/);
    assert.match(fonte, /aria-labelledby="cancelar-venda-titulo"/);
    assert.match(fonte, /aria-describedby="cancelar-venda-descricao"/);
    assert.match(fonte, /erroCancelamento && <Alert severity="error">/);
    assert.match(fonte, /<CircularProgress size=\{18\}/);
    assert.match(fonte, /"Cancelando…"/);
    assert.match(fonte, /await carregarVendas\(\)/);
    assert.match(fonte, /Venda cancelada com sucesso\./);
});

test("cancelamento exibe a mensagem devolvida pela API", () => {
    const erroAxios = (data) => ({ isAxiosError: true, response: { data } });

    assert.equal(mensagemVenda(erroAxios("Sessão de Caixa fechada."), "Falha"), "Sessão de Caixa fechada.");
    assert.equal(mensagemVenda(erroAxios({ detail: "Venda já cancelada." }), "Falha"), "Venda já cancelada.");
    assert.equal(mensagemVenda(erroAxios({ message: "Cancelamento indisponível." }), "Falha"), "Cancelamento indisponível.");
    assert.equal(mensagemVenda(erroAxios({ error: "Internal Server Error" }), "Falha"), "Falha");
    assert.equal(mensagemVenda(erroAxios({}), "Falha"), "Falha");
});
