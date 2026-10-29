import { somarDias } from "../../utils/dataHora";
import { normalizarDecimal } from "../../utils/numeroFormulario";
import type { ContaPagar } from "../../types/contaPagar";

export type FiltrosContaPagar = {
    busca: string;
    status: string;
    fornecedor: string;
    categoria: string;
    vencimentoDe: string;
    vencimentoAte: string;
    emissaoDe: string;
    emissaoAte: string;
};

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const emAberto = (conta: ContaPagar) => conta.status !== "ABERTA" ? 0 :
    Math.max(0, Number(conta.valor) - Number(conta.valorPago ?? 0));

/** Valores do formulário em centavos inteiros, sem soma monetária em ponto flutuante. */
export function centavosPagamento(texto: string): bigint | null {
    const normalizado = normalizarDecimal(texto, 2);
    if (!normalizado) return null;
    const [inteiro, fracao = ""] = normalizado.split(".");
    return BigInt(inteiro) * 100n + BigInt(fracao.padEnd(2, "0"));
}

export function decimalPagamento(centavos: bigint): string {
    return `${centavos / 100n}.${(centavos % 100n).toString().padStart(2, "0")}`;
}

export function calcularPagamento(original: string, juros: string, multa: string, desconto: string) {
    const valores = [original, juros, multa, desconto].map(centavosPagamento);
    if (valores.some(v => v === null)) return null;
    const [base, j, m, d] = valores as bigint[];
    const total = base + j + m - d;
    return base > 0n && total > 0n && total <= BigInt(Number.MAX_SAFE_INTEGER)
        ? { total, valorPago: decimalPagamento(total) } : null;
}

export function filtrarContas(contas: ContaPagar[], filtros: FiltrosContaPagar) {
    const termo = normalizar(filtros.busca.trim());
    return contas.filter((conta) =>
        (filtros.status === "todas" || conta.status === filtros.status)
        && (!filtros.fornecedor || String(conta.fornecedorId) === filtros.fornecedor)
        && (!filtros.categoria || conta.categoria === filtros.categoria)
        && (!filtros.vencimentoDe || conta.dataVencimento >= filtros.vencimentoDe)
        && (!filtros.vencimentoAte || conta.dataVencimento <= filtros.vencimentoAte)
        && (!filtros.emissaoDe || (conta.dataEmissao !== null && conta.dataEmissao >= filtros.emissaoDe))
        && (!filtros.emissaoAte || (conta.dataEmissao !== null && conta.dataEmissao <= filtros.emissaoAte))
        && (!termo || normalizar(`${conta.descricao} ${conta.documento ?? ""} ${conta.fornecedorNome ?? ""} ${conta.categoria ?? ""}`).includes(termo)));
}

function somar(contas: ContaPagar[]) {
    return contas.reduce((total, conta) => total + emAberto(conta), 0);
}

export function resumirContas(contas: ContaPagar[], hoje: string) {
    const prazo = (dias: number) => somarDias(hoje, dias);
    const abertas = contas.filter((conta) => conta.status === "ABERTA");
    const vencidas = abertas.filter((conta) => conta.dataVencimento < hoje);
    const emSeteDias = abertas.filter((conta) => conta.dataVencimento >= hoje && conta.dataVencimento <= prazo(7));
    const emTrintaDias = abertas.filter((conta) => conta.dataVencimento >= hoje && conta.dataVencimento <= prazo(30));
    const pagasMes = contas.filter((conta) => conta.status === "PAGA" && conta.dataPagamento?.startsWith(hoje.slice(0, 7)));
    return {
        vencidas: { total: somar(vencidas), quantidade: vencidas.length },
        seteDias: { total: somar(emSeteDias), quantidade: emSeteDias.length },
        trintaDias: { total: somar(emTrintaDias), quantidade: emTrintaDias.length },
        emAberto: { total: somar(abertas), quantidade: abertas.length },
        pagasMes: { total: pagasMes.reduce((total, conta) => total + Number(conta.valorPago ?? 0), 0), quantidade: pagasMes.length },
    };
}
