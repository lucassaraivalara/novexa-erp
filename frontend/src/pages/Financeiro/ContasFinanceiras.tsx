import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Paper, Snackbar, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { alterarSituacaoContaFinanceira, listarContasFinanceiras,
    mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { rotulosTipoContaFinanceira, type ContaFinanceira, type TipoContaFinanceira } from "../../types/contaFinanceira";
import ContaFinanceiraDrawer from "./ContaFinanceiraDrawer";
import MovimentacaoFinanceiraDrawer from "./MovimentacaoFinanceiraDrawer";
import ExtratoFinanceiroDrawer from "./ExtratoFinanceiroDrawer";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ContasFinanceiras() {
    const [contas, setContas] = useState<ContaFinanceira[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [editor, setEditor] = useState<ContaFinanceira | null | undefined>(undefined);
    const [movimentarId, setMovimentarId] = useState<number | null>(null);
    const [extratoId, setExtratoId] = useState<number | null>(null);
    const [situacao, setSituacao] = useState<ContaFinanceira | null>(null);
    const [processando, setProcessando] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        listarContasFinanceiras(controller.signal)
            .then((lista) => { if (!controller.signal.aborted) { setContas(lista); setErro(""); } })
            .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaFinanceira(e, "Não foi possível carregar as contas financeiras.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        return () => controller.abort();
    }, [tentativa]);

    function atualizar(conta: ContaFinanceira) {
        setContas((atuais) => atuais.some((item) => item.id === conta.id)
            ? atuais.map((item) => item.id === conta.id ? conta : item) : [...atuais, conta]);
    }

    async function confirmarSituacao() {
        if (!situacao || processando) return;
        setProcessando(true); setErro("");
        try {
            atualizar(await alterarSituacaoContaFinanceira(situacao.id, !situacao.ativo));
            setSucesso(situacao.ativo ? "Conta inativada." : "Conta ativada.");
            setSituacao(null);
        } catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível alterar a situação da conta.")); }
        finally { setProcessando(false); }
    }

    const grupos: { titulo: string; tipos: TipoContaFinanceira[]; cor: string }[] = [
        { titulo: "Saldo total", tipos: Object.keys(rotulosTipoContaFinanceira) as TipoContaFinanceira[], cor: "primary.main" },
        { titulo: "Bancos", tipos: ["BANCO"], cor: "info.main" },
        { titulo: "Cofre", tipos: ["COFRE"], cor: "warning.main" },
        { titulo: "Carteiras digitais", tipos: ["CARTEIRA_DIGITAL"], cor: "success.main" },
        { titulo: "Outros", tipos: ["OUTROS"], cor: "secondary.main" },
    ];
    const filtradas = contas.filter((conta) => normalizar(`${conta.nome} ${rotulosTipoContaFinanceira[conta.tipo]}`).includes(normalizar(busca.trim())));
    const atual = Math.min(pagina, Math.max(0, Math.ceil(filtradas.length / porPagina) - 1));
    const colunas: Coluna<ContaFinanceira>[] = [
        { campo: "nome", cabecalho: "Nome", largura: 260, render: (_, conta) => <Box>
            <Typography variant="body2">{conta.nome}</Typography>
            {conta.tipo === "BANCO" && <Typography variant="caption" color="text.secondary">
                {conta.contaBancaria ? `${conta.contaBancaria.bancoNome} · ${conta.contaBancaria.numero}${conta.contaBancaria.digito ? `-${conta.contaBancaria.digito}` : ""}` : "Legado: vínculo bancário pendente"}
            </Typography>}
        </Box> },
        { campo: "tipo", cabecalho: "Tipo", largura: 180, render: (_, conta) => rotulosTipoContaFinanceira[conta.tipo] },
        { campo: "saldoAtual", cabecalho: "Saldo atual", largura: 170, alinhar: "right", render: (valor) =>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{moeda.format(Number(valor))}</Typography> },
        { campo: "ativo", cabecalho: "Situação", largura: 125, render: (_, conta) =>
            <Chip size="small" variant="outlined" label={conta.ativo ? "Ativa" : "Inativa"}
                color={conta.ativo ? "success" : "default"} /> },
    ];
    const acoes: AcaoTabela<ContaFinanceira>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: setEditor, tooltip: "Editar conta" },
        { rotulo: "Movimentar", icone: <SwapHorizRoundedIcon fontSize="small" />, onClick: (conta) => setMovimentarId(conta.id),
            desabilitado: (conta) => !conta.ativo, tooltip: "Registrar entrada ou saída" },
        { rotulo: "Extrato", icone: <ReceiptLongOutlinedIcon fontSize="small" />, onClick: (conta) => setExtratoId(conta.id),
            tooltip: "Ver extrato" },
        { rotulo: "Alterar situação", icone: <PowerSettingsNewRoundedIcon fontSize="small" />,
            onClick: (conta) => { setErro(""); setSituacao(conta); }, tooltip: "Ativar ou inativar conta" },
    ];
    const contaMovimentar = contas.find((conta) => conta.id === movimentarId);
    const contaExtrato = contas.find((conta) => conta.id === extratoId);

    return <PageContainer>
        <PageHeader titulo="Contas Financeiras"
            acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor(null)}>Nova conta</Button>} />
        {erro && !situacao && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro("")}
            action={contas.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        <Box component="section" aria-label="Saldos por tipo de conta" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
            {grupos.map((grupo) => {
                const linhas = contas.filter((conta) => grupo.tipos.includes(conta.tipo));
                return <Paper key={grupo.titulo} variant="outlined" sx={{ p: 1.75, borderTop: 3, borderTopColor: grupo.cor, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">{grupo.titulo}</Typography>
                    <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, mt: 0.5, overflowWrap: "anywhere" }}>
                        {moeda.format(linhas.reduce((total, conta) => total + Number(conta.saldoAtual), 0))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{linhas.length} {linhas.length === 1 ? "conta" : "contas"}</Typography>
                </Paper>;
            })}
        </Box>
        <PageFilters busca={{ placeholder: "Buscar por nome ou tipo", valor: busca,
            onChange: (valor) => { setBusca(valor); setPagina(0); } }} />
        <AppTable colunas={colunas} linhas={filtradas.slice(atual * porPagina, (atual + 1) * porPagina)}
            acoes={acoes} carregando={carregando} obterChaveLinha={(conta) => conta.id} minWidth={850}
            vazio={{ titulo: "Nenhuma conta financeira encontrada", descricao: busca ? "Ajuste a busca." : "Cadastre a primeira conta financeira." }}
            paginacao={{ pagina: atual, linhasPorPagina: porPagina, total: filtradas.length,
                onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }} />
        {editor !== undefined && <ContaFinanceiraDrawer key={editor?.id ?? "nova"} conta={editor}
            onFechar={() => setEditor(undefined)} onSalvo={(conta) => { atualizar(conta); setEditor(undefined); setSucesso("Conta salva."); }} />}
        {contaMovimentar && <MovimentacaoFinanceiraDrawer key={contaMovimentar.id} conta={contaMovimentar}
            onFechar={() => setMovimentarId(null)} onSalvo={() => { setMovimentarId(null); setTentativa((n) => n + 1); setSucesso("Movimentação registrada."); }} />}
        {contaExtrato && <ExtratoFinanceiroDrawer key={contaExtrato.id} conta={contaExtrato}
            onFechar={() => setExtratoId(null)} onSaldoAlterado={() => { setTentativa((n) => n + 1); setSucesso("Movimentação estornada."); }} />}
        <Dialog open={situacao !== null} onClose={processando ? undefined : () => setSituacao(null)} aria-labelledby="situacao-conta-titulo">
            <DialogTitle id="situacao-conta-titulo">{situacao?.ativo ? "Inativar conta?" : "Ativar conta?"}</DialogTitle>
            <DialogContent>
                <Typography variant="body2">{situacao?.nome}</Typography>
                {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
            </DialogContent>
            <DialogActions><Button onClick={() => setSituacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" onClick={() => void confirmarSituacao()} disabled={processando}>
                    {processando ? "Salvando…" : "Confirmar"}
                </Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
