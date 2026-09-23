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
    enviarImagemProduto, removerImagemProduto,
    listarProdutos, obterMensagemDaApi, pesquisarProdutos,
} from "../../services/produtoService";
import type { Produto, ProdutoInput } from "../../types/produto";
import { obterEmpresaAtiva } from "../../utils/auth/sessao";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import ProdutoForm from "./ProdutoForm";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
type CampoBuscaProduto = "codigoInterno" | "nome" | "ativo";
const camposBusca = {
    codigoInterno: { rotulo: "Código interno", placeholder: "Pesquisar por código interno ou código de barras…" },
    nome: { rotulo: "Produto", placeholder: "Pesquisar por produto…" },
    ativo: { rotulo: "Situação", placeholder: "Pesquisar por situação…" },
};
const normalizarBusca = (texto: string) => texto.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

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
    const [situacao, setSituacao] = useState("ativas");
    const [campoBusca, setCampoBusca] = useState<CampoBuscaProduto | null>(null);
    const [termoLocal, setTermoLocal] = useState("");

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

    function selecionarCampoBusca(campo: string) {
        if (!(campo in camposBusca)) return;
        buscaRemota.cancel();
        if (campoBusca === null) setTermoLocal(buscaRemota.term);
        setCampoBusca(campo as CampoBuscaProduto);
    }

    function removerCampoBusca() {
        setCampoBusca(null);
        if (termoLocal === buscaRemota.term) buscaRemota.executeNow();
        else buscaRemota.setTerm(termoLocal);
    }

    const termoBusca = campoBusca === null ? buscaRemota.term : termoLocal;

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

    async function salvarProduto(dados: ProdutoInput, arquivoImagem: File | null, removerImagem: boolean) {
        setSalvando(true);
        setErroFormulario("");
        let etapa = produtoEmEdicao ? "atualização do produto" : "cadastro do produto";
        try {
            const produtoSalvo = produtoEmEdicao
                ? await atualizarProduto(produtoEmEdicao.id, dados)
                : await cadastrarProduto(dados);
            if (arquivoImagem) {
                etapa = "envio da imagem";
                await enviarImagemProduto(produtoSalvo.id, arquivoImagem);
            } else if (produtoEmEdicao && removerImagem) {
                etapa = "remoção da imagem";
                await removerImagemProduto(produtoSalvo.id);
            }
            if (produtoEmEdicao) {
                setNotificacao({ mensagem: "Produto atualizado com sucesso.", tipo: "success" });
            } else {
                setNotificacao({ mensagem: "Produto cadastrado com sucesso.", tipo: "success" });
            }
            setFormularioAberto(false);
            setProdutoEmEdicao(null);
            await buscaRemota.refresh();
        } catch (erro) {
            setErroFormulario(`${etapa}: ${obterMensagemDaApi(erro, "não foi possível concluir a operação.")}`);
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
        { campo: "codigoInterno", cabecalho: "Código interno", largura: 180, pesquisavel: true, ordenavel: true, render: renderCodigo },
        { campo: "nome", cabecalho: "Produto", largura: 300, pesquisavel: true, ordenavel: true, render: renderNome },
        { campo: "unidadeMedida", cabecalho: "Unidade", largura: 110, ordenavel: true },
        { campo: "precoVenda", cabecalho: "Preço de venda", largura: 160, ordenavel: true, alinhar: "right", render: renderPreco },
        { campo: "estoqueAtual", cabecalho: "Estoque", largura: 120, ordenavel: true, alinhar: "right", render: renderEstoque },
        { campo: "ativo", cabecalho: "Situação", largura: 140, pesquisavel: true, ordenavel: true, render: renderSituacao },
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
    const termoNormalizado = normalizarBusca(termoLocal);
    const produtosFiltrados = produtos.filter((produto) => {
        if (situacao !== "todas" && produto.ativo !== (situacao === "ativas")) return false;
        if (campoBusca === null || !termoNormalizado) return true;
        if (campoBusca === "codigoInterno") {
            return [produto.codigoInterno, produto.codigoBarras].some((codigo) =>
                normalizarBusca(codigo ?? "").includes(termoNormalizado));
        }
        if (campoBusca === "nome") return normalizarBusca(produto.nome).includes(termoNormalizado);
        return (produto.ativo ? "ativo" : "inativo").startsWith(termoNormalizado);
    });

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

            <Stack spacing={1.5}>
                <PageFilters
                    campoBuscaAtivo={campoBusca === null ? undefined : { rotulo: camposBusca[campoBusca].rotulo, onRemover: removerCampoBusca }}
                    busca={{
                        placeholder: campoBusca === null ? "Pesquisar por nome, código interno ou código de barras…" : camposBusca[campoBusca].placeholder,
                        onChange: (valor) => { setErroCarregamento(""); if (campoBusca === null) buscaRemota.setTerm(valor); else setTermoLocal(valor); },
                        onKeyDown: (evento) => { if (evento.key === "Enter") { evento.preventDefault(); if (campoBusca === null) buscaRemota.executeNow(); } },
                        valor: termoBusca,
                        carregando: buscaRemota.loading,
                    }}
                >
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 }, flex: "0 0 auto" }}>
                        <InputLabel id="produto-situacao-label">Situação</InputLabel>
                        <Select
                            labelId="produto-situacao-label"
                            label="Situação"
                            value={situacao}
                            inputProps={{ "aria-label": "Filtrar produtos por situação", name: "situacao" }}
                            onChange={(e) => setSituacao(e.target.value)}
                        >
                            <MenuItem value="todas">Todas</MenuItem>
                            <MenuItem value="ativas">Ativas</MenuItem>
                            <MenuItem value="inativas">Inativas</MenuItem>
                        </Select>
                    </FormControl>
                </PageFilters>

                <AppTable
                    colunas={colunas}
                    buscaPorColuna={{ campo: campoBusca, onSelecionar: selecionarCampoBusca }}
                    linhas={produtosFiltrados}
                    carregando={buscaRemota.loading && !produtos.length}
                    obterChaveLinha={(p) => p.id}
                    vazio={{
                        titulo: termoBusca.trim() || situacao !== "todas" ? "Nenhum produto encontrado" : "Nenhum produto cadastrado",
                        descricao: termoBusca.trim() || situacao !== "todas" ? "Tente ajustar a busca ou o filtro de situação." : "Use “Novo produto” para iniciar seu catálogo.",
                        acao: !termoBusca.trim() && situacao === "todas" ? <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={abrirCadastro}>Novo produto</Button> : undefined,
                    }}
                    acoes={acoes}
                    compacta
                    sx={{ "& .MuiTableCell-root": { py: 0.75 } }}
                    minWidth={1214}
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
