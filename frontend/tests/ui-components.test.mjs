import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const [statusModule, headerModule, filtersModule] = await Promise.all([
    server.ssrLoadModule("/src/components/ui/StatusChip.tsx"),
    server.ssrLoadModule("/src/components/ui/PageHeader.tsx"),
    server.ssrLoadModule("/src/components/ui/PageFilters.tsx"),
]);
const { default: theme } = await server.ssrLoadModule("/src/theme/theme.ts");
await server.close();

const render = (element) => renderToStaticMarkup(createElement(ThemeProvider, { theme }, element));

test("StatusChip mostra status, ponto acessivel e tons semanticos do theme", () => {
    const success = render(createElement(statusModule.default, { status: "ATIVO" }));
    const warning = render(createElement(statusModule.default, { status: "BAIXO" }));
    const error = render(createElement(statusModule.default, { status: "VENCIDA", label: "Vencida" }));
    const info = render(createElement(statusModule.default, { status: "ABERTA" }));
    const neutral = render(createElement(statusModule.default, { status: "Desconhecido" }));

    assert.match(success, /ATIVO/);
    assert.match(success, /#16794A/i);
    assert.match(warning, /BAIXO/);
    assert.match(warning, /#B25E09/i);
    assert.match(error, /Vencida/);
    assert.match(error, /#C4372E/i);
    assert.match(info, /ABERTA/);
    assert.match(info, /#2F5BD3/i);
    assert.match(neutral, /Desconhecido/);
    assert.match(neutral, /aria-hidden="true"/);
});

test("PageHeader apresenta titulo, descricao, acoes e quebra responsiva", () => {
    const html = render(createElement(headerModule.default, {
        titulo: "Produtos",
        descricao: "Descri\u00e7\u00e3o da p\u00e1gina",
        acaoPrincipal: createElement("button", null, "Novo produto"),
        acoesSecundarias: createElement("button", null, "Exportar"),
    }));

    assert.match(html, /<h1[^>]*>Produtos<\/h1>/);
    assert.match(html, /Descri\u00e7\u00e3o da p\u00e1gina/);
    assert.match(html, /Exportar[\s\S]*Novo produto/);
    assert.match(html, /@media\s*\(min-width:900px\)/);
    assert.match(html, /flex-direction:column/);
    assert.match(html, /flex-direction:row/);
});

test("PageFilters mantem busca, callback, carregamento, children e callback de teclado", async () => {
    const fonte = await readFile(new URL("../src/components/ui/PageFilters.tsx", import.meta.url), "utf8");
    const html = render(createElement(filtersModule.default, {
        busca: { placeholder: "Pesquisar", valor: "abc", carregando: true, onChange() {}, onKeyDown() {} },
        children: createElement("button", null, "Filtro existente"),
    }));

    assert.match(html, /aria-label="Pesquisar: Pesquisar"/);
    assert.match(html, /value="abc"/);
    assert.match(html, /Pesquisando/);
    assert.match(html, /Filtro existente/);
    assert.match(fonte, /onChange=\{\(evento\) => busca\.onChange\(evento\.target\.value\)\}/);
    assert.match(fonte, /onKeyDown=\{busca\.onKeyDown\}/);
});
