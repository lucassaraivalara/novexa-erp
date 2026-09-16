import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { abrirSessaoCaixa, listarCaixas, listarSessoesAbertas, mensagemCaixa } from "../../services/caixaService";
import type { CaixaResumo, SessaoCaixaAberta } from "../../types/caixa";
import { decidirSessaoCaixa, decimal } from "./pdv";

type Modo = "CARREGANDO" | "ABRIR" | "SELECIONAR" | "ERRO";

type Props = {
    resolvida: boolean;
    onResolvida: (sessaoId: number) => void;
};

const horario = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function SessaoCaixaPDVDialog({ resolvida, onResolvida }: Props) {
    const [modo, setModo] = useState<Modo>("CARREGANDO");
    const [sessoes, setSessoes] = useState<SessaoCaixaAberta[]>([]);
    const [caixas, setCaixas] = useState<CaixaResumo[]>([]);
    const [sessaoId, setSessaoId] = useState<number | null>(null);
    const [caixaId, setCaixaId] = useState<number | null>(null);
    const [saldoInicial, setSaldoInicial] = useState("");
    const [erro, setErro] = useState("");
    const [processando, setProcessando] = useState(false);

    const carregar = useCallback(async (signal?: AbortSignal) => {
        setModo("CARREGANDO");
        setErro("");
        try {
            const abertas = await listarSessoesAbertas(signal);
            const decisao = decidirSessaoCaixa(abertas);
            if (decisao.fluxo === "USAR_UNICA") {
                onResolvida(decisao.sessao.sessaoId);
                return;
            }
            if (decisao.fluxo === "SELECIONAR") {
                setSessoes(decisao.sessoes);
                setSessaoId(null);
                setModo("SELECIONAR");
                return;
            }
            const ativas = (await listarCaixas(signal)).filter(caixa => caixa.ativo);
            setCaixas(ativas);
            setCaixaId(ativas.length === 1 ? ativas[0].id : null);
            setModo("ABRIR");
        } catch (e) {
            if (signal?.aborted) return;
            setErro(mensagemCaixa(e, "Não foi possível identificar o Caixa operacional."));
            setModo("ERRO");
        }
    }, [onResolvida]);

    useEffect(() => {
        if (resolvida) return;
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, [carregar, resolvida]);

    async function abrir(evento: FormEvent) {
        evento.preventDefault();
        const centavos = decimal(saldoInicial, 2);
        if (caixaId === null) {
            setErro("Selecione o Caixa que será aberto.");
            return;
        }
        if (centavos === null) {
            setErro("Informe um saldo inicial válido, com até duas casas decimais.");
            return;
        }
        setProcessando(true);
        setErro("");
        try {
            const criada = await abrirSessaoCaixa(caixaId, { saldoInicial: centavos / 100 });
            onResolvida(criada.id);
        } catch (e) {
            setErro(mensagemCaixa(e, "Não foi possível abrir o Caixa."));
        } finally {
            setProcessando(false);
        }
    }

    if (resolvida) return null;

    return (
        <Dialog open fullWidth maxWidth="xs" aria-labelledby="sessao-caixa-pdv-titulo">
            {modo === "CARREGANDO" && <DialogContent>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 2 }}>
                    <CircularProgress size={24} />
                    <Typography>Identificando Caixa aberto…</Typography>
                </Stack>
            </DialogContent>}

            {modo === "ERRO" && <>
                <DialogTitle id="sessao-caixa-pdv-titulo">Caixa operacional</DialogTitle>
                <DialogContent><Alert severity="error">{erro}</Alert></DialogContent>
                <DialogActions>
                    <Button component={Link} to="/dashboard">Voltar ao ERP</Button>
                    <Button variant="contained" onClick={() => void carregar()}>Tentar novamente</Button>
                </DialogActions>
            </>}

            {modo === "SELECIONAR" && <>
                <DialogTitle id="sessao-caixa-pdv-titulo">Selecionar Caixa</DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <List disablePadding>
                        {sessoes.map(sessao => <ListItemButton key={sessao.sessaoId}
                            selected={sessaoId === sessao.sessaoId} onClick={() => setSessaoId(sessao.sessaoId)}>
                            <ListItemText primary={sessao.descricaoCaixa}
                                secondary={`${sessao.operadorAbertura.nome} · ${horario.format(new Date(sessao.dataHoraAbertura))}`} />
                        </ListItemButton>)}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button component={Link} to="/dashboard">Voltar ao ERP</Button>
                    <Button variant="contained" disabled={sessaoId === null}
                        onClick={() => sessaoId !== null && onResolvida(sessaoId)}>Usar sessão</Button>
                </DialogActions>
            </>}

            {modo === "ABRIR" && <form onSubmit={abrir}>
                <DialogTitle id="sessao-caixa-pdv-titulo">Abrir Caixa</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {erro && <Alert severity="error">{erro}</Alert>}
                        {caixas.length === 0 ? <Alert severity="warning">Nenhum Caixa ativo está disponível.</Alert> : <>
                            {caixas.length === 1
                                ? <Typography variant="body2">{caixas[0].descricao}</Typography>
                                : <TextField select required autoFocus label="Caixa" value={caixaId ?? ""}
                                    onChange={evento => setCaixaId(Number(evento.target.value))}>
                                    {caixas.map(caixa => <MenuItem key={caixa.id} value={caixa.id}>{caixa.descricao}</MenuItem>)}
                                </TextField>}
                            <TextField required autoFocus={caixas.length === 1} label="Saldo inicial (R$)"
                                value={saldoInicial} disabled={processando}
                                onChange={evento => setSaldoInicial(evento.target.value)}
                                slotProps={{ htmlInput: { inputMode: "decimal" } }} />
                        </>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button component={Link} to="/dashboard" disabled={processando}>Voltar ao ERP</Button>
                    <Button type="submit" variant="contained" disabled={processando || caixas.length === 0}>
                        {processando ? "Abrindo…" : "Abrir Caixa"}
                    </Button>
                </DialogActions>
            </form>}
        </Dialog>
    );
}
