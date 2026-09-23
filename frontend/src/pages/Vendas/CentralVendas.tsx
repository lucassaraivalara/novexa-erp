import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
    Alert,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { listarClientes } from "../../services/clienteService";
import {
    buscarVenda,
    cancelarVenda,
    listarVendas,
    mensagemVenda,
    type VendaDetalhe,
    type VendaResumo,
} from "../../services/vendaService";
import type { Cliente } from "../../types/cliente";
import { obterSessao } from "../../utils/auth/sessao";
import {
    criarParametrosVenda,
    dataHoraVenda,
    filtrosIniciais,
    moedaVenda,
    podeCancelarVenda,
    rotulosPagamento,
    rotulosStatus,
    type FiltrosCentralVendas,
} from "./centralVendasUtils";

const corStatus = (status: VendaResumo["status"]) =>
    status === "FATURADA" ? "success" : status === "CANCELADA" ? "default" : "warning";

type CampoOrdenacaoVenda = "id" | "dataHora" | "nomeCliente" | "total" | "status" | "sessaoCaixaId";

export default function CentralVendas() {
    const empresaId = obterSessao()?.empresa.id;
    const [vendas, setVendas] = useState<VendaResumo[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [filtros, setFiltros] = useState<FiltrosCentralVendas>(filtrosIniciais);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacaoVenda; direcao: "asc" | "desc" }>({
        campo: "dataHora",
        direcao: "desc",
    });
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [selecionada, setSelecionada] = useState<VendaResumo | null>(null);
    const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
    const [vendaParaCancelar, setVendaParaCancelar] = useState<VendaResumo | null>(null);
    const [erroCancelamento, setErroCancelamento] = useState("");
    const [cancelando, setCancelando] = useState<number | null>(null);
    const [sucesso, setSucesso] = useState(false);

    const carregarVendas = useCallback(async (signal?: AbortSignal) => {
        setCarregando(true);
        setErro("");
        try {
            setVendas(await listarVendas(criarParametrosVenda(filtros), signal));
        } catch (e) {
            if (!signal?.aborted) setErro(mensagemVenda(e, "Não foi possível carregar as vendas."));
        } finally {
            if (!signal?.aborted) setCarregando(false);
        }
    }, [filtros]);

    useEffect(() => {
        const controller = new AbortController();
        void carregarVendas(controller.signal);
        return () => controller.abort();
    }, [carregarVendas]);

    useEffect(() => {
        if (!empresaId) return;
        const controller = new AbortController();
        listarClientes(controller.signal)
            .then(setClientes)
            .catch(() => { /* O filtro continua utilizável sem a lista de clientes. */ });
        return () => controller.abort();
    }, [empresaId]);

    function alterarFiltro<K extends keyof FiltrosCentralVendas>(campo: K, valor: FiltrosCentralVendas[K]) {
        setFiltros(atuais => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    async function visualizar(venda: VendaResumo) {
        setSelecionada(venda);
        setDetalhe(null);
        setCarregandoDetalhe(true);
        setErro("");
        try {
            setDetalhe(await buscarVenda(venda.id));
        } catch (e) {
            setErro(mensagemVenda(e, "Não foi possível carregar os detalhes da venda."));
            setSelecionada(null);
        } finally {
            setCarregandoDetalhe(false);
        }
    }

    function solicitarCancelamento(venda: VendaResumo) {
        if (!podeCancelarVenda(venda.status)) return;
        setErroCancelamento("");
        setVendaParaCancelar(venda);
    }

    async function confirmarCancelamento() {
        const venda = vendaParaCancelar;
        if (!venda || !podeCancelarVenda(venda.status) || cancelando !== null) return;
        setCancelando(venda.id);
        setErroCancelamento("");
        try {
            const cancelada = await cancelarVenda(venda.id);
            setVendas(atuais => atuais.map(atual => atual.id === venda.id
                ? { ...atual, status: "CANCELADA" }
                : atual));
            if (selecionada?.id === venda.id) {
                setSelecionada(atual => atual ? { ...atual, status: "CANCELADA" } : null);
                setDetalhe(cancelada);
            }
            setVendaParaCancelar(null);
            setSucesso(true);
            await carregarVendas();
        } catch (e) {
            setErroCancelamento(mensagemVenda(e, "Não foi possível cancelar a venda."));
        } finally {
            setCancelando(null);
        }
    }

    const colunas: Coluna<VendaResumo>[] = [
        { campo: "id", cabecalho: "Venda", largura: 90, ordenavel: true, render: valor => `#${valor}` },
        { campo: "dataHora", cabecalho: "Data / hora", largura: 155, ordenavel: true, render: valor => dataHoraVenda(String(valor)) },
        { campo: "nomeCliente", cabecalho: "Cliente", largura: 240, ordenavel: true, render: valor => String(valor || "Consumidor final") },
        { campo: "total", cabecalho: "Total", largura: 130, alinhar: "right", ordenavel: true, render: valor => moedaVenda(Number(valor)) },
        { campo: "status", cabecalho: "Status", largura: 120, ordenavel: true, render: valor => {
            const status = valor as VendaResumo["status"];
            return <Chip size="small" variant="outlined" color={corStatus(status)} label={rotulosStatus[status]} />;
        } },
        { campo: "sessaoCaixaId", cabecalho: "Caixa / sessão", largura: 140, ordenavel: true,
            render: valor => valor ? `Sessão #${valor}` : "—" },
    ];

    const acoes: AcaoTabela<VendaResumo>[] = [
        {
            rotulo: "Visualizar detalhes",
            tooltip: "Visualizar detalhes",
            icone: <VisibilityOutlinedIcon fontSize="small" />,
            onClick: venda => void visualizar(venda),
            desabilitado: venda => carregandoDetalhe || cancelando === venda.id,
        },
        {
            rotulo: "Cancelar venda",
            tooltip: "Cancelar venda",
            icone: <CancelOutlinedIcon fontSize="small" />,
            onClick: solicitarCancelamento,
            desabilitado: venda => !podeCancelarVenda(venda.status) || cancelando !== null,
            cor: "error",
        },
    ];

    const vendasOrdenadas = useMemo(() => [...vendas].sort((a, b) => {
        const valorA = ordenacao.campo === "nomeCliente" ? a.nomeCliente ?? "Consumidor final" : a[ordenacao.campo];
        const valorB = ordenacao.campo === "nomeCliente" ? b.nomeCliente ?? "Consumidor final" : b[ordenacao.campo];
        if (valorA === valorB) return 0;
        if (valorA === null || valorA === undefined) return 1;
        if (valorB === null || valorB === undefined) return -1;
        const comparacao = typeof valorA === "string"
            ? valorA.localeCompare(String(valorB), "pt-BR", { numeric: true })
            : Number(valorA) - Number(valorB);
        return ordenacao.direcao === "asc" ? comparacao : -comparacao;
    }), [ordenacao, vendas]);
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(vendasOrdenadas.length / porPagina) - 1));
    const linhas = vendasOrdenadas.slice(paginaAtual * porPagina, paginaAtual * porPagina + porPagina);

    return <PageContainer>
        <PageHeader titulo="Central de Vendas" descricao="Consulte vendas, confira detalhes e execute cancelamentos."
            acaoPrincipal={<Button component={Link} to="/pdv" variant="contained"
                startIcon={<AddShoppingCartRoundedIcon />}>Nova Venda</Button>} />

        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void carregarVendas()}>Tentar novamente</Button>}>{erro}</Alert>}

        <AppTable colunas={colunas} linhas={linhas} carregando={carregando} compacta ordenacaoComIcone
            obterChaveLinha={venda => venda.id} minWidth={940} acoes={acoes}
            ordenacao={{
                campo: ordenacao.campo,
                direcao: ordenacao.direcao,
                onSort: campo => setOrdenacao(atual => ({
                    campo: campo as CampoOrdenacaoVenda,
                    direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc",
                })),
            }}
            filtros={<Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
                <TextField select size="small" label="Status" value={filtros.status} sx={{ minWidth: 150 }}
                    onChange={evento => alterarFiltro("status", evento.target.value as FiltrosCentralVendas["status"])}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="ABERTA">Aberta</MenuItem>
                    <MenuItem value="FATURADA">Faturada</MenuItem>
                    <MenuItem value="CANCELADA">Cancelada</MenuItem>
                </TextField>
                <TextField size="small" type="date" label="Data inicial" value={filtros.dataInicial}
                    slotProps={{ inputLabel: { shrink: true } }}
                    onChange={evento => alterarFiltro("dataInicial", evento.target.value)} />
                <TextField size="small" type="date" label="Data final" value={filtros.dataFinal}
                    slotProps={{ inputLabel: { shrink: true } }}
                    onChange={evento => alterarFiltro("dataFinal", evento.target.value)} />
                <TextField select size="small" label="Cliente" value={filtros.clienteId} sx={{ minWidth: 220 }}
                    onChange={evento => alterarFiltro("clienteId", evento.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {clientes.map(cliente => <MenuItem key={cliente.id} value={String(cliente.id)}>{cliente.nome}</MenuItem>)}
                </TextField>
            </Stack>}
            vazio={{ titulo: "Nenhuma venda encontrada", descricao: "Ajuste os filtros ou inicie uma nova venda." }}
            paginacao={{ pagina: paginaAtual, linhasPorPagina: porPagina, total: vendasOrdenadas.length,
                onPageChange: setPagina,
                onRowsPerPageChange: linhasPorPagina => { setPorPagina(linhasPorPagina); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }}
            alturaCorpo={480} />

        <Dialog open={vendaParaCancelar !== null} fullWidth maxWidth="xs"
            onClose={cancelando !== null ? undefined : () => setVendaParaCancelar(null)}
            aria-labelledby="cancelar-venda-titulo" aria-describedby="cancelar-venda-descricao">
            <DialogTitle id="cancelar-venda-titulo">Cancelar venda #{vendaParaCancelar?.id}?</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography id="cancelar-venda-descricao">
                        A venda será preservada como cancelada. O sistema reverterá o estoque e os efeitos financeiros registrados.
                    </Typography>
                    {erroCancelamento && <Alert severity="error">{erroCancelamento}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button type="button" onClick={() => setVendaParaCancelar(null)} disabled={cancelando !== null}>Voltar</Button>
                <Button type="button" color="error" variant="contained" onClick={() => void confirmarCancelamento()}
                    disabled={cancelando !== null}
                    startIcon={cancelando !== null ? <CircularProgress size={18} color="inherit" /> : <CancelOutlinedIcon />}>
                    {cancelando !== null ? "Cancelando…" : "Cancelar venda"}
                </Button>
            </DialogActions>
        </Dialog>

        <Dialog open={selecionada !== null} fullWidth maxWidth="md"
            onClose={carregandoDetalhe ? undefined : () => setSelecionada(null)} aria-labelledby="detalhe-venda-titulo">
            <DialogTitle id="detalhe-venda-titulo">Venda #{selecionada?.id}</DialogTitle>
            <DialogContent dividers>
                {carregandoDetalhe || !detalhe ? <Typography color="text.secondary">Carregando detalhes…</Typography> : <Stack spacing={2}>
                    <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap" }}>
                        <Typography><strong>Data:</strong> {dataHoraVenda(detalhe.dataHora)}</Typography>
                        <Typography><strong>Cliente:</strong> {selecionada?.nomeCliente || "Consumidor final"}</Typography>
                        <Typography><strong>Status:</strong> {rotulosStatus[detalhe.status]}</Typography>
                        <Typography><strong>Sessão:</strong> {detalhe.sessaoCaixaId ? `#${detalhe.sessaoCaixaId}` : "—"}</Typography>
                    </Stack>
                    <Table size="small" aria-label="Itens da venda">
                        <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Quantidade</TableCell>
                            <TableCell align="right">Unitário</TableCell><TableCell align="right">Subtotal</TableCell></TableRow></TableHead>
                        <TableBody>{detalhe.itens.map(item => <TableRow key={item.id}>
                            <TableCell>{item.nomeProduto}</TableCell><TableCell align="right">{item.quantidade}</TableCell>
                            <TableCell align="right">{moedaVenda(item.precoUnitario)}</TableCell>
                            <TableCell align="right">{moedaVenda(item.subtotal)}</TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                    <Stack direction="row" spacing={3} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Typography>Subtotal: <strong>{moedaVenda(detalhe.subtotal)}</strong></Typography>
                        <Typography>Desconto: <strong>{moedaVenda(detalhe.desconto)}</strong></Typography>
                        <Typography>Total: <strong>{moedaVenda(detalhe.total)}</strong></Typography>
                    </Stack>
                    <Alert severity="info" icon={false}>
                        Pagamento: <strong>{detalhe.formaPagamento ? rotulosPagamento[detalhe.formaPagamento] : "Não definido"}</strong>
                        {detalhe.valorRecebido !== null && <> · Recebido: <strong>{moedaVenda(detalhe.valorRecebido)}</strong></>}
                        {detalhe.troco !== null && <> · Troco: <strong>{moedaVenda(detalhe.troco)}</strong></>}
                    </Alert>
                </Stack>}
            </DialogContent>
            <DialogActions><Button onClick={() => setSelecionada(null)} disabled={carregandoDetalhe}>Fechar</Button></DialogActions>
        </Dialog>

        <Snackbar open={sucesso} autoHideDuration={4000} onClose={() => setSucesso(false)}>
            <Alert severity="success" onClose={() => setSucesso(false)}>Venda cancelada com sucesso.</Alert>
        </Snackbar>
    </PageContainer>;
}
