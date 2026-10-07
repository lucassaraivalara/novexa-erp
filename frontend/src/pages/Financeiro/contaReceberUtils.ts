import type { ContaReceber, StatusContaReceber } from "../../types/contaReceber";

export const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const rotulosStatus: Record<StatusContaReceber, string> = {
    PENDENTE: "Pendente", PARCIAL: "Parcial", RECEBIDA: "Recebida", CANCELADA: "Cancelada",
};
export const formatarData = (valor: string | null, hora = false) => valor
    ? (hora ? new Date(valor).toLocaleString("pt-BR") : new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR")) : "—";
export function hoje() {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
export function valorMonetario(texto: string): number | null {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto.trim())) return null;
    const valor = Number(texto.trim().replace(",", "."));
    return Number.isFinite(valor) && valor > 0 && Number.isSafeInteger(Math.round(valor * 100)) ? valor : null;
}
// A página não traz recebimentos; esta regra usa somente o detalhe carregado.
export const podeEditarConta = (conta: ContaReceber) => conta.status === "PENDENTE"
    && conta.origem === "MANUAL" && conta.recebimentos.length === 0;
export const podeReceberConta = (conta: ContaReceber) => (conta.status === "PENDENTE" || conta.status === "PARCIAL") && conta.saldo > 0;
export const podeCancelarConta = (conta: ContaReceber) => conta.origem === "MANUAL" && conta.status !== "CANCELADA" && conta.valorRecebido === 0;
