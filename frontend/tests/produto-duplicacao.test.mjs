import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [listagem, formulario] = await Promise.all([
    readFile(new URL("../src/pages/Produtos/Produtos.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Produtos/ProdutoForm.tsx", import.meta.url), "utf8"),
]);

test("Duplicar consulta a origem e salva por POST sem editar o registro original", () => {
    assert.match(listagem, /rotulo: "Duplicar"/);
    assert.match(listagem, /setProdutoEmEdicao\(await buscarProdutoPorId\(produto\.id\)\)/);
    assert.match(listagem, /produtoEmEdicao && !duplicando\s*\? await atualizarProduto/);
    assert.match(listagem, /: await cadastrarProduto\(dados\)/);
});

test("duplicação inicia sem códigos, imagem, saldo ou composição e como produto ativo", () => {
    assert.match(formulario, /codigoInterno: duplicando \? ""/);
    assert.match(formulario, /codigoBarras: duplicando \? ""/);
    assert.match(formulario, /duplicando \? null : produto\?\.imagemUrl/);
    assert.match(formulario, /produto\?\.composto && !duplicando \? null : \[\]/);
    assert.match(formulario, /produtoId=\{duplicando \? undefined : produto\?\.id\}/);
    assert.match(formulario, /ativo: duplicando \? true/);
    assert.match(formulario, /produto && !duplicando\s*\? numeroParaCampo/);
});

test("código automático envia null; manual exige valor e usa o mesmo cadastro", () => {
    assert.match(formulario, /useState\(duplicando\)/);
    assert.match(formulario, /duplicando && !codigoAutomatico && !formulario\.codigoInterno\.trim\(\)/);
    assert.match(formulario, /duplicando && codigoAutomatico \? null : formulario\.codigoInterno\.trim\(\) \|\| null/);
    assert.match(formulario, /Gerar automaticamente/);
    assert.match(formulario, /Informar manualmente/);
    assert.match(formulario, /duplicando \? "Criar produto"/);
});
