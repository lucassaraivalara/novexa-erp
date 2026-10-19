import api from "./api";

export type EnderecoCep = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string };
export async function consultarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep> {
    return (await api.get<EnderecoCep>(`/enderecos/cep/${cep.replace(/\D/g, "")}`, { signal, timeout: 7000 })).data;
}
