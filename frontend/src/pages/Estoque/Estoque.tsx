import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InputRoundedIcon from "@mui/icons-material/InputRounded";
import OutputRoundedIcon from "@mui/icons-material/OutputRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useEffect, useMemo, useState } from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, Stack, TextField, Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import type { Produto } from "../../types/produto";
import {
    listarHistoricoProduto, listarProdutosEstoque, obterMensagemEstoque,
    registrarAjuste, registrarEntrada, registrarSaida, type MovimentacaoEstoque,
    type TipoMovimentacaoEstoque,
} from "../../services/estoqueService";
import { novoSaldoEsperado, situacaoEstoque, type SituacaoEstoque } from "./estoqueRegras";

const quantidadeFormatada = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dataFormatada = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
type Operacao = TipoMovimentacaoEstoque;
type DialogoMovimentacao = { produto: Produto; operacao: Operacao } | null;
type CampoBuscaEstoque = "nome" | "codigoEstoque";
type ProdutoEstoque = Produto & { codigoEstoque: string; situacao: SituacaoEstoque };

const camposBusca: Record<CampoBuscaEstoque, { rotulo: string; placeholder: string }> = {
    nome: { rotulo: "Produto", placeholder: "Pesquisar por produto…" },
    codigoEstoque: { rotulo: "Código", placeholder: "Pesquisar por código…" },
};

const coresSituacao: Record<SituacaoEstoque, "default" | "success" | "warning" | "error"> = {
    "SEM CONTROLE": "default", NORMAL: "success", BAIXO: "warning", ZERADO: "error",
};

function codigoProduto(produto: Produto): string {
    return produto.codigoInterno || produto.codigoBarras || "—";
}

export default function Estoque() {
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [busca, setBusca] = useState("");
    const [campoBusca, setCampoBusca] = useState<CampoBuscaEstoque | null>(null);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [dialogo, setDialogo] = useState<DialogoMovimentacao>(null);
    const [historicoProduto, setHistoricoProduto] = useState<Produto | null>(null);
    const [historico, setHistorico] = useState<MovimentacaoEstoque[]>([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [quantidade, setQuantidade] = useState("");
    const [motivo, setMotivo] = useState("");
    const [salvando, setSalvando] = useState(false);

    async function carregarProdutos() {
        setCarregando(true); setErro("");
        try { setProdutos(await listarProdutosEstoque()); }
        catch (e) { setErro(obterMensagemEstoque(e, "Não foi possível carregar o estoque.")); }
        finally { setCarregando(false); }
    }

    useEffect(() => {
        let ativo = true;
        listarProdutosEstoque()
            .then((dados) => { if (ativo) setProdutos(dados); })
            .catch((e) => { if (ativo) setErro(obterMensagemEstoque(e, "Não foi possível carregar o estoque.")); })
            .finally(() => { if (ativo) setCarregando(false); });
        return () => { ativo = false; };
    }, []);

    const produtosFiltrados = useMemo(() => {
        const termo = busca.trim().toLocaleLowerCase("pt-BR");
        return produtos.map<ProdutoEstoque>((produto) => ({
            ...produto,
            codigoEstoque: codigoProduto(produto),
            situacao: situacaoEstoque(produto),
        })).filter((produto) => {
            if (!termo) return true;
            if (campoBusca === "nome") return produto.nome.toLocaleLowerCase("pt-BR").includes(termo);
            if (campoBusca === "codigoEstoque") return produto.codigoEstoque.toLocaleLowerCase("pt-BR").includes(termo);
            return produto.nome.toLocaleLowerCase("pt-BR").includes(termo)
                || produto.codigoEstoque.toLocaleLowerCase("pt-BR").includes(termo);
        });
    }, [busca, campoBusca, produtos]);
    const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(produtosFiltrados.length / porPagina) - 1));
    const linhasPagina = produtosFiltrados.slice(paginaAtual * porPagina, paginaAtual * porPagina + porPagina);

    function selecionarCampoBusca(campo: string) {
        if (!(campo in camposBusca)) return;
        setCampoBusca(campo as CampoBuscaEstoque);
    }

    function removerCampoBusca() {
        setCampoBusca(null);
    }

    function abrirMovimentacao(produto: Produto, operacao: Operacao) {
        setErro(""); setQuantidade(""); setMotivo(""); setDialogo({ produto, operacao });
    }

    async function abrirHistorico(produto: Produto) {
        setHistoricoProduto(produto); setCarregandoHistorico(true); setErro("");
        try { setHistorico(await listarHistoricoProduto(produto.id)); }
        catch (e) { setHistorico([]); setErro(obterMensagemEstoque(e, "Não foi possível carregar o histórico.")); }
        finally { setCarregandoHistorico(false); }
    }

    async function confirmarMovimentacao() {
        if (!dialogo || salvando) return;
        const valor = Number(quantidade.replace(",", "."));
        if (!Number.isFinite(valor) || valor < 0 || (dialogo.operacao !== "AJUSTE" && valor <= 0)) {
            setErro(dialogo.operacao === "AJUSTE" ? "Informe um novo saldo físico válido." : "Informe uma quantidade maior que zero."); return;
        }
        setSalvando(true); setErro("");
        const dados = { produtoId: dialogo.produto.id, quantidade: valor, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
        try {
            if (dialogo.operacao === "ENTRADA") await registrarEntrada(dados);
            if (dialogo.operacao === "SAIDA") await registrarSaida(dados);
            if (dialogo.operacao === "AJUSTE") await registrarAjuste(dados);
            setDialogo(null); await carregarProdutos();
        } catch (e) { setErro(obterMensagemEstoque(e, "Não foi possível registrar a movimentação.")); }
        finally { setSalvando(false); }
    }

    const colunas: Coluna<ProdutoEstoque>[] = [
        { campo: "nome", cabecalho: "Produto", largura: 280, pesquisavel: true, ordenavel: true },
        { campo: "codigoEstoque", cabecalho: "Código", largura: 135, pesquisavel: true, ordenavel: true },
        { campo: "estoqueAtual", cabecalho: "Estoque atual", largura: 125, alinhar: "right", ordenavel: true, render: (valor) => quantidadeFormatada.format(Number(valor)) },
        { campo: "estoqueMinimo", cabecalho: "Estoque mínimo", largura: 125, alinhar: "right", ordenavel: true, render: (valor) => quantidadeFormatada.format(Number(valor)) },
        { campo: "situacao", cabecalho: "Situação", largura: 135, ordenavel: true, render: (valor) => { const situacao = valor as SituacaoEstoque; return <Chip size="small" label={situacao} color={coresSituacao[situacao]} variant="outlined" />; } },
    ];

    const acoes: AcaoTabela<ProdutoEstoque>[] = [
        { rotulo: "Entrada", icone: <InputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "ENTRADA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Registrar entrada" },
        { rotulo: "Saída", icone: <OutputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "SAIDA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, cor: "error", tooltip: "Registrar saída" },
        { rotulo: "Ajuste", icone: <TuneRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "AJUSTE"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Ajustar novo saldo físico" },
        { rotulo: "Histórico", icone: <HistoryRoundedIcon fontSize="small" />, onClick: (produto) => void abrirHistorico(produto), tooltip: "Consultar histórico" },
    ];

    const operacao = dialogo?.operacao;
    const tituloOperacao = operacao === "AJUSTE" ? "Ajustar estoque" : operacao === "ENTRADA" ? "Registrar entrada" : "Registrar saída";
    const valor = Number(quantidade.replace(",", "."));
    const saldoEsperado = dialogo && quantidade.trim() !== "" && Number.isFinite(valor) && valor >= 0
        ? novoSaldoEsperado(operacao!, dialogo.produto.estoqueAtual, valor) : null;

    return <PageContainer>
        <PageHeader titulo="Estoque" descricao="Consulte saldos e registre movimentações operacionais." />
        {erro && <Alert severity="error" onClose={() => setErro("")}>{erro}</Alert>}
        <Stack spacing={1.5}>
            <PageFilters
                campoBuscaAtivo={campoBusca === null ? undefined : { rotulo: camposBusca[campoBusca].rotulo, onRemover: removerCampoBusca }}
                busca={{
                    placeholder: campoBusca === null ? "Pesquisar por produto ou código…" : camposBusca[campoBusca].placeholder,
                    valor: busca,
                    onChange: setBusca,
                }}
            />
            <AppTable colunas={colunas} buscaPorColuna={{ campo: campoBusca, onSelecionar: selecionarCampoBusca }} linhas={linhasPagina} carregando={carregando} obterChaveLinha={(produto) => produto.id}
            vazio={{ titulo: "Nenhum produto encontrado", descricao: busca ? "Tente outro nome ou código." : "Cadastre produtos para acompanhar o estoque." }}
            acoes={acoes} compacta alturaCorpo={480}
            minWidth={900} sx={{ "& .MuiTableCell-root": { py: 0.75 } }}
            paginacao={{
                pagina: paginaAtual,
                linhasPorPagina: porPagina,
                total: produtosFiltrados.length,
                onPageChange: setPagina,
                onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50],
            }} />
        </Stack>

        <Dialog open={dialogo !== null} onClose={salvando ? undefined : () => setDialogo(null)} fullWidth maxWidth="xs" aria-labelledby="estoque-movimentacao-titulo">
            <DialogTitle id="estoque-movimentacao-titulo">{tituloOperacao}</DialogTitle>
            <DialogContent>{dialogo && <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField name="produto" autoComplete="off" label="Produto" value={`${dialogo.produto.nome} · ${codigoProduto(dialogo.produto)}`} slotProps={{ input: { readOnly: true } }} />
                <Typography variant="body2" color="text.secondary">Saldo atual: <strong>{quantidadeFormatada.format(dialogo.produto.estoqueAtual)}</strong></Typography>
                <TextField name="quantidade" autoComplete="off" autoFocus required label={operacao === "AJUSTE" ? "Novo saldo físico" : "Quantidade"} value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmarMovimentacao(); } }} slotProps={{ htmlInput: { inputMode: "decimal", min: 0, "aria-describedby": "estoque-quantidade-ajuda" } }} />
                <Typography id="estoque-quantidade-ajuda" variant="caption" color="text.secondary">Informe um valor decimal; entrada e saída exigem valor maior que zero.</Typography>
                <TextField name="motivo" autoComplete="off" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} multiline minRows={2} />
                <Typography variant="body2" color="text.secondary">Novo saldo esperado: <strong>{saldoEsperado !== null ? quantidadeFormatada.format(saldoEsperado) : "—"}</strong></Typography>
            </Stack>}</DialogContent>
            <DialogActions><Button type="button" onClick={() => setDialogo(null)} disabled={salvando}>Cancelar</Button><Button type="button" variant="contained" onClick={() => void confirmarMovimentacao()} disabled={salvando}>{salvando ? "Registrando…" : "Confirmar"}</Button></DialogActions>
        </Dialog>

        <Dialog open={historicoProduto !== null} onClose={() => setHistoricoProduto(null)} fullWidth maxWidth="md" aria-labelledby="estoque-historico-titulo">
            <DialogTitle id="estoque-historico-titulo">Histórico de movimentações{historicoProduto ? ` · ${historicoProduto.nome}` : ""}</DialogTitle>
            <DialogContent>{carregandoHistorico ? <Typography color="text.secondary">Carregando histórico…</Typography> : historico.length === 0 ? <Typography color="text.secondary">Nenhuma movimentação encontrada.</Typography> : <Stack divider={<Divider />}>
                {historico.map((movimentacao) => <Stack key={movimentacao.id} spacing={0.5} sx={{ py: 1.5 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}><Typography sx={{ fontWeight: 700 }}>{movimentacao.tipo} · {movimentacao.origem}</Typography><Typography variant="body2" color="text.secondary">{dataFormatada.format(new Date(movimentacao.dataHora))}</Typography></Stack>
                    <Typography variant="body2">Saldo: {quantidadeFormatada.format(movimentacao.saldoAnterior)} → {quantidadeFormatada.format(movimentacao.saldoPosterior)} · Valor: {quantidadeFormatada.format(movimentacao.quantidade)}</Typography>
                    <Typography variant="body2" color="text.secondary">{movimentacao.motivo || "Sem motivo informado"} · {movimentacao.nomeUsuario}</Typography>
                </Stack>)}
            </Stack>}</DialogContent>
            <DialogActions><Button type="button" onClick={() => setHistoricoProduto(null)}>Fechar</Button></DialogActions>
        </Dialog>
    </PageContainer>;
}
