import { useEffect, useState, type FormEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
    MenuItem, Select, Snackbar, Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { cancelarConta, estornarConta, listarContasPagar, listarFornecedoresContaPagar,
    mensagemContaPagar, pagarConta } from "../../services/contaPagarService";
import type { ContaPagar, FornecedorContaPagar, StatusContaPagar } from "../../types/contaPagar";
import ContaPagarDrawer from "./ContaPagarDrawer";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) => valor ? new Date(`${valor}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const rotulos: Record<StatusContaPagar, string> = { ABERTA: "Aberta", PAGA: "Paga", CANCELADA: "Cancelada" };
const hoje = () => {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

export default function ContasPagar() {
    const [contas, setContas] = useState<ContaPagar[]>([]);
    const [fornecedores, setFornecedores] = useState<FornecedorContaPagar[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [status, setStatus] = useState("todas");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [editor, setEditor] = useState<{ conta: ContaPagar | null } | null>(null);
    const [pagamento, setPagamento] = useState<ContaPagar | null>(null);
    const [dataPagamento, setDataPagamento] = useState("");
    const [valorPago, setValorPago] = useState("");
    const [confirmacao, setConfirmacao] = useState<{ conta: ContaPagar; tipo: "cancelar" | "estornar" } | null>(null);
    const [processando, setProcessando] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([listarContasPagar(controller.signal), listarFornecedoresContaPagar(controller.signal)])
            .then(([lista, fornecedoresLista]) => { if (!controller.signal.aborted) { setContas(lista); setFornecedores(fornecedoresLista); setErro(""); } })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaPagar(e, "Não foi possível carregar as contas.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [tentativa]);

    function atualizar(conta: ContaPagar) {
        setContas((atuais) => atuais.some((item) => item.id === conta.id)
            ? atuais.map((item) => item.id === conta.id ? conta : item) : [...atuais, conta]);
    }

    const filtradas = contas.filter((conta) => {
        const termo = normalizar(busca.trim());
        return (status === "todas" || conta.status === status) && (!termo ||
            normalizar(`${conta.descricao} ${conta.fornecedorNome ?? ""} ${conta.categoria ?? ""}`).includes(termo));
    });
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));
    const visiveis = filtradas.slice(paginaAtual * porPagina, (paginaAtual + 1) * porPagina);

    function abrirPagamento(conta: ContaPagar) {
        setPagamento(conta);
        setDataPagamento(hoje());
        setValorPago(String(conta.valor).replace(".", ","));
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
        setProcessando(true); setErro("");
        try {
            atualizar(await pagarConta(pagamento.id, { dataPagamento, valorPago: valor }));
            setPagamento(null); setSucesso("Conta marcada como paga.");
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
        } catch (e) { setErro(mensagemContaPagar(e, "Não foi possível concluir a ação.")); }
        finally { setProcessando(false); }
    }

    const colunas: Coluna<ContaPagar>[] = [
        { campo: "descricao", cabecalho: "Descrição", largura: 250 },
        { campo: "fornecedorNome", cabecalho: "Fornecedor", largura: 180, render: (valor) => String(valor ?? "—") },
        { campo: "categoria", cabecalho: "Categoria", largura: 140, render: (valor) => String(valor ?? "—") },
        { campo: "dataVencimento", cabecalho: "Vencimento", largura: 130, render: (valor) => data(String(valor)) },
        { campo: "valor", cabecalho: "Valor", largura: 130, alinhar: "right", render: (valor) => moeda.format(Number(valor)) },
        { campo: "status", cabecalho: "Status", largura: 110, render: (_, conta) =>
            <Chip size="small" variant="outlined" label={rotulos[conta.status]}
                color={conta.status === "PAGA" ? "success" : conta.status === "CANCELADA" ? "default" : "warning"} /> },
        { campo: "dataPagamento", cabecalho: "Pagamento", largura: 130, render: (valor) => data(valor as string | null) },
        { campo: "valorPago", cabecalho: "Valor pago", largura: 130, alinhar: "right", render: (valor) => valor == null ? "—" : moeda.format(Number(valor)) },
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

    return <PageContainer>
        <PageHeader titulo="Contas a Pagar" descricao="Acompanhe vencimentos e pagamentos da empresa."
            acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ conta: null })}>Nova conta</Button>} />
        {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro("")}
            action={contas.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        <PageFilters busca={{ placeholder: "Buscar por descrição, fornecedor ou categoria", valor: busca,
            onChange: (valor) => { setBusca(valor); setPagina(0); } }}>
            <FormControl size="small" sx={{ minWidth: 170 }}>
                <Select value={status} inputProps={{ "aria-label": "Filtrar contas por status" }}
                    onChange={(e) => { setStatus(e.target.value); setPagina(0); }}>
                    <MenuItem value="todas">Todos os status</MenuItem>
                    <MenuItem value="ABERTA">Abertas</MenuItem>
                    <MenuItem value="PAGA">Pagas</MenuItem>
                    <MenuItem value="CANCELADA">Canceladas</MenuItem>
                </Select>
            </FormControl>
        </PageFilters>
        <AppTable colunas={colunas} linhas={visiveis} acoes={acoes} carregando={carregando}
            obterChaveLinha={(conta) => conta.id} minWidth={1280}
            vazio={{ titulo: "Nenhuma conta encontrada", descricao: busca || status !== "todas" ? "Ajuste os filtros para consultar outras contas." : "Cadastre a primeira conta a pagar." }}
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
                    <TextField required fullWidth label="Valor pago (R$)" value={valorPago} slotProps={{ htmlInput: { inputMode: "decimal" } }}
                        onChange={(e) => setValorPago(e.target.value)} />
                    {erro && <Alert severity="error">{erro}</Alert>}
                </Stack></DialogContent>
                <DialogActions><Button onClick={() => setPagamento(null)} disabled={processando}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={processando}>{processando ? "Salvando…" : "Confirmar pagamento"}</Button></DialogActions>
            </form>
        </Dialog>
        <Dialog open={confirmacao !== null} onClose={processando ? undefined : () => setConfirmacao(null)} aria-labelledby="acao-conta-titulo">
            <DialogTitle id="acao-conta-titulo">{confirmacao?.tipo === "cancelar" ? "Cancelar conta?" : "Estornar pagamento?"}</DialogTitle>
            <DialogContent><Stack spacing={2}>
                <Typography variant="body2">{confirmacao?.tipo === "cancelar"
                    ? `A conta ${confirmacao.conta.descricao} será cancelada.`
                    : "O título voltará a ficar aberto e os dados do pagamento serão removidos."}</Typography>
                {erro && <Alert severity="error">{erro}</Alert>}
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setConfirmacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" color={confirmacao?.tipo === "cancelar" ? "error" : "primary"}
                    onClick={() => void confirmarAcao()} disabled={processando}>{processando ? "Salvando…" : "Confirmar"}</Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
