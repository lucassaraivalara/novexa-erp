import { useEffect, useRef, useState } from "react";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, MenuItem, Snackbar, Stack, TextField, Tooltip, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import PageHeader from "../../components/ui/PageHeader";
import StatusChip from "../../components/ui/StatusChip";
import { listarRecebiveis, liquidarRecebivel, mensagemRecebivel } from "../../services/recebivelService";
import type { Recebivel, StatusRecebivel, TipoRecebivel } from "../../types/recebivel";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
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
    const data = new Date(comHora ? valor : `${valor}T12:00:00`);
    return Number.isNaN(data.getTime()) ? "—" : comHora
        ? data.toLocaleString("pt-BR")
        : data.toLocaleDateString("pt-BR");
}

export default function Recebiveis() {
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
    const [filtros, setFiltros] = useState({ status: "", tipo: "", dataInicial: "", dataFinal: "", vendaId: "" });
    const [confirmacao, setConfirmacao] = useState<Recebivel | null>(null);
    const [liquidando, setLiquidando] = useState(false);
    const liquidandoRef = useRef(false);

    useEffect(() => {
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
            vendaId: filtros.vendaId ? Number(filtros.vendaId) : undefined,
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
    }, [pagina, porPagina, ordenacao, filtros, tentativa]);

    function alterarFiltro(campo: keyof typeof filtros, valor: string) {
        setCarregando(true);
        setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    function abrirConfirmacao(recebivel: Recebivel) {
        if (recebivel.status !== "PENDENTE" || liquidandoRef.current) return;
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
        { campo: "vendaId", cabecalho: "Venda", largura: 90, render: (_, item) => `#${item.vendaId}` },
        { campo: "dataVenda", cabecalho: "Data da venda", largura: 160, ordenavel: true,
            render: (_, item) => formatarData(item.dataVenda, true) },
        { campo: "configuracaoNomeExibicao", cabecalho: "Forma / configuração", largura: 190,
            render: (_, item) => item.configuracaoNomeExibicao ?? "—" },
        { campo: "tipo", cabecalho: "Tipo", largura: 100, ordenavel: true,
            render: (_, item) => tipos[item.tipo] },
        { campo: "numeroParcela", cabecalho: "Parcela", largura: 90,
            render: (_, item) => `${item.numeroParcela}/${item.totalParcelas}` },
        { campo: "valorBruto", cabecalho: "Valor bruto", largura: 130, alinhar: "right", ordenavel: true,
            render: (_, item) => moeda.format(item.valorBruto) },
        { campo: "valorLiquidoPrevisto", cabecalho: "Líquido previsto", largura: 145, alinhar: "right",
            render: (_, item) => item.valorLiquidoPrevisto === null ? "—" : moeda.format(item.valorLiquidoPrevisto) },
        { campo: "dataPrevistaRecebimento", cabecalho: "Previsão", largura: 120, ordenavel: true,
            render: (_, item) => formatarData(item.dataPrevistaRecebimento) },
        { campo: "status", cabecalho: "Status", largura: 125, ordenavel: true,
            render: (_, item) => <StatusChip status={item.status} label={statusLabels[item.status]} /> },
        { campo: "id", cabecalho: "Ações", largura: 70, alinhar: "center", render: (_, item) => item.status === "PENDENTE"
            ? <Tooltip title="Liquidar recebível"><IconButton size="small" aria-label={`Liquidar recebível #${item.id}`}
                onClick={() => abrirConfirmacao(item)}><CreditCardRoundedIcon fontSize="small" /></IconButton></Tooltip>
            : null },
    ];

    const filtroAtivo = Object.values(filtros).some(Boolean);
    const formaConfirmacao = confirmacao ? tipos[confirmacao.tipo] : "";

    return <PageContainer>
        <PageHeader titulo="Recebíveis" descricao="Acompanhe os recebíveis de cartão e registre liquidações." />
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
            <TextField size="small" type="number" label="Venda" value={filtros.vendaId} sx={{ width: { xs: "100%", sm: 130 } }}
                slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
                onChange={(e) => alterarFiltro("vendaId", e.target.value)} />
        </PageFilters>
        <AppTable
            colunas={colunas}
            linhas={items}
            carregando={carregando}
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
                titulo: "Nenhum recebível encontrado",
                descricao: filtroAtivo ? "Ajuste os filtros para consultar outros recebíveis." : "Recebíveis de cartão aparecerão aqui após o faturamento das vendas.",
            }}
            paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
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
                    <Typography variant="body2">Valor: {confirmacao?.valorLiquidoPrevisto === null || !confirmacao
                        ? "—" : moeda.format(confirmacao.valorLiquidoPrevisto)}</Typography>
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
    </PageContainer>;
}
