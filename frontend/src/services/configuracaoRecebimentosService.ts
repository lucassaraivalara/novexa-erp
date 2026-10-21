import api from "./api";
export type ConfiguracaoRecebimentos = {
    modo: "CONTROLADO" | "SIMPLIFICADO";
    conferencia: "POR_FORMA_PAGAMENTO" | "TOTAL";
    exigirValoresInformadosNoFechamento: boolean;
};
const caminho = "/financeiro/configuracoes/recebimentos";
export const consultarConfiguracaoRecebimentos = async (signal?: AbortSignal) =>
    (await api.get<ConfiguracaoRecebimentos>(caminho, { signal })).data;
export const salvarConfiguracaoRecebimentos = async (dados: ConfiguracaoRecebimentos) =>
    (await api.put<ConfiguracaoRecebimentos>(caminho, dados)).data;
