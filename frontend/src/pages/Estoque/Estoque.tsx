import CampoTexto from "../../components/ui/CampoTexto";
import { CampoQuantidade } from "../../components/ui/CampoDecimal";
import { numeroDecimal } from "../../utils/numeroFormulario";
import { formatarDataHora } from "../../utils/dataHora";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import InputRoundedIcon from "@mui/icons-material/InputRounded";
import OutputRoundedIcon from "@mui/icons-material/OutputRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, IconButton, Link, MenuItem, Stack, Tab, Tabs, TablePagination, TextField, Tooltip, Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import PageFilters from "../../components/ui/PageFilters";
import type { Produto } from "../../types/produto";
import { buscarProdutoPorId } from "../../services/produtoService";
import {
    listarHistoricoProduto, listarProdutosEstoque, obterMensagemEstoque,
    registrarAjuste, registrarEntrada, registrarSaida, type MovimentacaoEstoque,
    type TipoMovimentacaoEstoque,
} from "../../services/estoqueService";
import { impedimentoMovimentacao, novoSaldoEsperado, quantidadeComUnidade, situacaoEstoque, type SituacaoEstoque } from "./estoqueRegras";
import EntradasMercadoria from "./EntradasMercadoria";
import AjusteEstoqueMassa from "./AjusteEstoqueMassa";

type Operacao = TipoMovimentacaoEstoque;
type DialogoMovimentacao = { produto: Produto; operacao: Operacao } | null;
type CampoBuscaEstoque = "nome" | "codigoEstoque";
type ProdutoEstoque = Produto & { codigoEstoque: string; situacao: SituacaoEstoque };

const camposBusca: Record<CampoBuscaEstoque, { rotulo: string; placeholder: string }> = {
    nome: { rotulo: "Produto", placeholder: "Pesquisar por produto…" },
    codigoEstoque: { rotulo: "Código", placeholder: "Pesquisar por código…" },
};

const coresSituacao: Record<SituacaoEstoque, "default" | "success" | "warning" | "error"> = {
    "SEM CONTROLE": "default", NEGATIVO: "error", NORMAL: "success", BAIXO: "warning", ZERADO: "error",
};

const situacoesFiltro = ["zerado", "baixo", "negativo", "normal", "semControle"];

function saldoNegativo(produto: Pick<Produto, "controlaEstoque" | "estoqueAtual">): boolean {
    return produto.controlaEstoque && Number(produto.estoqueAtual) < 0;
}

function codigoProduto(produto: Produto): string {
    return produto.codigoInterno || produto.codigoBarras || "—";
}

export default function Estoque() {
    const [params, setParams] = useSearchParams();
    const aba = params.get("aba") === "entradas" ? "entradas" : "saldo";
    return <Stack spacing={2}>
        <Tabs value={aba} onChange={(_, valor) => {
            const proximo = new URLSearchParams(params);
            if (valor === "entradas") proximo.set("aba", valor); else proximo.delete("aba");
            setParams(proximo, { replace: true });
        }} aria-label="Área de estoque" variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab value="saldo" label="Saldo" /><Tab value="entradas" label="Entradas de mercadoria" />
        </Tabs>
        {aba === "saldo" ? <SaldoEstoque /> : <EntradasMercadoria />}
    </Stack>;
}

function SaldoEstoque() {
    const [paramsIniciais] = useSearchParams();
    const situacaoInicial = paramsIniciais.get("situacaoEstoque");
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [busca, setBusca] = useState("");
    const [campoBusca, setCampoBusca] = useState<CampoBuscaEstoque | null>(null);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(25);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [erroMovimentacao, setErroMovimentacao] = useState("");
    const [erroHistorico, setErroHistorico] = useState("");
    const [sucesso, setSucesso] = useState("");
    const enviandoMovimentacao = useRef(false);
    const erroMovimentacaoRef = useRef<HTMLDivElement>(null);
    const acaoRetorno = useRef<string | null>(null);
    const dialogoSaiu = useRef(true);
    const [dialogo, setDialogo] = useState<DialogoMovimentacao>(null);
    const [historicoProduto, setHistoricoProduto] = useState<Produto | null>(null);
    const [erroComponente, setErroComponente] = useState("");
    const [historico, setHistorico] = useState<MovimentacaoEstoque[]>([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [quantidade, setQuantidade] = useState("");
    const [motivo, setMotivo] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [totalItems, setTotalItems] = useState(0);
    const [revisao, setRevisao] = useState(0);
    const [telaAjusteMassa, setTelaAjusteMassa] = useState(false);
    const [situacao, setSituacao] = useState(situacaoInicial && situacoesFiltro.includes(situacaoInicial) ? situacaoInicial : "");
    const [ordenacao, setOrdenacao] = useState({ campo: "nome", direcao: "asc" as "asc" | "desc" });
    const [paginaHistorico, setPaginaHistorico] = useState(0);
    const [sizeHistorico, setSizeHistorico] = useState(25);
    const [totalHistorico, setTotalHistorico] = useState(0);
    const [revisaoHistorico, setRevisaoHistorico] = useState(0);
    const [filtrosHistorico, setFiltrosHistorico] = useState({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" });
    const periodoInvalido = Boolean(filtrosHistorico.dataInicial && filtrosHistorico.dataFinal && filtrosHistorico.dataInicial > filtrosHistorico.dataFinal);

    useEffect(() => { if (erroMovimentacao) erroMovimentacaoRef.current?.focus(); }, [erroMovimentacao]);
    function devolverFoco() {
        if (dialogoSaiu.current && acaoRetorno.current) {
            const botao = document.getElementById(acaoRetorno.current);
            if (botao) { botao.focus(); acaoRetorno.current = null; }
        }
    }
    useEffect(() => { if (!carregando && !dialogo) devolverFoco(); }, [carregando, dialogo]);

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
        dialogoSaiu.current = false;
        setErroMovimentacao(""); setSucesso(""); setQuantidade(""); setMotivo(""); setDialogo({ produto, operacao });
    }

    function abrirHistorico(produto: Produto) {
        setErroComponente("");
        setErroHistorico("");
        setHistoricoProduto(produto); setPaginaHistorico(0); setHistorico([]); setTotalHistorico(0);
        setFiltrosHistorico({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" });
    }

    useEffect(() => {
        if (!historicoProduto || periodoInvalido) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregandoHistorico(true); setErroHistorico("");
            listarHistoricoProduto(historicoProduto.id, { page: paginaHistorico, size: sizeHistorico,
                sort: filtrosHistorico.sort, tipo: filtrosHistorico.tipo || undefined, origem: filtrosHistorico.origem || undefined,
                dataInicial: filtrosHistorico.dataInicial || undefined, dataFinal: filtrosHistorico.dataFinal || undefined }, controller.signal)
                .then(resposta => { if (!controller.signal.aborted) { setHistorico(resposta.items); setTotalHistorico(resposta.totalItems); } })
                .catch(e => { if (!controller.signal.aborted) { setHistorico([]); setErroHistorico(obterMensagemEstoque(e, "Não foi possível carregar o histórico. Tente consultar novamente.")); } })
                .finally(() => { if (!controller.signal.aborted) setCarregandoHistorico(false); });
        }, 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [historicoProduto, paginaHistorico, sizeHistorico, filtrosHistorico, periodoInvalido, revisaoHistorico]);

    async function confirmarMovimentacao() {
        if (!dialogo || enviandoMovimentacao.current) return;
        const valor = numeroDecimal(quantidade, 3);
        if (valor === null || valor < 0 || (dialogo.operacao !== "AJUSTE" && valor <= 0)) {
            setErroMovimentacao(dialogo.operacao === "AJUSTE" ? "Informe um novo saldo físico válido, a partir de zero." : "Informe uma quantidade maior que zero."); return;
        }
        if (motivo.trim().length > 255) { setErroMovimentacao("O motivo deve ter até 255 caracteres."); return; }
        enviandoMovimentacao.current = true;
        setSalvando(true); setErroMovimentacao("");
        const dados = { produtoId: dialogo.produto.id, quantidade: valor, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) };
        try {
            if (dialogo.operacao === "ENTRADA") await registrarEntrada(dados);
            if (dialogo.operacao === "SAIDA") await registrarSaida(dados);
            if (dialogo.operacao === "AJUSTE") await registrarAjuste(dados);
            setSucesso(`${tituloOperacao}: movimentação registrada para ${dialogo.produto.nome}.`);
            setDialogo(null); carregarProdutos();
        } catch (e) { setErroMovimentacao(obterMensagemEstoque(e, "Não foi possível registrar a movimentação. Revise os dados e tente novamente.")); }
        finally { enviandoMovimentacao.current = false; setSalvando(false); }
    }

    const colunas: Coluna<ProdutoEstoque>[] = [
        { campo: "nome", cabecalho: "Produto", largura: 280, pesquisavel: true, ordenavel: true, render: (_, produto) => <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{produto.nome}</Typography>{!produto.ativo && <Typography variant="caption" color="text.secondary">Inativo</Typography>}{produto.composto && <Typography variant="caption" sx={{ display: "block" }} color="text.secondary">Kit/Combo · disponibilidade calculada pelos componentes</Typography>}</Box> },
        { campo: "codigoEstoque", cabecalho: "Código", largura: 135, pesquisavel: true, ordenavel: true },
        { campo: "estoqueAtual", cabecalho: "Saldo atual", largura: 155, alinhar: "right", ordenavel: true, render: (valor, produto) => <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, ...(saldoNegativo(produto) ? { color: "error.main" } : {}) }}>{quantidadeComUnidade(Number(valor), produto.unidadeMedida)}</Box> },
        { campo: "estoqueMinimo", cabecalho: "Mínimo", largura: 140, alinhar: "right", ordenavel: true, render: (valor, produto) => <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{quantidadeComUnidade(Number(valor), produto.unidadeMedida)}</Box> },
        { campo: "situacao", cabecalho: "Situação", largura: 135, render: (valor) => { const situacao = valor as SituacaoEstoque; return <Chip size="small" label={situacao} color={coresSituacao[situacao]} variant="outlined" />; } },
    ];

    const acoes: AcaoTabela<ProdutoEstoque>[] = [
        { rotulo: "Entrada avulsa", icone: <InputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "ENTRADA"), desabilitado: (produto) => !!produto.composto || !produto.controlaEstoque || !produto.ativo, tooltip: "Registrar entrada avulsa" },
        { rotulo: "Saída", icone: <OutputRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "SAIDA"), desabilitado: (produto) => !!produto.composto || !produto.controlaEstoque || !produto.ativo, cor: "error", tooltip: "Registrar saída" },
        { rotulo: "Ajuste", icone: <TuneRoundedIcon fontSize="small" />, onClick: (produto) => abrirMovimentacao(produto, "AJUSTE"), desabilitado: (produto) => !!produto.composto || !produto.controlaEstoque || !produto.ativo, tooltip: "Ajustar novo saldo físico" },
        { rotulo: "Histórico", icone: <HistoryRoundedIcon fontSize="small" />, onClick: (produto) => void abrirHistorico(produto), tooltip: "Consultar histórico" },
    ];
    const colunasComAcoes: Coluna<ProdutoEstoque>[] = [...colunas, { campo: "acoes", cabecalho: "Ações", largura: 180, render: (_, produto) => <Stack direction="row" spacing={0.5}>
        {acoes.map(acao => {
            const impedimento = acao.desabilitado?.(produto) ? impedimentoMovimentacao(produto) : "";
            const id = `estoque-acao-${produto.id}-${acao.rotulo}`;
            return <Tooltip key={acao.rotulo} title={impedimento || acao.tooltip}><span><IconButton id={id} size="small" aria-label={`${acao.rotulo} · ${produto.nome}`} disabled={!!impedimento}
                color={acao.cor ?? "inherit"} onClick={() => { if (acao.rotulo !== "Histórico") acaoRetorno.current = id; acao.onClick(produto); }} sx={{ width: 36, height: 36,
                    "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>{acao.icone}</IconButton></span></Tooltip>;
        })}
    </Stack> }];

    const operacao = dialogo?.operacao;
    const tituloOperacao = operacao === "AJUSTE" ? "Ajustar estoque" : operacao === "ENTRADA" ? "Registrar entrada avulsa" : "Registrar saída";
    const valor = numeroDecimal(quantidade, 3);
    const saldoEsperado = dialogo && valor !== null && valor >= 0
        ? novoSaldoEsperado(operacao!, dialogo.produto.estoqueAtual, valor) : null;
    const filtrosAtivos = Boolean(busca || situacao || campoBusca);
    function limparFiltros() { setBusca(""); setSituacao(""); setCampoBusca(null); setPagina(0); }

    return <PageContainer>
        <PageHeader titulo={telaAjusteMassa ? "Ajuste de estoque em massa" : "Saldo"} descricao={telaAjusteMassa ? "Informe saldos físicos e confira as diferenças antes de confirmar." : "Consulte saldos e movimentações de estoque."} acoesSecundarias={telaAjusteMassa ? <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => setTelaAjusteMassa(false)}>Voltar para saldos</Button> : undefined} />
        <AjusteEstoqueMassa onConcluido={() => setRevisao(r => r + 1)} telaAjuste={telaAjusteMassa} onTelaAjusteChange={setTelaAjusteMassa} />
        <Box sx={{ display: telaAjusteMassa ? "none" : undefined }}>
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={carregarProdutos}>Tentar novamente</Button>}>{erro}</Alert>}
        {sucesso && <Alert severity="success" role="status" onClose={() => setSucesso("")}>{sucesso}</Alert>}
        <Stack spacing={1.5}>
            <PageFilters
                campoBuscaAtivo={campoBusca === null ? undefined : { rotulo: camposBusca[campoBusca].rotulo, onRemover: removerCampoBusca }}
                busca={{
                    placeholder: campoBusca === null ? "Pesquisar por produto ou código…" : camposBusca[campoBusca].placeholder,
                    valor: busca,
                    onChange: valor => { setBusca(valor); setPagina(0); },
                }}
            >
                <TextField select size="small" label="Situação do estoque" value={situacao} sx={{ minWidth: { xs: "100%", sm: 180 } }}
                    onChange={e => { setSituacao(e.target.value); setPagina(0); }}>
                    <MenuItem value="">Todas</MenuItem>
                    <MenuItem value="zerado">Zerado</MenuItem><MenuItem value="baixo">Baixo</MenuItem>
                    <MenuItem value="negativo">Negativo</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem><MenuItem value="semControle">Sem controle</MenuItem>
                </TextField>
                {filtrosAtivos && <Button size="small" onClick={limparFiltros}>Limpar filtros</Button>}
            </PageFilters>
            {filtrosAtivos && <Typography variant="caption" color="text.secondary" role="status">Filtros ativos{situacao ? ` · ${situacao === "semControle" ? "Sem controle" : situacao}` : ""}{busca ? ` · “${busca}”` : ""}</Typography>}
            <AppTable colunas={colunasComAcoes} buscaPorColuna={{ campo: campoBusca, onSelecionar: selecionarCampoBusca }} linhas={linhasPagina} carregando={carregando} obterChaveLinha={(produto) => produto.id}
            vazio={{ titulo: erro ? "Consulta indisponível" : filtrosAtivos ? "Nenhum produto encontrado" : "Nenhum produto cadastrado", descricao: erro ? "Tente carregar os saldos novamente." : filtrosAtivos ? "Revise ou limpe os filtros para encontrar produtos." : "Cadastre produtos para acompanhar o estoque.",
                acao: filtrosAtivos && !erro ? <Button onClick={limparFiltros}>Limpar filtros</Button> : undefined }}
            compacta alturaCorpo={480}
            minWidth={1000} sx={{ "& tbody .MuiTableCell-root": { py: 1, px: 1.5, verticalAlign: "middle" }, "& thead .MuiTableCell-root": { px: 1.5 } }}
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

        <Dialog open={dialogo !== null} onClose={salvando ? undefined : () => setDialogo(null)} fullWidth maxWidth="xs" aria-labelledby="estoque-movimentacao-titulo"
            slotProps={{ transition: { onExited: () => { dialogoSaiu.current = true; if (!carregando) devolverFoco(); } } }}>
            <DialogTitle id="estoque-movimentacao-titulo">{tituloOperacao}</DialogTitle>
            <DialogContent>{dialogo && <Stack spacing={2} sx={{ pt: 1 }}>
                <Box sx={{ overflowWrap: "anywhere" }}><Typography sx={{ fontWeight: 600 }}>{dialogo.produto.nome}</Typography><Typography variant="caption" color="text.secondary">Código {codigoProduto(dialogo.produto)}</Typography></Box>
                <Typography variant="body2" color="text.secondary">Saldo atual: <strong>{quantidadeComUnidade(dialogo.produto.estoqueAtual, dialogo.produto.unidadeMedida)}</strong></Typography>
                {erroMovimentacao && <Alert severity="error" ref={erroMovimentacaoRef} tabIndex={-1}>{erroMovimentacao}</Alert>}
                <CampoQuantidade canonico descricaoId="estoque-quantidade-ajuda" placeholder="Ex.: 1,250…" name="quantidade" autoComplete="off" autoFocus required label={operacao === "AJUSTE" ? "Novo saldo físico" : "Quantidade"} value={quantidade}
                    disabled={salvando} onValueChange={v => setQuantidade(v)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmarMovimentacao(); } }}  />
                <Typography id="estoque-quantidade-ajuda" variant="caption" color="text.secondary">{operacao === "AJUSTE" ? "Informe o total contado, não a diferença. Zero é permitido." : operacao === "SAIDA" ? "Informe quanto retirar do saldo atual." : "Informe quanto acrescentar ao saldo atual."} Até três casas decimais · {dialogo.produto.unidadeMedida || "unidade não informada"}.</Typography>
                <CampoTexto helperText={`Opcional; registrado no histórico. ${motivo.length}/255 caracteres.`} placeholder="Justifique a movimentação…" name="motivo" autoComplete="off" label="Motivo" value={motivo} disabled={salvando} error={motivo.length > 255} onChange={(e) => setMotivo(e.target.value)} multiline minRows={2} />
                <Box role="status" sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}><Typography variant="body2">Novo saldo esperado</Typography><Typography sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{saldoEsperado !== null ? quantidadeComUnidade(saldoEsperado, dialogo.produto.unidadeMedida) : "—"}</Typography><Typography variant="caption" color="text.secondary">Previsão; o saldo será validado ao confirmar.</Typography></Box>
            </Stack>}</DialogContent>
            <DialogActions><Button type="button" onClick={() => setDialogo(null)} disabled={salvando}>Cancelar</Button><Button type="button" variant="contained" onClick={() => void confirmarMovimentacao()} disabled={salvando}>{salvando ? "Registrando…" : "Confirmar"}</Button></DialogActions>
        </Dialog>

        <Dialog open={historicoProduto !== null} onClose={() => setHistoricoProduto(null)} fullWidth maxWidth="md" aria-labelledby="estoque-historico-titulo">
            <DialogTitle id="estoque-historico-titulo">Histórico de movimentações{historicoProduto ? ` · ${historicoProduto.nome}` : ""}</DialogTitle>
            {historicoProduto?.composto && <Stack spacing={1} sx={{ px: 3, pb: 2 }}>
                <Alert severity="info">Kit/Combo não possui movimentos físicos próprios. Consulte o consumo e as reversões no histórico dos componentes ou no detalhe da venda.</Alert>
                {erroComponente && <Alert severity="error">{erroComponente}</Alert>}
                {historicoProduto.componentes?.map(c => <Button key={c.produtoId} variant="text" sx={{ justifyContent: "flex-start" }}
                    onClick={() => { void buscarProdutoPorId(c.produtoId).then(abrirHistorico).catch(e => setErroComponente(obterMensagemEstoque(e, "Não foi possível consultar o componente."))); }}>Consultar movimentos de {c.nome}</Button>)}
            </Stack>}
            <DialogContent sx={{ pt: 0, overscrollBehavior: "contain" }}>
            {historicoProduto && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Código {codigoProduto(historicoProduto)} · Unidade {historicoProduto.unidadeMedida || "não informada"}</Typography>}
            <Stack direction={{ xs: "column", sm: "row" }} useFlexGap spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
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
                {(filtrosHistorico.tipo || filtrosHistorico.origem || filtrosHistorico.dataInicial || filtrosHistorico.dataFinal || filtrosHistorico.sort !== "dataHora,desc") && <Button onClick={() => { setPaginaHistorico(0); setFiltrosHistorico({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" }); }}>Limpar filtros do histórico</Button>}
            </Stack>
            {periodoInvalido ? <Alert severity="warning">A data inicial deve ser anterior ou igual à data final. Corrija o período para consultar.</Alert> : erroHistorico ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRevisaoHistorico(r => r + 1)}>Tentar novamente</Button>}>{erroHistorico}</Alert> : carregandoHistorico ? <Typography role="status" color="text.secondary">Carregando histórico…</Typography> : historico.length === 0 ? <Typography color="text.secondary">Nenhuma movimentação encontrada. Revise os filtros ou consulte outro período.</Typography> : <Stack divider={<Divider />}>
                {historico.map((movimentacao) => <Stack key={movimentacao.id} spacing={0.5} sx={{ py: 1.5 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}><Typography sx={{ fontWeight: 600 }}>{movimentacao.tipo} · {movimentacao.origem}</Typography><Typography variant="body2" color="text.secondary">{formatarDataHora(movimentacao.dataHora)}</Typography></Stack>
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>Saldo: {quantidadeComUnidade(movimentacao.saldoAnterior, historicoProduto?.unidadeMedida)} → {quantidadeComUnidade(movimentacao.saldoPosterior, historicoProduto?.unidadeMedida)} · {movimentacao.tipo === "AJUSTE" ? "Saldo físico informado" : "Quantidade"}: {quantidadeComUnidade(movimentacao.quantidade, historicoProduto?.unidadeMedida)}</Typography>
                    <Typography variant="body2" color="text.secondary">{movimentacao.motivo || "Sem motivo informado"} · {movimentacao.nomeUsuario}</Typography>
                    {movimentacao.vendaId != null && <Typography variant="body2"><Link href={`/vendas?vendaId=${movimentacao.vendaId}`} target="_blank" rel="noopener noreferrer">Abrir venda #{movimentacao.vendaId} · Kit/Combo #{movimentacao.produtoCompostoId} (nova aba)</Link></Typography>}
                    {movimentacao.entradaMercadoriaId != null && <Typography variant="body2">
                        <Link href={`/estoque?aba=entradas&entradaId=${movimentacao.entradaMercadoriaId}`} target="_blank" rel="noopener noreferrer">
                            Abrir entrada de origem #{movimentacao.entradaMercadoriaId} (nova aba)
                        </Link>
                    </Typography>}
                </Stack>)}
            </Stack>}</DialogContent>
            <TablePagination component="div" labelRowsPerPage="Itens por página" labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} count={totalHistorico} page={paginaHistorico} rowsPerPage={sizeHistorico}
                rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, pagina) => setPaginaHistorico(pagina)}
                onRowsPerPageChange={e => { setSizeHistorico(Number(e.target.value)); setPaginaHistorico(0); }} />
            <DialogActions><Button type="button" onClick={() => setHistoricoProduto(null)}>Fechar</Button></DialogActions>
        </Dialog>
        </Box>
    </PageContainer>;
}
