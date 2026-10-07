import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import SearchIcon from "@mui/icons-material/Search";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Alert, Box, Button, Divider, IconButton, InputAdornment, Stack, Table, TableBody, TableCell,
    TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { pesquisarProdutos, obterMensagemDaApi } from "../../services/produtoService";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import { finalizarVenda, type FormaPagamento } from "../../services/vendaService";
import { listarConfiguracoesParaPDV } from "../../services/configuracaoFormaPagamentoService";
import { obterSessao } from "../../utils/auth/sessao";
import type { Produto } from "../../types/produto";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";
import { encontrarProdutoPorCodigo, criarPedido, moeda, moverIndiceProduto, novoRascunho, pagamentosRascunho, subtotalItem, totais, type PagamentoPDV, type RascunhoPDV } from "./pdv";
import SessaoCaixaPDVDialog from "./SessaoCaixaPDVDialog";
import VendaFinalizacaoDialog, { type EstadoFinalizacao } from "./VendaFinalizacaoDialog";

type Opcional = "desconto" | "cliente" | "entrega" | "observacoes" | null;
type Finalizacao = {
    estado: EstadoFinalizacao;
    quantidadeItens: number;
    total: number;
    formaPagamento: string;
    troco: number;
    mensagemErro?: string;
    podeTentarNovamente?: boolean;
};

const rotulosPagamento: Record<FormaPagamento | "A_PRAZO", string> = {
    A_PRAZO: "A prazo",
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_DEBITO: "Cartão de débito",
    CARTAO_CREDITO: "Cartão de crédito",
};

const tipoConfigParaLegado: Record<ConfiguracaoFormaPagamento["tipo"], FormaPagamento> = {
    DINHEIRO: "DINHEIRO",
    PIX: "PIX",
    DEBITO: "CARTAO_DEBITO",
    CREDITO: "CARTAO_CREDITO",
    BOLETO: "DINHEIRO",
    TRANSFERENCIA: "DINHEIRO",
};

export default function Vendas() {
    const navigate = useNavigate();
    const sessao = obterSessao();
    const empresaId = sessao?.empresa.id;
    const chaveRascunho = "novexa-pdv:" + empresaId + ":" + sessao?.id;
    const [rascunho, setRascunho] = useState<RascunhoPDV>(() => {
        try {
            const salvo = JSON.parse(sessionStorage.getItem(chaveRascunho) ?? "null");
            return salvo && Array.isArray(salvo.itens) ? { ...novoRascunho(), ...salvo } : novoRascunho();
        } catch { return novoRascunho(); }
    });
    const [resultados, setResultados] = useState<Produto[]>([]);
    const [configuracoes, setConfiguracoes] = useState<ConfiguracaoFormaPagamento[]>([]);
    const [carregandoConfig, setCarregandoConfig] = useState(true);
    const [erroConfig, setErroConfig] = useState("");
    const [listaAberta, setListaAberta] = useState(false);
    const [indice, setIndice] = useState(0);
    const [selecionado, setSelecionado] = useState<number | null>(null);
    const [opcional, setOpcional] = useState<Opcional>(null);
    const [erro, setErro] = useState("");
    const [erroCatalogo, setErroCatalogo] = useState("");
    const [buscandoCodigo, setBuscandoCodigo] = useState(false);
    const scannerRef = useRef<AbortController | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [sessaoCaixaResolvida, setSessaoCaixaResolvida] = useState(false);
    const [finalizacao, setFinalizacao] = useState<Finalizacao | null>(null);
    const emEnvio = useRef(false);
    const finalizacaoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buscaRef = useRef<HTMLInputElement>(null);
    const recebidoRef = useRef<HTMLInputElement>(null);
    const opcionalRef = useRef<HTMLInputElement>(null);
    const quantidadesRef = useRef<Record<number, HTMLInputElement | null>>({});
    const t = totais(rascunho);
    const bloqueado = !sessaoCaixaResolvida || salvando || !!rascunho.pendente;
    const { term: busca, setTerm, loading, cancel, refresh } = useRemoteSearch<Produto>({
        enabled: !bloqueado, search: pesquisarProdutos,
        onResults: lista => { setResultados(lista); setErroCatalogo(""); },
        onError: e => { setResultados([]); setErroCatalogo(obterMensagemDaApi(e, "Não foi possível buscar os produtos.")); },
        onInvalidTerm: () => setResultados([]),
    });
    const carregando = loading || buscandoCodigo;

    useEffect(() => {
        if (bloqueado) { cancel(); scannerRef.current?.abort(); }
        return () => scannerRef.current?.abort();
    }, [bloqueado, cancel]);

    function setBusca(termo: string) {
        scannerRef.current?.abort(); scannerRef.current = null; setBuscandoCodigo(false);
        setResultados([]); setErroCatalogo(""); setTerm(termo);
    }

    async function adicionarPorCodigo() {
        const termo = busca.trim();
        if (!termo || bloqueado || scannerRef.current) return;
        cancel();
        const encontrado = encontrarProdutoPorCodigo(resultados, termo);
        if (encontrado) { adicionar(encontrado); return; }
        // O leitor não espera o debounce e nunca seleciona um nome parcial por Enter.
        const controller = new AbortController(); scannerRef.current = controller; setBuscandoCodigo(true);
        try {
            const lista = await pesquisarProdutos(termo, controller.signal);
            if (controller.signal.aborted) return;
            const produto = encontrarProdutoPorCodigo(lista, termo);
            if (produto) adicionar(produto);
            else { setResultados(lista); setListaAberta(true); setErro("Código exato não encontrado. Selecione o produto na lista."); }
        } catch (e) {
            if (!controller.signal.aborted) setErroCatalogo(obterMensagemDaApi(e, "Não foi possível buscar os produtos."));
        } finally {
            if (scannerRef.current === controller) { scannerRef.current = null; setBuscandoCodigo(false); }
        }
    }

    const definirSessaoCaixa = useCallback((sessaoCaixaId: number) => {
        setRascunho(atual => ({ ...atual, sessaoCaixaId }));
        setSessaoCaixaResolvida(true);
    }, []);

    useEffect(() => {
        if (sessaoCaixaResolvida && !salvando && !finalizacao) focarBusca();
    }, [sessaoCaixaResolvida, salvando, finalizacao]);

    useEffect(() => () => {
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
    }, []);

    useEffect(() => {
        try { sessionStorage.setItem(chaveRascunho, JSON.stringify(rascunho)); } catch { /* Mantém o rascunho em memória. */ }
    }, [chaveRascunho, rascunho]);

    useEffect(() => {
        const controller = new AbortController();
        listarConfiguracoesParaPDV(controller.signal)
            .then(list => { if (!controller.signal.aborted) { setConfiguracoes(list.filter(c => c.ativo && ["DINHEIRO", "PIX", "DEBITO", "CREDITO"].includes(c.tipo))); setErroConfig(""); } })
            .catch(e => { if (!controller.signal.aborted) setErroConfig(obterMensagemDaApi(e, "Não foi possível carregar as configurações de pagamento.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregandoConfig(false); });
        return () => controller.abort();
    }, [empresaId]);

    useEffect(() => {
        if (!opcional) return;
        opcionalRef.current?.focus();
    }, [opcional, empresaId]);

    function focarBusca() { requestAnimationFrame(() => buscaRef.current?.focus()); }
    function alterar(patch: Partial<RascunhoPDV>) { if (!bloqueado) setRascunho(r => ({ ...r, ...patch })); }
    function alterarPagamento(indice: number, patch: Partial<PagamentoPDV>) {
        alterar({ pagamentos: pagamentosRascunho(rascunho).map((p, i) => i === indice ? { ...p, ...patch } : p) });
    }
    function adicionarForma() {
        alterar({ ...(t.usaPrazo ? { parcelasPrazo: t.parcelasPrazo.map(p => ({
            valor: p.valor === "" ? ((p.valorCentavos ?? 0) / 100).toFixed(2) : p.valor, vencimento: p.vencimento,
        })) } : {}), pagamentos: [
            ...pagamentosRascunho(rascunho).map((p, i) => ({ ...p, valor: p.valor === "" ? ((t.parcelas[i].valorCentavos ?? 0) / 100).toFixed(2) : p.valor })),
            { configuracaoFormaPagamentoId: null, nomeExibicao: null, formaPagamento: "DINHEIRO",
                valor: (Math.max(0, t.restante) / 100).toFixed(2), recebido: "" },
        ] });
    }
    function alterarParcelaPrazo(indice: number, patch: Partial<{ valor: string; vencimento: string }>) {
        alterar({ parcelasPrazo: (rascunho.parcelasPrazo ?? []).map((p, i) => i === indice ? { ...p, ...patch } : p) });
    }
    function adicionar(produto: Produto) {
        if (bloqueado) return;
        if (rascunho.itens.length >= 200 && !rascunho.itens.some(i => i.produto.id === produto.id)) {
            setErro("O limite é de 200 produtos diferentes por venda."); return;
        }
        setRascunho(r => {
            const existente = r.itens.find(i => i.produto.id === produto.id);
            if (existente) return { ...r, itens: r.itens.map(i => i === existente
                ? { produto, quantidade: String((Number(i.quantidade.replace(",", ".")) || 0) + 1) } : i) };
            return { ...r, itens: [...r.itens, { produto, quantidade: "1" }] };
        });
        setBusca(""); setListaAberta(false); setIndice(0); setSelecionado(produto.id); setErro("");
        requestAnimationFrame(() => quantidadesRef.current[produto.id]?.focus());
    }
    function remover(id: number) {
        alterar({ itens: rascunho.itens.filter(i => i.produto.id !== id) });
        setSelecionado(null); focarBusca();
    }
    function fecharFinalizacao() {
        if (finalizacao?.estado === "processing") return;
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
        finalizacaoTimerRef.current = null;
        setFinalizacao(null);
    }
    async function finalizar() {
        if (emEnvio.current) return;
        if (!sessaoCaixaResolvida || rascunho.sessaoCaixaId === null) {
            setErro("Aguarde a definição do Caixa antes de finalizar a venda.");
            return;
        }
        if (!rascunho.pendente && t.usaPrazo && !rascunho.cliente) {
            setErro("Selecione um cliente para vender a prazo."); setOpcional("cliente"); return;
        }
        if (!rascunho.pendente && t.parcelas.some(p => p.formaPagamento !== "A_PRAZO" && !p.configuracaoFormaPagamentoId)) {
            setErro("Selecione uma forma de pagamento válida.");
            return;
        }
        let pedido = rascunho.pendente;
        try { pedido ??= criarPedido(rascunho, crypto.randomUUID()); }
        catch (e) {
            setErro((e as Error).message);
            if (t.parcelas.some(p => p.formaPagamento === "DINHEIRO") && t.valido) recebidoRef.current?.focus();
            return;
        }
        const pendente = { ...rascunho, pendente: pedido };
        try { sessionStorage.setItem(chaveRascunho, JSON.stringify(pendente)); }
        catch { setErro("Não foi possível guardar a finalização neste navegador. Libere espaço e tente novamente."); return; }
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
        setFinalizacao({
            estado: "processing",
            quantidadeItens: rascunho.itens.length,
            total: t.total,
            formaPagamento: t.parcelas.length > 1 ? "Pagamento misto"
                : t.parcelas[0].nomeExibicao ?? rotulosPagamento[t.parcelas[0].formaPagamento],
            troco: t.troco,
        });
        emEnvio.current = true; setSalvando(true); setRascunho(pendente); setErro("");
        try {
            await finalizarVenda(pedido);
            const proximoRascunho = novoRascunho(rascunho.sessaoCaixaId);
            setFinalizacao(atual => atual ? { ...atual, estado: "success" } : atual);
            setRascunho(proximoRascunho); setOpcional(null); setBusca("");
            try { sessionStorage.setItem(chaveRascunho, JSON.stringify(proximoRascunho)); } catch { /* Venda já confirmada pelo servidor. */ }
            finalizacaoTimerRef.current = setTimeout(() => {
                setFinalizacao(null);
                finalizacaoTimerRef.current = null;
            }, 1200);
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            let mensagemFalha: string;
            let podeTentarNovamente = false;
            if (status && status >= 400 && status < 500 && ![408, 429].includes(status)) {
                setRascunho(r => ({ ...r, pendente: null }));
                mensagemFalha = obterMensagemDaApi(e, "Venda não concluída. Revise os dados e tente novamente.");
                setErro(mensagemFalha);
                if (status === 409) setResultados([]);
            } else {
                mensagemFalha = "Não foi possível confirmar a venda. Tente novamente com segurança, sem duplicá-la.";
                podeTentarNovamente = true;
                setErro(mensagemFalha);
            }
            setFinalizacao(atual => atual ? {
                ...atual,
                estado: "error",
                mensagemErro: mensagemFalha,
                podeTentarNovamente,
            } : atual);
        } finally { emEnvio.current = false; setSalvando(false); }
    }
    function atalhos(e: KeyboardEvent) {
        if (e.key === "Escape") {
            if (listaAberta) { e.preventDefault(); setListaAberta(false); focarBusca(); return; }
            if (opcional) { e.preventDefault(); setOpcional(null); focarBusca(); return; }
            e.preventDefault(); navigate("/vendas"); return;
        }
        if (e.key === "F2" && sessaoCaixaResolvida && !salvando) { e.preventDefault(); void finalizar(); return; }
        if (bloqueado) return;
        const id = selecionado ?? rascunho.itens.at(-1)?.produto.id;
        if (e.ctrlKey && e.key === "Delete" && id) { e.preventDefault(); remover(id); }
        if (e.key === "F4") { e.preventDefault(); setOpcional("desconto"); requestAnimationFrame(() => opcionalRef.current?.focus()); return; }
        if (e.key === "F8") { e.preventDefault(); setOpcional("cliente"); return; }
        const paineis: Record<string, Opcional> = { F9: "observacoes", F7: "entrega" };
        if (e.key in paineis) { e.preventDefault(); setOpcional(paineis[e.key]); requestAnimationFrame(() => opcionalRef.current?.focus()); }
    }

    useEffect(() => {
        window.addEventListener("keydown", atalhos);
        return () => window.removeEventListener("keydown", atalhos);
    });

    return <Box sx={{ height: { xs: "auto", md: "100dvh" }, minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default", p: 2, gap: 1.5 }}>
        <SessaoCaixaPDVDialog resolvida={sessaoCaixaResolvida} onResolvida={definirSessaoCaixa} />
        {finalizacao && <VendaFinalizacaoDialog
            open
            estado={finalizacao.estado}
            quantidadeItens={finalizacao.quantidadeItens}
            total={finalizacao.total}
            formaPagamento={finalizacao.formaPagamento}
            troco={finalizacao.troco}
            mensagemErro={finalizacao.mensagemErro}
            onVoltar={fecharFinalizacao}
            onTentarNovamente={finalizacao.podeTentarNovamente ? () => void finalizar() : undefined} />}
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", flexWrap: "wrap" }}><Typography component="h1" variant="h6">Vender</Typography>
                <Typography variant="body2" color="text.secondary">{sessao?.empresa.nomeFantasia || sessao?.empresa.razaoSocial} · {sessao?.nomeUsuario}</Typography></Stack>
            <Button component={Link} to="/dashboard" size="small" disabled={salvando}>Voltar ao ERP</Button>
        </Stack>
        {erro && <Alert severity="error" role="alert">{erro}</Alert>}
        {erroConfig && <Alert severity="error" role="alert">{erroConfig}</Alert>}
        {rascunho.pendente && !salvando && !erro && <Alert severity="info">Finalização pendente de confirmação. F2 retoma sem duplicar a venda.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 350px" }, gap: 2, flex: 1, minHeight: 0, minWidth: 0 }}>
            <Stack spacing={1.5} sx={{ minHeight: 0, minWidth: 0 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField fullWidth autoFocus inputRef={buscaRef} disabled={!sessaoCaixaResolvida || salvando} value={busca}
                        label="Buscar produto ou ler código de barras" placeholder={carregando ? "Buscando produtos…" : "Nome, código interno ou código de barras"}
                        onChange={e => { setBusca(e.target.value); setListaAberta(true); setIndice(0); }}
                        slotProps={{ input: {
                            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                            endAdornment: <InputAdornment position="end"><Tooltip title="Buscar produtos"><IconButton
                                edge="end" size="small" aria-label="Abrir lista de produtos" aria-expanded={listaAberta}
                                onMouseDown={e => e.preventDefault()} onClick={() => { setListaAberta(aberta => !aberta); setIndice(0); focarBusca(); }}>
                                <ArrowDropDownIcon /></IconButton></Tooltip></InputAdornment>,
                        }, htmlInput: { role: "combobox", "aria-expanded": listaAberta && resultados.length > 0, "aria-controls": "pdv-resultados",
                            "aria-activedescendant": resultados.length ? "pdv-opcao-" + Math.min(indice, resultados.length - 1) : undefined, autoComplete: "off" } }}
                        onKeyDown={e => {
                            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                e.preventDefault();
                                setListaAberta(true);
                                setIndice(i => moverIndiceProduto(i, resultados.length, e.key === "ArrowDown" ? "PROXIMO" : "ANTERIOR"));
                            }
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void adicionarPorCodigo();
                            }
                        }} />
                    {listaAberta && !!resultados.length && !bloqueado && <Box id="pdv-resultados" role="listbox" sx={{ position: "absolute", zIndex: 10, top: "100%", width: "100%", bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                        {resultados.map((p, i) => <Box key={p.id} id={"pdv-opcao-" + i} role="option" aria-selected={i === indice}
                            onMouseDown={e => e.preventDefault()} onClick={() => adicionar(p)} sx={{ p: 1, cursor: "pointer", bgcolor: i === indice ? "action.selected" : undefined, display: "flex", justifyContent: "space-between" }}>
                            <span>{p.nome} <Typography component="span" variant="caption" color="text.secondary">{p.codigoBarras || p.codigoInterno} · {p.unidadeMedida}</Typography></span>
                            <strong>{moeda(Math.round(p.precoVenda * 100))}</strong>
                        </Box>)}
                    </Box>}
                </Box>
                {erroCatalogo && <Alert severity="error" action={<Button onClick={() => { refresh(); focarBusca(); }}>Recarregar</Button>}>{erroCatalogo}</Alert>}
                <Box sx={{ flex: 1, overflow: "auto", border: 1, borderColor: "divider", bgcolor: "background.paper", borderRadius: "10px", boxShadow: "0 1px 3px rgba(16,24,40,.06)" }}>
                    <Table stickyHeader size="small" aria-label="Itens da venda" sx={{ minWidth: 560, "& td, & th": { py: 0.25, px: 1, height: 30 }, "& input": { p: "3px 6px", fontSize: 14 } }}>
                        <TableHead><TableRow><TableCell>Produto</TableCell><TableCell width={105}>Quantidade</TableCell><TableCell align="right">Unitário</TableCell><TableCell align="right">Subtotal</TableCell><TableCell width={65} /></TableRow></TableHead>
                        <TableBody>{rascunho.itens.map((item, i) => <TableRow key={item.produto.id} selected={selecionado === item.produto.id} onClick={() => setSelecionado(item.produto.id)}>
                            <TableCell>{String(i + 1).padStart(2, "0")} · {item.produto.nome}</TableCell>
                            <TableCell><TextField size="small" value={item.quantidade} disabled={bloqueado}
                                inputRef={(el: HTMLInputElement | null) => { quantidadesRef.current[item.produto.id] = el; }}
                                slotProps={{ htmlInput: { "aria-label": "Quantidade de " + item.produto.nome, inputMode: "decimal" } }}
                                onFocus={() => setSelecionado(item.produto.id)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focarBusca(); } }}
                                onChange={e => alterar({ itens: rascunho.itens.map(x => x === item ? { ...x, quantidade: e.target.value } : x) })} /></TableCell>
                            <TableCell align="right">{moeda(Math.round(item.produto.precoVenda * 100))}</TableCell>
                            <TableCell align="right">{subtotalItem(item) === null ? "—" : moeda(subtotalItem(item)!)}</TableCell>
                            <TableCell><Button size="small" color="inherit" aria-label={"Remover " + item.produto.nome} disabled={bloqueado} onClick={e => { e.stopPropagation(); remover(item.produto.id); }}>×</Button></TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                    {!rascunho.itens.length && <Box sx={{ p: 5, textAlign: "center", color: "text.secondary" }}><Typography>Leia o primeiro produto para começar</Typography><Typography variant="body2">Busque pelo nome e selecione o produto, ou leia o código de barras.</Typography></Box>}
                </Box>
                <Typography variant="caption" color="text.secondary">Enter adicionar · ↑ ↓ selecionar · F2 pagar · F4 desconto · F8 cliente · Ctrl+Delete remover item · Esc fechar opção</Typography>
            </Stack>
            <Stack spacing={1.5} sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", p: 2, overflowY: "auto", minWidth: 0, borderRadius: "10px", boxShadow: "0 1px 3px rgba(16,24,40,.06)" }}>
                <Typography variant="overline">Resumo da venda · {rascunho.itens.length} itens</Typography>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Subtotal</span><span>{moeda(t.subtotal)}</span></Stack>
                {!!t.desconto && <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Desconto</span><span>− {moeda(t.desconto)}</span></Stack>}
                {rascunho.cliente && <Typography variant="body2">Cliente: {rascunho.cliente.nome}</Typography>}
                <Box><Typography variant="body2">Total a pagar</Typography><Typography aria-label="Total da venda" sx={{ fontSize: 38, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{moeda(Math.max(0, t.total))}</Typography></Box>
                <Divider />
                <Typography variant="overline">Pagamento</Typography>
                {carregandoConfig ? (
                    <Typography variant="body2" color="text.secondary">Carregando formas de pagamento…</Typography>
                ) : erroConfig ? (
                    <Alert severity="error">{erroConfig}</Alert>
                ) : (
                    <>
                        {t.parcelas.map((p, i) => <Stack key={i} spacing={1} role="group" aria-label={`Pagamento ${i + 1}`}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <TextField fullWidth select label={i === 0 ? "Forma de pagamento" : `Forma de pagamento ${i + 1}`} value={p.formaPagamento === "A_PRAZO" ? "A_PRAZO" : p.configuracaoFormaPagamentoId ?? ""} disabled={bloqueado || carregandoConfig}
                            slotProps={{ inputLabel: { shrink: true }, select: { native: true } }}
                            onChange={e => {
                                if (e.target.value === "A_PRAZO") {
                                    alterar({ pagamentos: pagamentosRascunho(rascunho).map((pag, indice) => indice === i
                                        ? { ...pag, formaPagamento: "A_PRAZO", configuracaoFormaPagamentoId: null, nomeExibicao: "A prazo", recebido: "" } : pag),
                                        parcelasPrazo: [{ valor: p.valor === "" && t.parcelas.length === 1 ? "" : ((p.valorCentavos ?? 0) / 100).toFixed(2), vencimento: "" }] });
                                    if (!rascunho.cliente) setOpcional("cliente");
                                    return;
                                }
                                const configId = e.target.value ? Number(e.target.value) : null;
                                const config = configuracoes.find(c => c.id === configId);
                                if (config) {
                                    alterarPagamento(i, {
                                        configuracaoFormaPagamentoId: config.id,
                                        nomeExibicao: config.nomeExibicao,
                                        formaPagamento: tipoConfigParaLegado[config.tipo],
                                        recebido: config.tipo === "DINHEIRO" ? p.recebido : "",
                                    });
                                } else {
                                    alterarPagamento(i, {
                                        configuracaoFormaPagamentoId: null,
                                        nomeExibicao: null,
                                        formaPagamento: "DINHEIRO",
                                    });
                                }
                            }}>
                            <option value="">Selecione uma forma de pagamento</option>
                            <option value="A_PRAZO" disabled={t.parcelas.some((outra, indice) => indice !== i && outra.formaPagamento === "A_PRAZO")}>A prazo</option>
                            {configuracoes.map(config => (
                                <option key={config.id} value={config.id} disabled={t.parcelas.some((outra, indice) => indice !== i && outra.configuracaoFormaPagamentoId === config.id)}>
                                    {config.nomeExibicao}
                                </option>
                            ))}
                        </TextField>
                        {t.parcelas.length > 1 && <Tooltip title="Remover forma"><IconButton size="small" aria-label={`Remover pagamento ${i + 1}`} disabled={bloqueado}
                            onClick={() => alterar({ pagamentos: pagamentosRascunho(rascunho).filter((_, indice) => indice !== i) })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                        </Stack>
                        {p.formaPagamento === "A_PRAZO" ? <Stack spacing={1}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>A prazo · {moeda(t.totalPrazo)}</Typography>
                            {!rascunho.cliente && <Alert severity="warning">Selecione um cliente para vender a prazo.</Alert>}
                            {t.parcelasPrazo.map((parcela, indice) => <Stack key={indice} spacing={0.5} role="group" aria-label={`Parcela a prazo ${indice + 1}`}>
                                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                    <Typography variant="caption">Parcela {indice + 1}/{t.parcelasPrazo.length}</Typography>
                                    {t.parcelasPrazo.length > 1 && <Tooltip title="Remover parcela"><IconButton size="small" aria-label={`Remover parcela a prazo ${indice + 1}`} disabled={bloqueado}
                                        onClick={() => alterar({ parcelasPrazo: rascunho.parcelasPrazo?.filter((_, posicao) => posicao !== indice) })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                                </Stack>
                                <TextField type="date" label={`Vencimento ${indice + 1}`} value={parcela.vencimento} disabled={bloqueado}
                                    slotProps={{ inputLabel: { shrink: true } }} onChange={e => alterarParcelaPrazo(indice, { vencimento: e.target.value })} />
                                <TextField label={`Valor da parcela ${indice + 1} (R$)`} value={parcela.valor === "" && t.parcelas.length === 1 && t.parcelasPrazo.length === 1 ? (Math.max(0, t.total) / 100).toFixed(2) : parcela.valor}
                                    disabled={bloqueado} slotProps={{ htmlInput: { inputMode: "decimal" } }} onFocus={e => e.target.select()}
                                    onChange={e => alterarParcelaPrazo(indice, { valor: e.target.value })} />
                            </Stack>)}
                            <Button startIcon={<AddRoundedIcon />} disabled={bloqueado || t.parcelasPrazo.length >= 120}
                                onClick={() => alterar({ parcelasPrazo: [
                                    ...t.parcelasPrazo.map(parcela => ({ valor: parcela.valor === "" ? ((parcela.valorCentavos ?? 0) / 100).toFixed(2) : parcela.valor, vencimento: parcela.vencimento })),
                                    { valor: (Math.max(0, t.restante) / 100).toFixed(2), vencimento: "" },
                                ] })}>Adicionar parcela</Button>
                        </Stack> : <>
                        <TextField label="Valor aplicado (R$)" value={p.valor === "" && t.parcelas.length === 1 ? (Math.max(0, t.total) / 100).toFixed(2) : p.valor}
                            disabled={bloqueado} slotProps={{ htmlInput: { inputMode: "decimal" } }} onFocus={e => e.target.select()}
                            onChange={e => alterarPagamento(i, { valor: e.target.value })} />
                        {p.formaPagamento === "DINHEIRO" ? (
                            <>
                                <TextField inputRef={recebidoRef} label="Valor recebido (R$)" value={p.recebido} placeholder={((p.valorCentavos ?? 0) / 100).toFixed(2)} disabled={bloqueado}
                                    slotProps={{ htmlInput: { inputMode: "decimal" } }} onFocus={e => e.target.select()} onChange={e => alterarPagamento(i, { recebido: e.target.value })} />
                                <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography>Troco</Typography><Typography sx={{ fontSize: 24, fontWeight: 700 }}>{moeda(p.troco)}</Typography></Stack>
                            </>
                        ) : (
                            <Typography variant="caption" color="text.secondary">{p.nomeExibicao ?? rotulosPagamento[p.formaPagamento]} · {moeda(p.valorCentavos ?? 0)}</Typography>
                        )}
                        </>}
                        </Stack>)}
                        <Button startIcon={<AddRoundedIcon />} disabled={bloqueado || t.parcelas.length >= 20} onClick={adicionarForma}>Adicionar forma</Button>
                        {t.usaPrazo && <>
                            <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Pago agora</span><Typography aria-label="Pago agora">{moeda(t.totalImediato)}</Typography></Stack>
                            <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>A prazo</span><Typography aria-label="Valor a prazo">{moeda(t.totalPrazo)}</Typography></Stack>
                        </>}
                        <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Total informado</span><Typography aria-label="Total informado">{moeda(t.totalInformado)}</Typography></Stack>
                        <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Restante</span><Typography aria-label="Restante" color={t.restante === 0 ? "text.primary" : "error"}>{moeda(t.restante)}</Typography></Stack>
                    </>
                )}
                <Button size="large" variant="contained" disableElevation disabled={!sessaoCaixaResolvida || salvando || carregandoConfig || (!rascunho.pendente && (!rascunho.itens.length || !t.valido || !t.pagamentosValidos || t.restante !== 0))} onClick={() => void finalizar()} sx={{ minHeight: 52, fontSize: "1.05rem", fontWeight: 700 }}>
                    {salvando ? "Finalizando…" : rascunho.pendente ? "Confirmar resultado · F2" : "Pagar · F2"}
                </Button>
                <Divider />
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
                    {([["desconto", "F4 Desconto"], ["cliente", "F8 Cliente"], ["entrega", "F7 Entrega"], ["observacoes", "F9 Observações"]] as const).map(([campo, label]) =>
                        <Button key={campo} size="small" disabled={bloqueado} color={opcional === campo ? "primary" : "inherit"} onClick={() => setOpcional(opcional === campo ? null : campo)}>{label}</Button>)}
                </Box>
                {opcional === "cliente" && <ClienteAutocomplete value={rascunho.cliente} disabled={bloqueado} inputRef={opcionalRef}
                    onChange={cliente => { alterar({ cliente }); setOpcional(null); focarBusca(); }} />}
                {opcional && opcional !== "cliente" && <TextField inputRef={opcionalRef} disabled={bloqueado}
                    label={opcional === "desconto" ? "Desconto em R$" : opcional === "entrega" ? "Endereço / instruções de entrega" : "Observações"}
                    value={rascunho[opcional]} multiline={opcional !== "desconto"} minRows={opcional !== "desconto" ? 2 : undefined}
                    slotProps={{ htmlInput: { maxLength: opcional === "entrega" ? 500 : opcional === "observacoes" ? 2000 : 12 } }}
                    onChange={e => alterar({ [opcional]: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setOpcional(null); focarBusca(); } }} />}
            </Stack>
        </Box>
    </Box>;
}
