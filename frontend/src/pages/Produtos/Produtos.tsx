import { useCallback, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Alert, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, IconButton, InputAdornment, Paper, Snackbar,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Tooltip, Typography,
} from "@mui/material";
import PageIntro from "../../components/layout/PageIntro";
import {
    atualizarProduto, buscarProdutoPorId, cadastrarProduto, excluirProduto,
    listarProdutos, obterMensagemDaApi, pesquisarProdutos,
} from "../../services/produtoService";
import type { Produto, ProdutoInput } from "../../types/produto";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import ProdutoForm from "./ProdutoForm";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
type Notificacao = { mensagem: string; tipo: "success" | "error" };

function Produtos() {
    const empresaId = obterEmpresaAtiva()?.id;
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [termo, setTermo] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [erroCarregamento, setErroCarregamento] = useState("");
    const [formularioAberto, setFormularioAberto] = useState(false);
    const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null);
    const [carregandoProduto, setCarregandoProduto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erroFormulario, setErroFormulario] = useState("");
    const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [notificacao, setNotificacao] = useState<Notificacao | null>(null);

    const carregarProdutos = useCallback(async (busca: string) => {
        if (!empresaId) { setCarregando(false); return; }
        setCarregando(true);
        setErroCarregamento("");
        try {
            const dados = busca.trim()
                ? await pesquisarProdutos(empresaId, busca.trim())
                : await listarProdutos(empresaId);
            setProdutos(dados);
        } catch (erro) {
            setErroCarregamento(obterMensagemDaApi(erro, "Não foi possível carregar os produtos."));
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    useEffect(() => {
        const atraso = window.setTimeout(() => void carregarProdutos(termo), termo ? 350 : 0);
        return () => window.clearTimeout(atraso);
    }, [carregarProdutos, termo]);

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
            await carregarProdutos(termo);
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
            await carregarProdutos(termo);
        } catch (erro) {
            setNotificacao({ mensagem: obterMensagemDaApi(erro, "Não foi possível inativar o produto."), tipo: "error" });
        } finally {
            setExcluindo(false);
        }
    }

    if (!empresaId) {
        return <Stack spacing={2.5}>
            <PageIntro titulo="Produtos" descricao="Gerencie os produtos do seu negócio." />
            <Alert severity="warning">Não foi encontrada uma empresa ativa nesta sessão. Entre novamente no sistema.</Alert>
        </Stack>;
    }

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <PageIntro titulo="Produtos" descricao="Cadastre, consulte e mantenha o catálogo da empresa." />
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={abrirCadastro}>Novo produto</Button>
            </Stack>

            <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)" }}>
                <TextField fullWidth size="small" value={termo} onChange={(e) => setTermo(e.target.value)}
                    placeholder="Pesquisar por nome, código interno ou código de barras"
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment> } }} />
            </Paper>

            {erroCarregamento && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void carregarProdutos(termo)}>Tentar novamente</Button>}>{erroCarregamento}</Alert>}

            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)" }}>
                <Table sx={{ minWidth: 820 }} aria-label="Lista de produtos">
                    <TableHead><TableRow sx={{ backgroundColor: "#F8FAFC" }}>
                        {[
                            ["Código", "left"], ["Produto", "left"], ["Unidade", "left"],
                            ["Preço de venda", "right"], ["Estoque", "right"], ["Situação", "left"], ["Ações", "right"],
                        ].map(([texto, alinhamento]) => <TableCell key={texto} align={alinhamento as "left" | "right"} sx={{ fontWeight: 700 }}>{texto}</TableCell>)}
                    </TableRow></TableHead>
                    <TableBody>
                        {carregando ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                            <CircularProgress size={32} /><Typography color="text.secondary" sx={{ mt: 1.5, fontSize: "0.875rem" }}>Carregando produtos...</Typography>
                        </TableCell></TableRow> : produtos.length === 0 ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                            <Typography sx={{ fontWeight: 700 }}>{termo ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: "0.875rem" }}>{termo ? "Tente pesquisar usando outro termo." : "Use “Novo produto” para iniciar seu catálogo."}</Typography>
                        </TableCell></TableRow> : produtos.map((produto) => <TableRow key={produto.id} hover>
                            <TableCell><Typography sx={{ fontSize: "0.85rem", fontWeight: 650 }}>{produto.codigoInterno ?? "—"}</Typography>{produto.codigoBarras && <Typography color="text.secondary" sx={{ fontSize: "0.72rem" }}>{produto.codigoBarras}</Typography>}</TableCell>
                            <TableCell><Typography sx={{ fontSize: "0.875rem", fontWeight: 650 }}>{produto.nome}</Typography>{produto.descricao && <Typography color="text.secondary" noWrap sx={{ maxWidth: 280, fontSize: "0.75rem" }}>{produto.descricao}</Typography>}</TableCell>
                            <TableCell>{produto.unidadeMedida}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 650 }}>{moeda.format(produto.precoVenda)}</TableCell>
                            <TableCell align="right">{produto.controlaEstoque ? quantidade.format(produto.estoqueAtual) : "Não controla"}</TableCell>
                            <TableCell><Chip size="small" label={produto.ativo ? "Ativo" : "Inativo"} color={produto.ativo ? "success" : "default"} variant={produto.ativo ? "filled" : "outlined"} /></TableCell>
                            <TableCell align="right">
                                <Tooltip title="Editar produto"><IconButton size="small" onClick={() => void abrirEdicao(produto)} aria-label={`Editar ${produto.nome}`}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                                <Tooltip title={produto.ativo ? "Inativar produto" : "Produto já inativo"}><span><IconButton size="small" color="error" disabled={!produto.ativo} onClick={() => setProdutoParaExcluir(produto)} aria-label={`Inativar ${produto.nome}`}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                            </TableCell>
                        </TableRow>)}
                    </TableBody>
                </Table>
            </TableContainer>

            <ProdutoForm aberto={formularioAberto} produto={produtoEmEdicao} carregandoProduto={carregandoProduto}
                key={produtoEmEdicao?.id ?? `novo-${formularioAberto}`}
                salvando={salvando} empresaId={empresaId} erroExterno={erroFormulario}
                onFechar={fecharFormulario} onSalvar={salvarProduto} />

            <Dialog open={produtoParaExcluir !== null} onClose={excluindo ? undefined : () => setProdutoParaExcluir(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Inativar produto?</DialogTitle>
                <DialogContent><Typography>O produto <strong>{produtoParaExcluir?.nome}</strong> será marcado como inativo e continuará no histórico.</Typography></DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setProdutoParaExcluir(null)} disabled={excluindo}>Cancelar</Button><Button color="error" variant="contained" onClick={() => void confirmarExclusao()} disabled={excluindo}>{excluindo ? <CircularProgress size={22} color="inherit" /> : "Inativar"}</Button></DialogActions>
            </Dialog>

            <Snackbar open={notificacao !== null} autoHideDuration={4500} onClose={() => setNotificacao(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <Alert severity={notificacao?.tipo ?? "success"} variant="filled" onClose={() => setNotificacao(null)}>{notificacao?.mensagem}</Alert>
            </Snackbar>
        </Stack>
    );
}

export default Produtos;
