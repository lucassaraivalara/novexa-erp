import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Link, MenuItem, Paper, Snackbar, Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import FornecedorAutocomplete, { type FornecedorOpcao } from "../../components/fornecedores/FornecedorAutocomplete";
import { buscarContaPagar, cancelarConta, estornarConta, listarContasPagar,
    mensagemContaPagar, pagarConta, listarCategoriasContasPagar, resumirContasPagar,
    type ResumoContasPagar } from "../../services/contaPagarService";
import { listarContasFinanceiras } from "../../services/contaFinanceiraService";
import type { ContaPagar, StatusContaPagar } from "../../types/contaPagar";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import { rotulosTipoContaFinanceira } from "../../types/contaFinanceira";
import ContaPagarDrawer from "./ContaPagarDrawer";
import { emAberto } from "./contaPagarCalculos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const rotulos: Record<StatusContaPagar, string> = { ABERTA: "Aberta", PAGA: "Paga", CANCELADA: "Cancelada" };
const hoje = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

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
    const [dataPagamento, setDataPagamento] = useState("");
    const [valorPago, setValorPago] = useState("");
    const [contaFinanceiraId, setContaFinanceiraId] = useState<number | "" >("");
    const [confirmacao, setConfirmacao] = useState<{ conta: ContaPagar; tipo: "cancelar" | "estornar" } | null>(null);
    const [processando, setProcessando] = useState(false);

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
            listarCategoriasContasPagar(controller.signal),
            resumirContasPagar(controller.signal)
        ])
            .then(([contasFinanceirasLista, categoriasLista, resumoAtual]) => {
                if (!controller.signal.aborted) {
                    setCategorias(categoriasLista); setResumo(resumoAtual);
                    setContasFinanceiras(contasFinanceirasLista);
                    setErro("");
                }
            })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível carregar as contas.")); });
        return () => controller.abort();
    }, [tentativa]);

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
        setDataPagamento(hoje());
        setValorPago(String(conta.valor).replace(".", ","));
        setContaFinanceiraId("");
        setErro("");
    }

    function abrirConfirmacao(conta: ContaPagar, tipo: "cancelar" | "estornar") {
        setErro("");
        setConfirmacao({ conta, tipo });
    }

    async function confirmarPagamento(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!pagamento || processando) return;
        const valor = Number(valorPago.replace(",", "."));
        if (!Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
            setErro("Informe um valor pago positivo com até duas casas decimais.");
            return;
        }
        if (Math.abs(valor - Number(pagamento.valor)) > 0.000001) {
            setErro("O pagamento deve corresponder ao valor integral da conta.");
            return;
        }
        if (!contaFinanceiraId) {
            setErro("Selecione uma conta financeira.");
            return;
        }
        const contaSelecionada = contasFinanceiras.find((c) => c.id === contaFinanceiraId);
        if (!contaSelecionada) {
            setErro("Conta financeira selecionada não encontrada.");
            return;
        }
        if (Number(contaSelecionada.saldoAtual) < valor) {
            setErro("Saldo insuficiente na conta financeira selecionada.");
            return;
        }
        setProcessando(true); setErro("");
        try {
            await pagarConta(pagamento.id, { contaFinanceiraId, dataPagamento, valorPago: valor });
            setPagamento(null); setSucesso("Pagamento registrado.");
            setTentativa((n) => n + 1);
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível registrar o pagamento.")); }
        finally { setProcessando(false); }
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
        { campo: "descricao", cabecalho: "Histórico", largura: 240, render: (_, conta) => <Box sx={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
            <Typography variant="body2">{conta.descricao}</Typography>
            {conta.entradaMercadoriaId && <Link variant="caption" href={`/estoque?aba=entradas&entradaId=${conta.entradaMercadoriaId}`} target="_blank" rel="noopener noreferrer">
                {conta.origemVinculoEntrada === "GERADA" ? "Gerada pela entrada" : "Vinculada à entrada"} #{conta.entradaMercadoriaId}
            </Link>}
        </Box> },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 130, render: (valor) => data(String(valor)) },
        { campo: "id", cabecalho: "Em aberto", largura: 130, alinhar: "right", render: (_, conta) =>
            <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: "primary.main", fontVariantNumeric: "tabular-nums" }}>{moeda.format(emAberto(conta))}</Typography> },
        { campo: "status", cabecalho: "Status", largura: 110, render: (_, conta) =>
            <Chip size="small" variant="outlined" label={conta.status === "ABERTA" && conta.dataVencimento < hojeLocal ? "Vencida" : rotulos[conta.status]}
                color={conta.status === "PAGA" ? "success" : conta.status === "CANCELADA" ? "default" : conta.dataVencimento < hojeLocal ? "error" : "warning"} /> },
        { campo: "fornecedorNome", cabecalho: "Fornecedor", largura: 170, render: (valor) => String(valor ?? "—") },
        { campo: "documento", cabecalho: "Documento", largura: 135, render: (valor) => String(valor ?? "—") },
        { campo: "categoria", cabecalho: "Categoria", largura: 130, render: (valor) => String(valor ?? "—") },
        { campo: "dataEmissao", cabecalho: "Emissão", largura: 125, render: (valor) => data(valor as string | null) },
        { campo: "valor", cabecalho: "Valor", largura: 130, alinhar: "right", render: (valor) => moeda.format(Number(valor)) },
        { campo: "valorPago", cabecalho: "Pago", largura: 130, alinhar: "right", render: (valor) => moeda.format(Number(valor ?? 0)) },
    ];
    const acoes: AcaoTabela<ContaPagar>[] = [
        { rotulo: "Pagar", icone: <CheckCircleOutlineRoundedIcon fontSize="small" />, onClick: abrirPagamento,
            desabilitado: (conta) => conta.status !== "ABERTA", cor: "primary", tooltip: "Pagar conta" },
        { rotulo: "Consultar conta", icone: <VisibilityOutlinedIcon fontSize="small" />, onClick: setDetalhe, tooltip: "Consultar conta" },
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (conta) => setEditor({ conta }),
            desabilitado: (conta) => conta.status !== "ABERTA", tooltip: "Editar conta aberta" },
        { rotulo: "Cancelar", icone: <CancelOutlinedIcon fontSize="small" />, onClick: (conta) => abrirConfirmacao(conta, "cancelar"),
            desabilitado: (conta) => conta.status !== "ABERTA" || conta.origemVinculoEntrada === "GERADA", cor: "error", tooltip: "Cancelar conta (geradas são canceladas pela entrada)" },
        { rotulo: "Estornar", icone: <UndoRoundedIcon fontSize="small" />, onClick: (conta) => abrirConfirmacao(conta, "estornar"),
            desabilitado: (conta) => conta.status !== "PAGA", tooltip: "Estornar pagamento" },
    ];

    const contaFinanceiraSelecionada = contasFinanceiras.find((c) => c.id === contaFinanceiraId);
    const saldoInsuficiente = Boolean(
        pagamento &&
        contaFinanceiraSelecionada &&
        Number(contaFinanceiraSelecionada.saldoAtual) < Number(pagamento.valor)
    );

    return <PageContainer>
        <PageHeader titulo="Contas a Pagar" descricao="Consulte vencimentos e valores em aberto. Pagar registra o pagamento integral na conta financeira de origem."
            acoesSecundarias={<Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ conta: null })}>Nova conta</Button>} />
        {erroDetalhe && <Alert severity="error" onClose={fecharDetalhe} action={<Button color="inherit" onClick={() => setTentativaDetalhe(n => n + 1)}>Tentar novamente</Button>}>{erroDetalhe}</Alert>}
        {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro("")}
            action={contas.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        <Box component="section" aria-label="Resumo de contas a pagar" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
            {resumos.map((resumo) => <Paper key={resumo.titulo} variant="outlined" sx={{ p: 1.75, borderTop: 3, borderTopColor: resumo.cor, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">{resumo.titulo}</Typography>
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, mt: 0.5, overflowWrap: "anywhere" }}>{moeda.format(resumo.valor.total)}</Typography>
                <Typography variant="caption" color="text.secondary">{resumo.valor.quantidade} {resumo.valor.quantidade === 1 ? "conta" : "contas"}</Typography>
            </Paper>)}
        </Box>
        <PageFilters busca={{ placeholder: "Buscar por descrição, documento, fornecedor ou categoria", valor: busca,
            onChange: (valor) => { setBusca(valor); setPagina(0); } }}>
            <TextField select size="small" label="Status" value={status} sx={{ minWidth: 150 }}
                onChange={(e) => { setStatus(e.target.value); setPagina(0); }}>
                    <MenuItem value="todas">Todos os status</MenuItem>
                    <MenuItem value="ABERTA">Abertas</MenuItem>
                    <MenuItem value="PAGA">Pagas</MenuItem>
                    <MenuItem value="CANCELADA">Canceladas</MenuItem>
            </TextField>
            <FornecedorAutocomplete size="small" minWidth={220} value={fornecedorFiltro} placeholder="Todos"
                onChange={(item) => { setFornecedorFiltro(item); alterarFiltro("fornecedor", item ? String(item.id) : ""); }} />
            <TextField select size="small" label="Categoria" value={filtros.categoria} sx={{ minWidth: 160 }}
                onChange={(e) => alterarFiltro("categoria", e.target.value)}>
                <MenuItem value="">Todas</MenuItem>
                {categorias.map((categoria) => <MenuItem key={categoria} value={categoria}>{categoria}</MenuItem>)}
            </TextField>
            {([ ["vencimentoDe", "Vencimento de"], ["vencimentoAte", "Vencimento até"],
                ["emissaoDe", "Emissão de"], ["emissaoAte", "Emissão até"] ] as const).map(([campo, label]) =>
                <TextField key={campo} size="small" type="date" label={label} value={filtros[campo]}
                    onChange={(e) => alterarFiltro(campo, e.target.value)} slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: { xs: "100%", sm: 175 } }} />)}
            <Button size="small" onClick={() => { setBusca(""); setStatus("todas"); setFornecedorFiltro(null); setFiltros({ fornecedor: "", categoria: "", vencimentoDe: "", vencimentoAte: "", emissaoDe: "", emissaoAte: "" }); setPagina(0); }}>
                Limpar filtros
            </Button>
        </PageFilters>
        <AppTable colunas={colunas.map(coluna => ({ ...coluna,
            ordenavel: ["categoria", "dataEmissao", "dataVencimento", "valor", "status"].includes(coluna.campo) }))}
            linhas={contas} acoes={acoes} carregando={carregando}
            ordenacaoRemota
            ordenacao={{ ...ordenacao, onSort: campo => {
                setPagina(0); setOrdenacao(atual => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
            } }}
            obterChaveLinha={(conta) => conta.id} minWidth={1540}
            vazio={{ titulo: "Nenhuma conta encontrada", descricao: busca || status !== "todas" || Object.values(filtros).some(Boolean) ? "Ajuste os filtros para consultar outras contas." : "Cadastre a primeira conta a pagar." }}
            paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
                onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }} />
        {editor && <ContaPagarDrawer key={editor.conta?.id ?? "nova"} conta={editor.conta}
            onFechar={() => setEditor(null)} onSalvo={() => { setTentativa(n => n + 1); setEditor(null); setSucesso("Conta salva."); }} />}
        {detalhe && <ContaPagarDrawer key={`detalhe-${detalhe.id}`} conta={detalhe} somenteLeitura onFechar={fecharDetalhe} onSalvo={() => {}} />}
        <Dialog open={pagamento !== null} onClose={processando ? undefined : () => setPagamento(null)} fullWidth maxWidth="xs" aria-labelledby="pagar-conta-titulo">
            <form onSubmit={(e) => void confirmarPagamento(e)}>
                <DialogTitle id="pagar-conta-titulo">Pagar conta</DialogTitle>
                <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">{pagamento?.descricao}</Typography>
                    <TextField required fullWidth type="date" label="Data do pagamento" value={dataPagamento}
                        onChange={(e) => setDataPagamento(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField select required fullWidth label="Conta financeira" value={contaFinanceiraId}
                        onChange={(e) => setContaFinanceiraId(e.target.value ? Number(e.target.value) : "")}>
                        <MenuItem value="">Selecione uma conta financeira</MenuItem>
                        {contasFinanceiras
                            .filter((c) => c.ativo)
                            .map((conta) => (
                                <MenuItem key={conta.id} value={conta.id}>
                                    {conta.nome} — {rotulosTipoContaFinanceira[conta.tipo]} — {moeda.format(Number(conta.saldoAtual))}
                                </MenuItem>
                            ))}
                    </TextField>
                    <TextField required fullWidth label="Valor pago (R$)" value={valorPago} helperText="O pagamento deve ser integral." slotProps={{ htmlInput: { inputMode: "decimal" } }}
                        onChange={(e) => setValorPago(e.target.value)} />
                    {erro && <Alert severity="error">{erro}</Alert>}
                </Stack></DialogContent>
                <DialogActions><Button onClick={() => setPagamento(null)} disabled={processando}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={!!processando || !contaFinanceiraId || saldoInsuficiente}>
                        {processando ? "Salvando…" : "Confirmar pagamento"}
                    </Button></DialogActions>
            </form>
        </Dialog>
        <Dialog open={confirmacao !== null} onClose={processando ? undefined : () => setConfirmacao(null)} aria-labelledby="acao-conta-titulo">
            <DialogTitle id="acao-conta-titulo">{confirmacao?.tipo === "cancelar" ? "Cancelar conta?" : "Estornar pagamento?"}</DialogTitle>
            <DialogContent><Stack spacing={2}>
                <Typography variant="body2">{confirmacao?.tipo === "cancelar"
                    ? `A conta ${confirmacao.conta.descricao} será cancelada e permanecerá no histórico.`
                    : "O título voltará a ficar aberto, a movimentação financeira vinculada será estornada e o saldo da conta financeira será recomposto."}</Typography>
                {erro && <Alert severity="error">{erro}</Alert>}
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setConfirmacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" color={confirmacao?.tipo === "cancelar" ? "error" : "primary"}
                    onClick={() => void confirmarAcao()} disabled={processando}>{processando ? "Salvando…" : confirmacao?.tipo === "cancelar" ? "Cancelar conta" : "Estornar pagamento"}</Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
