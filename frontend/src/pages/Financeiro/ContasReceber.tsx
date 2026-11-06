import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Box, Button, CircularProgress, Collapse, IconButton, MenuItem, Paper, Skeleton, Snackbar, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type Coluna } from "../../components/ui/AppTable";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import { buscarCliente } from "../../services/clienteService";
import { buscarContaReceber, listarContasReceber, mensagemContaReceber, resumirContasReceber } from "../../services/contaReceberService";
import type { Cliente } from "../../types/cliente";
import type { ContaReceber, OrigemContaReceber, ResumoContasReceber, StatusContaReceber } from "../../types/contaReceber";
import ContaReceberForm from "./ContaReceberForm";
import ContaReceberDetalhe from "./ContaReceberDetalhe";
import ContaReceberBaixaDialog from "./ContaReceberBaixaDialog";
import ContaReceberMobileList from "./ContaReceberMobileList";
import { formatarData, moeda, podeEditarConta, podeReceberConta, rotulosStatus } from "./contaReceberUtils";

import ContaReceberStatus from "./ContaReceberStatus";
import ContaReceberAcoes, { type AlvoDetalheReceber } from "./ContaReceberAcoes";

const filtrosVazios = { termo: "", status: "", origem: "", vencimentoDe: "", vencimentoAte: "" };
export default function ContasReceber() {
    const theme = useTheme();
    const mobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
    const [parametros] = useSearchParams();
    const [contas, setContas] = useState<ContaReceber[]>([]);
    const [resumo, setResumo] = useState<ResumoContasReceber | null>(null);
    const [erroResumo, setErroResumo] = useState("");
    const [resumoConcluido, setResumoConcluido] = useState({ revisao: -1, tentativa: -1 });
    const [erro, setErro] = useState("");
    const [erroOperacao, setErroOperacao] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [abrindo, setAbrindo] = useState(false);
    const abrindoRef = useRef(false);
    const [revisao, setRevisao] = useState(0);
    const [tentativaResumo, setTentativaResumo] = useState(0);
    const [tentativaListagem, setTentativaListagem] = useState(0);
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
    const [alvoDetalhe, setAlvoDetalhe] = useState<AlvoDetalheReceber>("detalhe");
    const consultandoResumo = resumoConcluido.revisao !== revisao || resumoConcluido.tentativa !== tentativaResumo;
    const [recebimento, setRecebimento] = useState<ContaReceber | null>(null);
    const erroPeriodo = filtros.vencimentoDe && filtros.vencimentoAte && filtros.vencimentoDe > filtros.vencimentoAte
        ? "O vencimento inicial deve ser anterior ou igual ao final." : "";
    const temFiltros = !!cliente || Object.values(filtros).some(valor => !!valor.trim());

    useEffect(() => {
        const controller = new AbortController();
        resumirContasReceber(controller.signal).then(r => { if (!controller.signal.aborted) { setResumo(r); setErroResumo(""); } })
            .catch(e => { if (!controller.signal.aborted) setErroResumo(mensagemContaReceber(e, "Não foi possível carregar o resumo.")); })
            .finally(() => { if (!controller.signal.aborted) setResumoConcluido({ revisao, tentativa: tentativaResumo }); });
        return () => controller.abort();
    }, [revisao, tentativaResumo]);
    useEffect(() => {
        if (erroPeriodo) return;
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
    }, [pagina, size, ordenacao, filtros, cliente, revisao, tentativaListagem, erroPeriodo]);

    function alterarFiltro(campo: keyof typeof filtros, valor: string) { setFiltros(f => ({ ...f, [campo]: valor })); setPagina(0); }
    function alterada(mensagem: string) { setRevisao(n => n + 1); setSucesso(mensagem); }
    function abrirDetalhe(conta: ContaReceber, alvo: AlvoDetalheReceber = "detalhe") { setAlvoDetalhe(alvo); setDetalhe(conta.id); }
    async function abrirEdicao(conta: ContaReceber) {
        if (abrindoRef.current) return;
        abrindoRef.current = true; setAbrindo(true); setErroOperacao("");
        try {
            const atual = await buscarContaReceber(conta.id);
            if (!podeEditarConta(atual)) { abrirDetalhe(atual); return; }
            setEditor({ conta: atual, clienteInicial: await buscarCliente(atual.cliente.id) });
        }
        catch (e) { setErroOperacao(mensagemContaReceber(e, "Não foi possível abrir o cadastro.")); }
        finally { abrindoRef.current = false; setAbrindo(false); }
    }
    async function abrirRecebimento(conta: ContaReceber) {
        if (abrindoRef.current) return;
        abrindoRef.current = true; setAbrindo(true); setErroOperacao("");
        try { const atual = await buscarContaReceber(conta.id); if (podeReceberConta(atual)) setRecebimento(atual);
            else { abrirDetalhe(atual); setRevisao(n => n + 1); } }
        catch (e) { setErroOperacao(mensagemContaReceber(e, "Não foi possível abrir o recebimento.")); }
        finally { abrindoRef.current = false; setAbrindo(false); }
    }
    const colunas: Coluna<ContaReceber>[] = [
        { campo: "cliente.nome", cabecalho: "Cliente", largura: 160, render: (_, c) => <Box sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>{c.cliente.nome}</Box> },
        { campo: "cliente.cpfCnpj", cabecalho: "Documento do cliente", largura: 175, render: (_, c) => <Box component="span" title="CPF/CNPJ do cliente" sx={{ whiteSpace: "normal", overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{c.cliente.cpfCnpj || "—"}</Box> },
        { campo: "descricao", cabecalho: "Descrição", largura: 220, ordenavel: true, render: (_, c) => <Box sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.descricao}</Typography>
            <Typography variant="caption" color="text.secondary">{c.origem === "VENDA_A_PRAZO" ? "Venda a prazo" : "Manual"} · Parcela {c.numeroParcela}/{c.totalParcelas}</Typography>
        </Box> },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 125, ordenavel: true, render: v => formatarData(String(v)) },
        { campo: "status", cabecalho: "Status", largura: 165, ordenavel: true, render: (_, c) => <ContaReceberStatus conta={c} /> },
        { campo: "saldo", cabecalho: "Saldo a receber", largura: 150, alinhar: "right", render: v => <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: Number(v) > 0 ? "primary.main" : "text.secondary", fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(v))}</Typography> },
        { campo: "valorOriginal", cabecalho: "Valor original", largura: 140, alinhar: "right", ordenavel: true, render: v => moeda.format(Number(v)) },
        { campo: "valorRecebido", cabecalho: "Recebido", largura: 130, alinhar: "right", ordenavel: true, render: v => moeda.format(Number(v)) },
        { campo: "acoes", cabecalho: "Ações", largura: 216, render: (_, c) => <ContaReceberAcoes conta={c} abrindo={abrindo} onDetalhe={abrirDetalhe} onEditar={c => void abrirEdicao(c)} onReceber={c => void abrirRecebimento(c)} /> },
    ];
    const resumos = [
        ["vencidas", "Vencidas", "error.main"], ["seteDias", "A vencer em 7 dias", "warning.main"],
        ["trintaDias", "A vencer em 30 dias", "info.main"], ["emAberto", "Total em aberto", "primary.main"],
        ["recebidasMes", "Recebido neste mês", "success.main"],
    ] as const;
    const ordenar = (campo: string) => { setPagina(0); setOrdenacao(o => ({ campo, direcao: o.campo === campo && o.direcao === "asc" ? "desc" : "asc" })); };
    const paginacao = { pagina, linhasPorPagina: size, total: totalItems, onPageChange: setPagina, onRowsPerPageChange: (n: number) => { setSize(n); setPagina(0); } };
    const vazio = { titulo: temFiltros ? "Nenhuma conta encontrada com os filtros atuais." : "Nenhuma conta a receber cadastrada.",
        descricao: temFiltros ? "Ajuste ou limpe os filtros." : "Cadastre uma nova conta a receber." };
    return <PageContainer sx={{ "& > :not(style) ~ :not(style)": { mt: 1.75 } }}>
        <PageHeader titulo="Contas a Receber" descricao="Consulte vencimentos e saldos pendentes. Receber registra uma baixa parcial ou total na conta financeira de destino."
            acoesSecundarias={<><Button variant="outlined" startIcon={<AddRoundedIcon />}
                onClick={() => setEditor({ conta: null })}>Nova conta</Button>
                <Tooltip title="Atualizar"><IconButton aria-label="Atualizar contas" aria-busy={carregando}
                    onClick={() => setRevisao(n => n + 1)}>{carregando ? <CircularProgress size={20} /> : <RefreshRoundedIcon />}</IconButton></Tooltip></>} />
        {erroOperacao && <Alert severity="error" onClose={() => setErroOperacao("")}>{erroOperacao}</Alert>}
        {abrindo && <CircularProgress size={20} aria-label="Abrindo operação" />}
        <Box component="section" aria-label="Resumo financeiro de contas a receber">
            <Typography variant="caption" component="p" sx={{ mb: 1 }}>Resumo global da empresa · Filtros afetam somente a tabela.</Typography>
            <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1 }}>Prazos cumulativos, incluindo hoje: 30 dias contém 7 dias; não some essas faixas.</Typography>
            {erroResumo && !consultandoResumo && <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativaResumo(n => n + 1)}>Tentar novamente</Button>}>Resumo financeiro: {erroResumo}</Alert>}
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" } }}>
                {resumos.map(([campo, titulo, cor]) => <Paper variant="outlined" key={campo} sx={{ p: 1.75, minWidth: 0, borderTop: 3, borderTopColor: cor,
                    gridColumn: campo === "recebidasMes" ? { xs: "1 / -1", sm: "auto" } : undefined }}>
                    <Typography variant="caption" color="text.secondary">{titulo}</Typography>
                    <Typography sx={{ mt: 0.5, fontSize: "1.05rem", lineHeight: 1.4, fontWeight: 700, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                        {consultandoResumo && !resumo ? <Skeleton aria-label="Consultando indicador" /> : erroResumo && !consultandoResumo ? "Indisponível" : resumo ? moeda.format(resumo[campo].total) : "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">{consultandoResumo ? resumo ? "Atualizando…" : "Consultando…" : erroResumo ? "Consulta não confirmada" : resumo && resumo[campo].quantidade > 0
                        ? `${resumo[campo].quantidade} ${campo === "recebidasMes" ? resumo[campo].quantidade === 1 ? "recebimento" : "recebimentos" : resumo[campo].quantidade === 1 ? "conta" : "contas"}` : "Sem movimento"}</Typography>
                </Paper>)}
            </Box>
        </Box>
        <Box component="section" aria-label="Listagem de contas a receber">
        {erro && <Alert severity="error" sx={{ mb: 1.5 }} action={<Button color="inherit" onClick={() => setTentativaListagem(n => n + 1)}>Tentar novamente</Button>}>Listagem de contas: {erro}</Alert>}
        <PageFilters busca={{ valor: filtros.termo, placeholder: "Buscar descrição, cliente ou documento", onChange: v => alterarFiltro("termo", v) }}>
            <TextField select size="small" label="Status" value={filtros.status} sx={{ minWidth: 150 }} onChange={e => alterarFiltro("status", e.target.value)}>
                <MenuItem value="">Todos</MenuItem>{Object.entries(rotulosStatus).map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
            </TextField>
            <Button size="small" aria-expanded={filtrosExpandidos} aria-controls="filtros-contas-receber" onClick={() => setFiltrosExpandidos(v => !v)}>
                Mais filtros{cliente || filtros.origem ? " · filtros ativos" : ""}
            </Button>
            <Collapse in={filtrosExpandidos} id="filtros-contas-receber" sx={{ width: "100%" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: "start", minWidth: 0 }}>
                    <ClienteAutocomplete value={cliente} label="Cliente" placeholder="Buscar cliente" size="small" minWidth={0} incluirInativos onChange={c => { setCliente(c); setPagina(0); }} />
                    <TextField select size="small" label="Origem" value={filtros.origem} sx={{ minWidth: 150, width: { xs: "100%", sm: "auto" } }} onChange={e => alterarFiltro("origem", e.target.value)}>
                        <MenuItem value="">Todas</MenuItem><MenuItem value="MANUAL">Manual</MenuItem><MenuItem value="VENDA_A_PRAZO">Venda a prazo</MenuItem>
                    </TextField>
                </Stack>
            </Collapse>
            {([ ["vencimentoDe", "Vencimento de"], ["vencimentoAte", "Vencimento até"] ] as const).map(([campo, label]) =>
                <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]} sx={{ width: { xs: "100%", sm: 175 } }}
                    error={!!erroPeriodo} helperText={campo === "vencimentoAte" ? erroPeriodo : undefined}
                    onChange={e => alterarFiltro(campo, e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />)}
            <Button size="small" onClick={() => { setFiltros(filtrosVazios); setCliente(null); setPagina(0); }}>Limpar filtros</Button>
        </PageFilters>
        {mobile ? <ContaReceberMobileList contas={contas} carregando={carregando && !erroPeriodo} abrindo={abrindo} vazio={vazio}
            onDetalhe={abrirDetalhe} onEditar={c => void abrirEdicao(c)} onReceber={c => void abrirRecebimento(c)} paginacao={paginacao}
            ordenacao={{ ...ordenacao, onSort: ordenar }} camposOrdenacao={colunas.flatMap(c => c.ordenavel ? [{ campo: String(c.campo), rotulo: c.cabecalho }] : [])} />
            : <AppTable colunas={colunas} linhas={contas} carregando={carregando && !erroPeriodo} minWidth={1481}
            sx={{ "& tbody .MuiTableCell-root": { py: 1, px: 1.5, verticalAlign: "middle" }, "& thead .MuiTableCell-root": { px: 1.5 },
                "& tbody .MuiTableCell-root:nth-of-type(6)": { bgcolor: "action.hover" },
                "& > footer": { gap: 1, py: 0.75 }, "& .MuiTablePagination-actions .MuiIconButton-root": { width: 36, height: 36, border: 1, borderColor: "divider", borderRadius: 1 } }}
            obterChaveLinha={c => c.id} onLinhaClick={c => abrirDetalhe(c)} ordenacaoRemota
            ordenacao={{ ...ordenacao, onSort: ordenar }} paginacao={paginacao} vazio={vazio} />}
        </Box>
        {detalhe !== null && <ContaReceberDetalhe key={`detalhe-${detalhe}`} id={detalhe} revisao={revisao} alvoInicial={alvoDetalhe} onFechar={() => setDetalhe(null)}
            onEditar={c => void abrirEdicao(c)} onReceber={c => void abrirRecebimento(c)} onAlterada={alterada} />}
        {editor && <ContaReceberForm key={`editor-${editor.conta?.id ?? "nova"}`} {...editor} onFechar={() => setEditor(null)}
            onSalvo={() => { setEditor(null); alterada("Conta salva."); }} />}
        {recebimento && <ContaReceberBaixaDialog key={`baixa-${recebimento.id}`} conta={recebimento} onFechar={() => setRecebimento(null)}
            onSalvo={() => { setRecebimento(null); alterada("Recebimento registrado."); }} />}
        <Snackbar open={!!sucesso} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
