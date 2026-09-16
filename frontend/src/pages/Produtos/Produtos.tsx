import { useCallback, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
    Alert, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Snackbar,
    Stack, Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type Coluna, type AcaoTabela } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
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
    const [situacao, setSituacao] = useState("todas");

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
            <PageContainer>
                <PageHeader titulo="Produtos" descricao="Gerencie os produtos do seu negócio." />
                <Alert severity="warning">Não foi encontrada uma empresa ativa nesta sessão. Entre novamente no sistema.</Alert>
            </PageContainer>
        );
    }

    const renderCodigo = (_: unknown, linha: Produto): React.ReactNode => (
        <Stack sx={{ gap: 0.125, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                {linha.codigoInterno ?? "—"}
            </Typography>
            {linha.codigoBarras && <Typography color="text.secondary" sx={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                Barras: {linha.codigoBarras}
            </Typography>}
        </Stack>
    );

    const renderNome = (_: unknown, linha: Produto): React.ReactNode => (
        <Stack sx={{ gap: 0.125, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 650 }}>{linha.nome}</Typography>
            {linha.descricao && <Typography color="text.secondary" noWrap sx={{ fontSize: "0.75rem" }}>{linha.descricao}</Typography>}
        </Stack>
    );

    const renderPreco = (valor: unknown): React.ReactNode => <span style={{ fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(valor))}</span>;
    const renderEstoque = (valor: unknown, linha: Produto): React.ReactNode => <span style={{ fontVariantNumeric: "tabular-nums" }}>{linha.controlaEstoque ? quantidade.format(Number(valor)) : "Não controla"}</span>;
    const renderSituacao = (valor: unknown): React.ReactNode => <Chip size="small" label={valor ? "Ativo" : "Inativo"} color={valor ? "success" : "default"} variant={valor ? "filled" : "outlined"} />;

    const colunas: Coluna<Produto>[] = [
        { campo: "codigoInterno", cabecalho: "Código interno", largura: 150, render: renderCodigo },
        { campo: "nome", cabecalho: "Produto", largura: 360, render: renderNome },
        { campo: "unidadeMedida", cabecalho: "Unidade", largura: 85 },
        { campo: "precoVenda", cabecalho: "Preço de venda", largura: 135, alinhar: "right", render: renderPreco },
        { campo: "estoqueAtual", cabecalho: "Estoque", largura: 110, alinhar: "right", render: renderEstoque },
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
    const produtosFiltrados = produtos.filter((produto) =>
        situacao === "todas" || produto.ativo === (situacao === "ativas")
    );

    return (
        <PageContainer>
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

            <Stack spacing={1}>
                <PageFilters
                    busca={{
                        placeholder: "Pesquisar por nome, código interno ou código de barras",
                        onChange: (valor) => { setErroCarregamento(""); buscaRemota.setTerm(valor); },
                        onKeyDown: (evento) => { if (evento.key === "Enter") { evento.preventDefault(); buscaRemota.executeNow(); } },
                        valor: buscaRemota.term,
                        carregando: buscaRemota.loading,
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="produto-situacao-label">Situação</InputLabel>
                        <Select labelId="produto-situacao-label" label="Situação" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativas">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    linhas={produtosFiltrados}
                    carregando={buscaRemota.loading && !produtos.length}
                    obterChaveLinha={(p) => p.id}
                    vazio={{
                        titulo: buscaRemota.term.trim() || situacao !== "todas" ? "Nenhum produto encontrado" : "Nenhum produto cadastrado",
                        descricao: buscaRemota.term.trim() || situacao !== "todas" ? "Tente ajustar a busca ou o filtro de situação." : "Use “Novo produto” para iniciar seu catálogo.",
                        acao: !buscaRemota.term.trim() && situacao === "todas" ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={abrirCadastro}>Novo produto</Button> : undefined,
                    }}
                    acoes={acoes}
                    compacta
                    minWidth={940}
                />
            </Stack>

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
        </PageContainer>
    );
}

export default Produtos;
