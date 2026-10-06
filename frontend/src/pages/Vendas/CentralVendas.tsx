import { useCallback, useEffect, useState } from "react";
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
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import {
    buscarVenda,
    cancelarVenda,
    confirmarRecebimentoPix,
    listarPagamentosVenda,
    mensagemConfirmacaoPix,
    type PagamentoVenda,
    listarVendasPaginado,
    mensagemVenda,
    type VendaDetalhe,
    type VendaResumo,
} from "../../services/vendaService";
import type { PaginaResponse } from "../../types/paginacao";
import type { Cliente } from "../../types/cliente";
import { obterSessao } from "../../utils/auth/sessao";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
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

type CampoOrdenacaoVenda = "id" | "dataHora" | "total" | "status";

export default function CentralVendas() {
    const podeCancelar = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    const [vendas, setVendas] = useState<VendaResumo[]>([]);
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
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
    const [totalItems, setTotalItems] = useState(0);
    const [sucesso, setSucesso] = useState(false);
    const [pagamentos, setPagamentos] = useState<PagamentoVenda[]>([]);
    const [erroPagamentos, setErroPagamentos] = useState("");
    const [pixParaConfirmar, setPixParaConfirmar] = useState<PagamentoVenda | null>(null);
    const [confirmandoPix, setConfirmandoPix] = useState(false);
    const [erroPix, setErroPix] = useState("");
    const [sucessoPix, setSucessoPix] = useState(false);

    const carregarVendas = useCallback(async (signal?: AbortSignal) => {
        setCarregando(true);
        setErro("");
        try {
            const response: PaginaResponse<VendaResumo> = await listarVendasPaginado(
                criarParametrosVenda(filtros),
                pagina,
                porPagina,
                `${ordenacao.campo},${ordenacao.direcao}`,
                signal
            );
            if (signal?.aborted) return;
            setVendas(response.items);
            setTotalItems(response.totalItems);
            if (pagina > 0 && !response.items.length) setPagina(Math.max(0, response.totalPages - 1));
        } catch (e) {
            if (!signal?.aborted) setErro(mensagemVenda(e, "Não foi possível carregar as vendas."));
        } finally {
            if (!signal?.aborted) setCarregando(false);
        }
    }, [filtros, pagina, porPagina, ordenacao]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => void carregarVendas(controller.signal), 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [carregarVendas]);

    function alterarFiltro<K extends keyof FiltrosCentralVendas>(campo: K, valor: FiltrosCentralVendas[K]) {
        setFiltros(atuais => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    async function visualizar(venda: VendaResumo) {
        setSelecionada(venda);
        setDetalhe(null);
        setPagamentos([]);
        setErroPagamentos("");
        setCarregandoDetalhe(true);
        setErro("");
        try {
            setDetalhe(await buscarVenda(venda.id));
            try {
                setPagamentos(await listarPagamentosVenda(venda.id));
            } catch (e) {
                setErroPagamentos(mensagemVenda(e, "Não foi possível carregar os pagamentos."));
            }
        } catch (e) {
            setErro(mensagemVenda(e, "Não foi possível carregar os detalhes da venda."));
            setSelecionada(null);
        } finally {
            setCarregandoDetalhe(false);
        }
    }

    async function confirmarPix() {
        if (!pixParaConfirmar || confirmandoPix) return;
        setConfirmandoPix(true);
        setErroPix("");
        try {
            const confirmado = await confirmarRecebimentoPix(pixParaConfirmar.id);
            setPagamentos(atuais => atuais.map(p => p.id === confirmado.id ? confirmado : p));
            setPixParaConfirmar(null);
            setSucessoPix(true);
            try {
                setPagamentos(await listarPagamentosVenda(confirmado.vendaId));
                setDetalhe(await buscarVenda(confirmado.vendaId));
                setErroPagamentos("");
            } catch (e) {
                setErroPagamentos(mensagemVenda(e, "Recebimento confirmado, mas não foi possível atualizar os detalhes."));
            }
        } catch (e) {
            setErroPix(mensagemConfirmacaoPix(e));
        } finally {
            setConfirmandoPix(false);
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
        { campo: "nomeCliente", cabecalho: "Cliente", largura: 240, render: valor => String(valor || "Consumidor final") },
        { campo: "total", cabecalho: "Total", largura: 130, alinhar: "right", ordenavel: true, render: valor => moedaVenda(Number(valor)) },
        { campo: "status", cabecalho: "Status", largura: 120, ordenavel: true, render: valor => {
            const status = valor as VendaResumo["status"];
            return <Chip size="small" variant="outlined" color={corStatus(status)} label={rotulosStatus[status]} />;
        } },
        { campo: "sessaoCaixaId", cabecalho: "Caixa / sessão", largura: 140,
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
        ...(podeCancelar ? [{
            rotulo: "Cancelar venda",
            tooltip: "Cancelar venda",
            icone: <CancelOutlinedIcon fontSize="small" />,
            onClick: solicitarCancelamento,
            desabilitado: venda => !podeCancelarVenda(venda.status) || cancelando !== null,
            cor: "error",
        } satisfies AcaoTabela<VendaResumo>] : []),
    ];

    return <PageContainer>
        <PageHeader titulo="Central de Vendas" descricao="Consulte vendas, confira detalhes e execute cancelamentos."
            acaoPrincipal={<Button component={Link} to="/pdv" variant="contained"
                startIcon={<AddShoppingCartRoundedIcon />}>Vender</Button>} />

        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void carregarVendas()}>Tentar novamente</Button>}>{erro}</Alert>}

        <AppTable colunas={colunas} linhas={vendas} carregando={carregando} compacta ordenacaoComIcone
            obterChaveLinha={venda => venda.id} minWidth={940} acoes={acoes}
            ordenacaoRemota
            ordenacao={{
                campo: ordenacao.campo,
                direcao: ordenacao.direcao,
                onSort: campo => { setPagina(0); setOrdenacao(atual => ({
                    campo: campo as CampoOrdenacaoVenda,
                    direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc",
                })); },
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
                <ClienteAutocomplete size="small" label="Cliente" placeholder="Buscar cliente..." minWidth={220}
                    incluirInativos value={clienteSelecionado} onChange={cliente => {
                        setClienteSelecionado(cliente);
                        alterarFiltro("clienteId", cliente ? String(cliente.id) : "");
                    }} />
            </Stack>}
            vazio={{ titulo: "Nenhuma venda encontrada", descricao: "Ajuste os filtros ou inicie uma nova venda." }}
            paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
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
            onClose={carregandoDetalhe || confirmandoPix ? undefined : () => setSelecionada(null)} aria-labelledby="detalhe-venda-titulo">
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
                    <Typography variant="h6">Pagamentos</Typography>
                    {erroPagamentos && <Alert severity="error">{erroPagamentos}</Alert>}
                    {pagamentos.map(pagamento => {
                        const pix = pagamento.formaPagamento === "PIX";
                        const cancelado = pagamento.status === "CANCELADO" || detalhe.status === "CANCELADA";
                        return <Stack key={pagamento.id} spacing={1}>
                            <Typography>{rotulosPagamento[pagamento.formaPagamento]} · {pagamento.configuracaoNomeExibicao || "Configuração histórica não informada"} · <strong>{moedaVenda(pagamento.valor)}</strong></Typography>
                            {pagamento.configuracaoContaFinanceiraDestinoNome && <Typography variant="body2" color="text.secondary">Conta de destino: {pagamento.configuracaoContaFinanceiraDestinoNome}</Typography>}
                            {pix && <Typography variant="body2">{cancelado ? "Pagamento cancelado" : pagamento.confirmadoFinanceiramente ? "Recebimento confirmado" : "Aguardando confirmação"}</Typography>}
                            {pix && pagamento.confirmadoFinanceiramente && <Typography variant="caption" color="text.secondary">
                                Confirmado em {pagamento.dataConfirmacaoFinanceira ? dataHoraVenda(pagamento.dataConfirmacaoFinanceira) : "—"} · Movimento #{pagamento.movimentacaoFinanceiraId}
                            </Typography>}
                            {pix && !cancelado && !pagamento.confirmadoFinanceiramente && podeCancelar && <Button
                                sx={{ alignSelf: "flex-start" }} disabled={confirmandoPix} onClick={() => { setErroPix(""); setPixParaConfirmar(pagamento); }}>
                                Confirmar recebimento
                            </Button>}
                        </Stack>;
                    })}
                </Stack>}
            </DialogContent>
            <DialogActions><Button onClick={() => setSelecionada(null)} disabled={carregandoDetalhe || confirmandoPix}>Fechar</Button></DialogActions>
        </Dialog>

        <Dialog open={pixParaConfirmar !== null} fullWidth maxWidth="xs"
            onClose={confirmandoPix ? undefined : () => setPixParaConfirmar(null)} aria-labelledby="confirmar-pix-titulo">
            <DialogTitle id="confirmar-pix-titulo">Confirmar recebimento PIX?</DialogTitle>
            <DialogContent dividers><Stack spacing={2}>
                <Typography>Valor: <strong>{moedaVenda(pixParaConfirmar?.valor ?? 0)}</strong></Typography>
                <Typography>Configuração: {pixParaConfirmar?.configuracaoNomeExibicao || "Não informada"}</Typography>
                <Typography>Esta ação registrará a entrada financeira.</Typography>
                {erroPix && <Alert severity="error">{erroPix}</Alert>}
            </Stack></DialogContent>
            <DialogActions>
                <Button disabled={confirmandoPix} onClick={() => setPixParaConfirmar(null)}>Cancelar</Button>
                <Button variant="contained" disabled={confirmandoPix} onClick={() => void confirmarPix()}
                    startIcon={confirmandoPix ? <CircularProgress size={18} color="inherit" /> : undefined}>
                    {confirmandoPix ? "Confirmando…" : "Confirmar recebimento"}
                </Button>
            </DialogActions>
        </Dialog>
        <Snackbar open={sucessoPix} autoHideDuration={4000} onClose={() => setSucessoPix(false)}>
            <Alert severity="success" onClose={() => setSucessoPix(false)}>Recebimento PIX confirmado com sucesso.</Alert>
        </Snackbar>

        <Snackbar open={sucesso} autoHideDuration={4000} onClose={() => setSucesso(false)}>
            <Alert severity="success" onClose={() => setSucesso(false)}>Venda cancelada com sucesso.</Alert>
        </Snackbar>
    </PageContainer>;
}
