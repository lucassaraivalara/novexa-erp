import { cadastroVazio, type CadastroFormulario, type EmpresaCadastro, type EmpresaCompleta, type EmpresaInput, type InscricaoSt } from "../../types/empresa";
import { documentoEmpresaValido, normalizarDocumentoEmpresa } from "../../utils/validators/documentoEmpresa";

export const ufs = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export const regimes = [["SIMPLES_NACIONAL", "Simples Nacional"], ["LUCRO_PRESUMIDO", "Lucro Presumido"], ["LUCRO_REAL", "Lucro Real"]];
export const abasEmpresa = ["Dados", "Endereço", "Contato", "Fiscal / SPED"];
export type EstadoEmpresa = {
    razaoSocial: string; nomeFantasia: string; cnpj: string; inscricaoEstadual: string;
    telefone: string; email: string; endereco: string; ativo: boolean;
    cadastro: CadastroFormulario; logomarca: string | null; inscricoesSt: InscricaoSt[];
};
export type NomeCampo = Exclude<keyof EstadoEmpresa, "cadastro" | "inscricoesSt" | "logomarca"> | `cadastro.${keyof CadastroFormulario}`;
export type Campo = { nome: NomeCampo; label: string; max?: number; required?: boolean; opcoes?: string[][]; tipo?: "email" | "decimal" | "digitos"; ajuda?: string };
export const gruposEmpresa: { aba: number; titulo: string; campos: Campo[] }[] = [
    { aba: 0, titulo: "Identificação e tributação", campos: [
        { nome: "cnpj", label: "CNPJ / CPF", required: true, max: 18, ajuda: "CPF permitido para produtor rural. CNPJ numérico ou alfanumérico." },
        { nome: "razaoSocial", label: "Razão Social", required: true, max: 150 },
        { nome: "nomeFantasia", label: "Nome Fantasia", max: 150 },
        { nome: "cadastro.regimeTributario", label: "Regime Tributário", required: true, opcoes: regimes },
        { nome: "inscricaoEstadual", label: "Inscrição Estadual", max: 30 },
        { nome: "cadastro.inscricaoMunicipal", label: "Inscrição Municipal", max: 30 },
    ] },
    { aba: 1, titulo: "Endereço da empresa", campos: [
        { nome: "cadastro.cep", label: "CEP", max: 8, tipo: "digitos" },
        { nome: "cadastro.logradouro", label: "Logradouro", max: 150 },
        { nome: "cadastro.numero", label: "Número", max: 20 },
        { nome: "cadastro.complemento", label: "Complemento", max: 100 },
        { nome: "cadastro.bairro", label: "Bairro", max: 100 },
        { nome: "cadastro.cidade", label: "Cidade", max: 100 },
        { nome: "cadastro.uf", label: "UF", opcoes: ufs.map(uf => [uf, uf]) },
    ] },
    { aba: 1, titulo: "Localização para rotas", campos: [
        { nome: "cadastro.latitude", label: "Latitude", tipo: "decimal", ajuda: "De −90 a 90" },
        { nome: "cadastro.longitude", label: "Longitude", tipo: "decimal", ajuda: "De −180 a 180" },
    ] },
    { aba: 2, titulo: "Contato da empresa", campos: [
        { nome: "telefone", label: "Telefone", max: 30 }, { nome: "email", label: "E-mail", max: 150, tipo: "email" },
    ] },
    { aba: 3, titulo: "ICMS / IPI e SUFRAMA", campos: [
        { nome: "cadastro.suframa", label: "Código SUFRAMA", max: 9, tipo: "digitos" },
        { nome: "cadastro.indicadorAtividade", label: "Indicador de Atividade", opcoes: [["0", "0 — Industrial / equiparado"], ["1", "1 — Outras atividades"]] },
        { nome: "cadastro.perfilEfd", label: "Perfil EFD ICMS/IPI", opcoes: [["A", "A — Detalhado"], ["B", "B — Sintético"], ["C", "C — Simplificado"]] },
        { nome: "cadastro.diaVencimentoIcms", label: "Dia de vencimento do ICMS", tipo: "digitos", max: 2, ajuda: "Dia de 1 a 31 do mês seguinte" },
        { nome: "cadastro.codigoReceitaIcms", label: "Código de receita estadual ICMS", max: 20, ajuda: "COD_REC do registro E116" },
    ] },
    { aba: 3, titulo: "PIS / COFINS", campos: [
        { nome: "cadastro.regimePisCofins", label: "Regime de apuração PIS/COFINS", opcoes: [["1", "1 — Não cumulativo"], ["2", "2 — Cumulativo"], ["3", "3 — Cumulativo e não cumulativo"]] },
        { nome: "cadastro.criterioPisCofins", label: "Critério de escrituração PIS/COFINS", opcoes: [["1", "1 — Caixa (consolidado)"], ["2", "2 — Competência (consolidado)"], ["9", "9 — Competência (detalhado)"]], ajuda: "IND_REG_CUM: aplicável à incidência exclusivamente cumulativa." },
        { nome: "cadastro.tipoAtividadePisCofins", label: "Tipo de atividade PIS/COFINS", opcoes: [["0", "0 — Industrial ou equiparado"], ["1", "1 — Prestador de serviços"], ["2", "2 — Comércio"], ["3", "3 — Serviços financeiros"], ["4", "4 — Atividade imobiliária"], ["9", "9 — Outros"]] },
    ] },
];

export function criarFormulario(empresa: EmpresaCompleta | null): EstadoEmpresa {
    const cadastro = { ...cadastroVazio };
    for (const chave of Object.keys(cadastro) as (keyof CadastroFormulario)[]) {
        if (chave === "produtorRural") cadastro[chave] = empresa?.cadastro?.[chave] ?? false;
        else cadastro[chave] = String(empresa?.cadastro?.[chave] ?? "");
    }
    return { razaoSocial: empresa?.razaoSocial ?? "", nomeFantasia: empresa?.nomeFantasia ?? "", cnpj: empresa?.cnpj ?? "", inscricaoEstadual: empresa?.inscricaoEstadual ?? "",
        email: empresa?.email ?? "", telefone: empresa?.telefone ?? "", endereco: empresa?.endereco ?? "", ativo: empresa?.ativo ?? true,
        cadastro, logomarca: empresa?.logomarca ?? null, inscricoesSt: empresa?.inscricoesSt?.map(i => ({ ...i })) ?? [] };
}

export function lerCampo(form: EstadoEmpresa, campo: NomeCampo): string {
    return String(campo.startsWith("cadastro.") ? form.cadastro[campo.slice(9) as keyof CadastroFormulario] : form[campo as keyof EstadoEmpresa]);
}

export function validarFormulario(form: EstadoEmpresa): Record<string, string> {
    const erros: Record<string, string> = {};
    for (const campo of gruposEmpresa.flatMap(g => g.campos)) {
        const valor = lerCampo(form, campo.nome).trim();
        if (campo.required && !valor) erros[campo.nome] = `Informe ${campo.label.toLowerCase()}.`;
        if (campo.max && valor.length > campo.max) erros[campo.nome] = `Use até ${campo.max} caracteres.`;
        if (campo.opcoes && valor && !campo.opcoes.some(([codigo]) => codigo === valor)) erros[campo.nome] = "Selecione uma opção válida.";
        if (campo.tipo === "email" && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) erros[campo.nome] = "Informe um e-mail válido.";
    }
    if (!documentoEmpresaValido(form.cnpj, form.cadastro.produtorRural)) erros.cnpj = "Informe um CNPJ válido ou marque produtor rural para usar CPF.";
    const c = form.cadastro;
    for (const chave of ["cep", "contadorCep"] as const) if (c[chave] && !/^\d{8}$/.test(c[chave])) erros[`cadastro.${chave}`] = "Informe 8 dígitos.";
    if (c.suframa && !/^\d{9}$/.test(c.suframa)) erros["cadastro.suframa"] = "Informe 9 dígitos.";
    if (c.contadorCodigoMunicipio && !/^\d{7}$/.test(c.contadorCodigoMunicipio)) erros["cadastro.contadorCodigoMunicipio"] = "Informe os 7 dígitos do código IBGE.";
    if (c.contadorCpf && (!/^\d{11}$/.test(normalizarDocumentoEmpresa(c.contadorCpf)) || !documentoEmpresaValido(c.contadorCpf, true))) erros["cadastro.contadorCpf"] = "CPF inválido.";
    if (c.contadorCnpjEscritorio && !documentoEmpresaValido(c.contadorCnpjEscritorio)) erros["cadastro.contadorCnpjEscritorio"] = "CNPJ inválido.";
    if (Object.entries(c).some(([k, v]) => k.startsWith("contador") && String(v).trim()) && !c.contadorCidade.trim()) erros["cadastro.contadorCidade"] = "Informe a cidade do contador.";
    if (c.contadorCrc && !c.contadorUfCrc) erros["cadastro.contadorUfCrc"] = "Informe a UF do CRC.";
    for (const chave of ["latitude", "longitude"] as const) {
        const valor = c[chave].trim().replace(",", ".");
        if (valor && (!/^-?\d+(\.\d{1,7})?$/.test(valor) || Math.abs(Number(valor)) > (chave === "latitude" ? 90 : 180))) erros[`cadastro.${chave}`] = "Coordenada inválida. Use até 7 casas decimais.";
    }
    if (!!c.latitude.trim() !== !!c.longitude.trim()) erros[c.latitude.trim() ? "cadastro.longitude" : "cadastro.latitude"] = "Preencha as duas coordenadas.";
    if (c.diaVencimentoIcms && (!/^\d+$/.test(c.diaVencimentoIcms) || Number(c.diaVencimentoIcms) < 1 || Number(c.diaVencimentoIcms) > 31)) erros["cadastro.diaVencimentoIcms"] = "Informe um dia de 1 a 31.";
    if (form.inscricoesSt.some(i => i.uf === c.uf)) erros["inscricoesSt"] = "Inscrições ST devem ser de outras UFs.";
    if (form.inscricoesSt.length > 26 || new Set(form.inscricoesSt.map(i => i.uf)).size !== form.inscricoesSt.length)
        erros.inscricoesSt = "Cadastre somente uma inscrição ST por UF.";
    if (form.inscricoesSt.some(i => !ufs.includes(i.uf) || !i.inscricaoEstadual.trim() || i.inscricaoEstadual.trim().length > 20))
        erros.inscricoesSt = "Revise a UF e a inscrição estadual de cada registro.";
    return erros;
}

export function gerarInput(form: EstadoEmpresa): EmpresaInput {
    const cadastro = Object.fromEntries(Object.entries(form.cadastro).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])) as EmpresaCadastro;
    for (const chave of ["latitude", "longitude", "diaVencimentoIcms"] as const) cadastro[chave] = form.cadastro[chave].trim() ? Number(form.cadastro[chave].replace(",", ".")) : null;
    return { ...form, razaoSocial: form.razaoSocial.trim(), cnpj: normalizarDocumentoEmpresa(form.cnpj), cadastro };
}
