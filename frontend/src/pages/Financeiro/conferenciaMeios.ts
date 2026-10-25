import type { ResumoSessaoCaixa, FechamentoCaixaInput } from "../../types/caixa";
import type { ConfiguracaoRecebimentos } from "../../services/configuracaoRecebimentosService";
import { numeroDecimal } from "../../utils/numeroFormulario";
export function valorConferido(texto: string): number | null {
    const normalizado = texto.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
    const valor = numeroDecimal(normalizado, 2);
    return valor !== null && valor >= 0 ? valor : null;
}
export function conferenciaMeios(resumo: ResumoSessaoCaixa | null, politica: ConfiguracaoRecebimentos | null,
    valores: Record<string, string>, total: string) {
    const grupos = resumo?.totaisPorConfiguracao ?? resumo?.totaisPorFormaPagamento.map(f => ({ ...f, configuracaoId: null })) ?? [];
    const linhas = grupos.filter(f => f.tipo !== "DINHEIRO").map(f => {
        const chave = f.configuracaoId != null ? `c:${f.configuracaoId}` : `f:${f.formaPagamentoId}`;
        const informado = valorConferido(valores[chave] ?? "");
        return { ...f, chave, informado, diferenca: informado == null ? null : Math.round((informado - f.total) * 100) / 100 };
    });
    const esperado = linhas.reduce((s, f) => s + Math.round(f.total * 100), 0) / 100;
    const informado = valorConferido(total);
    const porTotal = politica?.conferencia === "TOTAL";
    const incompleto = !!politica?.exigirValoresInformadosNoFechamento && (porTotal ? informado == null : linhas.some(l => l.informado == null));
    const invalido = porTotal ? total.trim() !== "" && informado == null : linhas.some(l => (valores[l.chave] ?? "").trim() !== "" && l.informado == null);
    const divergencia = porTotal ? informado != null && Math.round((informado - esperado) * 100) !== 0 : linhas.some(l => l.diferenca != null && l.diferenca !== 0);
    function pedido(observacao: string): FechamentoCaixaInput["conferenciaMeios"] {
        if (!politica) throw new Error("Aguarde a configuração de fechamento.");
        return { modo: politica.conferencia,
            meios: porTotal ? [] : linhas.map(l => ({ configuracaoId: l.configuracaoId, formaPagamentoId: l.configuracaoId == null ? l.formaPagamentoId : null, valorInformado: l.informado })),
            ...(porTotal ? { totalInformado: informado } : {}), observacao: observacao.trim() || null };
    }
    return { linhas, esperado, informado, incompleto, invalido, divergencia, porTotal, pedido };
}
