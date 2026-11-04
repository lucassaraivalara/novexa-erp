import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import { listarPagamentosConta, mensagemContaPagar } from "../../services/contaPagarService";
import { formatarData, formatarDataHora } from "../../utils/dataHora";
import type { PagamentoContaPagar } from "../../types/contaPagar";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Origens em lote na API: nenhuma consulta por baixa ou movimentação. */
export default function PagamentosContaPagar({ contaId }: { contaId: number }) {
    const [pagina, setPagina] = useState(0);
    const [tentativa, setTentativa] = useState(0);
    const [resultado, setResultado] = useState<{ items: PagamentoContaPagar[]; totalPages: number } | null>(null);
    const [erro, setErro] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        listarPagamentosConta(contaId, pagina, controller.signal).then(r => {
            if (!controller.signal.aborted) { setResultado(r); setErro(""); }
        }).catch(e => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível consultar os pagamentos.")); });
        return () => controller.abort();
    }, [contaId, pagina, tentativa]);
    return <Stack spacing={1.5} component="section" aria-label="Histórico de pagamentos">
        <Typography component="h3" variant="subtitle2">Histórico de pagamentos</Typography>
        {erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</Button>}>{erro}</Alert>
            : !resultado ? <Typography variant="body2" role="status">Consultando pagamentos…</Typography>
            : resultado.items.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhuma baixa agrupada registrada. Pagamentos antigos permanecem no extrato e no último pagamento legado.</Typography>
            : resultado.items.map(p => <Box key={p.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, overflowWrap: "anywhere" }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Pagamento #{p.id} · {formatarData(p.dataPagamento)}</Typography>
                    <Chip size="small" variant="outlined" color={p.estado === "CONFIRMADO" ? "success" : "default"} label={p.estado === "CONFIRMADO" ? "Confirmado" : "Estornado"} />
                </Stack>
                <Typography variant="body2">Principal quitado: {moeda.format(p.principalQuitado)}</Typography>
                <Typography variant="body2">Juros: {moeda.format(p.juros)} · Multa: {moeda.format(p.multa)} · Desconto: {moeda.format(p.desconto)}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Total pago: {moeda.format(p.totalPago)}</Typography>
                <Typography variant="caption" color="text.secondary">{p.usuarioNome} · {formatarDataHora(p.dataCriacao)}</Typography>
                <Divider sx={{ my: 1 }} />
                {p.origens.map(o => <Box key={o.movimentoId} sx={{ mb: 0.75 }}>
                    <Typography variant="body2">{o.contaFinanceiraNome}: <strong>{moeda.format(o.valor)}</strong></Typography>
                    <Typography variant="caption" color="text.secondary">Movimento #{o.movimentoId}{o.estornada ? " · Estornado" : ""}</Typography>
                </Box>)}
                {p.estado === "ESTORNADO" && <Typography variant="body2">Estorno: {p.motivoEstorno} · {p.usuarioEstornoNome} · {formatarDataHora(p.dataEstorno)}</Typography>}
                <Typography variant="caption" color="text.secondary">Operação: {p.chaveRequisicao}</Typography>
            </Box>)}
        {resultado && resultado.totalPages > 1 && <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Button disabled={pagina === 0} onClick={() => { setResultado(null); setPagina(p => p - 1); }}>Anterior</Button>
            <Typography variant="caption">{pagina + 1} de {resultado.totalPages}</Typography>
            <Button disabled={pagina + 1 >= resultado.totalPages} onClick={() => { setResultado(null); setPagina(p => p + 1); }}>Próxima</Button>
        </Stack>}
    </Stack>;
}
