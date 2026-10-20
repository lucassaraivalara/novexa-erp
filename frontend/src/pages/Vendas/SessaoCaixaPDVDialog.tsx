import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    Stack,
    Typography,
} from "@mui/material";
import { listarCaixas, listarSessoesAbertas, mensagemCaixa } from "../../services/caixaService";
import type { CaixaResumo, SessaoCaixaAberta } from "../../types/caixa";
import { obterSessao } from "../../utils/auth/sessao";
import { decidirSessaoCaixa } from "./pdv";
import AberturaCaixaDialog from "../Financeiro/AberturaCaixaDialog";

type Modo = "CARREGANDO" | "ABRIR" | "SELECIONAR" | "ERRO";

type Props = {
    resolvida: boolean;
    onResolvida: (sessaoId: number) => void;
};

const horario = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function SessaoCaixaPDVDialog({ resolvida, onResolvida }: Props) {
    const usuarioId = obterSessao()?.id;
    const navigate = useNavigate();
    const [modo, setModo] = useState<Modo>("CARREGANDO");
    const [sessoes, setSessoes] = useState<SessaoCaixaAberta[]>([]);
    const [caixas, setCaixas] = useState<CaixaResumo[]>([]);
    const [sessaoId, setSessaoId] = useState<number | null>(null);
    const [erro, setErro] = useState("");

    const carregar = useCallback((signal?: AbortSignal) => {
        return listarSessoesAbertas(signal).then(async (abertas) => {
            const decisao = decidirSessaoCaixa(abertas, usuarioId);
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
            const ativas = (await listarCaixas(signal)).filter(caixa => caixa.ativo
                && !abertas.some(sessao => sessao.caixaId === caixa.id));
            setCaixas(ativas);
            setModo("ABRIR");
        }).catch((e) => {
            if (signal?.aborted) return;
            setErro(mensagemCaixa(e, "Não foi possível identificar o Caixa operacional."));
            setModo("ERRO");
        });
    }, [onResolvida, usuarioId]);

    function recarregar() {
        setModo("CARREGANDO");
        setErro("");
        void carregar();
    }

    useEffect(() => {
        if (resolvida) return;
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, [carregar, resolvida]);

    if (resolvida) return null;
    if (modo === "ABRIR") return <AberturaCaixaDialog caixasAtivos={caixas}
        aviso="Não há sessão de caixa aberta para o seu usuário."
        onClose={() => navigate("/dashboard")} onSucesso={onResolvida} />;

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
                    <Button variant="contained" onClick={recarregar}>Tentar novamente</Button>
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

        </Dialog>
    );
}
