import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { abasEmpresa, criarFormulario, gerarInput, validarFormulario } = await server.ssrLoadModule("/src/pages/Empresa/empresaFormulario.ts");
const { documentoEmpresaValido, formatarDocumentoEmpresa } = await server.ssrLoadModule("/src/utils/validators/documentoEmpresa.ts");
await server.close();

function preenchido() {
    const f = criarFormulario(null);
    f.razaoSocial = "Distribuidora Teste";
    f.cnpj = "11.222.333/0001-81";
    f.cadastro.regimeTributario = "LUCRO_REAL";
    return f;
}

test("novo cadastro exige identificação e regime, mas aceita campos opcionais vazios", () => {
    assert.deepEqual(Object.keys(validarFormulario(criarFormulario(null))).sort(), ["cadastro.regimeTributario", "cnpj", "razaoSocial"]);
    assert.deepEqual(validarFormulario(preenchido()), {});
});

test("documento numérico e alfanumérico; CPF restrito a produtor rural", () => {
    assert.ok(documentoEmpresaValido("12.ABC.345/01DE-35"));
    assert.equal(documentoEmpresaValido("12.ABC.345/01DE-36"), false);
    assert.equal(documentoEmpresaValido("529.982.247-25"), false);
    assert.ok(documentoEmpresaValido("529.982.247-25", true));
    assert.equal(formatarDocumentoEmpresa("11222333000181"), "11.222.333/0001-81");
    assert.equal(formatarDocumentoEmpresa("52998224725", true), "529.982.247-25");
});

test("edição preserva dados antigos e não compartilha inscrições com a listagem", () => {
    const empresa = { ...gerarInput(preenchido()), id: 7, endereco: "Rua anterior", inscricoesSt: [{ uf: "MG", inscricaoEstadual: "001", difal: true }] };
    const f = criarFormulario(empresa);
    f.inscricoesSt[0].inscricaoEstadual = "002";
    assert.equal(empresa.inscricoesSt[0].inscricaoEstadual, "001");
    assert.equal(gerarInput(f).endereco, "Rua anterior");
    assert.equal(gerarInput(f).cnpj, "11222333000181");
});

test("coordenadas decimais negativas, zero, par obrigatório e limites", () => {
    const f = preenchido();
    f.cadastro.latitude = "-23,5505200";
    assert.ok(validarFormulario(f)["cadastro.longitude"]);
    f.cadastro.longitude = "0";
    assert.deepEqual(validarFormulario(f), {});
    assert.equal(gerarInput(f).cadastro.latitude, -23.55052);
    assert.equal(gerarInput(f).cadastro.longitude, 0);
    f.cadastro.latitude = "91";
    assert.ok(validarFormulario(f)["cadastro.latitude"]);
});

test("contador incompleto, dia inválido e ST duplicada são bloqueados", () => {
    const f = preenchido();
    f.cadastro.contadorEmail = "contador@example.com";
    f.cadastro.diaVencimentoIcms = "32";
    f.inscricoesSt = [{ uf: "MG", inscricaoEstadual: "001", difal: false }, { uf: "MG", inscricaoEstadual: "002", difal: true }];
    const erros = validarFormulario(f);
    assert.ok(erros["cadastro.contadorCidade"]);
    assert.ok(erros["cadastro.diaVencimentoIcms"]);
    assert.ok(erros.inscricoesSt);
});

test("dados das cinco abas sobrevivem à conversão para a API", () => {
    const f = preenchido();
    f.nomeFantasia = "Aços Teste";
    f.cadastro.cidade = "São Paulo";
    f.email = "empresa@example.com";
    f.cadastro.regimePisCofins = "1";
    f.cadastro.contadorCidade = "Campinas";
    f.inscricoesSt = [{ uf: "MG", inscricaoEstadual: "000123", difal: true }];
    const retorno = criarFormulario({ ...gerarInput(f), id: 7 });
    assert.deepEqual(retorno, { ...f, cnpj: "11222333000181" });
});

test("a UI de Empresa usa quatro abas, status textuais e máscara de documento", async () => {
    const fonte = await (await import("node:fs/promises")).readFile(new URL("../src/pages/Empresa/Empresa.tsx", import.meta.url), "utf8");
    const form = await (await import("node:fs/promises")).readFile(new URL("../src/pages/Empresa/EmpresaForm.tsx", import.meta.url), "utf8");
    assert.deepEqual(abasEmpresa, ["Dados", "Endereço", "Contato", "Fiscal / SPED"]);
    assert.match(fonte, /"Ativa"/);
    assert.match(fonte, /Inscrições estaduais\/municipais/);
    assert.match(form, /formatarDocumentoEmpresa/);
});
