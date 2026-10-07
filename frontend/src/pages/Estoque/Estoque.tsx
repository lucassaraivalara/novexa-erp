import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InputRoundedIcon from "@mui/icons-material/InputRounded";
import OutputRoundedIcon from "@mui/icons-material/OutputRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useEffect, useState } from "react";
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, MenuItem, Stack, Tab, Tabs, TablePagination, TextField, Typography,
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
import EntradasMercadoria from "./EntradasMercadoria";

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
    const [aba, setAba] = useState<"saldo" | "entradas">(() => new URLSearchParams(window.location.search).get("aba") === "entradas" ? "entradas" : "saldo");
    return <Stack spacing={2}>
        <Tabs value={aba} onChange={(_, valor) => setAba(valor)} aria-label="Área de estoque"
            sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="saldo" label="Saldo" /><Tab value="entradas" label="Entradas" />
        </Tabs>
        {aba === "saldo" ? <SaldoEstoque /> : <EntradasMercadoria />}
    </Stack>;
}

function SaldoEstoque() {
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
    const [totalItems, setTotalItems] = useState(0);
    const [revisao, setRevisao] = useState(0);
    const [situacao, setSituacao] = useState("");
    const [ordenacao, setOrdenacao] = useState({ campo: "nome", direcao: "asc" as "asc" | "desc" });
    const [paginaHistorico, setPaginaHistorico] = useState(0);
    const [sizeHistorico, setSizeHistorico] = useState(25);
    const [totalHistorico, setTotalHistorico] = useState(0);
    const [filtrosHistorico, setFiltrosHistorico] = useState({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" });

    function carregarProdutos() { setRevisao(n => n + 1); }

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarProdutosEstoque({ page: pagina, size: porPagina, sort: `${ordenacao.campo},${ordenacao.direcao}`,
                busca, campoBusca: campoBusca === "codigoEstoque" ? "codigoInterno" : campoBusca ?? undefined,
                situacaoEstoque: situacao || undefined }, controller.signal)
                .then(resposta => {
                    if (controller.signal.aborted) return;
                    setProdutos(resposta.items); setTotalItems(resposta.totalItems); setErro("");
                    if (pagina > 0 && !resposta.items.length) setPagina(Math.max(0, resposta.totalPages - 1));
                })
                .catch(e => { if (!controller.signal.aborted) setErro(obterMensagemEstoque(e, "Não foi possível carregar o estoque.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [pagina, porPagina, busca, campoBusca, situacao, ordenacao, revisao]);

    const linhasPagina = produtos.map<ProdutoEstoque>((produto) => ({
            ...produto,
            codigoEstoque: codigoProduto(produto),
            situacao: situacaoEstoque(produto),
        }));

    function selecionarCampoBusca(campo: string) {
        if (!(campo in camposBusca)) return;
        setCampoBusca(campo as CampoBuscaEstoque);
        setPagina(0);
    }

    function removerCampoBusca() {
        setCampoBusca(null);
        setPagina(0);
    }

    function abrirMovimentacao(produto: Produto, operacao: Operacao) {
        setErro(""); setQuantidade(""); setMotivo(""); setDialogo({ produto, operacao });
    }

    function abrirHistorico(produto: Produto) {
        setHistoricoProduto(produto); setPaginaHistorico(0); setHistorico([]); setTotalHistorico(0);
        setFiltrosHistorico({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" });
    }

    useEffect(() => {
        if (!historicoProduto) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregandoHistorico(true);
            listarHistoricoProduto(historicoProduto.id, { page: paginaHistorico, size: sizeHistorico,
                sort: filtrosHistorico.sort, tipo: filtrosHistorico.tipo || undefined, origem: filtrosHistorico.origem || undefined,
                dataInicial: filtrosHistorico.dataInicial || undefined, dataFinal: filtrosHistorico.dataFinal || undefined }, controller.signal)
                .then(resposta => { if (!controller.signal.aborted) { setHistorico(resposta.items); setTotalHistorico(resposta.totalItems); } })
                .catch(e => { if (!controller.signal.aborted) setErro(obterMensagemEstoque(e, "Não foi possível carregar o histórico.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregandoHistorico(false); });
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [historicoProduto, paginaHistorico, sizeHistorico, filtrosHistorico]);

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
        { campo: "situacao", cabecalho: "Situação", largura: 135, render: (valor) => { const situacao = valor as SituacaoEstoque; return <Chip size="small" label={situacao} color={coresSituacao[situacao]} variant="outlined" />; } },
    ];

    const acoes: AcaoTabela<ProdutoEstoque>[] = [
        { rotulo: "Entrada avulsa", icone: <InputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "ENTRADA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Registrar entrada avulsa" },
        { rotulo: "Saída", icone: <OutputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "SAIDA"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, cor: "error", tooltip: "Registrar saída" },
        { rotulo: "Ajuste", icone: <TuneRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "AJUSTE"), desabilitado: (produto) => !produto.controlaEstoque || !produto.ativo, tooltip: "Ajustar novo saldo físico" },
        { rotulo: "Histórico", icone: <HistoryRoundedIcon fontSize="small" />, onClick: (produto) => void abrirHistorico(produto), tooltip: "Consultar histórico" },
    ];

    const operacao = dialogo?.operacao;
    const tituloOperacao = operacao === "AJUSTE" ? "Ajustar estoque" : operacao === "ENTRADA" ? "Registrar entrada avulsa" : "Registrar saída";
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
                    onChange: valor => { setBusca(valor); setPagina(0); },
                }}
            >
                <TextField select size="small" label="Situação do estoque" value={situacao} sx={{ minWidth: 180 }}
                    onChange={e => { setSituacao(e.target.value); setPagina(0); }}>
                    <MenuItem value="">Todas</MenuItem>
                    <MenuItem value="zerado">Zerado</MenuItem><MenuItem value="baixo">Baixo</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem><MenuItem value="semControle">Sem controle</MenuItem>
                </TextField>
            </PageFilters>
            <AppTable colunas={colunas} buscaPorColuna={{ campo: campoBusca, onSelecionar: selecionarCampoBusca }} linhas={linhasPagina} carregando={carregando} obterChaveLinha={(produto) => produto.id}
            vazio={{ titulo: "Nenhum produto encontrado", descricao: busca ? "Tente outro nome ou código." : "Cadastre produtos para acompanhar o estoque." }}
            acoes={acoes} compacta alturaCorpo={480}
            minWidth={900} sx={{ "& .MuiTableCell-root": { py: 0.75 } }}
            ordenacaoRemota
            ordenacao={{ campo: ordenacao.campo === "codigoInterno" ? "codigoEstoque" : ordenacao.campo,
                direcao: ordenacao.direcao, onSort: campo => {
                    const propriedade = campo === "codigoEstoque" ? "codigoInterno" : campo;
                    setPagina(0); setOrdenacao(atual => ({ campo: propriedade, direcao: atual.campo === propriedade && atual.direcao === "asc" ? "desc" : "asc" }));
                } }}
            paginacao={{
                pagina,
                linhasPorPagina: porPagina,
                total: totalItems,
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
            <Stack direction="row" spacing={1} sx={{ px: 3, flexWrap: "wrap", gap: 1 }}>
                {([ ["tipo", "Tipo", ["ENTRADA", "SAIDA", "AJUSTE"]],
                    ["origem", "Origem", ["MANUAL", "VENDA", "COMPRA", "AJUSTE", "CANCELAMENTO"]] ] as const).map(([campo, label, opcoes]) =>
                    <TextField key={campo} select size="small" label={label} value={filtrosHistorico[campo]} sx={{ minWidth: 140 }}
                        onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(atual => ({ ...atual, [campo]: e.target.value })); }}>
                        <MenuItem value="">Todas</MenuItem>{opcoes.map(valor => <MenuItem key={valor} value={valor}>{valor}</MenuItem>)}
                    </TextField>)}
                {([ ["dataInicial", "Data inicial"], ["dataFinal", "Data final"] ] as const).map(([campo, label]) =>
                    <TextField key={campo} type="date" size="small" label={label} value={filtrosHistorico[campo]}
                        slotProps={{ inputLabel: { shrink: true } }}
                        onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(atual => ({ ...atual, [campo]: e.target.value })); }} />)}
                <TextField select size="small" label="Ordem" value={filtrosHistorico.sort}
                    onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(atual => ({ ...atual, sort: e.target.value })); }}>
                    <MenuItem value="dataHora,desc">Mais recentes</MenuItem><MenuItem value="dataHora,asc">Mais antigas</MenuItem>
                </TextField>
            </Stack>
            <DialogContent>{carregandoHistorico ? <Typography color="text.secondary">Carregando histórico…</Typography> : historico.length === 0 ? <Typography color="text.secondary">Nenhuma movimentação encontrada.</Typography> : <Stack divider={<Divider />}>
                {historico.map((movimentacao) => <Stack key={movimentacao.id} spacing={0.5} sx={{ py: 1.5 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}><Typography sx={{ fontWeight: 700 }}>{movimentacao.tipo} · {movimentacao.origem}</Typography><Typography variant="body2" color="text.secondary">{dataFormatada.format(new Date(movimentacao.dataHora))}</Typography></Stack>
                    <Typography variant="body2">Saldo: {quantidadeFormatada.format(movimentacao.saldoAnterior)} → {quantidadeFormatada.format(movimentacao.saldoPosterior)} · Valor: {quantidadeFormatada.format(movimentacao.quantidade)}</Typography>
                    <Typography variant="body2" color="text.secondary">{movimentacao.motivo || "Sem motivo informado"} · {movimentacao.nomeUsuario}</Typography>
                </Stack>)}
            </Stack>}</DialogContent>
            <TablePagination component="div" count={totalHistorico} page={paginaHistorico} rowsPerPage={sizeHistorico}
                rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, pagina) => setPaginaHistorico(pagina)}
                onRowsPerPageChange={e => { setSizeHistorico(Number(e.target.value)); setPaginaHistorico(0); }} />
            <DialogActions><Button type="button" onClick={() => setHistoricoProduto(null)}>Fechar</Button></DialogActions>
        </Dialog>
    </PageContainer>;
}
