import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Autocomplete, Box, Button, Chip, ClickAwayListener, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { alpha } from "@mui/material/styles";
import CampoTexto from "../../components/ui/CampoTexto";
import { CampoQuantidade } from "../../components/ui/CampoDecimal";
import { numeroDecimal } from "../../utils/numeroFormulario";
import { formatarDataHora } from "../../utils/dataHora";
import { obterSessao } from "../../utils/auth/sessao";
import { listarHistoricoProduto, listarProdutosEstoque, obterMensagemEstoque, type MovimentacaoEstoque } from "../../services/estoqueService";
import { confirmarAjusteLote, previaAjusteLote, previaImportacaoEstoque, type PedidoAjusteLote, type ResultadoAjusteLote, type PreviaImportacaoEstoque } from "../../services/ajusteEstoqueLoteService";
import type { Produto } from "../../types/produto";

const formatar = (v: number | null) => v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const decimalPlanilha = (v: string | null) => v == null ? "—" : v.replace(".", ",");
type Selecionado = { produto: Produto; valor: string };
const painelEstreito = "@container produtos-ajuste (max-width: 480px)";

function Diferenca({ valor }: { valor: number | null }) {
    const Icone = valor === null || valor === 0 ? RemoveRoundedIcon : valor > 0 ? ArrowUpwardRoundedIcon : ArrowDownwardRoundedIcon;
    return <Chip size="small" variant="outlined" icon={<Icone />} color={valor === null || valor === 0 ? "default" : valor > 0 ? "success" : "error"}
        sx={theme => ({ border: 0, borderRadius: 1, bgcolor: valor === null || valor === 0 ? theme.palette.action.hover : alpha(valor > 0 ? theme.palette.success.main : theme.palette.error.main, .12), fontWeight: 600, fontVariantNumeric: "tabular-nums" })}
        label={valor === null ? "—" : `${valor > 0 ? "+" : ""}${valor.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`} />;
}
function DirecaoAjuste({ valor }: { valor: number | null }) {
    const Icone = valor === null || valor === 0 ? RemoveRoundedIcon : valor > 0 ? ArrowUpwardRoundedIcon : ArrowDownwardRoundedIcon;
    const texto = valor === null ? "Informe o saldo" : valor > 0 ? "Entrada" : valor < 0 ? "Saída" : "Sem alteração";
    return <Stack sx={{ alignItems: "center", color: valor === null || valor === 0 ? "text.secondary" : valor > 0 ? "success.main" : "error.main" }}>
        <Icone fontSize="small" aria-hidden="true" /><Typography variant="caption">{texto}</Typography>
    </Stack>;
}

function mensagemPrevia(e: unknown) {
    if (!axios.isAxiosError(e)) return "Não foi possível interpretar a prévia. Tente novamente e informe o erro ao suporte.";
    const status = e.response?.status;
    if (!status) return "Não foi possível acessar a API de estoque. Verifique a conexão e se o backend está disponível.";
    if (status === 401) return "Sessão não autorizada. Entre novamente para gerar a prévia.";
    if (status === 403) return "A prévia de ajustes em massa exige permissão ADMIN. Confira o usuário autenticado.";
    if (status === 404) return "A API não disponibiliza a prévia de ajustes em massa. Confira o endereço da API e a versão do backend local.";
    if (status >= 500) {
        const id = String(e.response?.headers?.['x-request-id'] ?? '');
        return `A API falhou ao gerar a prévia (HTTP ${status}). Nenhum ajuste foi confirmado. Tente novamente ou contate o suporte.${/^[a-zA-Z0-9-]{1,80}$/.test(id) ? ` Referência: ${id}.` : ""}`;
    }
    const dados = e.response?.data;
    const mensagem = typeof dados === "string" ? dados : dados?.detail ?? dados?.message;
    return typeof mensagem === "string" && mensagem.trim() ? mensagem.slice(0, 500) : `A prévia foi recusada (HTTP ${status}). Confira os produtos e quantidades informados.`;
}

type Props = { onConcluido: () => void; telaAjuste?: boolean; onTelaAjusteChange?: (aberta: boolean) => void };

export default function AjusteEstoqueMassa({ onConcluido, telaAjuste: telaAjusteControlada, onTelaAjusteChange }: Props) {
    const [aberto, setAberto] = useState(false);
    const [telaAjusteLocal, setTelaAjusteLocal] = useState(false);
    const telaAjuste = telaAjusteControlada ?? telaAjusteLocal;
    const [modoImportacao, setModoImportacao] = useState(false);
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [busca, setBusca] = useState("");
    const [buscaAberta, setBuscaAberta] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [paginaItens, setPaginaItens] = useState(0);
    const [paginaImportacao, setPaginaImportacao] = useState(0);
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [total, setTotal] = useState(0);
    const [carregando, setCarregando] = useState(false);
    const [itens, setItens] = useState<Selecionado[]>([]);
    const [motivo, setMotivo] = useState("");
    const [previa, setPrevia] = useState<ResultadoAjusteLote | null>(null);
    const [importacao, setImportacao] = useState<PreviaImportacaoEstoque | null>(null);
    const [resultado, setResultado] = useState<ResultadoAjusteLote | null>(null);
    const [erro, setErro] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [pendente, setPendente] = useState<PedidoAjusteLote | null>(null);
    const [abaConferencia, setAbaConferencia] = useState(0);
    const [produtoHistoricoId, setProdutoHistoricoId] = useState<number | "">("");
    const [historico, setHistorico] = useState<MovimentacaoEstoque[]>([]);
    const [paginaHistorico, setPaginaHistorico] = useState(0);
    const [sizeHistorico, setSizeHistorico] = useState(10);
    const [totalHistorico, setTotalHistorico] = useState(0);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [erroHistorico, setErroHistorico] = useState("");
    const [filtrosHistorico, setFiltrosHistorico] = useState({ tipo: "", origem: "", dataInicial: "", dataFinal: "", sort: "dataHora,desc" });
    const emEnvio = useRef(false);
    const gatilhoAjuste = useRef<HTMLButtonElement>(null);
    const telaAnterior = useRef(telaAjuste);
    const admin = obterSessao()?.perfil === "ADMIN";
    const editavel = (!previa || !modoImportacao) && !resultado && !pendente && !enviando;

    useEffect(() => {
        if (!telaAjuste || !editavel || modoImportacao || !busca.trim()) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            listarProdutosEstoque({ busca, page: pagina, size: 10 }, controller.signal)
                .then(r => { if (!controller.signal.aborted) { setProdutos(r.items); setTotal(r.totalItems); } })
                .catch(() => { if (!controller.signal.aborted) { setProdutos([]); setErro("Não foi possível pesquisar produtos."); } })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, 250);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [telaAjuste, editavel, modoImportacao, busca, pagina]);

    const produtoHistorico = itens.find(i => i.produto.id === produtoHistoricoId)?.produto;
    useEffect(() => {
        if (!telaAjuste || abaConferencia !== 1 || !produtoHistorico) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setCarregandoHistorico(true); setErroHistorico("");
            listarHistoricoProduto(produtoHistorico.id, { page: paginaHistorico, size: sizeHistorico,
                sort: filtrosHistorico.sort, tipo: filtrosHistorico.tipo || undefined, origem: filtrosHistorico.origem || undefined,
                dataInicial: filtrosHistorico.dataInicial || undefined, dataFinal: filtrosHistorico.dataFinal || undefined }, controller.signal)
                .then(resposta => { if (!controller.signal.aborted) { setHistorico(resposta.items); setTotalHistorico(resposta.totalItems); } })
                .catch(e => { if (!controller.signal.aborted) { setHistorico([]); setErroHistorico(obterMensagemEstoque(e, "Não foi possível carregar o histórico.")); } })
                .finally(() => { if (!controller.signal.aborted) setCarregandoHistorico(false); });
        }, 0);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [telaAjuste, abaConferencia, produtoHistorico, paginaHistorico, sizeHistorico, filtrosHistorico]);

    function trocarTelaAjuste(aberta: boolean) {
        setTelaAjusteLocal(aberta); onTelaAjusteChange?.(aberta);
    }
    useEffect(() => {
        if (!telaAjuste && telaAnterior.current) gatilhoAjuste.current?.focus();
        telaAnterior.current = telaAjuste;
    }, [telaAjuste]);
    function abrir(importar: boolean) {
        if (resultado) { setItens([]); setMotivo(""); setArquivo(null); }
        setModoImportacao(importar); setResultado(null); setPrevia(null); setImportacao(null); setErro("");
        if (importar) setAberto(true);
        else { setAbaConferencia(0); setBusca(""); setPagina(0); setProdutos([]); setTotal(0); setCarregando(false); trocarTelaAjuste(true); }
    }
    async function solicitarPrevia() {
        if (emEnvio.current) return;
        emEnvio.current = true; setEnviando(true); setErro("");
        try { setPrevia(await previaAjusteLote({ modo: "SALDO_FINAL", motivo: motivo.trim(), itens: itens.map(i => ({ produtoId: i.produto.id, valor: i.valor })) })); }
        catch (e) { setErro(mensagemPrevia(e)); }
        finally { emEnvio.current = false; setEnviando(false); }
    }
    async function solicitarPreviaImportacao() {
        if (!arquivo || arquivo.size > 2 * 1024 * 1024 || emEnvio.current) return;
        emEnvio.current = true; setEnviando(true); setErro("");
        try {
            const resposta = await previaImportacaoEstoque(arquivo, motivo.trim());
            setImportacao(resposta); setPaginaImportacao(0); setPrevia(resposta.lote);
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            setErro(status === 413 ? "O arquivo excede 2 MiB ou 200 linhas. Divida a planilha e tente novamente."
                : "Não foi possível analisar o arquivo. Confira o formato CSV/XLSX e as mensagens de validação.");
        } finally { emEnvio.current = false; setEnviando(false); }
    }
    async function confirmar() {
        if (!previa || emEnvio.current) return;
        const pedido: PedidoAjusteLote = pendente ?? {
            modo: "SALDO_FINAL" as const, motivo: motivo.trim(), chaveRequisicao: crypto.randomUUID(),
            itens: previa.itens.map(l => {
                const linha = importacao?.linhas.find(i => i.produtoId === l.produtoId);
                return { produtoId: l.produtoId, valor: linha?.quantidade ?? itens.find(i => i.produto.id === l.produtoId)!.valor,
                    saldoEsperado: linha?.saldoAtual ?? l.saldoAnterior!, ultimaMovimentacaoIdEsperada: l.ultimaMovimentacaoId };
            }),
        };
        emEnvio.current = true; setPendente(pedido); setEnviando(true); setErro("");
        try { const resposta = await confirmarAjusteLote(pedido); setResultado(resposta); setPendente(null); onConcluido(); }
        catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
                setPendente(null);
                if (status === 409) { setPrevia(null); setImportacao(null); }
                setErro(status === 409 ? "O lote ou estoque mudou. Atualize a prévia antes de confirmar. Nenhum ajuste novo foi aplicado por esta tentativa."
                    : "A confirmação foi recusada. Revise os dados ou suas permissões.");
            } else setErro("Não foi possível confirmar o resultado. Tente novamente com a mesma chave; seus dados foram preservados.");
        } finally { emEnvio.current = false; setEnviando(false); }
    }
    if (!admin) return null;
    const valido = itens.length > 0 && motivo.trim().length > 0 && motivo.trim().length <= 255
        && itens.every(i => { const v = numeroDecimal(i.valor, 3); return v !== null && v >= 0; });
    const linhas = resultado?.itens ?? previa?.itens;
    const previsaoValida = importacao ? importacao.totais.invalidos === 0 && importacao.totais.validos > 0 : !previa?.itens.some(l => l.erros.length > 0);
    const paginaItensAtual = Math.min(paginaItens, Math.max(0, Math.ceil(itens.length / 25) - 1));
    function baixarModelo() {
        const url = URL.createObjectURL(new Blob(["\ufeffCódigo;Produto;Quantidade\r\n"], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "modelo-ajuste-estoque.csv"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return <>
        {!telaAjuste && <Stack direction="row" spacing={1}>
            <Button ref={gatilhoAjuste} variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => abrir(false)}>Ajuste em massa</Button>
            <Button variant="outlined" onClick={() => abrir(true)}>Importar planilha</Button>
        </Stack>}
        {telaAjuste && <>
        {telaAjusteControlada === undefined && <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => trocarTelaAjuste(false)}>Voltar para saldos</Button>}
        <Box sx={{ containerType: "inline-size", containerName: "ajuste-massa" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", "@container ajuste-massa (min-width: 1000px)": { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)" }, "@container ajuste-massa (min-width: 1500px)": { gridTemplateColumns: "minmax(0, .61fr) minmax(0, 1fr)" }, alignItems: "start", gap: 2 }}>
            <Paper component="section" aria-label="Produtos do ajuste" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0, containerType: "inline-size", containerName: "produtos-ajuste" }}>
                <Stack spacing={1.5}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                        <Box sx={{ p: 1.5, display: "flex", borderRadius: 1, bgcolor: "action.hover", color: "primary.main" }}><ViewInArOutlinedIcon /></Box>
                        <Box><Typography variant="h6" component="h2">Novo ajuste em massa</Typography>
                        <Typography variant="body2" color="text.secondary">Informe o saldo físico final. Limite de 200 produtos.</Typography></Box>
                    </Stack>
                    <Alert severity="info" role="note">Este ajuste será aplicado como um único lote: todos os produtos serão ajustados juntos ou nenhum será aplicado.</Alert>
                    <Divider />
                    {erro && <Alert severity="error" role="alert">{erro}</Alert>}
                    <ClickAwayListener onClickAway={() => setBuscaAberta(false)}><Box sx={{ position: "relative" }} onKeyDown={e => {
                        if (e.key === "Escape") { setBuscaAberta(false); e.stopPropagation(); }
                        if (e.key === "ArrowDown" && e.target instanceof HTMLInputElement) { e.preventDefault(); e.currentTarget.querySelector<HTMLButtonElement>('button[aria-label^="Adicionar"]:not(:disabled)')?.focus(); }
                    }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Selecionar produtos</Typography>
                        <CampoTexto fullWidth size="small" name="busca-produto-ajuste" autoComplete="off" label="Pesquisar produtos" placeholder="Digite o código, nome ou código de barras do produto…" value={busca} disabled={!editavel}
                            onClick={() => setBuscaAberta(true)} onFocus={() => setBuscaAberta(true)} onChange={e => { setBuscaAberta(true); setBusca(e.target.value); setProdutos([]); setTotal(0); setCarregando(false); setPagina(0); }} />
                        {!busca.trim() && editavel && <Typography variant="caption" color="text.secondary">Pesquise para ver produtos disponíveis.</Typography>}
                        {buscaAberta && busca.trim() && editavel && <Paper variant="outlined" role="region" aria-label="Resultados da pesquisa" sx={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, mt: 0.5, maxHeight: 240, overflowY: "auto", boxShadow: 2 }}>
                            {carregando ? <Typography role="status" sx={{ p: 1.5 }}>Pesquisando…</Typography> : produtos.length === 0 ? <Typography sx={{ p: 1.5 }} color="text.secondary">Nenhum produto encontrado.</Typography> :
                                <Stack component="ul" role="list" divider={<Divider />} sx={{ listStyle: "none", p: 0, m: 0 }}>
                                    {produtos.map(p => <Box component="li" key={p.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1.5, py: 0.75 }}>
                                        <Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap>{p.codigoInterno} · {p.nome}</Typography><Typography variant="caption" color="text.secondary">Saldo: {formatar(p.estoqueAtual)}</Typography></Box>
                                        <Button size="small" startIcon={<AddRoundedIcon />} disabled={!editavel || itens.length >= 200 || itens.some(i => i.produto.id === p.id) || !p.ativo || !p.controlaEstoque || p.composto}
                                            aria-label={`Adicionar ${p.nome}`} onClick={() => { setPrevia(null); setItens(atual => [...atual, { produto: p, valor: "" }]); setProdutoHistoricoId(atual => atual || p.id); }}>
                                            {itens.some(i => i.produto.id === p.id) ? "Adicionado" : "Adicionar"}
                                        </Button>
                                    </Box>)}
                                </Stack>}
                            {total > 10 && <TablePagination component="div" count={total} page={pagina} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, p) => setPagina(p)} />}
                        </Paper>}
                    </Box></ClickAwayListener>
                    <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                        <Typography variant="subtitle2">Produtos selecionados</Typography><Typography variant="caption" color="text.secondary">{itens.length}/200</Typography>
                    </Stack>
                    {itens.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhum produto selecionado. Pesquise e adicione produtos para começar.</Typography> :
                        <Box>
                        <Box aria-hidden="true" sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "minmax(120px, 1fr) 54px 120px 96px 36px", gap: 1, py: .75, px: 1, bgcolor: "action.hover", fontSize: 12, color: "text.secondary", [painelEstreito]: { display: "none" } }}>
                            <span>Produto</span><Box sx={{ textAlign: "right" }}>Atual</Box><Box sx={{ textAlign: "right" }}>Saldo físico</Box><Box sx={{ textAlign: "center" }}>Diferença</Box><span />
                        </Box>
                        <Stack role="region" aria-label="Produtos selecionados para ajuste" divider={<Divider />} sx={{ maxHeight: { xs: 280, lg: "clamp(150px, 32vh, 350px)" }, overflowY: "auto", overscrollBehavior: "contain" }}>
                            {itens.slice(paginaItensAtual * 25, (paginaItensAtual + 1) * 25).map(i => {
                                const linha = linhas?.find(x => x.produtoId === i.produto.id);
                                const fisico = numeroDecimal(i.valor, 3);
                                const diferenca = linha?.diferenca ?? (fisico === null ? null : Number((fisico - i.produto.estoqueAtual).toFixed(3)));
                                return <Box key={i.produto.id} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) 120px 36px", sm: "minmax(120px, 1fr) 54px 120px 96px 36px" }, alignItems: "center", gap: 1, py: .75, px: 1, [painelEstreito]: { gridTemplateColumns: "minmax(0, 1fr) 120px 36px" } }}>
                                    <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" }, [painelEstreito]: { gridColumn: "1 / -1" } }}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><ViewInArOutlinedIcon sx={{ color: "text.secondary", display: { xs: "none", md: "block" } }} /><Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" title={i.produto.nome} sx={{ fontWeight: 600, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.produto.nome}</Typography>
                                        <Typography variant="caption" color="text.secondary">{i.produto.codigoInterno}</Typography>
                                        </Box></Stack>
                                    </Box>
                                    <Typography variant="body2" sx={{ textAlign: { xs: "left", sm: "right" }, fontVariantNumeric: "tabular-nums", [painelEstreito]: { textAlign: "left" } }}><Box component="span" sx={{ display: { xs: "inline", sm: "none" }, [painelEstreito]: { display: "inline" } }}>Atual: </Box>{formatar(linha?.saldoAnterior ?? i.produto.estoqueAtual)}</Typography>
                                    {editavel ? <CampoQuantidade canonico size="small" label="Saldo físico" rotuloAcessivel={`Saldo físico ${i.produto.nome}`} value={i.valor}
                                        onValueChange={valor => { setPrevia(null); setItens(atual => atual.map(x => x.produto.id === i.produto.id ? { ...x, valor } : x)); }} /> :
                                        <Typography variant="body2" sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatar(linha?.saldoFinal ?? null)}</Typography>}
                                    <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "center", [painelEstreito]: { display: "none" } }}><Diferenca valor={diferenca} /></Box>
                                    {editavel && <Tooltip title={`Remover ${i.produto.nome}`}><IconButton size="small" aria-label={`Remover ${i.produto.nome}`} onClick={() => {
                                        const restantes = itens.filter(x => x.produto.id !== i.produto.id); setPrevia(null); setItens(restantes);
                                        if (produtoHistoricoId === i.produto.id) setProdutoHistoricoId(restantes[0]?.produto.id ?? "");
                                    }} sx={{ minWidth: 36, minHeight: 36 }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                                    <Box sx={{ gridColumn: "1 / -1", display: { xs: "flex", sm: "none" }, justifyContent: "space-between", alignItems: "center", [painelEstreito]: { display: "flex" } }}><Diferenca valor={diferenca} /><DirecaoAjuste valor={diferenca} /></Box>
                                </Box>;
                            })}
                        </Stack></Box>}
                    {itens.length > 25 && <TablePagination component="div" count={itens.length} page={paginaItensAtual} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaItens(p)} />}
                    <CampoTexto fullWidth size="small" minRows={2} maxRows={3} name="motivo-ajuste-massa" autoComplete="off" label="Motivo do ajuste em massa" required multiline value={motivo} disabled={!!resultado || !!pendente || enviando}
                        helperText={`Obrigatório; registrado no histórico (até 255 caracteres). ${motivo.length}/255`} onChange={e => { setPrevia(null); setMotivo(e.target.value); }} />
                    {previa && !resultado && <Button onClick={() => { setPrevia(null); setImportacao(null); setErro(""); }} disabled={enviando || !!pendente}>Revisar dados</Button>}
                    {!resultado && <Button variant="contained" size="large" startIcon={<DescriptionOutlinedIcon />} onClick={() => void solicitarPrevia()} disabled={!valido || enviando || !!pendente}>
                            {enviando ? "Gerando prévia…" : "Gerar prévia"}
                        </Button>}
                </Stack>
            </Paper>
            <Paper component="section" aria-label="Conferência do ajuste" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0, "& .MuiTableCell-root": { py: .75, px: 1, fontSize: 13, overflowWrap: "anywhere" }, "& .MuiTableCell-head": { fontWeight: 500 } }}>
                <Tabs value={abaConferencia} onChange={(_, v: number) => setAbaConferencia(v)} aria-label="Conferência do estoque" variant="fullWidth">
                    <Tab icon={<DescriptionOutlinedIcon fontSize="small" />} iconPosition="start" label="Prévia de ajustes" id="conferencia-tab-0" aria-controls="conferencia-panel-0" />
                    <Tab icon={<HistoryRoundedIcon fontSize="small" />} iconPosition="start" label="Histórico" id="conferencia-tab-1" aria-controls="conferencia-panel-1" />
                </Tabs>
                <Box role="tabpanel" id={`conferencia-panel-${abaConferencia}`} aria-labelledby={`conferencia-tab-${abaConferencia}`} sx={{ pt: 1.5 }}>
                    {abaConferencia === 0 && <Stack spacing={1.5}>
                        {!previa ? <Box sx={{ py: .5 }}>
                            <Typography variant="subtitle2">A conferência aparecerá aqui</Typography>
                            <Typography variant="body2" color="text.secondary">Selecione produtos, informe as quantidades físicas e gere a prévia para revisar cada diferença.</Typography>
                        </Box> : <>
                            <Alert severity={previsaoValida ? "info" : "warning"}>
                                {linhas?.length ?? 0} produtos · {linhas?.filter(l => l.erros.length === 0 && l.status !== "SEM_ALTERACAO").length ?? 0} com diferença · {linhas?.filter(l => l.status === "SEM_ALTERACAO").length ?? 0} sem alteração · {linhas?.filter(l => l.erros.length > 0).length ?? 0} inválidos
                            </Alert>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Deslize a tabela para conferir as colunas.</Typography>
                            <TableContainer tabIndex={0} aria-label="Prévia de diferenças do ajuste" sx={{ maxHeight: { xs: 360, lg: "clamp(180px, 48vh, 520px)" }, overflow: "auto" }}>
                                <Table size="small" stickyHeader sx={{ minWidth: 650, "& td:nth-of-type(n+2):nth-of-type(-n+4)": { fontVariantNumeric: "tabular-nums" } }}>
                                    <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Saldo atual</TableCell><TableCell align="right">Saldo físico</TableCell><TableCell align="right">Diferença</TableCell><TableCell>Situação</TableCell><TableCell>Ajuste</TableCell></TableRow></TableHead>
                                    <TableBody>{itens.slice(paginaItensAtual * 25, (paginaItensAtual + 1) * 25).map(i => {
                                        const l = linhas?.find(x => x.produtoId === i.produto.id);
                                        return <TableRow key={i.produto.id}>
                                            <TableCell><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><ViewInArOutlinedIcon sx={{ color: "text.secondary" }} /><Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{l?.nome ?? i.produto.nome}</Typography><Typography variant="caption">{i.produto.codigoInterno}</Typography></Box></Stack></TableCell>
                                            <TableCell align="right">{formatar(l?.saldoAnterior ?? null)}</TableCell>
                                            <TableCell align="right">{l?.saldoFinal == null ? "—" : l.saldoFinal.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</TableCell>
                                            <TableCell align="right"><Diferenca valor={l?.diferenca ?? null} /></TableCell>
                                            <TableCell>{l?.erros.length ? <Typography variant="caption" color="error">{l.erros.join(" ")}</Typography> : l?.status === "SEM_ALTERACAO" ? "Sem alteração" : resultado ? `Aplicado · movimento ${l?.movimentacaoId ?? "—"}` : <Chip size="small" variant="outlined" color="success" label="Válido" />}</TableCell>
                                            <TableCell><DirecaoAjuste valor={l?.diferenca ?? null} /></TableCell>
                                        </TableRow>;
                                    })}</TableBody>
                                </Table>
                            </TableContainer>
                            {itens.length > 25 && <TablePagination component="div" count={itens.length} page={paginaItensAtual} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaItens(p)} />}
                            {!resultado && previsaoValida && <Alert severity="success" role="note"><Typography variant="subtitle2">{linhas?.length ?? 0} {linhas?.length === 1 ? "produto pronto" : "produtos prontos"} para ajuste</Typography>Revise as diferenças e confirme para aplicar o ajuste em massa.</Alert>}
                            {resultado ? <Alert severity="success" role="status">Lote confirmado: {resultado.alterados} ajustes aplicados e {resultado.semAlteracao} sem alteração.</Alert> :
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                                <Button variant="outlined" startIcon={<DeleteOutlineRoundedIcon />} disabled={enviando || !!pendente} onClick={() => { setItens([]); setPrevia(null); setImportacao(null); setProdutoHistoricoId(""); setErro(""); }}>Limpar tudo</Button>
                                <Button variant="contained" size="large" startIcon={<CheckRoundedIcon />} onClick={() => void confirmar()} disabled={enviando || !previsaoValida}>
                                    {enviando ? "Confirmando…" : pendente ? "Tentar novamente com a mesma chave" : "Confirmar ajustes"}
                                </Button></Stack>}
                        </>}
                    </Stack>}
                    {abaConferencia === 1 && <Stack spacing={1.5}>
                        <Autocomplete size="small" options={itens.map(i => i.produto)} value={produtoHistorico ?? null} isOptionEqualToValue={(a, b) => a.id === b.id}
                            getOptionLabel={p => `${p.codigoInterno} · ${p.nome}`} onChange={(_, p) => { setProdutoHistoricoId(p?.id ?? ""); setPaginaHistorico(0); }}
                            renderInput={params => <TextField {...params} label="Produto do histórico" placeholder="Pesquisar nos selecionados…" />} />
                        {produtoHistorico ? <>
                            <Stack direction={{ xs: "column", sm: "row" }} useFlexGap spacing={1} sx={{ flexWrap: "wrap" }}>
                                <TextField select size="small" label="Tipo" value={filtrosHistorico.tipo} sx={{ minWidth: 130 }} onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(f => ({ ...f, tipo: e.target.value })); }}>
                                    <MenuItem value="">Todos</MenuItem>{["ENTRADA", "SAIDA", "AJUSTE"].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                                </TextField>
                                <TextField select size="small" label="Origem" value={filtrosHistorico.origem} sx={{ minWidth: 140 }} onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(f => ({ ...f, origem: e.target.value })); }}>
                                    <MenuItem value="">Todas</MenuItem>{["MANUAL", "VENDA", "COMPRA", "AJUSTE", "CANCELAMENTO"].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                                </TextField>
                                <TextField type="date" size="small" label="Data inicial" value={filtrosHistorico.dataInicial} slotProps={{ inputLabel: { shrink: true } }} onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(f => ({ ...f, dataInicial: e.target.value })); }} />
                                <TextField type="date" size="small" label="Data final" value={filtrosHistorico.dataFinal} slotProps={{ inputLabel: { shrink: true } }} onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(f => ({ ...f, dataFinal: e.target.value })); }} />
                                <TextField select size="small" label="Ordem" value={filtrosHistorico.sort} onChange={e => { setPaginaHistorico(0); setFiltrosHistorico(f => ({ ...f, sort: e.target.value })); }}>
                                    <MenuItem value="dataHora,desc">Mais recentes</MenuItem><MenuItem value="dataHora,asc">Mais antigas</MenuItem>
                                </TextField>
                            </Stack>
                            {erroHistorico && <Alert severity="error" role="alert">{erroHistorico}</Alert>}
                            <TableContainer tabIndex={0} aria-label="Histórico de movimentações" sx={{ maxHeight: { xs: 360, lg: "clamp(180px, 48vh, 520px)" }, overflow: "auto" }}>
                                <Table size="small" stickyHeader sx={{ minWidth: 940 }}>
                                    <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Código</TableCell><TableCell>Produto</TableCell><TableCell>Tipo / origem</TableCell><TableCell>Entrada / saída</TableCell><TableCell align="right">Quantidade</TableCell><TableCell>Motivo</TableCell><TableCell>Usuário</TableCell></TableRow></TableHead>
                                    <TableBody>{carregandoHistorico ? <TableRow><TableCell colSpan={8}><Typography role="status">Carregando histórico…</Typography></TableCell></TableRow> : historico.length === 0 ? <TableRow><TableCell colSpan={8}>Nenhuma movimentação encontrada.</TableCell></TableRow> : historico.map(m => <TableRow key={m.id}>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatarDataHora(m.dataHora)}</TableCell><TableCell>{produtoHistorico.codigoInterno}</TableCell><TableCell sx={{ minWidth: 140, maxWidth: 200 }}>{m.produtoNome}</TableCell><TableCell>{m.tipo} · {m.origem}</TableCell>
                                        <TableCell>{m.saldoPosterior > m.saldoAnterior ? "Entrada" : m.saldoPosterior < m.saldoAnterior ? "Saída" : "Sem variação"}</TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatar(m.quantidade)}</TableCell><TableCell sx={{ minWidth: 140, maxWidth: 220 }}>{m.motivo || "Sem motivo informado"}</TableCell><TableCell>{m.nomeUsuario || "—"}</TableCell>
                                    </TableRow>)}</TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination component="div" count={totalHistorico} page={paginaHistorico} rowsPerPage={sizeHistorico} rowsPerPageOptions={[10, 25, 50]}
                                onPageChange={(_, p) => setPaginaHistorico(p)} onRowsPerPageChange={e => { setSizeHistorico(Number(e.target.value)); setPaginaHistorico(0); }} />
                        </> : <Typography color="text.secondary">Adicione um produto ao ajuste para consultar as movimentações dele.</Typography>}
                    </Stack>}
                </Box>
            </Paper>
        </Box></Box>
        </>}
        <Dialog open={aberto} fullWidth maxWidth="lg" aria-labelledby="ajuste-massa-titulo" onClose={() => { if (!enviando && !pendente) setAberto(false); }}>
            <DialogTitle id="ajuste-massa-titulo">{modoImportacao ? "Importar estoque por planilha" : "Ajuste em massa · Saldo físico"}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2">Informe o saldo físico final. A confirmação aplica todo o lote ou nenhum ajuste. Limite: 200 produtos.</Typography>
                    {erro && <Alert severity="error" role="alert">{erro}</Alert>}
                    {resultado && <Alert severity="success" role="status">Lote confirmado: {resultado.alterados} ajustes e {resultado.semAlteracao} produtos sem alteração. Sem diferença não gera movimento.</Alert>}
                    {modoImportacao && <>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                            <Button onClick={baixarModelo}>Baixar modelo CSV</Button>
                            <Button component="label" variant="outlined" disabled={!editavel}>
                                {arquivo ? "Trocar arquivo" : "Selecionar CSV ou XLSX"}
                                <input aria-label="Selecionar arquivo CSV ou XLSX" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
                                    onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); setImportacao(null); }} />
                            </Button>
                            <Typography variant="body2" aria-live="polite">{arquivo ? `${arquivo.name} · ${arquivo.size < 1024 ? `${arquivo.size} bytes` : `${(arquivo.size / 1024).toFixed(1)} KiB`}` : "CSV UTF-8 com ponto e vírgula ou XLSX · até 2 MiB e 200 linhas"}</Typography>
                        </Stack>
                        {arquivo && arquivo.size > 2 * 1024 * 1024 && <Alert severity="error">O arquivo excede o limite de 2 MiB.</Alert>}
                        {importacao && <>
                            <Alert severity={importacao.totais.invalidos ? "warning" : "info"}>
                                {importacao.totais.linhas} {importacao.totais.linhas === 1 ? "linha" : "linhas"} · {importacao.totais.identificados} {importacao.totais.identificados === 1 ? "identificado" : "identificados"} · {importacao.totais.validos} válidas · {importacao.totais.invalidos} inválidas · {importacao.totais.comDiferenca} com diferença · {importacao.totais.semAlteracao} sem alteração
                            </Alert>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Deslize a tabela para conferir os saldos, diferenças e situações.</Typography>
                            <TableContainer tabIndex={0} aria-label="Prévia das linhas importadas" sx={{ maxWidth: "100%", overflowX: "auto" }}>
                                <Table size="small" sx={{ minWidth: 760, "& td:nth-of-type(n+3):nth-of-type(-n+5)": { fontVariantNumeric: "tabular-nums" } }}>
                                    <TableHead><TableRow><TableCell>Linha / código</TableCell><TableCell>Produto</TableCell><TableCell align="right">Atual</TableCell><TableCell align="right">Importado</TableCell><TableCell align="right">Diferença</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
                                    <TableBody>{importacao.linhas.slice(paginaImportacao * 25, (paginaImportacao + 1) * 25).map(l => {
                                        const concluida = resultado?.itens.find(i => i.produtoId === l.produtoId);
                                        return <TableRow key={l.linha}>
                                            <TableCell>{l.linha} · {l.codigo}</TableCell><TableCell>{l.produto ?? "Produto não identificado"}{l.descricaoPlanilha ? ` · planilha: ${l.descricaoPlanilha}` : ""}</TableCell>
                                            <TableCell align="right">{decimalPlanilha(l.saldoAtual)}</TableCell><TableCell align="right">{decimalPlanilha(l.quantidade)}</TableCell>
                                            <TableCell align="right">{decimalPlanilha(l.diferenca)}</TableCell>
                                            <TableCell>{l.erros.length ? l.erros.join(" ") : concluida ? `Aplicado · movimento ${concluida.movimentacaoId ?? "—"}` : l.situacao === "SEM_ALTERACAO" ? "Sem alteração" : "Válido"}</TableCell>
                                        </TableRow>;
                                    })}</TableBody>
                                </Table>
                            </TableContainer>
                            {importacao.linhas.length > 25 && <TablePagination component="div" count={importacao.linhas.length} page={paginaImportacao} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaImportacao(p)} />}
                        </>}
                    </>}
                    {!modoImportacao && editavel && <>
                        <CampoTexto label="Pesquisar produtos para ajuste" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} autoFocus />
                        {carregando && <Typography role="status">Pesquisando…</Typography>}
                        {!carregando && produtos.length === 0 && <Typography>Nenhum produto encontrado.</Typography>}
                        <Stack spacing={0.5}>{produtos.map(p => <Box key={p.id} sx={{ display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2">{p.codigoInterno} · {p.nome}</Typography>
                            <Button disabled={itens.length >= 200 || itens.some(i => i.produto.id === p.id) || !p.ativo || !p.controlaEstoque || p.composto}
                                aria-label={`Adicionar ${p.nome}`} onClick={() => setItens(atual => [...atual, { produto: p, valor: "" }])}>Adicionar</Button>
                        </Box>)}</Stack>
                        <TablePagination component="div" count={total} page={pagina} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, p) => setPagina(p)} />
                    </>}
                    <CampoTexto label="Motivo do ajuste em massa" required multiline value={motivo} slotProps={{ input: { readOnly: !editavel } }}
                        helperText="Obrigatório. Registrado no histórico de cada ajuste (até 255 caracteres)." onChange={e => setMotivo(e.target.value)} />
                    {!modoImportacao && <>
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Deslize a tabela para conferir saldo informado e diferença.</Typography>
                        <TableContainer tabIndex={0} aria-label="Produtos e diferenças do ajuste" sx={{ maxWidth: "100%", overflowX: "auto" }}>
                            <Table size="small" sx={{ minWidth: 600 }}>
                                <TableHead><TableRow><TableCell>Produto</TableCell><TableCell align="right">Saldo atual</TableCell><TableCell align="right">Saldo informado</TableCell><TableCell align="right">Diferença</TableCell><TableCell>Validação / Resultado</TableCell></TableRow></TableHead>
                                <TableBody>{itens.slice(paginaItensAtual * 25, (paginaItensAtual + 1) * 25).map(i => {
                                    const l = linhas?.find(x => x.produtoId === i.produto.id);
                                    return <TableRow key={i.produto.id}>
                                        <TableCell>{i.produto.codigoInterno} · {i.produto.nome}</TableCell>
                                        <TableCell align="right">{formatar(l?.saldoAnterior ?? i.produto.estoqueAtual)}</TableCell>
                                        <TableCell align="right" sx={{ minWidth: 160 }}>{editavel ? <CampoQuantidade canonico label={`Saldo físico ${i.produto.nome}`} value={i.valor}
                                            onValueChange={valor => setItens(atual => atual.map(x => x.produto.id === i.produto.id ? { ...x, valor } : x))} /> : formatar(l?.saldoFinal ?? null)}</TableCell>
                                        <TableCell align="right">{l?.diferenca != null ? `${l.diferenca > 0 ? "+" : ""}${formatar(l.diferenca)}` : "Solicite a prévia"}</TableCell>
                                        <TableCell>{l ? l.erros.length ? <Typography color="error">{l.erros.join(" ")}</Typography> : l.status === "SEM_ALTERACAO" ? "Sem alteração" : resultado ? `Movimento ${l.movimentacaoId}` : "Elegível"
                                            : <Button aria-label={`Remover ${i.produto.nome}`} onClick={() => setItens(atual => atual.filter(x => x.produto.id !== i.produto.id))}>Remover</Button>}</TableCell>
                                    </TableRow>;
                                })}</TableBody>
                            </Table>
                        </TableContainer>
                        {itens.length > 25 && <TablePagination component="div" count={itens.length} page={paginaItensAtual} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPaginaItens(p)} />}
                    </>}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button disabled={enviando || !!pendente} onClick={() => setAberto(false)}>{resultado ? "Fechar resultado" : "Cancelar"}</Button>
                {previa && !resultado && <Button disabled={enviando || !!pendente} onClick={() => { setPrevia(null); setImportacao(null); setErro(""); }}>Revisar dados</Button>}
                {!resultado && (!previa ? <Button variant="contained" disabled={(modoImportacao ? !arquivo || arquivo.size > 2 * 1024 * 1024 : !valido) || !motivo.trim() || enviando}
                    onClick={() => void (modoImportacao ? solicitarPreviaImportacao() : solicitarPrevia())}>{enviando ? (modoImportacao ? "Lendo planilha…" : "Gerando prévia…") : (modoImportacao ? "Analisar arquivo" : "Gerar prévia")}</Button>
                    : <Button variant="contained" disabled={enviando || !previsaoValida} onClick={() => void confirmar()}>{enviando ? "Confirmando…" : pendente ? "Tentar novamente com a mesma chave" : "Confirmar ajustes"}</Button>)}
            </DialogActions>
        </Dialog>
    </>;
}
