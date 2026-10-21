import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

let server, browser, url;
before(async () => {
    server = await createServer({ server: { host: "127.0.0.1", port: 0 }, plugins: [{
        name: "tempo-fixture", configureServer(vite) {
            vite.middlewares.use("/__tempo", (_req, res) => {
                res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Tempo</title>");
            });
        },
    }] });
    await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await server?.close(); });

for (const timezoneId of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "America/Sao_Paulo"]) {
    test(`14:03 salvo sem offset e como instante aparece 14:03 em navegador ${timezoneId}`, async () => {
        const page = await browser.newPage({ timezoneId });
        try {
            await page.goto(`${url}/__tempo`);
            const r = await page.evaluate(async () => {
                const t = await import("/src/utils/dataHora.ts");
                const vendas = await import("/src/pages/Vendas/centralVendasUtils.ts");
                const contas = await import("/src/pages/Financeiro/contaReceberUtils.ts");
                return [t.formatarDataHora("2026-10-21T14:03:00.123456"),
                    t.formatarDataHora("2026-10-21T17:03:00Z"), t.formatarDataHora("2026-10-21T14:03:00-03:00"),
                    vendas.dataHoraVenda("2026-10-21T14:03:00"), contas.formatarData("2026-10-21T14:03:00", true),
                    t.formatarData("2026-10-21"), t.somarDias("2026-12-31", 1),
                    t.interpretarDataHora("2018-12-01T14:03:00").toISOString(),
                    t.formatarDataHora("inválida"), t.formatarData("2026-02-30")];
            });
            assert.deepEqual(r.slice(0, 5), Array(5).fill("21/10/2026, 14:03"));
            assert.deepEqual(r.slice(5), ["21/10/2026", "2027-01-01", "2018-12-01T16:03:00.000Z", "—", "—"]);
        } finally { await page.close(); }
    });
    test(`dia civil e filtros de Brasília não adiantam à meia-noite UTC (${timezoneId})`, async () => {
        const page = await browser.newPage({ timezoneId });
        try {
            await page.clock.install({ time: new Date("2026-10-22T02:59:59Z") });
            await page.goto(`${url}/__tempo`);
            const r = await page.evaluate(async () => {
                const t = await import("/src/utils/dataHora.ts");
                const contas = await import("/src/pages/Financeiro/contaReceberUtils.ts");
                const vendas = await import("/src/pages/Vendas/centralVendasUtils.ts");
                return [t.hojeBrasilia(), contas.hoje(), t.horaBrasilia(),
                    t.hojeBrasilia(new Date("2026-10-22T03:00:00Z")),
                    vendas.criarParametrosVenda({ status: "FATURADA", dataInicial: t.hojeBrasilia(), dataFinal: t.hojeBrasilia(), clienteId: "" }),
                    t.formatarDataHora("2026-10-22T02:59:59Z")];
            });
            assert.equal(r[0], "2026-10-21"); assert.equal(r[1], "2026-10-21"); assert.equal(r[2], 23);
            assert.equal(r[3], "2026-10-22");
            assert.deepEqual(r[4], { status: "FATURADA", dataInicial: "2026-10-21", dataFinal: "2026-10-21", clienteId: undefined });
            assert.equal(r[5], "21/10/2026, 23:59");
        } finally { await page.close(); }
    });
}
