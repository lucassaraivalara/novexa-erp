import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FilterAltOffRoundedIcon from "@mui/icons-material/FilterAltOffRounded";
import { Alert, Box, Button, CircularProgress, IconButton, MenuItem, Paper, Snackbar, TextField, Tooltip, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import StatusChip from "../../components/ui/StatusChip";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import { buscarCliente } from "../../services/clienteService";
import { buscarContaReceber, listarContasReceber, mensagemContaReceber, resumirContasReceber } from "../../services/contaReceberService";
import type { Cliente } from "../../types/cliente";
import type { ContaReceber, OrigemContaReceber, ResumoContasReceber, StatusContaReceber } from "../../types/contaReceber";
import ContaReceberForm from "./ContaReceberForm";
import ContaReceberDetalhe from "./ContaReceberDetalhe";
import ContaReceberBaixaDialog from "./ContaReceberBaixaDialog";
import { formatarData, hoje, moeda, podeReceberConta, rotulosStatus } from "./contaReceberUtils";

const filtrosVazios = { termo: "", status: "", origem: "", vencimentoDe: "", vencimentoAte: "" };
export default function ContasReceber() {
    const [parametros] = useSearchParams();
    const [contas, setContas] = useState<ContaReceber[]>([]);
    const [resumo, setResumo] = useState<ResumoContasReceber | null>(null);
    const [erroResumo, setErroResumo] = useState("");
    const [erro, setErro] = useState("");
    const [erroOperacao, setErroOperacao] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [abrindo, setAbrindo] = useState(false);
    const abrindoRef = useRef(false);
    const [revisao, setRevisao] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [size, setSize] = useState(25);
    const [totalItems, setTotalItems] = useState(0);
    const [filtros, setFiltros] = useState(filtrosVazios);
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [ordenacao, setOrdenacao] = useState({ campo: "dataVencimento", direcao: "asc" as "asc" | "desc" });
    const [editor, setEditor] = useState<{ conta: ContaReceber | null; clienteInicial?: Cliente } | null>(null);
    const [detalhe, setDetalhe] = useState<number | null>(() => {
        const id = Number(parametros.get("contaId"));
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    });
    const [recebimento, setRecebimento] = useState<ContaReceber | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        resumirContasReceber(controller.signal).then(r => { if (!controller.signal.aborted) { setResumo(r); setErroResumo(""); } })
            .catch(e => { if (!controller.signal.aborted) setErroResumo(mensagemContaReceber(e, "Não foi possível carregar o resumo.")); });
        return () => controller.abort();
    }, [revisao]);
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarContasReceber({ page: pagina, size, sort: `${ordenacao.campo},${ordenacao.direcao}`,
                termo: filtros.termo.trim() || undefined, status: filtros.status as StatusContaReceber || undefined,
                origem: filtros.origem as OrigemContaReceber || undefined, clienteId: cliente?.id,
                vencimentoDe: filtros.vencimentoDe || undefined, vencimentoAte: filtros.vencimentoAte || undefined }, controller.signal)
                .then(r => { if (!controller.signal.aborted) {
                    setContas(r.items); setTotalItems(r.totalItems); setErro("");
                    if (pagina > 0 && !r.items.length) setPagina(Math.max(0, r.totalPages - 1));
                } }).catch(e => { if (!controller.signal.aborted) setErro(mensagemContaReceber(e, "Não foi possível carregar as contas.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, filtros.termo.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [pagina, size, ordenacao, filtros, cliente, revisao]);

    function alterarFiltro(campo: keyof typeof filtros, valor: string) { setFiltros(f => ({ ...f, [campo]: valor })); setPagina(0); }
    function alterada(mensagem: string) { setRevisao(n => n + 1); setSucesso(mensagem); }
    async function abrirEdicao(conta: ContaReceber) {
        if (abrindoRef.current) return;
        abrindoRef.current = true; setAbrindo(true); setErroOperacao("");
        try { setEditor({ conta, clienteInicial: await buscarCliente(conta.cliente.id) }); }
        catch (e) { setErroOperacao(mensagemContaReceber(e, "Não foi possível abrir o cadastro.")); }
        finally { abrindoRef.current = false; setAbrindo(false); }
    }
    async function abrirRecebimento(conta: ContaReceber) {
        if (abrindoRef.current) return;
        abrindoRef.current = true; setAbrindo(true); setErroOperacao("");
        try { const atual = await buscarContaReceber(conta.id); if (podeReceberConta(atual)) setRecebimento(atual);
            else { setDetalhe(conta.id); setRevisao(n => n + 1); } }
        catch (e) { setErroOperacao(mensagemContaReceber(e, "Não foi possível abrir o recebimento.")); }
        finally { abrindoRef.current = false; setAbrindo(false); }
    }
    const colunas: Coluna<ContaReceber>[] = [
        { campo: "descricao", cabecalho: "Descrição", largura: 220, ordenavel: true },
        { campo: "cliente.nome", cabecalho: "Cliente", largura: 180 },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 125, ordenavel: true, render: v => formatarData(String(v)) },
        { campo: "valorOriginal", cabecalho: "Original", largura: 110, alinhar: "right", ordenavel: true, render: v => moeda.format(Number(v)) },
        { campo: "valorRecebido", cabecalho: "Recebido", largura: 110, alinhar: "right", ordenavel: true, render: v => moeda.format(Number(v)) },
        { campo: "saldo", cabecalho: "Em aberto", largura: 110, alinhar: "right", render: v => moeda.format(Number(v)) },
        { campo: "status", cabecalho: "Status", largura: 145, ordenavel: true, render: (_, c) => <StatusChip status={c.status}
            label={rotulosStatus[c.status] + ((c.status === "PENDENTE" || c.status === "PARCIAL") && c.dataVencimento < hoje() ? " · Vencida" : "")} /> },
    ];
    const acoes: AcaoTabela<ContaReceber>[] = [
        { rotulo: "Consultar histórico", icone: <HistoryRoundedIcon />, onClick: c => setDetalhe(c.id) },
        { rotulo: "Receber", icone: <CheckCircleOutlineRoundedIcon />, onClick: c => void abrirRecebimento(c), desabilitado: c => abrindo || !podeReceberConta(c) },
    ];
    const resumos = [
        ["vencidas", "Vencidas", "error.main"], ["seteDias", "A vencer em 7 dias", "warning.main"],
        ["trintaDias", "A vencer em 30 dias", "info.main"], ["emAberto", "Total em aberto", "primary.main"],
        ["recebidasMes", "Recebido neste mês", "success.main"],
    ] as const;
    return <PageContainer>
        <PageHeader titulo="Contas a Receber" acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />}
            onClick={() => setEditor({ conta: null })}>Nova conta</Button>}
            acoesSecundarias={<Tooltip title="Atualizar"><IconButton aria-label="Atualizar contas" onClick={() => setRevisao(n => n + 1)}><RefreshRoundedIcon /></IconButton></Tooltip>} />
        {erroOperacao && <Alert severity="error" onClose={() => setErroOperacao("")}>{erroOperacao}</Alert>}
        {abrindo && <CircularProgress size={20} aria-label="Abrindo operação" />}
        {erroResumo ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Button>}>{erroResumo}</Alert>
            : <Box component="section" aria-label="Resumo financeiro de contas a receber" sx={{ display: "grid", gap: 1.5,
                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" } }}>
                {resumos.map(([campo, titulo, cor]) => <Paper variant="outlined" key={campo} sx={{ p: 1.5, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{titulo}</Typography>
                    <Typography sx={{ mt: 0.75, fontSize: 20, lineHeight: 1.25, fontWeight: 700, color: cor, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                        {resumo ? moeda.format(resumo[campo].total) : "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">{resumo ? `${resumo[campo].quantidade} ${campo === "recebidasMes"
                        ? resumo[campo].quantidade === 1 ? "recebimento" : "recebimentos"
                        : resumo[campo].quantidade === 1 ? "conta" : "contas"}` : "Carregando…"}</Typography>
                </Paper>)}
            </Box>}
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Button>}>{erro}</Alert>}
        <PageFilters busca={{ valor: filtros.termo, placeholder: "Buscar descrição, cliente ou documento", onChange: v => alterarFiltro("termo", v) }}>
            <TextField select size="small" label="Status" value={filtros.status} sx={{ minWidth: 145 }} onChange={e => alterarFiltro("status", e.target.value)}>
                <MenuItem value="">Todos</MenuItem>{Object.entries(rotulosStatus).map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
            </TextField>
            <ClienteAutocomplete value={cliente} label="Cliente" placeholder="Buscar cliente" size="small" minWidth={210} incluirInativos
                onChange={c => { setCliente(c); setPagina(0); }} />
            <TextField select size="small" label="Origem" value={filtros.origem} sx={{ minWidth: 135 }} onChange={e => alterarFiltro("origem", e.target.value)}>
                <MenuItem value="">Todas</MenuItem><MenuItem value="MANUAL">Manual</MenuItem><MenuItem value="VENDA_A_PRAZO">Venda a prazo</MenuItem>
            </TextField>
            {([ ["vencimentoDe", "Vencimento de"], ["vencimentoAte", "Vencimento até"] ] as const).map(([campo, label]) =>
                <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]}
                    sx={{ width: { xs: "100%", sm: 165 } }} onChange={e => alterarFiltro(campo, e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />)}
            <Tooltip title="Limpar filtros"><IconButton aria-label="Limpar filtros" onClick={() => { setFiltros(filtrosVazios); setCliente(null); setPagina(0); }}><FilterAltOffRoundedIcon /></IconButton></Tooltip>
        </PageFilters>
        <AppTable colunas={colunas} linhas={contas} acoes={acoes} carregando={carregando} minWidth={1100} compacta
            obterChaveLinha={c => c.id} onLinhaClick={c => setDetalhe(c.id)} ordenacaoRemota
            ordenacao={{ ...ordenacao, onSort: campo => { setPagina(0); setOrdenacao(o => ({ campo, direcao: o.campo === campo && o.direcao === "asc" ? "desc" : "asc" })); } }}
            paginacao={{ pagina, linhasPorPagina: size, total: totalItems, onPageChange: setPagina, onRowsPerPageChange: n => { setSize(n); setPagina(0); } }}
            vazio={{ titulo: "Nenhuma conta encontrada", descricao: "Cadastre uma conta ou ajuste os filtros." }} />
        {detalhe !== null && <ContaReceberDetalhe key={`detalhe-${detalhe}`} id={detalhe} revisao={revisao} onFechar={() => setDetalhe(null)}
            onEditar={c => void abrirEdicao(c)} onReceber={c => void abrirRecebimento(c)} onAlterada={alterada} />}
        {editor && <ContaReceberForm key={`editor-${editor.conta?.id ?? "nova"}`} {...editor} onFechar={() => setEditor(null)}
            onSalvo={() => { setEditor(null); alterada("Conta salva."); }} />}
        {recebimento && <ContaReceberBaixaDialog key={`baixa-${recebimento.id}`} conta={recebimento} onFechar={() => setRecebimento(null)}
            onSalvo={() => { setRecebimento(null); alterada("Recebimento registrado."); }} />}
        <Snackbar open={!!sucesso} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
