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

export const emAberto = (conta: ContaPagar) => conta.status === "CANCELADA" ? 0 :
    Math.max(0, Number(conta.valor) - Number(conta.valorPago ?? 0));

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
    const prazo = (dias: number) => {
        const data = new Date(`${hoje}T12:00:00`);
        data.setDate(data.getDate() + dias);
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    };
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
