import type { EntregaCofre } from "../../services/cofreService";

export type FormEntregaCofre = { conta: string; valor: string; troco: string; responsavel: string; observacao: string; confirmar: boolean };
export const novaEntregaCofre = (): FormEntregaCofre => ({ conta: "", valor: "", troco: "", responsavel: "", observacao: "", confirmar: false });
export function lerEntregaCofre(form: FormEntregaCofre, valorFixo?: number): EntregaCofre {
    function valor(texto: string) {
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto.trim())) throw new Error("Informe valores não negativos com até duas casas decimais, sem separador de milhar.");
        return Number(texto.replace(",", "."));
    }
    return { contaCofreId: form.conta ? Number(form.conta) : null, valor: valorFixo ?? valor(form.valor),
        valorTroco: valorFixo === undefined ? valor(form.troco) : 0, responsavel: form.responsavel.trim() || null,
        observacao: form.observacao.trim() || null, confirmarEntrega: form.confirmar };
}
