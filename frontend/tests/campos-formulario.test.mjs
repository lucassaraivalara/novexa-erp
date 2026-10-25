import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

let server;
let normalizarDecimal, numeroDecimal, formatarDecimal, ajustarDecimal;
let centavosDinheiro, valorConferido, valorMonetario, prepararComposicao;
before(async () => {
    server = await createServer({server: {middlewareMode: true, hmr: false}, appType: "custom"});
    ({normalizarDecimal, numeroDecimal, formatarDecimal, ajustarDecimal} = await server.ssrLoadModule("/src/utils/numeroFormulario.ts"));
    ({centavosDinheiro} = await server.ssrLoadModule("/src/pages/Financeiro/cofreFormulario.ts"));
    ({valorConferido} = await server.ssrLoadModule("/src/pages/Financeiro/conferenciaMeios.ts"));
    ({valorMonetario} = await server.ssrLoadModule("/src/pages/Financeiro/contaReceberUtils.ts"));
    ({prepararComposicao} = await server.ssrLoadModule("/src/pages/Produtos/composicaoProduto.ts"));
});
after(async () => { await server?.close(); });

for (const [texto, casas, numero] of [
    ["0,0002", 4, 0.0002], ["1,2500", 4, 1.25], ["10,50", 2, 10.5],
    ["1.234,56", 2, 1234.56], ["1234.56", 2, 1234.56], ["0", 2, 0],
    ["0001,20", 2, 1.2], ["1,", 2, 1], [" 10,50 ", 2, 10.5], ["1.234,56", 4, 1234.56],
]) test(`conversao sem arredondar: ${texto} (${casas} casas)`, () => assert.equal(numeroDecimal(texto, casas), numero));

for (const texto of ["", " ", "-1", "abc", "1e3", "NaN", "Infinity", "1,2,3", "1.23,45", "1.234.56", "1 234,56", "+2", "0,0002", "1,2500", "90071992547409,92", "90071992547409,91"])
    test(`valor invalido ou nao representavel em duas casas: ${JSON.stringify(texto)}`, () => assert.equal(numeroDecimal(texto, 2), null));

test("vazio permanece vazio e simbolos monetarios sao exclusivos da moeda", () => {
    assert.equal(normalizarDecimal("", 4), "");
    assert.equal(formatarDecimal("", 4), "");
    assert.equal(numeroDecimal("R$ 1.234,56", 2, true), 1234.56);
    assert.equal(numeroDecimal("R$ 1.234,56", 2), null);
});
test("quatro casas nao viram centavos; texto invalido nao e arredondado", () => {
    assert.equal(formatarDecimal("0,0002", 4), "0,0002");
    assert.equal(formatarDecimal("1,2500", 4), "1,2500");
    assert.equal(formatarDecimal("1.234,56", 2), "1.234,56");
    assert.equal(formatarDecimal("0,0002", 2), "0,0002");
});

test("quantidade compacta do PDV preserva inteiros e nunca gera ponto de milhar ambíguo", () => {
    assert.equal(formatarDecimal("1", 3, false, 0), "1");
    assert.equal(formatarDecimal("1250", 3, false, 0), "1250");
    assert.equal(formatarDecimal("1250.125", 3, false, 0), "1250,125");
    assert.equal(numeroDecimal(formatarDecimal("1250", 3, false, 0), 3), 1250);
});

test("parsers dos formulários recusam perda de centavos e preservam zero, sinais e precisão dos kits", () => {
    for (const texto of ["90071992547409,91", "90071992547409,92", "1e3", "-1", "0,001"])
        for (const ler of [centavosDinheiro, valorConferido, valorMonetario]) assert.equal(ler(texto), null, texto);
    assert.equal(centavosDinheiro("10,50"), 1050);
    assert.equal(valorConferido("10,50"), 10.5);
    assert.equal(valorMonetario("10,50"), 10.5);
    assert.equal(centavosDinheiro("0"), 0);
    assert.equal(valorConferido("0"), 0);
    assert.equal(valorMonetario("0"), null);
    assert.deepEqual(prepararComposicao([{produtoId: 1, quantidade: "1,250", fator: "0,000002", unidade: "CX"}]),
        [{produtoId: 1, quantidade: 1.25, fator: 0.000002, unidade: "CX"}]);
    assert.throws(() => prepararComposicao([{produtoId: 1, quantidade: "9007199254740,991", fator: "1", unidade: "UN"}]));
});
test("passos decimais exatos, limites, vazio e invalidos", () => {
    assert.equal(ajustarDecimal("0,2", 3, "0,1", 1), "0,300");
    assert.equal(ajustarDecimal("0,1", 3, "0,1", -1), "0,000");
    assert.equal(ajustarDecimal("0", 3, "1", -1), "0,000");
    assert.equal(ajustarDecimal("4,9", 3, "1", 1, 0, 5), "5,000");
    assert.equal(ajustarDecimal("", 3, "1", 1), "1,000");
    assert.equal(ajustarDecimal("abc", 3, "1", 1), null);
    assert.equal(ajustarDecimal("1", 3, "0", 1), null);
    assert.equal(ajustarDecimal("1", 3, "-1", 1), null);
    assert.equal(ajustarDecimal("9007199254740,991", 3, "0,001", 1), null);
});
