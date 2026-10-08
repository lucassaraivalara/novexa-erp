import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Alert, Box, Button, CircularProgress, Divider, Drawer, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import CadastroDialog from "../../components/ui/CadastroDialog";
import StatusChip from "../../components/ui/StatusChip";
import { buscarContaReceber, cancelarContaReceber, estornarRecebimentoConta, mensagemContaReceber } from "../../services/contaReceberService";
import type { ContaReceber } from "../../types/contaReceber";
import type { MovimentacaoFinanceira } from "../../types/contaFinanceira";
import { formatarData, moeda, podeCancelarConta, podeEditarConta, podeReceberConta, rotulosStatus } from "./contaReceberUtils";

type Props = { id: number; revisao: number; onFechar: () => void; onEditar: (conta: ContaReceber) => void;
    onReceber: (conta: ContaReceber) => void; onAlterada: (mensagem: string) => void };

export default function ContaReceberDetalhe({ id, revisao, onFechar, onEditar, onReceber, onAlterada }: Props) {
    const [conta, setConta] = useState<ContaReceber | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [acao, setAcao] = useState<{ tipo: "cancelar" } | { tipo: "estornar"; movimento: MovimentacaoFinanceira } | null>(null);
    const [motivo, setMotivo] = useState("");
    const [erroAcao, setErroAcao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [tentativa, setTentativa] = useState(0);
    const emAndamento = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        buscarContaReceber(id, controller.signal).then(resposta => {
            if (!controller.signal.aborted) { setConta(resposta); setErro(""); }
        }).catch(e => { if (!controller.signal.aborted) setErro(mensagemContaReceber(e, "Não foi possível carregar a conta.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [id, revisao, tentativa]);

    async function confirmar() {
        if (!conta || !acao || emAndamento.current) return;
        if (acao.tipo === "estornar" && !motivo.trim()) { setErroAcao("Informe o motivo do estorno."); return; }
        emAndamento.current = true; setSalvando(true); setErroAcao("");
        try {
            const resposta = acao.tipo === "cancelar" ? await cancelarContaReceber(conta.id)
                : await estornarRecebimentoConta(conta.id, acao.movimento.id, motivo.trim());
            setConta(resposta); setAcao(null);
            onAlterada(acao.tipo === "cancelar" ? "Conta cancelada." : "Recebimento estornado.");
        } catch (e) { setErroAcao(mensagemContaReceber(e, "Não foi possível concluir a operação.")); }
        finally { emAndamento.current = false; setSalvando(false); }
    }

    return <>
        <Drawer anchor="right" open onClose={salvando ? undefined : onFechar}
            slotProps={{ paper: { "aria-labelledby": "conta-receber-detalhe-titulo", sx: { width: { xs: "100%", sm: 600 }, maxWidth: "100vw" } } }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography id="conta-receber-detalhe-titulo" component="h2" variant="h6">Conta a receber #{id}</Typography>
                <IconButton aria-label="Fechar detalhe" onClick={onFechar} disabled={salvando}><CloseRoundedIcon /></IconButton>
            </Stack>
            <Stack spacing={2} sx={{ p: { xs: 2, sm: 2.5 }, flex: 1, overflowY: "auto", minHeight: 0, overflowWrap: "anywhere" }}>
                {carregando && <CircularProgress size={24} aria-label="Carregando conta" />}
                {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => { setCarregando(true); setTentativa(n => n + 1); }}>Tentar novamente</Button>}>{erro}</Alert>}
                {conta && <>
                    <Stack spacing={0.5}>
                        <Typography variant="h6">{conta.descricao}</Typography>
                        <Typography variant="body2">{conta.cliente.nome}{!conta.cliente.ativo ? " (inativo)" : ""}</Typography>
                        {conta.cliente.cpfCnpj && <Typography variant="caption" color="text.secondary">{conta.cliente.cpfCnpj}</Typography>}
                        <Box><StatusChip status={conta.status} label={rotulosStatus[conta.status]} /></Box>
                    </Stack>
                    <Box component="dl" aria-label="Valores da conta" sx={{ m: 0, p: 1.5, bgcolor: "background.default", borderRadius: 1,
                        display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                        {[["Valor original", conta.valorOriginal], ["Já recebido", conta.valorRecebido], ["Saldo", conta.saldo]].map(([titulo, valor]) =>
                            <Box key={titulo} sx={{ minWidth: 0, gridColumn: titulo === "Saldo" ? "1 / -1" : undefined }}>
                                <Typography component="dt" variant="caption" color="text.secondary">{titulo}</Typography>
                                <Typography component="dd" sx={{ m: 0, fontWeight: titulo === "Saldo" ? 700 : 600, fontSize: titulo === "Saldo" ? 24 : 14,
                                    color: titulo === "Saldo" ? "primary.main" : "text.primary", fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(valor))}</Typography>
                            </Box>)}
                    </Box>
                    <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                        {[["Vencimento", formatarData(conta.dataVencimento)],
                            ["Emissão", formatarData(conta.dataEmissao)], ["Parcela", `${conta.numeroParcela}/${conta.totalParcelas}`],
                            ["Origem", conta.origem === "MANUAL" ? "Manual" : "Venda a prazo"],
                            ["Venda", conta.vendaId ? `#${conta.vendaId}` : "—"],
                            ["Criada em", formatarData(conta.dataCriacao, true)], ["Atualizada em", formatarData(conta.dataAtualizacao, true)]].map(([titulo, valor]) =>
                            <Box key={titulo} sx={{ minWidth: 0 }}><Typography component="dt" variant="caption" color="text.secondary">{titulo}</Typography>
                                <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{valor}</Typography></Box>)}
                    </Box>
                    {conta.observacao && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{conta.observacao}</Typography>}
                    {conta.origem === "VENDA_A_PRAZO" && <Typography variant="body2" color="text.secondary">Esta conta é controlada pela venda de origem.</Typography>}
                    <Divider />
                    <Typography variant="h6">Histórico de recebimentos</Typography>
                    {!conta.recebimentos.length && <Typography variant="body2" color="text.secondary">Nenhum recebimento registrado.</Typography>}
                    {conta.recebimentos.map(m => <Stack component="section" aria-label={`Recebimento ${m.id}`} key={m.id} spacing={0.75} sx={{ pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
                        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                            <Box><Typography variant="caption" color="text.secondary">Valor desta baixa</Typography>
                                <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moeda.format(m.valor)}</Typography></Box>
                            <StatusChip status={m.estornada ? "CANCELADA" : "RECEBIDA"} label={m.estornada ? "Estornado" : "Recebido"} />
                        </Stack>
                        <Typography variant="body2">Conta destino: {m.contaFinanceiraNome}</Typography>
                        <Typography variant="body2" color="text.secondary">{formatarData(m.dataMovimento)}</Typography>
                        <Typography variant="caption" color="text.secondary">#{m.id} · {m.usuarioNome} · {formatarData(m.dataCriacao, true)}</Typography>
                        {m.observacao && <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{m.observacao}</Typography>}
                        {m.estornada ? <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                            Estorno: {formatarData(m.dataEstorno, true)} · {m.usuarioEstornoNome}<br />{m.motivoEstorno}
                        </Typography> : conta.status !== "CANCELADA" && <Box><Tooltip title={`Estornar recebimento de ${moeda.format(m.valor)}`}><Button size="small" startIcon={<UndoRoundedIcon />}
                            aria-label={`Estornar recebimento de ${moeda.format(m.valor)}`}
                            onClick={() => { setMotivo(""); setErroAcao(""); setAcao({ tipo: "estornar", movimento: m }); }}>Estornar recebimento</Button></Tooltip></Box>}
                    </Stack>)}
                    <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", pt: 0.5 }}>
                        {podeReceberConta(conta) && <Button variant="contained" disableElevation onClick={() => onReceber(conta)}>Receber</Button>}
                        {podeEditarConta(conta) && <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => onEditar(conta)}>Editar</Button>}
                        {podeCancelarConta(conta) && <Button color="error" onClick={() => { setErroAcao(""); setAcao({ tipo: "cancelar" }); }}>Cancelar conta</Button>}
                    </Stack>
                </>}
            </Stack>
        </Drawer>
        {acao && <CadastroDialog aberto variante="compact" titulo={acao.tipo === "cancelar" ? "Cancelar conta?" : "Estornar recebimento?"}
            textoSalvar={acao.tipo === "cancelar" ? "Cancelar conta" : "Estornar recebimento"} textoCancelar="Voltar"
            salvando={salvando} onFechar={() => setAcao(null)} onSubmit={e => { e.preventDefault(); void confirmar(); }}>
            <Stack spacing={2}>
                <Typography variant="body2">{acao.tipo === "cancelar" ? "A conta será cancelada e permanecerá no histórico."
                    : `${moeda.format(acao.movimento.valor)} serão revertidos de ${acao.movimento.contaFinanceiraNome}. O recebimento permanecerá no histórico.`}</Typography>
                {acao.tipo === "estornar" && <TextField required autoFocus multiline minRows={2} label="Motivo do estorno" value={motivo}
                    disabled={salvando} onChange={e => setMotivo(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />}
                {erroAcao && <Alert severity="error">{erroAcao}</Alert>}
            </Stack>
        </CadastroDialog>}
    </>;
}
