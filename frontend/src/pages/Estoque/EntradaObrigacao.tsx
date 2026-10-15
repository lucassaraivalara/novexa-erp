import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, MenuItem, Stack, TextField, Typography } from "@mui/material";
import StatusChip from "../../components/ui/StatusChip";
import { consultarObrigacaoEntrada, desvincularObrigacaoEntrada, gerarObrigacaoEntrada, vincularObrigacaoEntrada } from "../../services/entradaMercadoriaService";
import { listarContasPagar } from "../../services/contaPagarService";
import { obterMensagemDaApi } from "../../services/produtoService";
import type { EntradaMercadoria, GerarObrigacaoEntrada, ObrigacaoEntrada } from "../../types/entradaMercadoria";
import type { ContaPagar } from "../../types/contaPagar";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const situacoes = { ABERTA: "Aberta", PAGA: "Paga", CANCELADA: "Cancelada" };

export default function EntradaObrigacao({ entrada }: { entrada: EntradaMercadoria }) {
    const [obrigacao, setObrigacao] = useState<ObrigacaoEntrada | null>(null);
    const [erro, setErro] = useState("");
    const [revisao, setRevisao] = useState(0);
    const [modo, setModo] = useState<"gerar" | "vincular" | "desvincular" | null>(null);
    const [descricao, setDescricao] = useState(`Entrada de mercadoria #${entrada.id}`);
    const [valor, setValor] = useState(String(entrada.valorTotal).replace(".", ","));
    const [vencimento, setVencimento] = useState("");
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(0);
    const [contas, setContas] = useState<ContaPagar[]>([]);
    const [contaId, setContaId] = useState<number | "">("");
    const [erroBusca, setErroBusca] = useState("");
    const [carregandoBusca, setCarregandoBusca] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const ocupado = useRef(false);
    const tentativa = useRef<GerarObrigacaoEntrada | null>(null);
    const [incerta, setIncerta] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        consultarObrigacaoEntrada(entrada.id, controller.signal).then(r => {
            if (!controller.signal.aborted) { setObrigacao(r); setErro(""); }
        }).catch(e => { if (!controller.signal.aborted) setErro(obterMensagemDaApi(e, "Não foi possível consultar a obrigação.")); });
        return () => controller.abort();
    }, [entrada.id, revisao]);

    useEffect(() => {
        if (modo !== "vincular") return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregandoBusca(true); setErroBusca("");
            listarContasPagar({ busca: busca.trim() || undefined,
                page: pagina, size: 10, sort: "dataVencimento,asc" }, controller.signal).then(r => {
                if (!controller.signal.aborted) {
                    setContas(r.items); setTotalPaginas(r.totalPages);
                }
            }).catch(e => { if (!controller.signal.aborted) { setContas([]); setErroBusca(obterMensagemDaApi(e, "Não foi possível buscar contas.")); } })
                .finally(() => { if (!controller.signal.aborted) setCarregandoBusca(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [modo, entrada.fornecedorId, busca, pagina, revisao]);

    function abrir(proximo: typeof modo) {
        setErro(""); setModo(proximo);
        if (proximo === "vincular") { setContaId(""); setPagina(0); setBusca(""); setContas([]); setCarregandoBusca(true); }
    }
    async function confirmar(evento: FormEvent) {
        evento.preventDefault();
        if (!modo || ocupado.current) return;
        if (modo === "gerar" && !tentativa.current) {
            const numero = Number(valor.replace(",", "."));
            if (!Number.isFinite(numero) || numero <= 0 || Math.abs(numero * 100 - Math.round(numero * 100)) > 0.000001) {
                setErro("Informe um valor positivo com até duas casas decimais."); return;
            }
            tentativa.current = { chaveRequisicao: crypto.randomUUID(), descricao: descricao.trim(), valor: numero, dataVencimento: vencimento };
        }
        ocupado.current = true; setSalvando(true); setErro("");
        try {
            const resposta = modo === "gerar" ? await gerarObrigacaoEntrada(entrada.id, tentativa.current!)
                : modo === "vincular" ? await vincularObrigacaoEntrada(entrada.id, Number(contaId))
                    : await desvincularObrigacaoEntrada(entrada.id, obrigacao!.conta!.id);
            setObrigacao(resposta); setModo(null); tentativa.current = null; setIncerta(false);
        } catch (e) {
            // Mantém UUID e payload de geração até a reconciliação, inclusive ao fechar/reabrir o diálogo.
            if (modo === "gerar") {
                const resultadoIncerto = !axios.isAxiosError(e) || !e.response || e.response.status >= 500;
                setIncerta(resultadoIncerto);
                if (!resultadoIncerto) tentativa.current = null;
            }
            setErro(obterMensagemDaApi(e, "Não foi possível concluir. Consulte o vínculo ou repita a operação."));
        } finally { ocupado.current = false; setSalvando(false); }
    }
    const titulo = modo === "gerar" ? "Gerar conta a pagar" : modo === "vincular" ? "Vincular conta existente" : "Desvincular conta";
    return <Stack component="section" aria-label="Obrigação financeira da entrada" spacing={1.25} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>Conta a pagar</Typography>
        {erro && !modo && <Alert severity="error">{erro}</Alert>}
        {!obrigacao ? <Typography variant="body2">Consultando obrigação…</Typography> : obrigacao.conta ? <>
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="body2">{obrigacao.origem === "GERADA" ? "Conta gerada pela entrada" : "Conta preexistente vinculada"} #{obrigacao.conta.id}</Typography>
                <StatusChip status={obrigacao.conta.status} label={situacoes[obrigacao.conta.status]} />
            </Stack>
            <Typography variant="body2">{obrigacao.conta.descricao} · {moeda.format(obrigacao.conta.valor)}</Typography>
            <Link href={`/financeiro/contas-pagar?contaId=${obrigacao.conta.id}`} target="_blank" rel="noopener noreferrer">Abrir conta a pagar (nova aba)</Link>
            {obrigacao.motivoBloqueioCancelamento && entrada.status === "CONFIRMADA" && <Alert severity="info">{obrigacao.motivoBloqueioCancelamento}</Alert>}
            {obrigacao.podeDesvincular && <Box><Button size="small" onClick={() => abrir("desvincular")}>Desvincular conta</Button></Box>}
        </> : <Typography variant="body2" color="text.secondary">Sem obrigação vinculada. Confirmar a entrada não cria dívida nem comprova pagamento.</Typography>}
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {obrigacao?.podeGerar && <Button size="small" variant="outlined" onClick={() => abrir("gerar")}>Gerar conta a pagar</Button>}
            {obrigacao?.podeVincular && <Button size="small" onClick={() => abrir("vincular")}>Vincular conta existente</Button>}
            <Button size="small" disabled={salvando} onClick={() => setRevisao(n => n + 1)}>Atualizar vínculo</Button>
        </Stack>
        <Dialog open={modo !== null} onClose={salvando ? undefined : () => setModo(null)} fullWidth maxWidth="sm" aria-labelledby="obrigacao-entrada-titulo">
            <form onSubmit={confirmar}>
                <DialogTitle id="obrigacao-entrada-titulo">{titulo}</DialogTitle>
                <DialogContent dividers><Stack spacing={2}>
                    <Typography variant="body2">Esta ação não registra pagamento nem movimenta saldo.</Typography>
                    {erro && <Alert severity="error">{erro}</Alert>}
                    {modo === "gerar" && <>
                        {incerta && <Alert severity="warning">Confira o vínculo antes de repetir. A nova tentativa usará os mesmos dados.</Alert>}
                        <TextField required autoFocus label="Descrição" value={descricao} disabled={salvando || incerta} onChange={e => setDescricao(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
                        <TextField required label="Valor financeiro (R$)" value={valor} disabled={salvando || incerta} onChange={e => setValor(e.target.value)}
                            helperText="Sugestão: total operacional. Revise o valor; frete e impostos não são acrescentados automaticamente." slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                        <TextField required type="date" label="Vencimento" value={vencimento} disabled={salvando || incerta} onChange={e => setVencimento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                    </>}
                    {modo === "vincular" && <>
                        <Typography variant="body2">Selecione uma conta aberta ou paga do mesmo fornecedor, ou sem fornecedor informado. Confirme que corresponde a esta entrada. Vincular uma conta paga não registra outro pagamento.</Typography>
                        <TextField label="Buscar conta por descrição ou documento" value={busca} disabled={salvando} onChange={e => {
                            setBusca(e.target.value); setPagina(0); setContaId(""); setContas([]); setCarregandoBusca(true);
                        }} />
                        {erroBusca && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Button>}>{erroBusca}</Alert>}
                        <TextField select required label="Conta a pagar existente" value={contaId} disabled={salvando || carregandoBusca || !!erroBusca} onChange={e => setContaId(Number(e.target.value))}
                            helperText={carregandoBusca ? "Buscando contas…" : !contas.length ? "Nenhuma conta nesta página." : undefined}>
                            {contas.map(c => <MenuItem key={c.id} value={c.id} disabled={c.status === "CANCELADA" || !!c.entradaMercadoriaId || (!!c.fornecedorId && c.fornecedorId !== entrada.fornecedorId)} sx={{ whiteSpace: "normal" }}>
                                #{c.id} · {c.descricao} · {moeda.format(c.valor)} · {situacoes[c.status]} · {c.fornecedorNome ?? "Sem fornecedor informado"}{c.entradaMercadoriaId ? " · Já vinculada" : ""}
                            </MenuItem>)}
                        </TextField>
                        <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
                            <Button disabled={salvando || carregandoBusca || pagina === 0} onClick={() => { setPagina(p => p - 1); setContaId(""); setCarregandoBusca(true); }}>Anterior</Button>
                            <Typography variant="caption">Página {pagina + 1}</Typography>
                            <Button disabled={salvando || carregandoBusca || pagina + 1 >= totalPaginas} onClick={() => { setPagina(p => p + 1); setContaId(""); setCarregandoBusca(true); }}>Próxima</Button>
                        </Stack>
                    </>}
                    {modo === "desvincular" && <Typography>A conta preexistente será preservada, com seu estado e histórico financeiro.</Typography>}
                </Stack></DialogContent>
                <DialogActions><Button disabled={salvando} onClick={() => setModo(null)}>Voltar</Button>
                    <Button type="submit" variant="contained" disabled={salvando || (modo === "vincular" && (!contaId || carregandoBusca || !!erroBusca))}>
                        {salvando ? "Salvando…" : incerta && modo === "gerar" ? "Repetir com os mesmos dados" : titulo}
                    </Button></DialogActions>
            </form>
        </Dialog>
    </Stack>;
}
