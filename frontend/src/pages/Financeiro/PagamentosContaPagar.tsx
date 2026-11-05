import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from "@mui/material";
import { buscarContaPagar, estornarPagamentoConta, listarPagamentosConta, mensagemContaPagar } from "../../services/contaPagarService";
import { formatarData, formatarDataHora } from "../../utils/dataHora";
import type { ContaPagar, PagamentoContaPagar } from "../../types/contaPagar";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Origens em lote na API: nenhuma consulta por baixa ou movimentação. */
export default function PagamentosContaPagar({ contaId, onAlterado }: { contaId: number; onAlterado?: (conta: ContaPagar) => void }) {
    const [pagina, setPagina] = useState(0);
    const [tentativa, setTentativa] = useState(0);
    const [resultado, setResultado] = useState<{ items: PagamentoContaPagar[]; totalPages: number } | null>(null);
    const [erro, setErro] = useState("");
    const [estorno, setEstorno] = useState<PagamentoContaPagar | null>(null);
    const [motivo, setMotivo] = useState("");
    const [processando, setProcessando] = useState(false);
    const enviando = useRef(false);
    const gerencial = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    async function confirmarEstorno() {
        if (!estorno || !motivo.trim() || enviando.current) return;
        enviando.current = true; setProcessando(true); setErro("");
        try {
            await estornarPagamentoConta(contaId, estorno.id, motivo.trim());
            const conta = await buscarContaPagar(contaId);
            setEstorno(null); setResultado(null); setTentativa(n => n + 1); onAlterado?.(conta);
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível concluir o estorno. Verifique e tente novamente com o mesmo motivo.")); }
        finally { enviando.current = false; setProcessando(false); }
    }
    useEffect(() => {
        const controller = new AbortController();
        listarPagamentosConta(contaId, pagina, controller.signal).then(r => {
            if (!controller.signal.aborted) { setResultado(r); setErro(""); }
        }).catch(e => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível consultar os pagamentos.")); });
        return () => controller.abort();
    }, [contaId, pagina, tentativa]);
    return <Stack spacing={1.5} component="section" aria-label="Histórico de pagamentos">
        <Typography component="h3" variant="subtitle2">Histórico de pagamentos</Typography>
        <Typography variant="caption" color="text.secondary">Mais recentes pela data da baixa · Estornos vinculados à operação original.</Typography>
        {erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</Button>}>{erro}</Alert>
            : !resultado ? <Typography variant="body2" role="status">Consultando pagamentos…</Typography>
            : resultado.items.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhuma baixa agrupada registrada. Pagamentos antigos permanecem no extrato e no último pagamento legado.</Typography>
            : <Stack component="ol" spacing={2} sx={{ listStyle: "none", p: 0, m: 0 }}>{resultado.items.map(p => <Box component="li" key={p.id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Pagamento #{p.id} · <Box component="time" dateTime={p.dataPagamento}>{formatarData(p.dataPagamento)}</Box></Typography>
                    <Chip size="small" variant="outlined" color={p.estado === "CONFIRMADO" ? "success" : "default"} label={p.estado === "CONFIRMADO" ? "Confirmado" : "Estornado"} />
                </Stack>
                <Typography variant="body2">Principal quitado: {moeda.format(p.principalQuitado)}</Typography>
                <Typography variant="body2">Juros: {moeda.format(p.juros)} · Multa: {moeda.format(p.multa)} · Desconto: {moeda.format(p.desconto)}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Total pago: {moeda.format(p.totalPago)}</Typography>
                <Typography variant="caption" component="p" color="text.secondary">Data da baixa: {formatarData(p.dataPagamento)}</Typography>
                <Typography variant="caption" component="p" color="text.secondary">Registrado por {p.usuarioNome} · {formatarDataHora(p.dataCriacao)}</Typography>
                <Divider sx={{ my: 1 }} />
                {p.origens.map(o => <Box key={o.movimentoId} sx={{ mb: 0.75 }}>
                    <Typography variant="body2">{o.contaFinanceiraNome}: <strong>{moeda.format(o.valor)}</strong></Typography>
                    <Typography variant="caption" color="text.secondary">Movimento #{o.movimentoId}{o.estornada ? " · Estornado" : ""}</Typography>
                </Box>)}
                {p.estado === "ESTORNADO" && <Box sx={{ borderTop: 1, borderColor: "divider", mt: 1, pt: 1 }}>
                    <Typography variant="subtitle2">Estorno desta baixa #{p.id}</Typography>
                    <Typography variant="caption" component="p" color="text.secondary">{formatarDataHora(p.dataEstorno)} · {p.usuarioEstornoNome ?? "Responsável não informado"}</Typography>
                    <Typography variant="body2">Motivo: {p.motivoEstorno ?? "Não informado"}</Typography>
                </Box>}
                <Typography variant="caption" color="text.secondary">Operação: {p.chaveRequisicao}</Typography>
                {gerencial && p.estado === "CONFIRMADO" && <Button size="small" sx={{ display: "flex", mt: 1 }}
                    onClick={() => { setEstorno(p); setMotivo(""); setErro(""); }}>Estornar baixa #{p.id}</Button>}
            </Box>)}</Stack>}
        {resultado && resultado.totalPages > 1 && <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Button disabled={pagina === 0} onClick={() => { setResultado(null); setPagina(p => p - 1); }}>Anterior</Button>
            <Typography variant="caption">{pagina + 1} de {resultado.totalPages}</Typography>
            <Button disabled={pagina + 1 >= resultado.totalPages} onClick={() => { setResultado(null); setPagina(p => p + 1); }}>Próxima</Button>
        </Stack>}
        <Dialog open={!!estorno} onClose={processando ? undefined : () => setEstorno(null)} fullWidth maxWidth="xs" aria-labelledby="estornar-baixa-titulo">
            <DialogTitle id="estornar-baixa-titulo">Estornar baixa #{estorno?.id}?</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                <Typography variant="body2">Serão devolvidos {moeda.format(estorno?.totalPago ?? 0)} às origens desta baixa e {moeda.format(estorno?.principalQuitado ?? 0)} voltarão ao principal pendente. As demais baixas serão preservadas.</Typography>
                <TextField required fullWidth multiline minRows={2} label="Motivo do estorno" value={motivo} disabled={processando}
                    onChange={e => setMotivo(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
                {erro && <Alert severity="error">{erro}</Alert>}
            </Stack></DialogContent>
            <DialogActions><Button disabled={processando} onClick={() => setEstorno(null)}>Cancelar</Button>
                <Button variant="contained" disabled={processando || !motivo.trim()} onClick={() => void confirmarEstorno()}>{processando ? "Estornando…" : "Confirmar estorno"}</Button></DialogActions>
        </Dialog>
    </Stack>;
}
