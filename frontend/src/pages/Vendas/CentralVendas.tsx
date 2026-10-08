import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
    Alert,
    Box,
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
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import StatusChip from "../../components/ui/StatusChip";
import { listarRecebiveis, mensagemRecebivel } from "../../services/recebivelService";
import type { Recebivel, StatusRecebivel } from "../../types/recebivel";
import { formatarData, rotulosStatus as rotulosContaReceber } from "../Financeiro/contaReceberUtils";
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
const rotulosRecebivel: Record<StatusRecebivel, string> = {
    PENDENTE: "Aguardando liquidação", LIQUIDADO: "Liquidado", CANCELADO: "Cancelado",
};

type CampoOrdenacaoVenda = "id" | "dataHora" | "total" | "status";

export default function CentralVendas() {
    const [parametros, setParametros] = useSearchParams();
    const vendaIdParametro = parametros.get("vendaId");
    const vendaId = vendaIdParametro && /^[1-9]\d*$/.test(vendaIdParametro) && Number.isSafeInteger(Number(vendaIdParametro))
        ? Number(vendaIdParametro) : null;
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
    const [selecionada, setSelecionada] = useState<{ id: number; nomeCliente?: string | null } | null>(null);
    const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
    const [erroDetalhe, setErroDetalhe] = useState("");
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
    const [vendaParaCancelar, setVendaParaCancelar] = useState<VendaResumo | null>(null);
    const [erroCancelamento, setErroCancelamento] = useState("");
    const [cancelando, setCancelando] = useState<number | null>(null);
    const [totalItems, setTotalItems] = useState(0);
    const [sucesso, setSucesso] = useState(false);
    const [pagamentos, setPagamentos] = useState<PagamentoVenda[]>([]);
    const [erroPagamentos, setErroPagamentos] = useState("");
    const [recebiveis, setRecebiveis] = useState<{ vendaId: number; items: Recebivel[]; erro: string } | null>(null);
    const [tentativaRecebiveis, setTentativaRecebiveis] = useState(0);
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

    const visualizar = useCallback(async (venda: { id: number; nomeCliente?: string | null }, signal?: AbortSignal) => {
        setSelecionada(venda);
        setDetalhe(null);
        setPagamentos([]);
        setRecebiveis(null);
        setErroPagamentos("");
        setCarregandoDetalhe(true);
        setErroDetalhe("");
        try {
            const resposta = await buscarVenda(venda.id, signal);
            if (signal?.aborted) return;
            setDetalhe(resposta);
            try {
                const respostaPagamentos = await listarPagamentosVenda(venda.id, signal);
                if (!signal?.aborted) setPagamentos(respostaPagamentos);
            } catch (e) {
                if (!signal?.aborted) setErroPagamentos(mensagemVenda(e, "Não foi possível carregar os pagamentos."));
            }
        } catch (e) {
            if (!signal?.aborted) {
                setErroDetalhe(mensagemVenda(e, "Não foi possível carregar os detalhes da venda."));
                setSelecionada(null);
            }
        } finally {
            if (!signal?.aborted) setCarregandoDetalhe(false);
        }
    }, []);

    useEffect(() => {
        if (vendaId === null) return;
        const controller = new AbortController();
        const timer = setTimeout(() => void visualizar({ id: vendaId }, controller.signal), 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [vendaId, visualizar]);

    const idDetalhe = selecionada?.id;
    const temCartao = pagamentos.some(p => p.formaPagamento === "CARTAO_DEBITO" || p.formaPagamento === "CARTAO_CREDITO");
    useEffect(() => {
        if (!idDetalhe || !temCartao || carregandoDetalhe) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setRecebiveis(null);
            try {
                const items: Recebivel[] = [];
                let page = 0;
                let totalPages;
                do {
                    const resposta = await listarRecebiveis({ vendaId: idDetalhe, page, size: 25, sort: "id,asc" }, controller.signal);
                    if (controller.signal.aborted) return;
                    items.push(...resposta.items);
                    totalPages = resposta.totalPages;
                    page++;
                } while (page < totalPages);
                setRecebiveis({ vendaId: idDetalhe, items, erro: "" });
            } catch (e) {
                if (!controller.signal.aborted) setRecebiveis({ vendaId: idDetalhe, items: [],
                    erro: mensagemRecebivel(e, "Não foi possível consultar os recebimentos de cartão.") });
            }
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [idDetalhe, temCartao, carregandoDetalhe, detalhe?.status, tentativaRecebiveis]);

    function fecharDetalhe() {
        setSelecionada(null);
        if (parametros.has("vendaId")) {
            const novos = new URLSearchParams(parametros);
            novos.delete("vendaId");
            setParametros(novos, { replace: true });
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

    const pagamentosRegistrados = pagamentos.reduce<PagamentoVenda[]>((registrados, pagamento) => {
        // A prazo pertence a ContaReceber, nunca aos pagamentos imediatos.
        if (pagamento.status === "REGISTRADO" && Object.hasOwn(rotulosPagamento, pagamento.formaPagamento)) registrados.push(pagamento);
        return registrados;
    }, []);
    const pagoAgora = pagamentosRegistrados.reduce((total, pagamento) => total + pagamento.valor, 0);
    const aReceber = detalhe?.contasReceber?.reduce((total, conta) => total + conta.saldo, 0) ?? 0;

    return <PageContainer>
        <PageHeader titulo="Central de Vendas" descricao="Consulte vendas, confira detalhes e execute cancelamentos."
            acaoPrincipal={<Button component={Link} to="/pdv" variant="contained"
                startIcon={<AddShoppingCartRoundedIcon />}>Vender</Button>} />

        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void carregarVendas()}>Tentar novamente</Button>}>{erro}</Alert>}
        {erroDetalhe && <Alert severity="error" action={vendaId !== null
            ? <Button color="inherit" onClick={() => void visualizar({ id: vendaId })}>Tentar novamente</Button> : undefined}>{erroDetalhe}</Alert>}

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
            onClose={carregandoDetalhe || confirmandoPix ? undefined : fecharDetalhe} aria-labelledby="detalhe-venda-titulo">
            <DialogTitle id="detalhe-venda-titulo">Venda #{selecionada?.id}</DialogTitle>
            <DialogContent dividers>
                {carregandoDetalhe || !detalhe ? <Typography color="text.secondary">Carregando detalhes…</Typography> : <Stack spacing={2}>
                    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", columnGap: 3, rowGap: 0.75, px: 1.5, py: 1, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                        <Chip size="small" color={corStatus(detalhe.status)} label={rotulosStatus[detalhe.status]} />
                        <Typography variant="body2" color="text.secondary"><strong>Data:</strong> {dataHoraVenda(detalhe.dataHora)}</Typography>
                        <Typography variant="body2" color="text.secondary"><strong>Cliente:</strong> {selecionada?.nomeCliente || detalhe.contasReceber?.[0]?.cliente?.nome
                            || (detalhe.clienteId ? `Cliente #${detalhe.clienteId}` : "Consumidor final")}</Typography>
                        <Typography variant="body2" color="text.secondary"><strong>Sessão:</strong> {detalhe.sessaoCaixaId ? `#${detalhe.sessaoCaixaId}` : "—"}</Typography>
                    </Stack>
                    <Box component="section" aria-label="Resumo financeiro da venda" sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                        <Box component="dl" sx={{ m: 0, display: "grid", gap: 1.5,
                            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: detalhe.contasReceber?.length ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))" } }}>
                            <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                                <Typography component="dt" variant="caption" color="text.secondary">Total da venda</Typography>
                                <Typography component="dd" sx={{ m: 0, fontSize: 24, fontWeight: 700, color: "primary.main", fontVariantNumeric: "tabular-nums" }}>{moedaVenda(detalhe.total)}</Typography>
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography component="dt" variant="caption" color="text.secondary">Pago agora</Typography>
                                <Typography component="dd" sx={{ m: 0, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{erroPagamentos ? "Indisponível" : moedaVenda(pagoAgora)}</Typography>
                            </Box>
                            {!!detalhe.contasReceber?.length && <Box sx={{ minWidth: 0 }}>
                                <Typography component="dt" variant="caption" color="text.secondary">A receber</Typography>
                                <Typography component="dd" sx={{ m: 0, fontWeight: 600, color: aReceber > 0 ? "warning.main" : "text.secondary", fontVariantNumeric: "tabular-nums" }}>{moedaVenda(aReceber)}</Typography>
                            </Box>}
                        </Box>
                        {((!!pagamentosRegistrados.length && !erroPagamentos) || !!detalhe.contasReceber?.length) && <Stack direction="row" aria-label="Formas utilizadas" sx={{ gap: 0.75, flexWrap: "wrap", mt: 1.25 }}>
                            {!erroPagamentos && pagamentosRegistrados.map(pagamento => {
                                const pix = pagamento.formaPagamento === "PIX";
                                const pendente = pix && pagamento.confirmadoFinanceiramente === false;
                                const confirmado = pix && pagamento.confirmadoFinanceiramente === true;
                                return <Chip key={pagamento.id} size="small" variant="outlined"
                                    color={pendente ? "warning" : confirmado ? "success" : "default"}
                                    label={`${rotulosPagamento[pagamento.formaPagamento]}${pendente ? " pendente" : confirmado ? " confirmado" : ""} · ${moedaVenda(pagamento.valor)}`}
                                    sx={{ maxWidth: "100%", height: "auto", minHeight: 24, "& .MuiChip-label": { whiteSpace: "normal", py: 0.25, overflowWrap: "anywhere" } }} />;
                            })}
                            {!!detalhe.contasReceber?.length && <Chip size="small" variant="outlined" label="A prazo" />}
                        </Stack>}
                    </Box>
                    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                    <Table size="small" aria-label="Itens da venda" sx={{ minWidth: 420 }}>
                        <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Quantidade</TableCell>
                            <TableCell align="right">Unitário</TableCell><TableCell align="right">Subtotal</TableCell></TableRow></TableHead>
                        <TableBody>{detalhe.itens.map(item => <TableRow key={item.id}>
                            <TableCell>{item.nomeProduto}</TableCell><TableCell align="right">{item.quantidade}</TableCell>
                            <TableCell align="right">{moedaVenda(item.precoUnitario)}</TableCell>
                            <TableCell align="right">{moedaVenda(item.subtotal)}</TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                    </TableContainer>
                    <Stack direction="row" spacing={3} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Typography>Subtotal: <strong>{moedaVenda(detalhe.subtotal)}</strong></Typography>
                        <Typography>Desconto: <strong>{moedaVenda(detalhe.desconto)}</strong></Typography>
                        {!!detalhe.troco && <Typography>Troco: <strong>{moedaVenda(detalhe.troco)}</strong></Typography>}
                    </Stack>
                    {(!!pagamentos.length || !!erroPagamentos) && <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700 }}>Pagamentos</Typography>}
                    {erroPagamentos && <Alert severity="error">{erroPagamentos}</Alert>}
                    {temCartao && recebiveis?.vendaId === detalhe.id && recebiveis.erro && <Alert severity="warning"
                        action={<Button color="inherit" onClick={() => { setRecebiveis(null); setTentativaRecebiveis(n => n + 1); }}>Tentar novamente</Button>}>
                        Recebimentos de cartão: {recebiveis.erro}
                    </Alert>}
                    {pagamentos.map(pagamento => {
                        const pix = pagamento.formaPagamento === "PIX";
                        const cartao = pagamento.formaPagamento === "CARTAO_DEBITO" || pagamento.formaPagamento === "CARTAO_CREDITO";
                        const recebivel = recebiveis?.items.find(r => r.vendaId === detalhe.id && r.pagamentoId === pagamento.id
                            && r.tipo === (pagamento.formaPagamento === "CARTAO_DEBITO" ? "DEBITO" : "CREDITO"));
                        const cancelado = pagamento.status === "CANCELADO" || detalhe.status === "CANCELADA";
                        return <Stack key={pagamento.id} spacing={0.75} role={cartao ? "group" : undefined}
                            aria-label={cartao ? `${rotulosPagamento[pagamento.formaPagamento]} · ${moedaVenda(pagamento.valor)}` : undefined}
                            sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
                                <Typography sx={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{rotulosPagamento[pagamento.formaPagamento]} · {pagamento.configuracaoNomeExibicao || "Configuração histórica não informada"}</Typography>
                                <Typography sx={{ fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{moedaVenda(pagamento.valor)}</Typography>
                            </Stack>
                            {cartao && (recebiveis?.vendaId !== detalhe.id
                                ? <Typography variant="body2" color="text.secondary">Consultando recebimento do cartão…</Typography>
                                : recebiveis.erro ? <Typography variant="body2" color="text.secondary">Situação indisponível</Typography>
                                    : recebivel ? <Box><StatusChip status={recebivel.status} label={rotulosRecebivel[recebivel.status] ?? "Situação indisponível"} /></Box>
                                        : <Typography variant="body2" color="text.secondary">Recebível não localizado</Typography>)}
                            {!cartao && pagamento.configuracaoContaFinanceiraDestinoNome && <Typography variant="body2" color="text.secondary">Conta de destino: {pagamento.configuracaoContaFinanceiraDestinoNome}</Typography>}
                            {pix && <Box><Chip size="small" variant="outlined" color={cancelado ? "default" : pagamento.confirmadoFinanceiramente ? "success" : "warning"}
                                label={cancelado ? "Pagamento cancelado" : pagamento.confirmadoFinanceiramente ? "Recebimento confirmado" : "Aguardando confirmação"} /></Box>}
                            {pix && pagamento.confirmadoFinanceiramente && <Typography variant="caption" color="text.secondary">
                                Confirmado em {pagamento.dataConfirmacaoFinanceira ? dataHoraVenda(pagamento.dataConfirmacaoFinanceira) : "—"} · Movimento #{pagamento.movimentacaoFinanceiraId}
                            </Typography>}
                            {pix && !cancelado && !pagamento.confirmadoFinanceiramente && podeCancelar && <Button
                                size="small" variant="contained" sx={{ alignSelf: "flex-start" }} disabled={confirmandoPix} onClick={() => { setErroPix(""); setPixParaConfirmar(pagamento); }}>
                                Confirmar recebimento
                            </Button>}
                        </Stack>;
                    })}
                    {!!detalhe.contasReceber?.length && <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 700 }}>A prazo</Typography>
                        {detalhe.contasReceber.map(conta => <Stack key={conta.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" }, flexWrap: "wrap", p: 1.25, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                            <Typography variant="body2">{conta.numeroParcela}/{conta.totalParcelas} · {formatarData(conta.dataVencimento)} · <strong>{moedaVenda(conta.valorOriginal)}</strong> · Saldo {moedaVenda(conta.saldo)}</Typography>
                            <StatusChip status={conta.status} label={rotulosContaReceber[conta.status]} />
                            <Button component={Link} to={`/financeiro/contas-receber?contaId=${conta.id}`} size="small">Ver em Contas a Receber</Button>
                        </Stack>)}
                    </Stack>}
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
