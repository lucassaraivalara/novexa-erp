import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { default: AppTable } = await server.ssrLoadModule("/src/components/ui/AppTable.tsx");
const { default: PageFilters } = await server.ssrLoadModule("/src/components/ui/PageFilters.tsx");
await server.close();

const props = {
    colunas: [{ campo: "nome", cabecalho: "Produto", pesquisavel: true, ordenavel: true }],
    linhas: [{ id: 1, nome: "Teste" }],
    obterChaveLinha: linha => linha.id,
};

test("AppTable preserva cabecalho legado sem adesao ao piloto", () => {
    const html = renderToStaticMarkup(createElement(AppTable, props));
    assert.doesNotMatch(html, /aria-pressed|Buscar por:|Ordenar por/);
    assert.match(html, /Produto/);
    assert.match(html, /Teste/);
});

test("AppTable apresenta dois botoes independentes antes da primeira ordenacao", () => {
    const html = renderToStaticMarkup(createElement(AppTable, {
        ...props, buscaPorColuna: { campo: "nome", onSelecionar() {} },
    }));
    assert.equal((html.match(/<button\b/g) ?? []).length, 2);
    assert.match(html, /aria-label="Buscar por: Produto"/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-label="Ordenar por Produto: crescente"/);
});

test("PageFilters renderiza chip apenas quando um campo esta ativo", () => {
    const busca = { placeholder: "Pesquisar", valor: "", onChange() {} };
    const legado = renderToStaticMarkup(createElement(PageFilters, { busca }));
    assert.doesNotMatch(legado, /Buscando por:/);
    const piloto = renderToStaticMarkup(createElement(PageFilters, {
        busca, campoBuscaAtivo: { rotulo: "Produto", onRemover() {} },
    }));
    assert.match(piloto, /Buscando por: Produto/);
    assert.match(piloto, /Remover filtro de coluna/);
});
