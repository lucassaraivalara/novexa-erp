import { formatarData as dataCivil, formatarDataHora } from "../../utils/dataHora";
import AgendaRecebimentos from "./AgendaRecebimentos";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Link, MenuItem, Snackbar, Stack, TextField, Tooltip, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import PageHeader from "../../components/ui/PageHeader";
import StatusChip from "../../components/ui/StatusChip";
import { listarRecebiveis, liquidarRecebivel, mensagemRecebivel } from "../../services/recebivelService";
import type { Recebivel, StatusRecebivel, TipoRecebivel } from "../../types/recebivel";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const tipos: Record<TipoRecebivel, string> = { DEBITO: "Débito", CREDITO: "Crédito" };
const statusLabels: Record<StatusRecebivel, string> = {
    PENDENTE: "Pendente",
    LIQUIDADO: "Liquidado",
    CANCELADO: "Cancelado",
};
const sortFields = ["id", "dataVenda", "tipo", "status", "valorBruto", "dataPrevistaRecebimento"] as const;
type SortField = typeof sortFields[number];

function formatarData(valor: string | null, comHora = false) {
    if (!valor) return "—";
    return comHora ? formatarDataHora(valor) : dataCivil(valor);
}

export default function Recebiveis() {
    const [agendaAberta, setAgendaAberta] = useState(false);
    const [parametros, setParametros] = useSearchParams();
    const vendaIdParametro = parametros.get("vendaId");
    const vendaIdInvalido = vendaIdParametro !== null && (!/^[1-9]\d*$/.test(vendaIdParametro) || !Number.isSafeInteger(Number(vendaIdParametro)));
    const podeLiquidar = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    const [items, setItems] = useState<Recebivel[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [erroLiquidacao, setErroLiquidacao] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [totalItems, setTotalItems] = useState(0);
    const [ordenacao, setOrdenacao] = useState<{ campo: SortField; direcao: "asc" | "desc" }>({
        campo: "dataVenda",
        direcao: "desc",
    });
    const [filtros, setFiltros] = useState({ status: "", tipo: "", dataInicial: "", dataFinal: "" });
    const [confirmacao, setConfirmacao] = useState<Recebivel | null>(null);
    const [liquidando, setLiquidando] = useState(false);
    const liquidandoRef = useRef(false);

    useEffect(() => {
        if (vendaIdInvalido) return;
        const controller = new AbortController();
        let ajustandoPagina = false;
        listarRecebiveis({
            page: pagina,
            size: porPagina,
            sort: `${ordenacao.campo},${ordenacao.direcao}`,
            status: filtros.status ? filtros.status as StatusRecebivel : undefined,
            tipo: filtros.tipo ? filtros.tipo as TipoRecebivel : undefined,
            dataInicial: filtros.dataInicial || undefined,
            dataFinal: filtros.dataFinal || undefined,
            vendaId: vendaIdParametro !== null ? Number(vendaIdParametro) : undefined,
        }, controller.signal)
            .then((resposta) => {
                if (controller.signal.aborted) return;
                setItems(resposta.items);
                setPagina(resposta.page);
                setPorPagina(resposta.size);
                setTotalItems(resposta.totalItems);
                setErro("");
                if (resposta.page > 0 && !resposta.items.length) {
                    ajustandoPagina = true;
                    setCarregando(true);
                    setPagina(Math.max(0, resposta.totalPages - 1));
                }
            })
            .catch((e) => {
                if (!controller.signal.aborted) setErro(mensagemRecebivel(e, "Não foi possível carregar os recebíveis."));
            })
            .finally(() => {
                if (!controller.signal.aborted && !ajustandoPagina) setCarregando(false);
            });
        return () => controller.abort();
    }, [pagina, porPagina, ordenacao, filtros, tentativa, vendaIdParametro, vendaIdInvalido]);

    function alterarFiltro(campo: keyof typeof filtros | "vendaId", valor: string) {
        setCarregando(true);
        if (campo === "vendaId") {
            const novos = new URLSearchParams(parametros);
            if (valor) novos.set("vendaId", valor); else novos.delete("vendaId");
            setParametros(novos, { replace: true });
        } else setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    function abrirConfirmacao(recebivel: Recebivel) {
        if (!podeLiquidar || recebivel.status !== "PENDENTE" || liquidandoRef.current) return;
        setErroLiquidacao("");
        setConfirmacao(recebivel);
    }

    async function confirmarLiquidacao() {
        if (!confirmacao || confirmacao.status !== "PENDENTE" || liquidandoRef.current) return;
        liquidandoRef.current = true;
        setLiquidando(true);
        setErroLiquidacao("");
        try {
            await liquidarRecebivel(confirmacao.id);
            setConfirmacao(null);
            setCarregando(true);
            setTentativa((atual) => atual + 1);
            setSucesso("Recebível liquidado.");
        } catch (e) {
            setErroLiquidacao(mensagemRecebivel(e, "Não foi possível liquidar o recebível."));
        } finally {
            liquidandoRef.current = false;
            setLiquidando(false);
        }
    }

    const colunas: Coluna<Recebivel>[] = [
        { campo: "status", cabecalho: "Situação", largura: 125, ordenavel: true,
            render: (_, item) => <StatusChip status={item.status} label={statusLabels[item.status]} /> },
        { campo: "dataPrevistaRecebimento", cabecalho: "Data prevista", largura: 120, ordenavel: true,
            render: (_, item) => formatarData(item.dataPrevistaRecebimento) },
        { campo: "valorBruto", cabecalho: "Valor bruto", largura: 130, alinhar: "right", ordenavel: true,
            render: (_, item) => moeda.format(item.valorBruto) },
        { campo: "valorTaxasPrevisto", cabecalho: "Taxas previstas", largura: 135, alinhar: "right",
            render: (_, item) => item.valorTaxasPrevisto === null ? "—" : moeda.format(item.valorTaxasPrevisto) },
        { campo: "valorLiquidoPrevisto", cabecalho: "Líquido previsto", largura: 140, alinhar: "right",
            render: (_, item) => <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                {item.valorLiquidoPrevisto === null ? "—" : moeda.format(item.valorLiquidoPrevisto)}</Typography> },
        { campo: "valorLiquidoRecebido", cabecalho: "Liquidação registrada", largura: 185, alinhar: "right",
            render: (_, item) => <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.valorLiquidoRecebido == null ? "—" : moeda.format(item.valorLiquidoRecebido)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "normal" }}>
                    {formatarData(item.dataLiquidacao, true)}
                </Typography>
                {item.status === "CANCELADO" && (item.valorLiquidoRecebido != null || item.dataLiquidacao != null) &&
                    <Typography variant="caption" color="text.secondary">Registro histórico</Typography>}
            </Box> },
        { campo: "vendaId", cabecalho: "Venda", largura: 90, render: (_, item) => Number.isSafeInteger(item.vendaId) && item.vendaId > 0
            ? <Link href={`/vendas?vendaId=${item.vendaId}`} target="_blank" rel="noopener noreferrer"
                aria-label={`Ver venda #${item.vendaId}`} title="Abrir venda em nova aba; volte a esta aba para retomar a consulta.">#{item.vendaId}</Link>
            : "—" },
        { campo: "dataVenda", cabecalho: "Data da venda", largura: 160, ordenavel: true,
            render: (_, item) => formatarData(item.dataVenda, true) },
        { campo: "tipo", cabecalho: "Tipo / configuração", largura: 190, ordenavel: true,
            render: (_, item) => <Box sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
                <Typography variant="body2">{tipos[item.tipo]} · Parcela {item.numeroParcela}/{item.totalParcelas}</Typography>
                <Typography variant="caption" color="text.secondary">{item.configuracaoNomeExibicao ?? "—"}</Typography>
            </Box> },
        { campo: "id", cabecalho: "Ações", largura: 70, alinhar: "center", render: (_, item) => podeLiquidar && item.status === "PENDENTE"
            ? <Tooltip title="Liquidar recebível"><IconButton size="small" aria-label={`Liquidar recebível #${item.id}`}
                onClick={() => abrirConfirmacao(item)}><CreditCardRoundedIcon fontSize="small" /></IconButton></Tooltip>
            : null },
    ];

    const filtroAtivo = vendaIdParametro !== null || Object.values(filtros).some(Boolean);
    const formaConfirmacao = confirmacao ? tipos[confirmacao.tipo] : "";

    return <PageContainer>
        <PageHeader titulo="Recebimentos de cartão" descricao="Valores previstos não são saldo disponível. A liquidação registra o crédito; registros cancelados preservam o histórico." acoesSecundarias={<Button variant="outlined" onClick={() => setAgendaAberta(true)}>Agenda de recebimentos</Button>} />
        {erro && <Alert severity="error" sx={{ mb: 2 }} action={items.length === 0
            ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((atual) => atual + 1); }}>Tentar novamente</Button>
            : undefined}>{erro}</Alert>}
        <PageFilters>
            <TextField select size="small" label="Status" value={filtros.status} sx={{ minWidth: { xs: "100%", sm: 150 } }}
                onChange={(e) => alterarFiltro("status", e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="PENDENTE">Pendente</MenuItem>
                <MenuItem value="LIQUIDADO">Liquidado</MenuItem>
                <MenuItem value="CANCELADO">Cancelado</MenuItem>
            </TextField>
            <TextField select size="small" label="Tipo" value={filtros.tipo} sx={{ minWidth: { xs: "100%", sm: 145 } }}
                onChange={(e) => alterarFiltro("tipo", e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="DEBITO">Débito</MenuItem>
                <MenuItem value="CREDITO">Crédito</MenuItem>
            </TextField>
            <TextField size="small" type="date" label="Data inicial" value={filtros.dataInicial}
                onChange={(e) => alterarFiltro("dataInicial", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="date" label="Data final" value={filtros.dataFinal}
                onChange={(e) => alterarFiltro("dataFinal", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="number" label="Venda" value={vendaIdParametro ?? ""} sx={{ width: { xs: "100%", sm: 130 } }}
                error={vendaIdInvalido} helperText={vendaIdInvalido ? "Informe um número de venda inteiro e positivo." : undefined}
                slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
                onChange={(e) => alterarFiltro("vendaId", e.target.value)} />
            {vendaIdParametro !== null && <Button size="small" onClick={() => alterarFiltro("vendaId", "")}>Limpar venda</Button>}
        </PageFilters>
        <AppTable
            colunas={colunas}
            linhas={vendaIdInvalido ? [] : items}
            carregando={carregando && !vendaIdInvalido}
            ordenacaoRemota
            ordenacao={{ ...ordenacao, onSort: (campo) => {
                if (!sortFields.includes(campo as SortField)) return;
                setCarregando(true);
                setPagina(0);
                setOrdenacao((atual) => ({ campo: campo as SortField,
                    direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
            } }}
            obterChaveLinha={(item) => item.id}
            minWidth={1260}
            compacta
            vazio={{
                titulo: vendaIdInvalido ? "Informe uma venda válida para consultar os recebimentos" : "Nenhum recebível encontrado",
                descricao: filtroAtivo ? "Ajuste os filtros para consultar outros recebimentos de cartão." : "Recebimentos de cartão aparecerão aqui após o faturamento das vendas.",
            }}
            paginacao={{ pagina: vendaIdInvalido ? 0 : pagina, linhasPorPagina: porPagina, total: vendaIdInvalido ? 0 : totalItems,
                onPageChange: (valor) => { setCarregando(true); setPagina(valor); },
                onRowsPerPageChange: (valor) => { setCarregando(true); setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50, 100] }}
        />
        <Dialog open={confirmacao !== null} onClose={liquidando ? undefined : () => setConfirmacao(null)}
            fullWidth maxWidth="xs" aria-labelledby="liquidar-recebivel-titulo">
            <Box component="form" onSubmit={(e) => { e.preventDefault(); void confirmarLiquidacao(); }}>
                <DialogTitle id="liquidar-recebivel-titulo">Liquidar recebível?</DialogTitle>
                <DialogContent><Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    <Typography variant="body2">Venda: #{confirmacao?.vendaId}</Typography>
                    <Typography variant="body2">Valor bruto: {confirmacao ? moeda.format(confirmacao.valorBruto) : "—"}</Typography>
                    <Typography variant="body2">Taxa percentual: {confirmacao?.taxaPercentualSnapshot == null
                        ? "—" : `${percentual.format(confirmacao.taxaPercentualSnapshot)}%`}</Typography>
                    <Typography variant="body2">Taxa fixa: {confirmacao?.taxaFixaSnapshot == null
                        ? "—" : moeda.format(confirmacao.taxaFixaSnapshot)}</Typography>
                    <Typography variant="body2">Taxas previstas: {confirmacao?.valorTaxasPrevisto == null
                        ? "—" : moeda.format(confirmacao.valorTaxasPrevisto)}</Typography>
                    <Typography variant="body2">Prazo de recebimento: {confirmacao?.prazoRecebimentoDiasSnapshot == null
                        ? "—" : `${confirmacao.prazoRecebimentoDiasSnapshot} dias`}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Valor a creditar: {confirmacao?.valorLiquidoPrevisto == null
                        ? "—" : moeda.format(confirmacao.valorLiquidoPrevisto)}</Typography>
                    <Typography variant="body2">Data prevista: {formatarData(confirmacao?.dataPrevistaRecebimento ?? null)}</Typography>
                    <Typography variant="body2">Forma: {formaConfirmacao}{confirmacao?.configuracaoNomeExibicao
                        ? ` · ${confirmacao.configuracaoNomeExibicao}` : ""}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        A entrada será registrada na Conta Financeira do snapshot histórico do Pagamento.
                    </Typography>
                    {erroLiquidacao && <Alert severity="error">{erroLiquidacao}</Alert>}
                </Stack></DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmacao(null)} disabled={liquidando}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={liquidando || confirmacao?.status !== "PENDENTE"}
                        aria-busy={liquidando}>{liquidando ? "Liquidando…" : "Liquidar"}</Button>
                </DialogActions>
            </Box>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
        {agendaAberta && <AgendaRecebimentos onFechar={() => setAgendaAberta(false)} onAlterado={() => { setCarregando(true); setTentativa(v => v + 1); }} />}
    </PageContainer>;
}
