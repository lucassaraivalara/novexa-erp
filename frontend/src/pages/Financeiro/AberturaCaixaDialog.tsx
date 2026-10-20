import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Skeleton, Stack, TextField, Typography,
} from "@mui/material";
import { abrirSessaoCaixa, buscarContextoAbertura, mensagemCaixa } from "../../services/caixaService";
import type { AberturaContexto, CaixaResumo } from "../../types/caixa";
import { centavosDinheiro as centavos } from "./cofreFormulario";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dinheiro = (centavos: number) => moeda.format(centavos / 100);

type Props = { onClose: () => void; onSucesso: (sessaoId: number) => void; caixasAtivos: CaixaResumo[]; aviso?: string };

export default function AberturaCaixaDialog({ onClose, onSucesso, caixasAtivos, aviso }: Props) {
    const [caixaId, setCaixaId] = useState<number | "">(caixasAtivos.length === 1 ? caixasAtivos[0].id : "");
    const [contexto, setContexto] = useState<AberturaContexto | null>(null);
    const [carregando, setCarregando] = useState(caixasAtivos.length === 1);
    const [falhaContexto, setFalhaContexto] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [saldo, setSaldo] = useState("");
    const [usarTroco, setUsarTroco] = useState(false);
    const [origem, setOrigem] = useState("COFRE");
    const [cofreId, setCofreId] = useState<number | "">("");
    const [retiradaMista, setRetiradaMista] = useState("");
    const [observacao, setObservacao] = useState("");
    const [processando, setProcessando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);
    const operacao = useRef<{ dados: string; chave: string } | null>(null);
    const alerta = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (caixaId === "") return;
        const c = new AbortController();
        buscarContextoAbertura(caixaId, c.signal).then(ctx => {
            if (c.signal.aborted) return;
            setContexto(ctx); setFalhaContexto("");
            setSaldo(ctx.saldoSugerido.toFixed(2).replace(".", ","));
            setUsarTroco(!!ctx.trocoAnterior);
            setCofreId(ctx.cofres.length === 1 ? ctx.cofres[0].id : "");
            setOrigem(ctx.cofres.some(c => c.saldoAtual > 0) ? "COFRE" : "APORTE");
        }).catch(e => {
            if (!c.signal.aborted) setFalhaContexto(mensagemCaixa(e, "Não foi possível consultar a origem do fundo. Tente novamente."));
        }).finally(() => { if (!c.signal.aborted) setCarregando(false); });
        return () => c.abort();
    }, [caixaId, tentativa]);

    useEffect(() => { if (erro) alerta.current?.focus(); }, [erro]);

    const total = centavos(saldo);
    const herdado = contexto?.trocoAnterior ? Math.round(contexto.trocoAnterior.valor * 100) : 0;
    const troco = usarTroco ? herdado : 0;
    const complemento = total === null ? 0 : Math.max(0, total - troco);
    const retirada = complemento === 0 || origem === "APORTE" ? 0 : origem === "COFRE" ? complemento : centavos(retiradaMista);
    const aporte = retirada === null ? null : complemento - retirada;
    const conta = contexto?.cofres.find(c => c.id === cofreId);
    const insuficiente = retirada !== null && retirada > 0 && conta && retirada > Math.round(conta.saldoAtual * 100);

    function selecionarCaixa(id: number | "") {
        setCaixaId(id); setContexto(null); setCarregando(id !== ""); setErro(""); setFalhaContexto("");
        setObservacao(""); setRetiradaMista(""); operacao.current = null;
    }

    async function confirmar(e: FormEvent) {
        e.preventDefault();
        if (ocupado.current) return;
        setErro("");
        let motivo = "";
        if (!contexto || caixaId === "" || contexto.sessaoAberta || !contexto.caixaAtivo) motivo = "Selecione um Caixa ativo sem sessão aberta e consulte o contexto.";
        else if (total === null) motivo = "Informe o fundo inicial não negativo com até duas casas decimais, sem separador de milhar.";
        else if (total < herdado) motivo = `Existem ${dinheiro(herdado)} de troco sob custódia deste Caixa. Regularize o excedente antes de abrir com valor menor.`;
        else if (herdado > 0 && !usarTroco) motivo = "Confirme a utilização integral do troco da sessão anterior.";
        else if (complemento > 0 && !contexto.podeMovimentarCofre) motivo = "Solicite a um administrador ou gestor a retirada do cofre ou o aporte externo.";
        else if (retirada === null || aporte === null || aporte < 0 || (origem === "MISTO" && complemento > 0 && (retirada === 0 || aporte === 0))) motivo = "Informe a parcela do cofre menor que o complemento; o restante será aporte externo.";
        else if (retirada > 0 && !conta) motivo = "Selecione um Cofre com saldo suficiente.";
        else if (insuficiente) motivo = `Saldo insuficiente no ${conta?.nome}.`;
        else if (aporte > 0 && !observacao.trim()) motivo = "Informe o motivo do aporte externo.";
        if (motivo) { setErro(motivo); return; }
        const pedido = {
            saldoInicial: (total as number) / 100, confirmarTroco: usarTroco && herdado > 0,
            valorRetiradoCofre: (retirada as number) / 100, contaCofreId: retirada ? Number(cofreId) : null,
            valorAporteExterno: (aporte as number) / 100, observacaoAporte: aporte ? observacao.trim() : null,
        };
        const dados = JSON.stringify({ caixaId, sessaoOrigem: contexto?.trocoAnterior?.sessaoId, ...pedido });
        if (operacao.current?.dados !== dados) operacao.current = { dados, chave: crypto.randomUUID() };
        ocupado.current = true; setProcessando(true);
        try {
            const sessao = await abrirSessaoCaixa(Number(caixaId), { ...pedido, chaveRequisicao: operacao.current.chave });
            onSucesso(sessao.id);
        } catch (e) { setErro(mensagemCaixa(e, "Não foi possível abrir o Caixa. Confira as origens e tente novamente.")); }
        finally { ocupado.current = false; setProcessando(false); }
    }

    return <Dialog open fullWidth maxWidth="sm" aria-labelledby="caixa-abertura-titulo" onClose={() => !ocupado.current && onClose()}>
        <form onSubmit={confirmar}>
            <DialogTitle id="caixa-abertura-titulo">Abrir Caixa</DialogTitle>
            <DialogContent dividers sx={{ overscrollBehavior: "contain" }}>
                <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                    {aviso && <Alert severity="info">{aviso}</Alert>}
                    {erro && <Alert ref={alerta} tabIndex={-1} severity="error">{erro}</Alert>}
                    <Typography variant="body2" color="text.secondary">Confira o dinheiro físico e sua origem. Nenhum valor será movimentado antes de confirmar a abertura.</Typography>
                    <TextField select fullWidth name="caixaAbertura" label="Caixa" value={caixaId} disabled={processando}
                        onChange={e => selecionarCaixa(e.target.value === "" ? "" : Number(e.target.value))} helperText={caixasAtivos.length ? undefined : "Nenhum Caixa ativo está disponível."}>
                        <MenuItem value="">Selecione</MenuItem>{caixasAtivos.map(c => <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>)}
                    </TextField>
                    {carregando && <Skeleton aria-label="Consultando origens da abertura" variant="rounded" height={96} />}
                    {falhaContexto && <Alert severity="error" action={<Button color="inherit" onClick={() => { setContexto(null); setFalhaContexto(""); setCarregando(true); setTentativa(t => t + 1); }}>Tentar novamente</Button>}>{falhaContexto}</Alert>}
                    {contexto && <>
                        {contexto.sessaoAberta ? <Alert severity="warning">Já existe a sessão #{contexto.sessaoAbertaId} aberta neste Caixa.</Alert> : <>
                            {contexto.trocoAnterior ? <Box>
                                <Typography variant="subtitle2">Troco disponível da sessão anterior: {dinheiro(herdado)}</Typography>
                                <Typography variant="body2" color="text.secondary">Sessão #{contexto.trocoAnterior.sessaoId} · fechada em {dataHora.format(new Date(contexto.trocoAnterior.dataFechamento))}</Typography>
                                <FormControlLabel label="Usar troco da sessão anterior" control={<Checkbox checked={usarTroco} disabled={processando} onChange={e => setUsarTroco(e.target.checked)} />} />
                            </Box> : <Typography variant="body2" color="text.secondary">Sem troco herdado disponível. Informe a origem de qualquer fundo inicial.</Typography>}
                            <TextField fullWidth name="saldoInicial" autoComplete="off" label="Fundo inicial (R$)" value={saldo} disabled={processando}
                                slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => setSaldo(e.target.value)} helperText="Total físico após somar todas as origens, sem separador de milhar." />
                            {complemento > 0 && <>
                                <Typography variant="subtitle2">Complemento necessário: {dinheiro(complemento)}</Typography>
                                {!contexto.podeMovimentarCofre && <Alert severity="info">Retirada do cofre e aporte externo exigem administrador ou gestor.</Alert>}
                                <FormControl disabled={processando || !contexto.podeMovimentarCofre}>
                                    <FormLabel id="abertura-origem-label">Origem do complemento</FormLabel>
                                    <RadioGroup aria-labelledby="abertura-origem-label" value={origem} onChange={e => setOrigem(e.target.value)}>
                                        <FormControlLabel value="COFRE" control={<Radio />} label="COFRE" />
                                        <FormControlLabel value="APORTE" control={<Radio />} label="Aporte externo" />
                                        <FormControlLabel value="MISTO" control={<Radio />} label="COFRE e aporte externo" />
                                    </RadioGroup>
                                </FormControl>
                                {origem !== "APORTE" && <TextField select fullWidth name="cofreOrigem" label="Cofre de origem" value={cofreId} disabled={processando || !contexto.podeMovimentarCofre}
                                    error={!!insuficiente} helperText={insuficiente ? `Saldo disponível: ${moeda.format(conta?.saldoAtual ?? 0)}. Insuficiente para esta retirada.` : conta ? `Saldo disponível: ${moeda.format(conta.saldoAtual)}. Débito somente ao confirmar.` : "Selecione o destino; a retirada só ocorre ao confirmar."} onChange={e => setCofreId(e.target.value === "" ? "" : Number(e.target.value))}>
                                    <MenuItem value="">Selecione um Cofre</MenuItem>{contexto.cofres.map(c => <MenuItem key={c.id} value={c.id} sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{c.nome} · disponível {moeda.format(c.saldoAtual)}</MenuItem>)}
                                </TextField>}
                                {origem === "MISTO" && <TextField fullWidth name="retiradaMista" autoComplete="off" label="Valor a retirar do cofre (R$)" value={retiradaMista} disabled={processando || !contexto.podeMovimentarCofre}
                                    slotProps={{ htmlInput: { inputMode: "decimal" } }} onChange={e => setRetiradaMista(e.target.value)} helperText="O restante do complemento será registrado como aporte externo." />}
                                {origem !== "COFRE" && <TextField fullWidth multiline minRows={2} name="observacaoAporte" autoComplete="off" label="Motivo do aporte externo" value={observacao} disabled={processando || !contexto.podeMovimentarCofre}
                                    slotProps={{ htmlInput: { maxLength: 500 } }} onChange={e => setObservacao(e.target.value)} helperText="Obrigatório. O aporte não movimenta Conta Financeira." />}
                            </>}
                            <Divider />
                            <Box component="section" aria-labelledby="abertura-composicao-titulo" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                <Typography id="abertura-composicao-titulo" variant="subtitle2">Composição da abertura · {contexto.descricaoCaixa}</Typography>
                                <Box component="dl" sx={{ m: 0, mt: 1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1 }} aria-live="polite">
                                    <Typography component="dt" variant="body2">Troco herdado</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{dinheiro(troco)}</Typography>
                                    <Typography component="dt" variant="body2" sx={{ overflowWrap: "anywhere" }}>{conta?.nome ?? "Retirada do cofre"}</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{dinheiro(retirada ?? 0)}</Typography>
                                    <Typography component="dt" variant="body2">Aporte externo</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{dinheiro(Math.max(0, aporte ?? 0))}</Typography>
                                    <Typography component="dt" sx={{ fontWeight: 700 }}>Fundo inicial</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{total === null ? "—" : dinheiro(total)}</Typography>
                                </Box>
                            </Box>
                        </>}
                    </>}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap" }}>
                <Button type="button" disabled={processando} onClick={onClose}>Cancelar</Button>
                <Button type="submit" variant="contained" disabled={processando || carregando || !contexto || contexto.sessaoAberta || !contexto.caixaAtivo}>{processando ? "Abrindo…" : "Confirmar abertura"}</Button>
            </DialogActions>
        </form>
    </Dialog>;
}
