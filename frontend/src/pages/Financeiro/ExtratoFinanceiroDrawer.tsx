import { useEffect, useState, type FormEvent } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Drawer, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { estornarMovimentacaoFinanceira, estornarTransferenciaFinanceira, listarMovimentacoesFinanceiras,
    mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { descricaoMovimentacaoFinanceira, rotulosOrigemMovimentacaoFinanceira, type ContaFinanceira, type MovimentacaoFinanceira } from "../../types/contaFinanceira";

type Props = { conta: ContaFinanceira; onFechar: () => void; onSaldoAlterado: () => void };
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR");

export default function ExtratoFinanceiroDrawer({ conta, onFechar, onSaldoAlterado }: Props) {
    const [movimentos, setMovimentos] = useState<MovimentacaoFinanceira[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [ordenacao, setOrdenacao] = useState({ campo: "dataMovimento", direcao: "desc" as "asc" | "desc" });
    const [filtros, setFiltros] = useState({ tipo: "", origem: "", estornada: "", dataInicial: "", dataFinal: "" });
    const [estorno, setEstorno] = useState<MovimentacaoFinanceira | null>(null);
    const [motivo, setMotivo] = useState("");
    const [processando, setProcessando] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
        setCarregando(true);
        listarMovimentacoesFinanceiras({ contaFinanceiraId: conta.id, page: pagina, size: porPagina,
            sort: `${ordenacao.campo},${ordenacao.direcao}`, tipo: filtros.tipo || undefined,
            origem: filtros.origem || undefined, estornada: filtros.estornada === "" ? undefined : filtros.estornada === "true",
            dataInicial: filtros.dataInicial || undefined, dataFinal: filtros.dataFinal || undefined }, controller.signal)
            .then((resposta) => { if (!controller.signal.aborted) {
                setMovimentos(resposta.items); setTotalItems(resposta.totalItems); setErro("");
                if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
            } })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaFinanceira(e, "Não foi possível carregar o extrato.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [conta.id, tentativa, pagina, porPagina, ordenacao, filtros]);

    async function confirmarEstorno(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!estorno || !["MANUAL", "TRANSFERENCIA"].includes(estorno.origem) || processando || !motivo.trim()) return;
        setProcessando(true); setErro("");
        try {
            if (estorno.origem === "TRANSFERENCIA" && estorno.transferenciaId) {
                await estornarTransferenciaFinanceira(estorno.transferenciaId, motivo.trim());
                setCarregando(true); setTentativa((n) => n + 1);
            } else if (estorno.origem === "MANUAL") {
                await estornarMovimentacaoFinanceira(estorno.id, motivo.trim());
                setTentativa(n => n + 1);
            } else { return; }
            setEstorno(null); setMotivo(""); onSaldoAlterado();
        } catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível estornar a movimentação.")); }
        finally { setProcessando(false); }
    }

    const colunas: Coluna<MovimentacaoFinanceira>[] = [
        { campo: "dataMovimento", cabecalho: "Data", largura: 100, render: (valor) => data(String(valor)) },
        { campo: "descricao", cabecalho: "Descrição", largura: 180, render: (_, item) => <Box>
            <Typography variant="body2">{descricaoMovimentacaoFinanceira(item)}</Typography>
            <Typography variant="caption" color="text.secondary">{rotulosOrigemMovimentacaoFinanceira[item.origem]}</Typography>
        </Box> },
        { campo: "tipo", cabecalho: "Tipo", largura: 80, render: (_, item) => item.tipo === "ENTRADA" ? "Entrada" : "Saída" },
        { campo: "valor", cabecalho: "Valor", largura: 110, alinhar: "right", render: (_, item) =>
            <Typography variant="body2" color={item.estornada ? "text.disabled" : item.tipo === "ENTRADA" ? "success.main" : "text.primary"}>
                {item.tipo === "SAIDA" ? "−" : "+"}{moeda.format(item.valor)}
            </Typography> },
        { campo: "usuarioNome", cabecalho: "Registrado por", largura: 125 },
        { campo: "estornada", cabecalho: "Situação", largura: 105, render: (_, item) => item.estornada
            ? <Tooltip title={`Estornada por ${item.usuarioEstornoNome ?? "—"}: ${item.motivoEstorno ?? ""}`}><Chip label="Estornada" size="small" variant="outlined" /></Tooltip>
            : <Chip label="Efetivada" color="success" size="small" variant="outlined" /> },
    ];
    const acoes: AcaoTabela<MovimentacaoFinanceira>[] = [
        { rotulo: "Estornar", tooltip: "Estornar movimentação", icone: <UndoRoundedIcon fontSize="small" />,
            onClick: (item) => { setErro(""); setMotivo(""); setEstorno(item); },
            desabilitado: (item) => item.estornada || (item.origem !== "MANUAL"
                && !(item.origem === "TRANSFERENCIA" && item.transferenciaId)) },
    ];

    return <Drawer anchor="right" open onClose={processando ? undefined : onFechar}
        slotProps={{ paper: { "aria-labelledby": "extrato-financeiro-titulo", sx: { width: { xs: "100%", md: 900 }, maxWidth: "100vw" } } }}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
            <Box>
                <Typography id="extrato-financeiro-titulo" variant="h6" component="h2">Extrato · {conta.nome}</Typography>
                <Typography variant="body2" color="text.secondary">Saldo atual {moeda.format(conta.saldoAtual)}</Typography>
            </Box>
            <IconButton aria-label="Fechar extrato" onClick={onFechar} disabled={processando}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Box sx={{ p: { xs: 1.5, sm: 3 }, overflowY: "auto", flex: 1 }}>
            {conta.saldoInicialAuditado === false && conta.saldoInicial > 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Conta legada: o saldo inicial de {moeda.format(conta.saldoInicial)} não possui lançamento no extrato.
            </Typography>}
            {erro && !estorno && <Alert severity="error" sx={{ mb: 2 }}
                action={movimentos.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                {([ ["tipo", "Tipo", { ENTRADA: "Entrada", SAIDA: "Saída" }],
                    ["origem", "Origem", { ...rotulosOrigemMovimentacaoFinanceira, PAGAMENTO_PIX: "PIX" }],
                    ["estornada", "Situação", { false: "Efetivada", true: "Estornada" }] ] as const).map(([campo, label, opcoes]) =>
                    <TextField key={campo} select size="small" label={label} value={filtros[campo]} sx={{ minWidth: 145 }}
                        onChange={e => { setPagina(0); setFiltros(atual => ({ ...atual, [campo]: e.target.value })); }}>
                        <MenuItem value="">Todas</MenuItem>
                        {Object.entries(opcoes).map(([valor, rotulo]) => <MenuItem key={valor} value={valor}>{rotulo}</MenuItem>)}
                    </TextField>)}
                {([ ["dataInicial", "Data inicial"], ["dataFinal", "Data final"] ] as const).map(([campo, label]) =>
                    <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]}
                        slotProps={{ inputLabel: { shrink: true } }}
                        onChange={e => { setPagina(0); setFiltros(atual => ({ ...atual, [campo]: e.target.value })); }} />)}
            </Stack>
            <AppTable colunas={colunas.map(coluna => ({ ...coluna, ordenavel: ["dataMovimento", "tipo", "valor"].includes(coluna.campo) }))}
                linhas={movimentos}
                ordenacaoRemota
                ordenacao={{ ...ordenacao, onSort: campo => { setPagina(0);
                    setOrdenacao(atual => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" })); } }}
                acoes={acoes} carregando={carregando} obterChaveLinha={(item) => item.id} minWidth={760}
                vazio={{ titulo: "Nenhuma movimentação", descricao: "Esta conta ainda não possui lançamentos." }}
                paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
                    onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                    opcoesLinhasPorPagina: [10, 25, 50] }} />
        </Box>
        <Dialog open={estorno !== null} onClose={processando ? undefined : () => setEstorno(null)} fullWidth maxWidth="xs" aria-labelledby="estorno-financeiro-titulo">
            <Box component="form" onSubmit={(e) => void confirmarEstorno(e)}>
                <DialogTitle id="estorno-financeiro-titulo">{estorno?.origem === "TRANSFERENCIA" ? "Estornar transferência?" : "Estornar movimentação?"}</DialogTitle>
                <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2">{estorno && descricaoMovimentacaoFinanceira(estorno)} · {estorno && moeda.format(estorno.valor)}</Typography>
                    <TextField autoFocus required fullWidth multiline minRows={2} label="Motivo do estorno" value={motivo}
                        onChange={(e) => setMotivo(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
                    {erro && <Alert severity="error">{erro}</Alert>}
                </Stack></DialogContent>
                <DialogActions><Button onClick={() => setEstorno(null)} disabled={processando}>Voltar</Button>
                    <Button type="submit" variant="contained" disabled={processando}>{processando ? "Estornando…" : "Confirmar estorno"}</Button></DialogActions>
            </Box>
        </Dialog>
    </Drawer>;
}
