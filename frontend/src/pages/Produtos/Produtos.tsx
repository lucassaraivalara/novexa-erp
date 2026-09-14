import { useCallback, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
    Alert, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Snackbar,
    Stack, Typography,
} from "@mui/material";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import {
    atualizarProduto, buscarProdutoPorId, cadastrarProduto, excluirProduto,
    listarProdutos, obterMensagemDaApi, pesquisarProdutos,
} from "../../services/produtoService";
import type { Produto, ProdutoInput } from "../../types/produto";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import ProdutoForm from "./ProdutoForm";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
type Notificacao = { mensagem: string; tipo: "success" | "error" };

function Produtos() {
    const empresaId = obterEmpresaAtiva()?.id;
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [erroCarregamento, setErroCarregamento] = useState("");
    const [formularioAberto, setFormularioAberto] = useState(false);
    const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null);
    const [carregandoProduto, setCarregandoProduto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erroFormulario, setErroFormulario] = useState("");
    const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [notificacao, setNotificacao] = useState<Notificacao | null>(null);

    const carregarProdutos = useCallback((busca: string, signal: AbortSignal) => {
        if (!empresaId) return Promise.resolve([]);
        return busca ? pesquisarProdutos(empresaId, busca, signal) : listarProdutos(empresaId, signal);
    }, [empresaId]);
    const buscaRemota = useRemoteSearch({
        enabled: Boolean(empresaId),
        search: carregarProdutos,
        onResults: (dados) => { setProdutos(dados); setErroCarregamento(""); },
        onError: (erro) => setErroCarregamento(obterMensagemDaApi(erro, "Não foi possível carregar os produtos.")),
        onInvalidTerm: () => { setProdutos([]); setErroCarregamento(""); },
    });

    function abrirCadastro() {
        setProdutoEmEdicao(null);
        setErroFormulario("");
        setFormularioAberto(true);
    }

    async function abrirEdicao(produto: Produto) {
        if (!empresaId) return;
        setProdutoEmEdicao(produto);
        setErroFormulario("");
        setFormularioAberto(true);
        setCarregandoProduto(true);
        try {
            setProdutoEmEdicao(await buscarProdutoPorId(produto.id, empresaId));
        } catch (erro) {
            setErroFormulario(obterMensagemDaApi(erro, "Não foi possível carregar o produto."));
        } finally {
            setCarregandoProduto(false);
        }
    }

    function fecharFormulario() {
        if (salvando) return;
        setFormularioAberto(false);
        setProdutoEmEdicao(null);
        setErroFormulario("");
    }

    async function salvarProduto(dados: ProdutoInput) {
        setSalvando(true);
        setErroFormulario("");
        try {
            if (produtoEmEdicao) {
                await atualizarProduto(produtoEmEdicao.id, dados);
                setNotificacao({ mensagem: "Produto atualizado com sucesso.", tipo: "success" });
            } else {
                await cadastrarProduto(dados);
                setNotificacao({ mensagem: "Produto cadastrado com sucesso.", tipo: "success" });
            }
            setFormularioAberto(false);
            setProdutoEmEdicao(null);
            await buscaRemota.refresh();
        } catch (erro) {
            setErroFormulario(obterMensagemDaApi(erro, "Não foi possível salvar o produto."));
        } finally {
            setSalvando(false);
        }
    }

    async function confirmarExclusao() {
        if (!empresaId || !produtoParaExcluir || excluindo) return;
        setExcluindo(true);
        try {
            await excluirProduto(produtoParaExcluir.id, empresaId);
            setProdutoParaExcluir(null);
            setNotificacao({ mensagem: "Produto inativado com sucesso.", tipo: "success" });
            await buscaRemota.refresh();
        } catch (erro) {
            setNotificacao({ mensagem: obterMensagemDaApi(erro, "Não foi possível inativar o produto."), tipo: "error" });
        } finally {
            setExcluindo(false);
        }
    }

    if (!empresaId) {
        return (
            <Stack spacing={2.5}>
                <PageHeader titulo="Produtos" descricao="Gerencie os produtos do seu negócio." />
                <Alert severity="warning">Não foi encontrada uma empresa ativa nesta sessão. Entre novamente no sistema.</Alert>
            </Stack>
        );
    }

    const renderCodigo = (_: unknown, linha: Produto): React.ReactNode => (
        <Stack sx={{ gap: 0.25 }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 650 }}>{linha.codigoInterno ?? "—"}</Typography>
            {linha.codigoBarras && <Typography color="text.secondary" sx={{ fontSize: "0.72rem" }}>{linha.codigoBarras}</Typography>}
        </Stack>
    );

    const renderNome = (_: unknown, linha: Produto): React.ReactNode => (
        <Stack sx={{ gap: 0.25 }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 650 }}>{linha.nome}</Typography>
            {linha.descricao && <Typography color="text.secondary" noWrap sx={{ maxWidth: 280, fontSize: "0.75rem" }}>{linha.descricao}</Typography>}
        </Stack>
    );

    const renderPreco = (valor: unknown): React.ReactNode => moeda.format(Number(valor));
    const renderEstoque = (valor: unknown, linha: Produto): React.ReactNode => linha.controlaEstoque ? quantidade.format(Number(valor)) : "Não controla";
    const renderSituacao = (valor: unknown): React.ReactNode => <Chip size="small" label={valor ? "Ativo" : "Inativo"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />;

    const colunas: Coluna<Produto>[] = [
        { campo: "codigoInterno", cabecalho: "Código", largura: 140, render: renderCodigo },
        { campo: "nome", cabecalho: "Produto", largura: 320, render: renderNome },
        { campo: "unidadeMedida", cabecalho: "Unidade", largura: 100 },
        { campo: "precoVenda", cabecalho: "Preço de venda", largura: 160, alinhar: "right", render: renderPreco },
        { campo: "estoqueAtual", cabecalho: "Estoque", largura: 140, alinhar: "right", render: renderEstoque },
        { campo: "ativo", cabecalho: "Situação", largura: 100, render: renderSituacao },
    ];

    const acoes: AcaoTabela<Produto>[] = [
        {
            rotulo: "Editar",
            icone: <EditOutlinedIcon fontSize="small" />,
            onClick: abrirEdicao,
            tooltip: "Editar produto",
        },
        {
            rotulo: "Inativar",
            icone: <DeleteOutlineRoundedIcon fontSize="small" />,
            onClick: (p) => setProdutoParaExcluir(p),
            desabilitado: (p) => !p.ativo,
            cor: "error",
            tooltip: "Inativar produto",
        },
    ];

    return (
        <Stack spacing={2.5}>
            <PageHeader
                titulo="Produtos"
                descricao="Cadastre, consulte e mantenha o catálogo da empresa."
                acaoPrincipal={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={abrirCadastro}>Novo produto</Button>}
            />

            {erroCarregamento && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => buscaRemota.refresh()}>Tentar novamente</Button>}>
                    {erroCarregamento}
                </Alert>
            )}

            <AppTable
                colunas={colunas}
                linhas={produtos}
                carregando={buscaRemota.loading && !produtos.length}
                obterChaveLinha={(p) => p.id}
                busca={{
                    placeholder: "Pesquisar por nome, código interno ou código de barras",
                    onChange: (valor) => { setErroCarregamento(""); buscaRemota.setTerm(valor); },
                    onKeyDown: (evento) => { if (evento.key === "Enter") { evento.preventDefault(); buscaRemota.executeNow(); } },
                    valor: buscaRemota.term,
                    carregando: buscaRemota.loading,
                }}
                vazio={{
                    titulo: buscaRemota.term.trim() ? "Nenhum produto encontrado" : "Nenhum produto cadastrado",
                    descricao: buscaRemota.term.trim() ? "Tente pesquisar usando outro termo." : "Use “Novo produto” para iniciar seu catálogo.",
                }}
                acoes={acoes}
                minWidth={900}
            />

            <ProdutoForm
                aberto={formularioAberto}
                produto={produtoEmEdicao}
                carregandoProduto={carregandoProduto}
                key={produtoEmEdicao?.id ?? `novo-${formularioAberto}`}
                salvando={salvando}
                empresaId={empresaId}
                erroExterno={erroFormulario}
                onFechar={fecharFormulario}
                onSalvar={salvarProduto}
            />

            <Dialog open={produtoParaExcluir !== null} onClose={excluindo ? undefined : () => setProdutoParaExcluir(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Inativar produto?</DialogTitle>
                <DialogContent><Typography>O produto <strong>{produtoParaExcluir?.nome}</strong> será marcado como inativo e continuará no histórico.</Typography></DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setProdutoParaExcluir(null)} disabled={excluindo}>Cancelar</Button>
                    <Button color="error" variant="contained" onClick={() => void confirmarExclusao()} disabled={excluindo}>
                        {excluindo ? <CircularProgress size={22} color="inherit" /> : "Inativar"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={notificacao !== null} autoHideDuration={4500} onClose={() => setNotificacao(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <Alert severity={notificacao?.tipo ?? "success"} variant="filled" onClose={() => setNotificacao(null)}>{notificacao?.mensagem}</Alert>
            </Snackbar>
        </Stack>
    );
}

export default Produtos;