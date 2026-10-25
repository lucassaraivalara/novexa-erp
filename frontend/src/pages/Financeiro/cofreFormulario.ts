import type { EntregaCofre } from "../../services/cofreService";
import { numeroDecimal } from "../../utils/numeroFormulario";

export type FormEntregaCofre = { conta: string; valor: string; troco: string; responsavel: string; observacao: string; confirmar: boolean };
export const novaEntregaCofre = (): FormEntregaCofre => ({ conta: "", valor: "", troco: "", responsavel: "", observacao: "", confirmar: false });
export function centavosDinheiro(texto: string): number | null {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto.trim())) return null;
    const numero = numeroDecimal(texto, 2);
    if (numero === null) return null;
    const valor = Math.round(numero * 100);
    return Number.isSafeInteger(valor) ? valor : null;
}
export function lerEntregaCofre(form: FormEntregaCofre, valorFixo?: number): EntregaCofre {
    function valor(texto: string) {
        const centavos = centavosDinheiro(texto);
        if (centavos === null) throw new Error("Informe valores não negativos com até duas casas decimais, sem separador de milhar.");
        return centavos / 100;
    }
    return { contaCofreId: form.conta ? Number(form.conta) : null, valor: valorFixo ?? valor(form.valor),
        valorTroco: valorFixo === undefined ? valor(form.troco) : 0, responsavel: form.responsavel.trim() || null,
        observacao: form.observacao.trim() || null, confirmarEntrega: form.confirmar };
}
