import { useEffect, useState, type FormEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Paper, Snackbar, Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { cancelarConta, estornarConta, listarContasPagar, listarFornecedoresContaPagar,
    mensagemContaPagar, pagarConta } from "../../services/contaPagarService";
import { listarContasFinanceiras } from "../../services/contaFinanceiraService";
import type { ContaPagar, FornecedorContaPagar, StatusContaPagar } from "../../types/contaPagar";
import type { ContaFinanceira } from "../../types/contaFinanceira";
import { rotulosTipoContaFinanceira } from "../../types/contaFinanceira";
import ContaPagarDrawer from "./ContaPagarDrawer";
import { emAberto, filtrarContas, resumirContas } from "./contaPagarCalculos";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const rotulos: Record<StatusContaPagar, string> = { ABERTA: "Aberta", PAGA: "Paga", CANCELADA: "Cancelada" };
const hoje = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

export default function ContasPagar() {
    const [contas, setContas] = useState<ContaPagar[]>([]);
    const [fornecedores, setFornecedores] = useState<FornecedorContaPagar[]>([]);
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
    const [porPagina, setPorPagina] = useState(10);
    const [editor, setEditor] = useState<{ conta: ContaPagar | null } | null>(null);
    const [pagamento, setPagamento] = useState<ContaPagar | null>(null);
    const [dataPagamento, setDataPagamento] = useState("");
    const [valorPago, setValorPago] = useState("");
    const [contaFinanceiraId, setContaFinanceiraId] = useState<number | "" >("");
    const [confirmacao, setConfirmacao] = useState<{ conta: ContaPagar; tipo: "cancelar" | "estornar" } | null>(null);
    const [processando, setProcessando] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            listarContasPagar(controller.signal),
            listarFornecedoresContaPagar(controller.signal),
            listarContasFinanceiras(controller.signal)
        ])
            .then(([lista, fornecedoresLista, contasFinanceirasLista]) => {
                if (!controller.signal.aborted) {
                    setContas(lista);
                    setFornecedores(fornecedoresLista);
                    setContasFinanceiras(contasFinanceirasLista);
                    setErro("");
                }
            })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível carregar as contas.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [tentativa]);

    function atualizar(conta: ContaPagar) {
        setContas((atuais) => atuais.some((item) => item.id === conta.id)
            ? atuais.map((item) => item.id === conta.id ? conta : item) : [...atuais, conta]);
    }

    function alterarFiltro(campo: keyof typeof filtros, valor: string) {
        setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
        setPagina(0);
    }

    const categorias = [...new Set(contas.map((conta) => conta.categoria).filter((valor): valor is string => Boolean(valor)))].sort();
    const hojeLocal = hoje();
    const resumo = resumirContas(contas, hojeLocal);
    const resumos = [
        { titulo: "Vencidas", valor: resumo.vencidas, cor: "error.main" },
        { titulo: "A vencer em 7 dias", valor: resumo.seteDias, cor: "warning.main" },
        { titulo: "A vencer em 30 dias", valor: resumo.trintaDias, cor: "info.main" },
        { titulo: "Total em aberto", valor: resumo.emAberto, cor: "primary.main" },
        { titulo: "Pago neste mês", valor: resumo.pagasMes, cor: "success.main" },
    ];
    const filtradas = filtrarContas(contas, { ...filtros, busca, status });
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));
    const visiveis = filtradas.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina);

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
            atualizar(await pagarConta(pagamento.id, { contaFinanceiraId, dataPagamento, valorPago: valor }));
            setPagamento(null); setSucesso("Conta marcada como paga.");
            setTentativa((n) => n + 1);
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível registrar o pagamento.")); }
        finally { setProcessando(false); }
    }

    async function confirmarAcao() {
        if (!confirmacao || processando) return;
        setProcessando(true); setErro("");
        try {
            atualizar(confirmacao.tipo === "cancelar"
                ? await cancelarConta(confirmacao.conta.id) : await estornarConta(confirmacao.conta.id));
            setSucesso(confirmacao.tipo === "cancelar" ? "Conta cancelada." : "Pagamento estornado.");
            setConfirmacao(null);
            if (confirmacao.tipo === "estornar") {
                setTentativa((n) => n + 1);
            }
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível concluir a ação.")); }
        finally { setProcessando(false); }
    }

    const colunas: Coluna<ContaPagar>[] = [
        { campo: "descricao", cabecalho: "Histórico", largura: 240 },
        { campo: "fornecedorNome", cabecalho: "Fornecedor", largura: 170, render: (valor) => String(valor ?? "—") },
        { campo: "documento", cabecalho: "Documento", largura: 135, render: (valor) => String(valor ?? "—") },
        { campo: "categoria", cabecalho: "Categoria", largura: 130, render: (valor) => String(valor ?? "—") },
        { campo: "dataEmissao", cabecalho: "Emissão", largura: 125, render: (valor) => data(valor as string | null) },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 130, render: (valor) => data(String(valor)) },
        { campo: "valor", cabecalho: "Valor", largura: 130, alinhar: "right", render: (valor) => moeda.format(Number(valor)) },
        { campo: "valorPago", cabecalho: "Pago", largura: 130, alinhar: "right", render: (valor) => moeda.format(Number(valor ?? 0)) },
        { campo: "id", cabecalho: "Em aberto", largura: 130, alinhar: "right", render: (_, conta) => moeda.format(emAberto(conta)) },
        { campo: "status", cabecalho: "Status", largura: 110, render: (_, conta) =>
            <Chip size="small" variant="outlined" label={conta.status === "ABERTA" && conta.dataVencimento < hojeLocal ? "Vencida" : rotulos[conta.status]}
                color={conta.status === "PAGA" ? "success" : conta.status === "CANCELADA" ? "default" : conta.dataVencimento < hojeLocal ? "error" : "warning"} /> },
    ];
    const acoes: AcaoTabela<ContaPagar>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (conta) => setEditor({ conta }),
            desabilitado: (conta) => conta.status !== "ABERTA", tooltip: "Editar conta aberta" },
        { rotulo: "Pagar", icone: <CheckCircleOutlineRoundedIcon fontSize="small" />, onClick: abrirPagamento,
            desabilitado: (conta) => conta.status !== "ABERTA", tooltip: "Marcar como paga" },
        { rotulo: "Cancelar", icone: <CancelOutlinedIcon fontSize="small" />, onClick: (conta) => abrirConfirmacao(conta, "cancelar"),
            desabilitado: (conta) => conta.status !== "ABERTA", cor: "error", tooltip: "Cancelar conta" },
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
        <PageHeader titulo="Contas a Pagar" descricao="Acompanhe vencimentos e pagamentos da empresa."
            acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ conta: null })}>Nova conta</Button>} />
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
            <TextField select size="small" label="Fornecedor" value={filtros.fornecedor} sx={{ minWidth: 180 }}
                onChange={(e) => alterarFiltro("fornecedor", e.target.value)}>
                <MenuItem value="">Todos</MenuItem>
                {fornecedores.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.razaoSocial}</MenuItem>)}
            </TextField>
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
            <Button size="small" onClick={() => { setBusca(""); setStatus("todas"); setFiltros({ fornecedor: "", categoria: "", vencimentoDe: "", vencimentoAte: "", emissaoDe: "", emissaoAte: "" }); setPagina(0); }}>
                Limpar filtros
            </Button>
        </PageFilters>
        <AppTable colunas={colunas} linhas={visiveis} acoes={acoes} carregando={carregando}
            obterChaveLinha={(conta) => conta.id} minWidth={1540}
            vazio={{ titulo: "Nenhuma conta encontrada", descricao: busca || status !== "todas" || Object.values(filtros).some(Boolean) ? "Ajuste os filtros para consultar outras contas." : "Cadastre a primeira conta a pagar." }}
            paginacao={{ pagina: paginaAtual, linhasPorPagina: porPagina, total: filtradas.length,
                onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }} />
        {editor && <ContaPagarDrawer key={editor.conta?.id ?? "nova"} conta={editor.conta} fornecedores={fornecedores}
            onFechar={() => setEditor(null)} onSalvo={(conta) => { atualizar(conta); setEditor(null); setSucesso("Conta salva."); }} />}
        <Dialog open={pagamento !== null} onClose={processando ? undefined : () => setPagamento(null)} fullWidth maxWidth="xs" aria-labelledby="pagar-conta-titulo">
            <form onSubmit={(e) => void confirmarPagamento(e)}>
                <DialogTitle id="pagar-conta-titulo">Marcar como paga</DialogTitle>
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
                    <TextField required fullWidth label="Valor pago (R$)" value={valorPago} helperText="Pagamento integral nesta versão" slotProps={{ htmlInput: { inputMode: "decimal" } }}
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
                    ? `A conta ${confirmacao.conta.descricao} será cancelada.`
                    : "O título voltará a ficar aberto, a movimentação financeira vinculada será estornada e o saldo da conta financeira será recomposto."}</Typography>
                {erro && <Alert severity="error">{erro}</Alert>}
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setConfirmacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" color={confirmacao?.tipo === "cancelar" ? "error" : "primary"}
                    onClick={() => void confirmarAcao()} disabled={processando}>{processando ? "Salvando…" : "Confirmar"}</Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
