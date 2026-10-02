import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
    Snackbar, Stack, TextField, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import StatusChip from "../../components/ui/StatusChip";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import FornecedorForm from "../../components/fornecedores/FornecedorForm";
import { buscarFornecedorPorId, inativarFornecedor, listarFornecedores, mensagemFornecedor,
    reativarFornecedor } from "../../services/fornecedorService";
import type { FornecedorCompleto } from "../../types/fornecedor";
import { formatarDocumentoEmpresa } from "../../utils/validators/documentoEmpresa";

type Notificacao = { mensagem: string; tipo: "success" | "error" };
const filtroAtivo = { todos: undefined, ativos: true, inativos: false } as const;

export default function Fornecedores() {
    const [fornecedores, setFornecedores] = useState<FornecedorCompleto[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [busca, setBusca] = useState("");
    const [situacao, setSituacao] = useState<keyof typeof filtroAtivo>("todos");
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [totalItems, setTotalItems] = useState(0);
    const [ordenacao, setOrdenacao] = useState({ campo: "razaoSocial", direcao: "asc" as "asc" | "desc" });
    const [revisao, setRevisao] = useState(0);
    const [formulario, setFormulario] = useState<{ fornecedor: FornecedorCompleto | null } | null>(null);
    const [inativando, setInativando] = useState<FornecedorCompleto | null>(null);
    const [processando, setProcessando] = useState(false);
    const [notificacao, setNotificacao] = useState<Notificacao | null>(null);
    const recarregar = () => setRevisao((v) => v + 1);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarFornecedores({ page: pagina, size: porPagina, sort: `${ordenacao.campo},${ordenacao.direcao}`,
                termo: busca.trim() || undefined, ativo: filtroAtivo[situacao] }, controller.signal)
                .then((resposta) => {
                    if (controller.signal.aborted) return;
                    setFornecedores(resposta.items); setTotalItems(resposta.totalItems); setErro("");
                    if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
                })
                .catch((e) => { if (!controller.signal.aborted) setErro(mensagemFornecedor(e, "Não foi possível carregar os fornecedores.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [busca, situacao, pagina, porPagina, ordenacao, revisao]);

    async function abrirEdicao(fornecedor: FornecedorCompleto) {
        try { setFormulario({ fornecedor: await buscarFornecedorPorId(fornecedor.id) }); }
        catch (e) { setNotificacao({ mensagem: mensagemFornecedor(e, "Não foi possível carregar o fornecedor."), tipo: "error" }); }
    }

    async function executar(acao: () => Promise<unknown>, sucesso: string, falha: string) {
        if (processando) return;
        setProcessando(true);
        try { await acao(); setNotificacao({ mensagem: sucesso, tipo: "success" }); recarregar(); }
        catch (e) { setNotificacao({ mensagem: mensagemFornecedor(e, falha), tipo: "error" }); }
        finally { setProcessando(false); setInativando(null); }
    }

    const colunas: Coluna<FornecedorCompleto>[] = [
        { campo: "razaoSocial", cabecalho: "Nome / Razão Social", largura: 280, ordenavel: true,
            render: (valor) => <Typography sx={{ fontSize: "0.875rem", fontWeight: 650 }}>{String(valor)}</Typography> },
        { campo: "nomeFantasia", cabecalho: "Nome Fantasia", largura: 200, ordenavel: true, render: (valor) => String(valor ?? "—") },
        { campo: "cpfCnpj", cabecalho: "CPF/CNPJ", largura: 170, ordenavel: true,
            render: (valor) => valor ? formatarDocumentoEmpresa(String(valor), true) : "—" },
        { campo: "telefone", cabecalho: "Telefone", largura: 140, render: (valor) => String(valor ?? "—") },
        { campo: "cidade", cabecalho: "Cidade/UF", largura: 160,
            render: (_, f) => [f.cidade, f.uf].filter(Boolean).join("/") || "—" },
        { campo: "ativo", cabecalho: "Status", largura: 110, ordenavel: true,
            render: (valor) => <StatusChip status={valor ? "Ativo" : "Inativo"} /> },
    ];

    const acoes: AcaoTabela<FornecedorCompleto>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (f) => void abrirEdicao(f), tooltip: "Editar fornecedor" },
        { rotulo: "Inativar", icone: <BlockRoundedIcon fontSize="small" />, onClick: setInativando,
            desabilitado: (f) => !f.ativo, cor: "error", tooltip: "Inativar fornecedor" },
        { rotulo: "Reativar", icone: <RestoreRoundedIcon fontSize="small" />,
            onClick: (f) => void executar(() => reativarFornecedor(f.id), "Fornecedor reativado com sucesso.", "Não foi possível reativar o fornecedor."),
            desabilitado: (f) => f.ativo || processando, tooltip: "Reativar fornecedor" },
    ];

    const filtrado = busca.trim() !== "" || situacao !== "todos";
    const botaoNovo = <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setFormulario({ fornecedor: null })}>Novo fornecedor</Button>;

    return <PageContainer>
        <PageHeader titulo="Fornecedores" descricao="Cadastre e mantenha os fornecedores usados nas compras e contas a pagar." acaoPrincipal={botaoNovo} />
        {erro && <Alert severity="error" action={<Button color="inherit" size="small" onClick={recarregar}>Tentar novamente</Button>}>{erro}</Alert>}
        <Stack spacing={1.5}>
            <PageFilters busca={{ placeholder: "Buscar fornecedor…", valor: busca, carregando,
                onChange: (valor) => { setBusca(valor); setPagina(0); } }}>
                <TextField select size="small" label="Status" value={situacao} sx={{ minWidth: { xs: "100%", sm: 160 } }}
                    onChange={(e) => { setSituacao(e.target.value as keyof typeof filtroAtivo); setPagina(0); }}>
                    <MenuItem value="todos">Todos</MenuItem>
                    <MenuItem value="ativos">Ativos</MenuItem>
                    <MenuItem value="inativos">Inativos</MenuItem>
                </TextField>
            </PageFilters>
            <AppTable colunas={colunas} linhas={fornecedores} acoes={acoes} carregando={carregando && !fornecedores.length}
                obterChaveLinha={(f) => f.id} compacta minWidth={1100} ordenacaoRemota
                vazio={{ titulo: filtrado ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado",
                    descricao: filtrado ? "Tente ajustar a busca ou o filtro de status." : "Use “Novo fornecedor” para começar.",
                    acao: filtrado ? undefined : botaoNovo }}
                ordenacao={{ ...ordenacao, onSort: (campo) => {
                    setPagina(0);
                    setOrdenacao((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
                } }}
                paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems, onPageChange: setPagina,
                    onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); }, opcoesLinhasPorPagina: [10, 25, 50] }} />
        </Stack>

        {formulario && <FornecedorForm modo="completo" fornecedor={formulario.fornecedor} onFechar={() => setFormulario(null)}
            onSalvo={() => {
                setNotificacao({ mensagem: formulario.fornecedor ? "Fornecedor atualizado com sucesso." : "Fornecedor cadastrado com sucesso.", tipo: "success" });
                setFormulario(null); recarregar();
            }} />}

        <Dialog open={inativando !== null} onClose={processando ? undefined : () => setInativando(null)} maxWidth="xs" fullWidth>
            <DialogTitle>Inativar fornecedor?</DialogTitle>
            <DialogContent><Typography>O fornecedor <strong>{inativando?.razaoSocial}</strong> deixará de aparecer em novas seleções e continuará no histórico.</Typography></DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => setInativando(null)} disabled={processando}>Cancelar</Button>
                <Button color="error" variant="contained" disabled={processando}
                    onClick={() => inativando && void executar(() => inativarFornecedor(inativando.id), "Fornecedor inativado com sucesso.", "Não foi possível inativar o fornecedor.")}>
                    {processando ? <CircularProgress size={22} color="inherit" /> : "Inativar"}
                </Button>
            </DialogActions>
        </Dialog>

        <Snackbar open={notificacao !== null} autoHideDuration={4500} onClose={() => setNotificacao(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
            <Alert severity={notificacao?.tipo ?? "success"} variant="filled" onClose={() => setNotificacao(null)}>{notificacao?.mensagem}</Alert>
        </Snackbar>
    </PageContainer>;
}
