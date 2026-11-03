import { useEffect, useState } from "react";
import { consultarCategoriasAnalise, consultarPagamentosAnalise, type CategoriasAnalise, type PagamentosAnalise, type PeriodoAnalise } from "../../services/analiseVendasService";
import { mensagemVenda } from "../../services/vendaService";

export function useDistribuicoesAnalise(periodo: PeriodoAnalise) {
    const { dataInicial, dataFinal } = periodo;
    const chave = `${dataInicial}|${dataFinal}`;
    const [estado, setEstado] = useState<{ chave: string; categorias?: CategoriasAnalise; pagamentos?: PagamentosAnalise; erroCategorias?: string; erroPagamentos?: string }>({ chave: "" });
    useEffect(() => {
        const c = new AbortController();
        const salvar = (dados: Partial<typeof estado>) => { if (!c.signal.aborted) setEstado(s => ({ ...(s.chave === chave ? s : { chave }), ...dados })); };
        void consultarCategoriasAnalise({ dataInicial, dataFinal }, c.signal).then(categorias => salvar({ categorias })).catch(e => salvar({ erroCategorias: mensagemVenda(e, "Não foi possível consultar categorias.") }));
        void consultarPagamentosAnalise({ dataInicial, dataFinal }, c.signal).then(pagamentos => salvar({ pagamentos })).catch(e => salvar({ erroPagamentos: mensagemVenda(e, "Não foi possível consultar pagamentos comerciais.") }));
        return () => c.abort();
    }, [dataInicial, dataFinal, chave]);
    return estado.chave === chave ? estado : { chave };
}
