import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import SearchIcon from "@mui/icons-material/Search";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Alert, Autocomplete, Box, Button, Divider, IconButton, InputAdornment, Stack, Table, TableBody, TableCell,
    TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { listarProdutos, obterMensagemDaApi } from "../../services/produtoService";
import { listarClientes } from "../../services/clienteService";
import { finalizarVenda, type FormaPagamento } from "../../services/vendaService";
import { obterSessao } from "../../utils/auth/sessao";
import type { Produto } from "../../types/produto";
import type { Cliente } from "../../types/cliente";
import { buscarProdutosPDV, criarPedido, moeda, moverIndiceProduto, novoRascunho, subtotalItem, totais, type RascunhoPDV } from "./pdv";
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

const rotulosPagamento: Record<FormaPagamento, string> = {
    DINHEIRO: "Dinheiro",
    PIX: "PIX",
    CARTAO_DEBITO: "Cartão de débito",
    CARTAO_CREDITO: "Cartão de crédito",
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
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [busca, setBusca] = useState("");
    const [listaAberta, setListaAberta] = useState(false);
    const [indice, setIndice] = useState(0);
    const [selecionado, setSelecionado] = useState<number | null>(null);
    const [opcional, setOpcional] = useState<Opcional>(null);
    const [erro, setErro] = useState("");
    const [erroCatalogo, setErroCatalogo] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [sessaoCaixaResolvida, setSessaoCaixaResolvida] = useState(false);
    const [finalizacao, setFinalizacao] = useState<Finalizacao | null>(null);
    const emEnvio = useRef(false);
    const finalizacaoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buscaRef = useRef<HTMLInputElement>(null);
    const recebidoRef = useRef<HTMLInputElement>(null);
    const opcionalRef = useRef<HTMLInputElement>(null);
    const quantidadesRef = useRef<Record<number, HTMLInputElement | null>>({});
    const resultados = buscarProdutosPDV(produtos, busca, listaAberta && !busca.trim());
    const t = totais(rascunho);
    const bloqueado = !sessaoCaixaResolvida || salvando || !!rascunho.pendente;

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
        let ativo = true;
        if (empresaId) listarProdutos(empresaId).then(p => { if (ativo) setProdutos(p); })
            .catch(e => { if (ativo) setErroCatalogo(obterMensagemDaApi(e, "Não foi possível carregar os produtos.")); })
            .finally(() => { if (ativo) setCarregando(false); });
        return () => { ativo = false; };
    }, [empresaId]);

    useEffect(() => {
        if (!opcional) return;
        opcionalRef.current?.focus();
        if (opcional !== "cliente" || !empresaId) return;
        const abort = new AbortController();
        listarClientes(empresaId, abort.signal).then(c => setClientes(c.filter(c => c.ativo)))
            .catch(e => { if (!abort.signal.aborted) setErro(obterMensagemDaApi(e, "Não foi possível carregar os clientes.")); });
        return () => abort.abort();
    }, [opcional, empresaId]);

    function focarBusca() { requestAnimationFrame(() => buscaRef.current?.focus()); }
    function alterar(patch: Partial<RascunhoPDV>) { if (!bloqueado) setRascunho(r => ({ ...r, ...patch })); }
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
    async function recarregarCatalogo(focarAoConcluir = true) {
        if (!empresaId) return;
        setCarregando(true);
        try { setProdutos(await listarProdutos(empresaId)); setErroCatalogo(""); }
        catch (e) { setErroCatalogo(obterMensagemDaApi(e, "Não foi possível carregar os produtos.")); }
        finally { setCarregando(false); if (focarAoConcluir) focarBusca(); }
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
        let pedido = rascunho.pendente;
        try { pedido ??= criarPedido(rascunho, crypto.randomUUID()); }
        catch (e) {
            setErro((e as Error).message);
            if (rascunho.formaPagamento === "DINHEIRO" && t.valido) recebidoRef.current?.focus();
            return;
        }
        // Persiste a mesma requisição antes do envio para retomar após timeout ou recarga.
        const pendente = { ...rascunho, pendente: pedido };
        try { sessionStorage.setItem(chaveRascunho, JSON.stringify(pendente)); }
        catch { setErro("Não foi possível guardar a finalização neste navegador. Libere espaço e tente novamente."); return; }
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
        setFinalizacao({
            estado: "processing",
            quantidadeItens: rascunho.itens.length,
            total: t.total,
            formaPagamento: rotulosPagamento[rascunho.formaPagamento],
            troco: t.troco,
        });
        emEnvio.current = true; setSalvando(true); setRascunho(pendente); setErro("");
        try {
            await finalizarVenda(pedido);
            const proximoRascunho = novoRascunho(rascunho.sessaoCaixaId);
            setFinalizacao(atual => atual ? { ...atual, estado: "success" } : atual);
            setRascunho(proximoRascunho); setOpcional(null); setBusca("");
            try { sessionStorage.setItem(chaveRascunho, JSON.stringify(proximoRascunho)); } catch { /* Venda já confirmada pelo servidor. */ }
            void recarregarCatalogo(false);
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
                if (status === 409) void recarregarCatalogo(false);
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
        if (e.key === "F3") { e.preventDefault(); setOpcional("desconto"); requestAnimationFrame(() => opcionalRef.current?.focus()); return; }
        if (e.key === "F6") { e.preventDefault(); setOpcional("cliente"); return; }
        const paineis: Record<string, Opcional> = { F9: "observacoes", F10: "entrega" };
        if (e.key in paineis) { e.preventDefault(); setOpcional(paineis[e.key]); requestAnimationFrame(() => opcionalRef.current?.focus()); }
    }

    return <Box onKeyDown={atalhos} sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default", p: 2, gap: 1.5 }}>
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
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "baseline" }}><Typography component="h1" variant="h6">Frente de caixa</Typography>
                <Typography variant="body2" color="text.secondary">{sessao?.empresa.nomeFantasia || sessao?.empresa.razaoSocial} · {sessao?.nomeUsuario}</Typography></Stack>
            <Button component={Link} to="/dashboard" size="small" disabled={salvando}>Voltar ao ERP</Button>
        </Stack>
        {erro && <Alert severity="error" role="alert">{erro}</Alert>}
        {rascunho.pendente && !salvando && !erro && <Alert severity="info">Finalização pendente de confirmação. F2 retoma sem duplicar a venda.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 350px", gap: 2, flex: 1, minHeight: 0, minWidth: 760 }}>
            <Stack spacing={1.5} sx={{ minHeight: 0, minWidth: 0 }}>
                <Box sx={{ position: "relative" }}>
                    <TextField fullWidth autoFocus inputRef={buscaRef} disabled={!sessaoCaixaResolvida || salvando} value={busca}
                        label="Buscar produto ou ler código de barras" placeholder={carregando ? "Carregando catálogo…" : "Nome, código interno ou código de barras"}
                        onChange={e => { setBusca(e.target.value); setListaAberta(true); setIndice(0); }}
                        slotProps={{ input: {
                            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                            endAdornment: <InputAdornment position="end"><Tooltip title="Listar produtos ativos"><IconButton
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
                                const produto = resultados[indice] ?? resultados[0];
                                if (produto && !carregando) adicionar(produto);
                                else if (busca.trim()) setErro(carregando ? "Aguarde o carregamento do catálogo." : "Produto não encontrado ou inativo.");
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
                {erroCatalogo && <Alert severity="error" action={<Button onClick={() => void recarregarCatalogo()}>Recarregar</Button>}>{erroCatalogo}</Alert>}
                <Box sx={{ flex: 1, overflow: "auto", border: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                    <Table stickyHeader size="small" aria-label="Itens da venda" sx={{ "& td, & th": { py: 0.25, px: 1, height: 30 }, "& input": { p: "3px 6px", fontSize: 14 } }}>
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
                    {!rascunho.itens.length && <Box sx={{ p: 5, textAlign: "center", color: "text.secondary" }}><Typography>Leia o primeiro produto para começar</Typography><Typography variant="body2">Busque pelo nome e pressione Enter para adicionar.</Typography></Box>}
                </Box>
                <Typography variant="caption" color="text.secondary">Enter adicionar · ↑ ↓ selecionar · F2 pagar · F3 desconto · F6 cliente · Ctrl+Delete remover item · Esc fechar opção</Typography>
            </Stack>
            <Stack spacing={1.5} sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", p: 2, overflowY: "auto" }}>
                <Typography variant="overline">Resumo da venda · {rascunho.itens.length} itens</Typography>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Subtotal</span><span>{moeda(t.subtotal)}</span></Stack>
                {!!t.desconto && <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Desconto</span><span>− {moeda(t.desconto)}</span></Stack>}
                {rascunho.cliente && <Typography variant="body2">Cliente: {rascunho.cliente.nome}</Typography>}
                <Box><Typography variant="body2">Total a pagar</Typography><Typography aria-label="Total da venda" sx={{ fontSize: 38, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{moeda(Math.max(0, t.total))}</Typography></Box>
                <Divider />
                <Typography variant="overline" sx={{ letterSpacing: "0.08em" }}>Pagamento</Typography>
                <TextField select label="Forma de pagamento" value={rascunho.formaPagamento} disabled={bloqueado}
                    slotProps={{ select: { native: true } }} onChange={e => alterar({ formaPagamento: e.target.value as FormaPagamento })}>
                    <option value="DINHEIRO">Dinheiro</option><option value="PIX">PIX</option><option value="CARTAO_DEBITO">Cartão de débito</option><option value="CARTAO_CREDITO">Cartão de crédito</option>
                </TextField>
                {rascunho.formaPagamento === "DINHEIRO" ? <>
                    <TextField inputRef={recebidoRef} label="Valor recebido (R$)" value={rascunho.recebido} disabled={bloqueado}
                        slotProps={{ htmlInput: { inputMode: "decimal" } }} onFocus={e => e.target.select()} onChange={e => alterar({ recebido: e.target.value })} />
                    <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography>Troco</Typography><Typography sx={{ fontSize: 24, fontWeight: 700 }}>{moeda(t.troco)}</Typography></Stack>
                </> : <Typography variant="caption" color="text.secondary">Finalize após confirmar o PIX ou a aprovação na maquininha. Registro de {moeda(Math.max(0, t.total))}.</Typography>}
                <Button size="large" variant="contained" disableElevation disabled={!sessaoCaixaResolvida || salvando || (!rascunho.itens.length && !rascunho.pendente)} onClick={() => void finalizar()} sx={{ minHeight: 52, fontSize: "1.05rem", fontWeight: 700 }}>
                    {salvando ? "Finalizando…" : rascunho.pendente ? "Confirmar resultado · F2" : "Pagar · F2"}
                </Button>
                <Divider />
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
                    {([["desconto", "F3 Desconto"], ["cliente", "F6 Cliente"], ["entrega", "F10 Entrega"], ["observacoes", "F9 Observações"]] as const).map(([campo, label]) =>
                        <Button key={campo} size="small" disabled={bloqueado} color={opcional === campo ? "primary" : "inherit"} onClick={() => setOpcional(opcional === campo ? null : campo)}>{label}</Button>)}
                </Box>
                {opcional === "cliente" && <Autocomplete options={clientes} value={rascunho.cliente} disabled={bloqueado} autoHighlight
                    getOptionLabel={c => c.nome + (c.cpfCnpj ? " · " + c.cpfCnpj : "")} isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, cliente) => { alterar({ cliente }); setOpcional(null); focarBusca(); }}
                    renderInput={params => <TextField {...params} inputRef={opcionalRef} label="Cliente (opcional)" />} />}
                {opcional && opcional !== "cliente" && <TextField inputRef={opcionalRef} disabled={bloqueado}
                    label={opcional === "desconto" ? "Desconto em R$" : opcional === "entrega" ? "Endereço / instruções de entrega" : "Observações"}
                    value={rascunho[opcional]} multiline={opcional !== "desconto"} minRows={opcional !== "desconto" ? 2 : undefined}
                    slotProps={{ htmlInput: { maxLength: opcional === "entrega" ? 500 : opcional === "observacoes" ? 2000 : 12 } }}
                    onChange={e => alterar({ [opcional]: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setOpcional(null); focarBusca(); } }} />}
            </Stack>
        </Box>
    </Box>;
}
