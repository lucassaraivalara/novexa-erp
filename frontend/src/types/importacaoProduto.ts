export type LinhaImportacaoProduto = {
    linha: number; situacao: "VALIDA" | "INVALIDA" | "DUPLICADA" | "IGNORADA";
    mensagem: string; campos: Record<string, string>;
};
export type ImportacaoProduto = {
    id: string; arquivo: string; estado: "PREVIA" | "CONFIRMADA" | "CANCELADA";
    validas: number; invalidas: number; duplicadas: number; ignoradas: number; importados: number;
    colunasIgnoradas: string[]; linhas: LinhaImportacaoProduto[];
};
