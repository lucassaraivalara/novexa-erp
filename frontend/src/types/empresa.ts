import type { EmpresaAtiva } from "./auth";

export type RegimeTributario = "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
export type EmpresaCadastro = {
    produtorRural: boolean;
    regimeTributario: RegimeTributario | null;
    inscricaoMunicipal: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    suframa: string | null;
    indicadorAtividade: string | null;
    perfilEfd: string | null;
    regimePisCofins: string | null;
    criterioPisCofins: string | null;
    tipoAtividadePisCofins: string | null;
    codigoReceitaIcms: string | null;
    contadorNome: string | null;
    contadorCpf: string | null;
    contadorCrc: string | null;
    contadorUfCrc: string | null;
    contadorCnpjEscritorio: string | null;
    contadorRazaoSocial: string | null;
    contadorTelefone: string | null;
    contadorFax: string | null;
    contadorEmail: string | null;
    contadorCep: string | null;
    contadorLogradouro: string | null;
    contadorNumero: string | null;
    contadorComplemento: string | null;
    contadorBairro: string | null;
    contadorCidade: string | null;
    contadorUf: string | null;
    contadorCodigoMunicipio: string | null;
    latitude: number | null;
    longitude: number | null;
    diaVencimentoIcms: number | null;
};

export type InscricaoSt = { uf: string; inscricaoEstadual: string; difal: boolean };
export type EmpresaResumo = EmpresaAtiva & { cadastro: EmpresaCadastro | null };
export type EmpresaCompleta = EmpresaResumo & { logomarca: string | null; inscricoesSt: InscricaoSt[] };
export type EmpresaInput = Omit<EmpresaCompleta, "id">;
export type CoordenadaEmpresa = { descricao: string; latitude: number; longitude: number };
export type CadastroFormulario = { [K in keyof Omit<EmpresaCadastro, "produtorRural">]: string } & { produtorRural: boolean };
export const cadastroVazio: CadastroFormulario = {
    produtorRural: false,
    regimeTributario: "",
    inscricaoMunicipal: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    suframa: "",
    indicadorAtividade: "",
    perfilEfd: "",
    regimePisCofins: "",
    criterioPisCofins: "",
    tipoAtividadePisCofins: "",
    codigoReceitaIcms: "",
    contadorNome: "",
    contadorCpf: "",
    contadorCrc: "",
    contadorUfCrc: "",
    contadorCnpjEscritorio: "",
    contadorRazaoSocial: "",
    contadorTelefone: "",
    contadorFax: "",
    contadorEmail: "",
    contadorCep: "",
    contadorLogradouro: "",
    contadorNumero: "",
    contadorComplemento: "",
    contadorBairro: "",
    contadorCidade: "",
    contadorUf: "",
    contadorCodigoMunicipio: "",
    latitude: "",
    longitude: "",
    diaVencimentoIcms: "",
};
