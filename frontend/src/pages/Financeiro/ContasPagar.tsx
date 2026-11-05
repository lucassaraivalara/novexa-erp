import { hojeBrasilia, formatarData } from "../../utils/dataHora";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Collapse, IconButton, Tooltip, Link, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Skeleton, Snackbar, Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import { buscarContaPagar, cancelarConta, estornarConta, listarContasPagar,
    mensagemContaPagar, listarCategoriasContasPagar, resumirContasPagar,
    type ResumoContasPagar } from "../../services/contaPagarService";
import { listarContasFinanceiras } from "../../services/contaFinanceiraService";
import type { ContaPagar, StatusContaPagar } from "../../types/contaPagar";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import ContaPagarDrawer from "./ContaPagarDrawer";
import PagamentoContaPagarDialog from "./PagamentoContaPagarDialog";
import { emAberto } from "./contaPagarCalculos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = formatarData;
const rotulos: Record<StatusContaPagar, string> = { ABERTA: "Aberta", PARCIALMENTE_PAGA: "Parcialmente paga", PAGA: "Paga", CANCELADA: "Cancelada" };
const hoje = hojeBrasilia;
const ordemColunas = ["fornecedorNome", "documento", "descricao", "dataVencimento", "status", "id", "valor", "valorPago", "acoes"];

export default function ContasPagar() {
    const [parametros, setParametros] = useSearchParams();
    const contaIdParametro = parametros.get("contaId");
    const [detalhe, setDetalhe] = useState<ContaPagar | null>(null);
    const [erroDetalhe, setErroDetalhe] = useState("");
    const [tentativaDetalhe, setTentativaDetalhe] = useState(0);
    const [contas, setContas] = useState<ContaPagar[]>([]);
    const [fornecedorFiltro, setFornecedorFiltro] = useState<FornecedorOpcao | null>(null);
    const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [status, setStatus] = useState("todas");
    const [filtros, setFiltros] = useState({ fornecedor: "", categoria: "", vencimentoDe: "",
        vencimentoAte: "", emissaoDe: "", emissaoAte: "" });
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [totalItems, setTotalItems] = useState(0);
    const [categorias, setCategorias] = useState<string[]>([]);
    const [resumo, setResumo] = useState<ResumoContasPagar>({
        vencidas: { total: 0, quantidade: 0 }, seteDias: { total: 0, quantidade: 0 },
        trintaDias: { total: 0, quantidade: 0 }, emAberto: { total: 0, quantidade: 0 }, pagasMes: { total: 0, quantidade: 0 },
    });
    const [ordenacao, setOrdenacao] = useState({ campo: "dataVencimento", direcao: "asc" as "asc" | "desc" });
    const [editor, setEditor] = useState<{ conta: ContaPagar | null } | null>(null);
    const [pagamento, setPagamento] = useState<ContaPagar | null>(null);
    const [maisFiltros, setMaisFiltros] = useState(false);
    const [carregandoResumo, setCarregandoResumo] = useState(true);
    const [erroResumo, setErroResumo] = useState("");
    const [retryResumo, setRetryResumo] = useState(0);
    const [resumoRevisao, setResumoRevisao] = useState(-1);
    const consultandoResumo = carregandoResumo || resumoRevisao !== tentativa;
    const [confirmacao, setConfirmacao] = useState<{ conta: ContaPagar; tipo: "cancelar" | "estornar" } | null>(null);
    const [processando, setProcessando] = useState(false);
    const [menuAcoes, setMenuAcoes] = useState<{ ancora: HTMLElement; conta: ContaPagar } | null>(null);

    useEffect(() => {
        if (contaIdParametro === null) return;
        const controller = new AbortController();
        if (!/^[1-9]\d*$/.test(contaIdParametro) || !Number.isSafeInteger(Number(contaIdParametro))) {
            const timer = setTimeout(() => setErroDetalhe("Informe uma conta a pagar válida para abrir o detalhe."), 0);
            return () => clearTimeout(timer);
        }
        buscarContaPagar(Number(contaIdParametro), controller.signal).then(conta => {
            if (!controller.signal.aborted) { setDetalhe(conta); setErroDetalhe(""); }
        }).catch(e => { if (!controller.signal.aborted) setErroDetalhe(mensagemContaPagar(e, "Não foi possível abrir a conta vinculada.")); });
        return () => controller.abort();
    }, [contaIdParametro, tentativaDetalhe]);

    function fecharDetalhe() {
        setDetalhe(null); setErroDetalhe("");
        if (parametros.has("contaId")) {
            const novos = new URLSearchParams(parametros); novos.delete("contaId"); setParametros(novos, { replace: true });
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            listarContasFinanceiras(controller.signal),
            listarCategoriasContasPagar(controller.signal)
        ])
            .then(([contasFinanceirasLista, categoriasLista]) => {
                if (!controller.signal.aborted) {
                    setCategorias(categoriasLista);
                    setContasFinanceiras(contasFinanceirasLista);
                    setErro("");
                }
            })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível carregar as contas.")); });
        return () => controller.abort();
    }, [tentativa]);

    useEffect(() => {
        const controller = new AbortController();
        resumirContasPagar(controller.signal).then(valor => {
            if (!controller.signal.aborted) { setResumo(valor); setErroResumo(""); }
        }).catch(e => {
            if (!controller.signal.aborted) setErroResumo(mensagemContaPagar(e, "Não foi possível consultar os indicadores."));
        }).finally(() => { if (!controller.signal.aborted) { setCarregandoResumo(false); setResumoRevisao(tentativa); } });
        return () => controller.abort();
    }, [tentativa, retryResumo]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarContasPagar({ page: pagina, size: porPagina, sort: `${ordenacao.campo},${ordenacao.direcao}`,
                busca: busca || undefined, status: status === "todas" ? undefined : status,
                fornecedor: filtros.fornecedor ? Number(filtros.fornecedor) : undefined,
                categoria: filtros.categoria || undefined, vencimentoDe: filtros.vencimentoDe || undefined,
                vencimentoAte: filtros.vencimentoAte || undefined, emissaoDe: filtros.emissaoDe || undefined,
                emissaoAte: filtros.emissaoAte || undefined }, controller.signal)
                .then(resposta => {
                    if (controller.signal.aborted) return;
                    setContas(resposta.items); setTotalItems(resposta.totalItems); setErro("");
                    if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
                })
                .catch(e => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível carregar as contas.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [pagina, porPagina, ordenacao, busca, status, filtros, tentativa]);

    function alterarFiltro(campo: keyof typeof filtros, valor: string) {
        setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    const hojeLocal = hoje();
    const resumos = [
        { titulo: "Vencidas", valor: resumo.vencidas, cor: "error.main" },
        { titulo: "A vencer em 7 dias", valor: resumo.seteDias, cor: "warning.main" },
        { titulo: "A vencer em 30 dias", valor: resumo.trintaDias, cor: "info.main" },
        { titulo: "Total em aberto", valor: resumo.emAberto, cor: "primary.main" },
        { titulo: "Pago neste mês", valor: resumo.pagasMes, cor: "success.main" },
    ];

    function abrirPagamento(conta: ContaPagar) {
        setPagamento(conta);
        setErro("");
    }

    function abrirConfirmacao(conta: ContaPagar, tipo: "cancelar" | "estornar") {
        setErro("");
        if (tipo === "estornar" && conta.pagamentoAtualId) { setDetalhe(conta); return; }
        setConfirmacao({ conta, tipo });
    }

    async function confirmarAcao() {
        if (!confirmacao || processando) return;
        setProcessando(true); setErro("");
        try {
            if (confirmacao.tipo === "cancelar") await cancelarConta(confirmacao.conta.id);
            else await estornarConta(confirmacao.conta.id);
            setSucesso(confirmacao.tipo === "cancelar" ? "Conta cancelada." : "Pagamento estornado.");
            setConfirmacao(null);
            setTentativa((n) => n + 1);
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível concluir a ação.")); }
        finally { setProcessando(false); }
    }

    const colunas: Coluna<ContaPagar>[] = [
        { campo: "descricao", cabecalho: "Descrição", largura: 220, render: (_, conta) => <Box sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{conta.descricao}</Typography>
            {conta.entradaMercadoriaId && <Link variant="caption" href={`/estoque?aba=entradas&entradaId=${conta.entradaMercadoriaId}`} target="_blank" rel="noopener noreferrer">
                {conta.origemVinculoEntrada === "GERADA" ? "Gerada pela entrada" : "Vinculada à entrada"} #{conta.entradaMercadoriaId}
            </Link>}
        </Box> },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 125, render: (valor) => <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{data(String(valor))}</Box> },
        { campo: "id", cabecalho: "Saldo pendente", largura: 150, alinhar: "right", render: (_, conta) =>
            <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: emAberto(conta) > 0 ? "primary.main" : "text.secondary", fontVariantNumeric: "tabular-nums" }}>{moeda.format(emAberto(conta))}</Typography> },
        { campo: "status", cabecalho: "Status", largura: 165, render: (_, conta) =>
            <Chip size="small" variant="outlined" sx={{ height: 28, fontWeight: 600 }} label={emAberto(conta) > 0 && conta.dataVencimento < hojeLocal
                ? conta.status === "PARCIALMENTE_PAGA" ? "Parcial · Vencida" : "Vencida" : rotulos[conta.status]}
                color={conta.status === "PAGA" ? "success" : conta.status === "CANCELADA" ? "default" : conta.dataVencimento < hojeLocal ? "error" : "warning"} /> },
        { campo: "fornecedorNome", cabecalho: "Fornecedor", largura: 160, render: (valor) => <Box component="span" sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{String(valor || "—")}</Box> },
        { campo: "documento", cabecalho: "Documento", largura: 115, render: (valor) => <Box component="span" sx={{ whiteSpace: "normal", overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{String(valor || "—")}</Box> },
        { campo: "valor", cabecalho: "Valor original", largura: 140, alinhar: "right", render: (valor) => <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(valor))}</Box> },
        { campo: "valorPago", cabecalho: "Desembolsado", largura: 140, alinhar: "right", render: (valor) => <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(valor ?? 0))}</Box> },
        { campo: "acoes", cabecalho: "Ações", largura: 208, render: (_, conta) => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", "& .MuiIconButton-root": { width: 32, height: 32, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } } }}>
            {(conta.status === "ABERTA" || conta.status === "PARCIALMENTE_PAGA") && <Button size="small" variant="contained" disableElevation sx={{ minWidth: 58 }} aria-label="Pagar conta" onClick={() => abrirPagamento(conta)}>Pagar</Button>}
            {acoes.slice(0, 2).map(acao => <Tooltip key={acao.rotulo} title={acao.tooltip ?? acao.rotulo}><span><IconButton size="small" aria-label={acao.tooltip ?? acao.rotulo} disabled={acao.desabilitado?.(conta)} color={acao.cor ?? "inherit"} onClick={() => acao.onClick(conta)}>{acao.icone}</IconButton></span></Tooltip>)}
            <Tooltip title="Mais ações"><IconButton size="small" aria-label={`Mais ações da conta #${conta.id}`} aria-haspopup="menu"
                aria-controls={menuAcoes?.conta.id === conta.id ? "menu-acoes-conta" : undefined} aria-expanded={menuAcoes?.conta.id === conta.id ? true : undefined}
                onClick={evento => setMenuAcoes({ ancora: evento.currentTarget, conta })}><MoreVertRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack> },
    ];
    const acoes: AcaoTabela<ContaPagar>[] = [
        { rotulo: "Consultar conta", icone: <VisibilityOutlinedIcon fontSize="small" />, onClick: setDetalhe, tooltip: "Consultar conta" },
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (conta) => setEditor({ conta }),
            desabilitado: (conta) => conta.status !== "ABERTA", tooltip: "Editar conta aberta" },
        { rotulo: "Cancelar", icone: <CancelOutlinedIcon fontSize="small" />, onClick: (conta) => abrirConfirmacao(conta, "cancelar"),
            desabilitado: (conta) => conta.status !== "ABERTA" || conta.origemVinculoEntrada === "GERADA", cor: "error", tooltip: "Cancelar conta (geradas são canceladas pela entrada)" },
        { rotulo: "Estornar", icone: <UndoRoundedIcon fontSize="small" />, onClick: (conta) => abrirConfirmacao(conta, "estornar"),
            desabilitado: (conta) => conta.status !== "PAGA" && conta.status !== "PARCIALMENTE_PAGA", tooltip: "Estornar pagamento" },
    ];

    return <PageContainer>
        <PageHeader titulo="Contas a Pagar" descricao="Consulte vencimentos e saldos pendentes. Registre pagamentos integrais ou parciais nas contas financeiras de origem."
            acoesSecundarias={<Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ conta: null })}>Nova conta</Button>} />
        {erroDetalhe && <Alert severity="error" onClose={fecharDetalhe} action={<Button color="inherit" onClick={() => setTentativaDetalhe(n => n + 1)}>Tentar novamente</Button>}>{erroDetalhe}</Alert>}
        {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro("")}
            action={contas.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        <Typography variant="caption" component="p" sx={{ mb: 1 }}>Resumo global da empresa · Filtros afetam somente a tabela.</Typography>
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1 }}>Prazos cumulativos, incluindo hoje: 30 dias contém 7 dias; não some essas faixas.</Typography>
        {erroResumo && <Alert severity="error" action={<Button onClick={() => { setCarregandoResumo(true); setErroResumo(""); setRetryResumo(n => n + 1); }}>Tentar indicadores novamente</Button>}>{erroResumo}</Alert>}
        <Box component="section" aria-label="Resumo de contas a pagar" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
            {resumos.map((resumo) => <Paper key={resumo.titulo} variant="outlined" sx={{ p: 1.75, borderTop: 3, borderTopColor: resumo.cor, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">{resumo.titulo}</Typography>
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, mt: 0.5, overflowWrap: "anywhere" }}>{consultandoResumo ? <Skeleton aria-label="Consultando indicador" /> : erroResumo ? "Indisponível" : moeda.format(resumo.valor.total)}</Typography>
                <Typography variant="caption" color="text.secondary">{consultandoResumo ? "Consultando…" : erroResumo ? "Consulta não confirmada" : resumo.valor.quantidade === 0 ? "Sem movimento" : resumo.valor.quantidade} {!consultandoResumo && !erroResumo && resumo.valor.quantidade > 0 && (resumo.titulo === "Pago neste mês"
                    ? resumo.valor.quantidade === 1 ? "baixa" : "baixas" : resumo.valor.quantidade === 1 ? "conta" : "contas")}</Typography>
            </Paper>)}
        </Box>
        <PageFilters busca={{ placeholder: "Buscar por descrição, documento, fornecedor ou categoria", valor: busca,
            onChange: (valor) => { setBusca(valor); setPagina(0); } }}>
            <TextField select size="small" label="Status" value={status} sx={{ minWidth: 150 }}
                onChange={(e) => { setStatus(e.target.value); setPagina(0); }}>
                    <MenuItem value="todas">Todos os status</MenuItem>
                    <MenuItem value="ABERTA">Abertas</MenuItem>
                    <MenuItem value="PARCIALMENTE_PAGA">Parcialmente pagas</MenuItem>
                    <MenuItem value="PAGA">Pagas</MenuItem>
                    <MenuItem value="CANCELADA">Canceladas</MenuItem>
            </TextField>
            <Button aria-expanded={maisFiltros} aria-controls="filtros-adicionais" onClick={() => setMaisFiltros(v => !v)}>Mais filtros{[filtros.fornecedor, filtros.categoria, filtros.emissaoDe, filtros.emissaoAte].some(Boolean) ? " · filtros ativos" : ""}</Button>
            <Collapse in={maisFiltros} id="filtros-adicionais" sx={{ width: "100%" }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <FornecedorAutocomplete size="small" minWidth={220} value={fornecedorFiltro} placeholder="Todos"
                onChange={(item) => { setFornecedorFiltro(item); alterarFiltro("fornecedor", item ? String(item.id) : ""); }} />
            <TextField select size="small" label="Categoria" value={filtros.categoria} sx={{ minWidth: 160 }}
                onChange={(e) => alterarFiltro("categoria", e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {categorias.map((categoria) => <MenuItem key={categoria} value={categoria}>{categoria}</MenuItem>)}
            </TextField>
            {([ ["emissaoDe", "Emissão de"], ["emissaoAte", "Emissão até"] ] as const).map(([campo, label]) =>
                <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]}
                    onChange={(e) => alterarFiltro(campo, e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: { xs: "100%", sm: 175 } }} />)}
            </Stack></Collapse>
            {([ ["vencimentoDe", "Vencimento de"], ["vencimentoAte", "Vencimento até"] ] as const).map(([campo, label]) =>
                <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]} onChange={e => alterarFiltro(campo, e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: { xs: "100%", sm: 175 } }} />)}
            <Button size="small" onClick={() => { setBusca(""); setStatus("todas"); setFornecedorFiltro(null); setFiltros({ fornecedor: "", categoria: "", vencimentoDe: "", vencimentoAte: "", emissaoDe: "", emissaoAte: "" }); setPagina(0); }}>
                Limpar filtros
            </Button>
        </PageFilters>
        <AppTable colunas={[...colunas].sort((a, b) => ordemColunas.indexOf(String(a.campo)) - ordemColunas.indexOf(String(b.campo))).map(coluna => ({ ...coluna,
            ordenavel: ["dataVencimento", "valor", "status"].includes(coluna.campo) }))}
            sx={{
                "& tbody .MuiTableCell-root": { py: 1, px: 1.5, verticalAlign: "middle" },
                "& thead .MuiTableCell-root": { px: 1.5 },
                "& tbody .MuiTableCell-root:nth-of-type(6)": { bgcolor: "action.hover" },
                "& > footer": { gap: 1, py: 0.75, alignItems: { xs: "flex-start", sm: "center" } },
                "& .MuiTablePagination-root": { flex: { xs: "1 1 100%", sm: "0 0 auto" } },
                "& .MuiTablePagination-actions .MuiIconButton-root": { width: 36, height: 36, border: 1, borderColor: "divider", borderRadius: 1 },
            }}
            linhas={contas} carregando={carregando}
            ordenacaoRemota
            ordenacao={{ ...ordenacao, onSort: campo => {
                setPagina(0); setOrdenacao(atual => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
            } }}
            obterChaveLinha={(conta) => conta.id} minWidth={1423}
            vazio={{ titulo: "Nenhuma conta encontrada", descricao: busca || status !== "todas" || Object.values(filtros).some(Boolean) ? "Ajuste os filtros para consultar outras contas." : "Cadastre a primeira conta a pagar." }}
            paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
                onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }} />
        <Menu id="menu-acoes-conta" anchorEl={menuAcoes?.ancora} open={Boolean(menuAcoes)} onClose={() => setMenuAcoes(null)}
            slotProps={{ list: { "aria-label": "Ações secundárias da conta" } }}>
            {menuAcoes && acoes.slice(2).map(acao => <MenuItem key={acao.rotulo} aria-label={acao.tooltip ?? acao.rotulo} title={acao.tooltip ?? acao.rotulo}
                disabled={acao.desabilitado?.(menuAcoes.conta)} sx={{ color: acao.cor === "error" ? "error.main" : undefined, minHeight: 40 }}
                onClick={() => { const conta = menuAcoes.conta; setMenuAcoes(null); acao.onClick(conta); }}>
                <ListItemIcon sx={{ color: "inherit" }}>{acao.icone}</ListItemIcon><ListItemText>{acao.rotulo === "Cancelar" ? "Cancelar conta" : "Estornar pagamento"}</ListItemText>
            </MenuItem>)}
        </Menu>
        {editor && <ContaPagarDrawer key={editor.conta?.id ?? "nova"} conta={editor.conta}
            onFechar={() => setEditor(null)} onSalvo={() => { setTentativa(n => n + 1); setEditor(null); setSucesso("Conta salva."); }} />}
        {detalhe && <ContaPagarDrawer key={`detalhe-${detalhe.id}`} conta={detalhe} somenteLeitura onFechar={fecharDetalhe}
            onSalvo={conta => { setDetalhe(conta); setTentativa(n => n + 1); setSucesso("Pagamento estornado. Saldo pendente atualizado."); }} />}
        {pagamento && <PagamentoContaPagarDialog key={pagamento.id} conta={pagamento} contasFinanceiras={contasFinanceiras}
            onFechar={() => setPagamento(null)} onConcluido={mensagem => { setPagamento(null); setSucesso(mensagem); setTentativa(n => n + 1); }} />}
        <Dialog open={confirmacao !== null} onClose={processando ? undefined : () => setConfirmacao(null)} aria-labelledby="acao-conta-titulo">
            <DialogTitle id="acao-conta-titulo">{confirmacao?.tipo === "cancelar" ? "Cancelar conta?" : "Estornar pagamento?"}</DialogTitle>
            <DialogContent><Stack spacing={2}>
                <Typography variant="body2">{confirmacao?.tipo === "cancelar"
                    ? `A conta ${confirmacao.conta.descricao} será cancelada e permanecerá no histórico.`
                    : "O título voltará a ficar aberto. Todas as origens do pagamento serão estornadas juntas, recompondo os respectivos saldos financeiros."}</Typography>
                {erro && <Alert severity="error">{erro}</Alert>}
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setConfirmacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" color={confirmacao?.tipo === "cancelar" ? "error" : "primary"}
                    onClick={() => void confirmarAcao()} disabled={processando}>{processando ? "Salvando…" : confirmacao?.tipo === "cancelar" ? "Cancelar conta" : "Estornar pagamento"}</Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
