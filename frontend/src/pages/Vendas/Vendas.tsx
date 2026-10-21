import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import SearchIcon from "@mui/icons-material/Search";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, Table, TableBody, TableCell,
    TableHead, TableRow, TextField, Tooltip, Typography, useTheme } from "@mui/material";
import { pesquisarProdutos, obterMensagemDaApi } from "../../services/produtoService";
import { useRemoteSearch } from "../../hooks/useRemoteSearch";
import ClienteAutocomplete from "../../components/clientes/ClienteAutocomplete";
import { finalizarVenda, type FormaPagamento } from "../../services/vendaService";
import { listarConfiguracoesParaPDV } from "../../services/configuracaoFormaPagamentoService";
import { obterSessao } from "../../utils/auth/sessao";
import type { Produto } from "../../types/produto";
import type { ConfiguracaoFormaPagamento } from "../../types/configuracaoFormaPagamento";
import { carregarRascunhoSalvo, salvarRascunho, encontrarProdutoPorCodigo, criarPedido, decimal, formatarValorMonetario, moeda, moverIndiceProduto, novoRascunho, pagamentosRascunho, subtotalItem, totais, type PagamentoPDV, type RascunhoPDV } from "./pdv";
import ValorMonetarioPDV from "./ValorMonetarioPDV";
import SessaoCaixaPDVDialog from "./SessaoCaixaPDVDialog";
import VendaFinalizacaoDialog, { type EstadoFinalizacao } from "./VendaFinalizacaoDialog";
import PdvActionButton from "./PdvActionButton";
import { pdvTokens } from "../../theme/darkTokens";

type Opcional = "desconto" | "cliente" | "entrega" | "observacoes" | null;
const avisoCodigoAmbiguo = "Código corresponde a mais de um produto. Selecione o item na lista.";
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
    const theme = useTheme();
    const cores = pdvTokens[theme.palette.mode];
    const navigate = useNavigate();
    const sessao = obterSessao();
    const empresaId = sessao?.empresa.id;
    const chaveOperador = "novexa-pdv:" + empresaId + ":" + sessao?.id;
    const [rascunho, setRascunho] = useState<RascunhoPDV>(novoRascunho);
    const chaveRascunho = chaveOperador + ":" + rascunho.sessaoCaixaId;
    const [limpezaAberta, setLimpezaAberta] = useState(false);
    const [pagamentoAberto, setPagamentoAberto] = useState(false);
    const [estoqueConfirmado, setEstoqueConfirmado] = useState(false);
    const formaPagamentoRef = useRef<HTMLSelectElement>(null);
    const formasPagamentoRefs = useRef<(HTMLSelectElement | null)[]>([]);
    const confirmarPagamentoRef = useRef<HTMLButtonElement>(null);
    const proximaFormaRef = useRef<number | null>(null);
    const erroPagamentoRef = useRef<HTMLDivElement>(null);
    const retornandoPagamento = useRef(false);
    const [resultados, setResultados] = useState<Produto[]>([]);
    const [buscaConcluida, setBuscaConcluida] = useState(false);
    const [configuracoes, setConfiguracoes] = useState<ConfiguracaoFormaPagamento[]>([]);
    const [carregandoConfig, setCarregandoConfig] = useState(true);
    const [erroConfig, setErroConfig] = useState("");
    const [listaAberta, setListaAberta] = useState(false);
    const [indice, setIndice] = useState(0);
    const [selecionado, setSelecionado] = useState<number | null>(null);
    const [opcional, setOpcional] = useState<Opcional>(null);
    const [erro, setErro] = useState("");
    const [erroCatalogo, setErroCatalogo] = useState("");
    const [avisoBusca, setAvisoBusca] = useState("");
    const [buscandoCodigo, setBuscandoCodigo] = useState(false);
    const scannerRef = useRef<AbortController | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [sessaoCaixaResolvida, setSessaoCaixaResolvida] = useState(false);
    const [finalizacao, setFinalizacao] = useState<Finalizacao | null>(null);
    const [confirmacaoEstoque, setConfirmacaoEstoque] = useState<{ permitido: boolean;
        itens: { produtoId: number; nome: string; disponivel: number; solicitada: number }[] } | null>(null);
    const emEnvio = useRef(false);
    const finalizacaoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buscaRef = useRef<HTMLInputElement>(null);
    const recebidoRef = useRef<HTMLInputElement>(null);
    const opcionalRef = useRef<HTMLInputElement>(null);
    const registrarOpcional = useCallback((campo: HTMLInputElement | null) => {
        opcionalRef.current = campo;
        campo?.focus();
    }, []);
    const quantidadesRef = useRef<Record<number, HTMLInputElement | null>>({});
    const quantidadeFocoPendenteRef = useRef<number | null>(null);
    const quantidadeAntesRef = useRef("");
    const t = totais(rascunho);
    const bloqueado = !sessaoCaixaResolvida || salvando || !!rascunho.pendente;
    const { term: busca, setTerm, loading, cancel, refresh } = useRemoteSearch<Produto>({
        enabled: !bloqueado, search: pesquisarProdutos,
        onResults: lista => { setResultados(lista); setBuscaConcluida(true); setErroCatalogo(""); },
        onError: e => { setResultados([]); setErroCatalogo(obterMensagemDaApi(e, "Não foi possível buscar os produtos.")); },
        onInvalidTerm: () => setResultados([]),
    });
    const carregando = loading || buscandoCodigo;
    const itemAtual = rascunho.itens.find(item => item.produto.id === selecionado) ?? rascunho.itens.at(-1);
    const emInclusao = !!busca.trim();
    const produtoEmInclusao = encontrarProdutoPorCodigo(resultados, busca) ?? (listaAberta ? resultados[indice] : undefined);
    const produtoExibido = emInclusao ? produtoEmInclusao : itemAtual?.produto;
    const revisaoDesabilitada = !sessaoCaixaResolvida || salvando || (!rascunho.pendente && (!rascunho.itens.length || !t.valido));
    const pagarDesabilitado = !sessaoCaixaResolvida || salvando || carregandoConfig || (!rascunho.pendente && (!rascunho.itens.length || !t.valido || !t.pagamentosValidos || t.restante !== 0
        || t.parcelas.some(p => p.formaPagamento !== "A_PRAZO" && !configuracoes.some(c => c.id === p.configuracaoFormaPagamentoId))));

    useLayoutEffect(() => {
        const id = quantidadeFocoPendenteRef.current;
        if (id === null) return;
        const campo = quantidadesRef.current[id];
        if (!campo) return;
        // Foca e seleciona o valor atualizado somente depois do commit do carrinho.
        quantidadeFocoPendenteRef.current = null;
        campo.focus();
        campo.select();
    }, [rascunho.itens]);

    useEffect(() => {
        if (bloqueado) { cancel(); scannerRef.current?.abort(); }
        return () => scannerRef.current?.abort();
    }, [bloqueado, cancel]);

    function setBusca(termo: string) {
        scannerRef.current?.abort(); scannerRef.current = null; setBuscandoCodigo(false);
        setResultados([]); setBuscaConcluida(false); setErroCatalogo(""); setAvisoBusca(""); setIndice(0); setTerm(termo);
    }

    function exibirCodigoAmbiguo(lista: Produto[], termo: string) {
        if (lista.filter(p => encontrarProdutoPorCodigo([p], termo)).length < 2) return false;
        setResultados(lista); setBuscaConcluida(true); setListaAberta(true); setIndice(0);
        setAvisoBusca(avisoCodigoAmbiguo); setErroCatalogo("");
        return true;
    }

    async function adicionarPorCodigo() {
        const termo = busca.trim();
        if (bloqueado || scannerRef.current) return;
        if (!termo) { setAvisoBusca("Digite nome, código interno ou código de barras."); return; }
        cancel();
        if (avisoBusca !== avisoCodigoAmbiguo && exibirCodigoAmbiguo(resultados, termo)) return;
        const encontrado = encontrarProdutoPorCodigo(resultados, termo);
        if (encontrado) { adicionar(encontrado); return; }
        if (listaAberta && resultados[indice]) { adicionar(resultados[indice]); return; }
        if (listaAberta && buscaConcluida && !erroCatalogo) return;
        // Sem resultado exibido, o scanner consulta código exato sem esperar o debounce.
        const controller = new AbortController(); scannerRef.current = controller; setBuscandoCodigo(true);
        try {
            const lista = await pesquisarProdutos(termo, controller.signal);
            if (controller.signal.aborted) return;
            if (exibirCodigoAmbiguo(lista, termo)) return;
            const produto = encontrarProdutoPorCodigo(lista, termo);
            if (produto) adicionar(produto);
            else { setResultados(lista); setBuscaConcluida(true); setListaAberta(true); setIndice(0); setErroCatalogo(""); }
        } catch (e) {
            if (!controller.signal.aborted) setErroCatalogo(obterMensagemDaApi(e, "Não foi possível buscar os produtos."));
        } finally {
            if (scannerRef.current === controller) { scannerRef.current = null; setBuscandoCodigo(false); }
        }
    }

    const definirSessaoCaixa = useCallback((sessaoCaixaId: number) => {
        setRascunho(carregarRascunhoSalvo(chaveOperador + ":" + sessaoCaixaId, sessaoCaixaId, chaveOperador));
        setSessaoCaixaResolvida(true);
    }, [chaveOperador]);

    useEffect(() => {
        if (sessaoCaixaResolvida && !salvando && !finalizacao && !pagamentoAberto && !retornandoPagamento.current) focarBusca();
    }, [sessaoCaixaResolvida, salvando, finalizacao, pagamentoAberto]);

    useEffect(() => {
        if (pagamentoAberto && !carregandoConfig && !finalizacao && !opcional && !confirmacaoEstoque) {
            const campo = erro || erroConfig ? erroPagamentoRef.current : formaPagamentoRef.current;
            campo?.focus();
        }
    }, [pagamentoAberto, carregandoConfig, finalizacao, opcional, confirmacaoEstoque, erro, erroConfig]);

    useEffect(() => () => {
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
    }, []);

    useEffect(() => {
        if (!sessaoCaixaResolvida) return;
        try { salvarRascunho(chaveRascunho, rascunho); } catch { /* Mantém o rascunho em memória. */ }
    }, [chaveRascunho, rascunho, sessaoCaixaResolvida]);

    useEffect(() => {
        const controller = new AbortController();
        listarConfiguracoesParaPDV(controller.signal)
            .then(list => { if (!controller.signal.aborted) { setConfiguracoes(list.filter(c => c.ativo && ["DINHEIRO", "PIX", "DEBITO", "CREDITO"].includes(c.tipo)
                && (c.tipo !== "PIX" || (c.contaFinanceiraDestino?.ativo && ["BANCO", "CARTEIRA_DIGITAL"].includes(c.contaFinanceiraDestino.tipo))))); setErroConfig(""); } })
            .catch(e => { if (!controller.signal.aborted) setErroConfig(obterMensagemDaApi(e, "Não foi possível carregar as configurações de pagamento.")); })
            .finally(() => { if (!controller.signal.aborted) setCarregandoConfig(false); });
        return () => controller.abort();
    }, [empresaId]);

    useEffect(() => {
        if (!opcional) return;
        opcionalRef.current?.focus();
    }, [opcional, empresaId]);

    function focarBusca() { requestAnimationFrame(() => {
        buscaRef.current?.focus();
        buscaRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
    }); }
    function focarQuantidade() {
        const id = selecionado ?? rascunho.itens.at(-1)?.produto.id;
        if (id === undefined) return;
        const campo = quantidadesRef.current[id];
        campo?.focus(); campo?.select();
    }
    function fecharOpcional() { setOpcional(null); if (!pagamentoAberto) focarBusca(); }
    function fecharLimpeza() { setLimpezaAberta(false); focarBusca(); }
    function alterar(patch: Partial<RascunhoPDV>) {
        if (!bloqueado) {
            if (patch.itens || patch.desconto !== undefined) setEstoqueConfirmado(false);
            setRascunho(r => ({ ...r, ...patch }));
        }
    }
    function abrirPagamento() {
        if (revisaoDesabilitada) return;
        retornandoPagamento.current = false;
        setListaAberta(false); setErro(""); setPagamentoAberto(true);
    }
    function fecharPagamento() {
        if (emEnvio.current) return;
        retornandoPagamento.current = true;
        setPagamentoAberto(false);
    }
    function ajustarQuantidade(id: number, passo: number) {
        const item = rascunho.itens.find(i => i.produto.id === id);
        if (!item) return;
        const atual = decimal(item.quantidade, 3);
        if (atual === null || atual + passo * 1000 <= 0) return;
        alterar({ itens: rascunho.itens.map(i => i === item ? { ...i, quantidade: String((atual + passo * 1000) / 1000) } : i) });
        setSelecionado(id); focarBusca();
    }
    function alterarPagamento(indice: number, patch: Partial<PagamentoPDV>) {
        alterar({ pagamentos: pagamentosRascunho(rascunho).map((p, i) => i === indice ? { ...p, ...patch } : p) });
    }
    function adicionarForma() {
        if (bloqueado || t.parcelas.length >= 20) return;
        proximaFormaRef.current = t.parcelas.length;
        alterar({ ...(t.usaPrazo ? { parcelasPrazo: t.parcelasPrazo.map(p => ({
            valor: p.valor === "" ? ((p.valorCentavos ?? 0) / 100).toFixed(2) : p.valor, vencimento: p.vencimento,
        })) } : {}), pagamentos: [
            ...pagamentosRascunho(rascunho).map((p, i) => ({ ...p,
                valor: p.valor === "" ? ((t.parcelas[i].valorCentavos ?? 0) / 100).toFixed(2) : p.valor,
                recebido: p.formaPagamento === "DINHEIRO" && p.recebido === "" ? ((t.parcelas[i].recebidoCentavos ?? 0) / 100).toFixed(2) : p.recebido,
            })),
            { configuracaoFormaPagamentoId: null, nomeExibicao: null, formaPagamento: "DINHEIRO",
                valor: (Math.max(0, t.restante) / 100).toFixed(2), recebido: (Math.max(0, t.restante) / 100).toFixed(2) },
        ] });
    }
    useEffect(() => {
        if (proximaFormaRef.current === null) return;
        formasPagamentoRefs.current[proximaFormaRef.current]?.focus();
        proximaFormaRef.current = null;
    }, [t.parcelas.length]);

    function confirmarLinhaPagamento() {
        if (bloqueado) return;
        const incompleta = t.parcelas.findIndex(p => p.formaPagamento !== "A_PRAZO" && p.configuracaoFormaPagamentoId === null);
        if (incompleta >= 0) { formasPagamentoRefs.current[incompleta]?.focus(); return; }
        if (!t.pagamentosValidos) return;
        if (t.restante > 0) adicionarForma();
        else if (!pagarDesabilitado) confirmarPagamentoRef.current?.focus();
    }
    function alterarParcelaPrazo(indice: number, patch: Partial<{ valor: string; vencimento: string }>) {
        alterar({ parcelasPrazo: (rascunho.parcelasPrazo ?? []).map((p, i) => i === indice ? { ...p, ...patch } : p) });
    }
    function adicionar(produto: Produto) {
        if (bloqueado) return;
        setEstoqueConfirmado(false);
        if (rascunho.itens.length >= 200 && !rascunho.itens.some(i => i.produto.id === produto.id)) {
            setErro("O limite é de 200 produtos diferentes por venda."); return;
        }
        quantidadeFocoPendenteRef.current = produto.id;
        setRascunho(r => {
            const existente = r.itens.find(i => i.produto.id === produto.id);
            if (existente) return { ...r, itens: r.itens.map(i => i === existente
                ? { produto, quantidade: String((Number(i.quantidade.replace(",", ".")) || 0) + 1) } : i) };
            return { ...r, itens: [...r.itens, { produto, quantidade: "1" }] };
        });
        setBusca(""); setListaAberta(false); setIndice(0); setSelecionado(produto.id); setErro("");
    }
    function remover(id: number) {
        alterar({ itens: rascunho.itens.filter(i => i.produto.id !== id) });
        setSelecionado(null); focarBusca();
    }
    function limparVenda() {
        if (bloqueado) return;
        try { sessionStorage.removeItem(chaveRascunho); } catch { /* Limpa tambem o estado em memoria. */ }
        setRascunho(novoRascunho(rascunho.sessaoCaixaId));
        setBusca(""); setOpcional(null); setSelecionado(null); setErro(""); setLimpezaAberta(false); focarBusca();
    }
    function fecharFinalizacao() {
        if (finalizacao?.estado === "processing") return;
        if (finalizacaoTimerRef.current) clearTimeout(finalizacaoTimerRef.current);
        finalizacaoTimerRef.current = null;
        setFinalizacao(null);
    }
    async function confirmarPagamento() {
        if (!pagamentoAberto || emEnvio.current) return;
        if (!sessaoCaixaResolvida || rascunho.sessaoCaixaId === null) {
            setErro("Aguarde a definição do Caixa antes de finalizar a venda.");
            return;
        }
        if (!rascunho.pendente && t.usaPrazo && !rascunho.cliente) {
            setErro("Selecione um cliente para vender a prazo."); setOpcional("cliente"); return;
        }
        if (!rascunho.pendente && t.parcelas.some(p => p.formaPagamento !== "A_PRAZO" && !configuracoes.some(c => c.id === p.configuracaoFormaPagamentoId))) {
            setErro("Selecione uma forma de pagamento válida.");
            return;
        }
        let pedido = rascunho.pendente;
        try { pedido ??= { ...criarPedido(rascunho, crypto.randomUUID()),
            ...(estoqueConfirmado ? { confirmarEstoqueInsuficiente: true } : {}) }; }
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
            setPagamentoAberto(false); retornandoPagamento.current = false; setEstoqueConfirmado(false);
            setRascunho(proximoRascunho); setOpcional(null); setBusca("");
            try { sessionStorage.removeItem(chaveRascunho); } catch { /* Venda já confirmada pelo servidor. */ }
            finalizacaoTimerRef.current = setTimeout(() => {
                setFinalizacao(null);
                finalizacaoTimerRef.current = null;
            }, 1200);
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            const dados = axios.isAxiosError(e) ? e.response?.data : undefined;
            if (status === 409 && dados?.codigo === "ESTOQUE_INSUFICIENTE" && Array.isArray(dados.itens)) {
                setRascunho(r => ({ ...r, pendente: null }));
                setFinalizacao(null);
                setConfirmacaoEstoque({ permitido: dados.permitido === true, itens: dados.itens });
                return;
            }
            let mensagemFalha: string;
            let podeTentarNovamente = false;
            if (status && status >= 400 && status < 500 && ![408, 429].includes(status)) {
                setRascunho(r => ({ ...r, pendente: null }));
                mensagemFalha = obterMensagemDaApi(e, "Venda não concluída. Revise os dados e tente novamente.");
                if (status === 409 && mensagemFalha.startsWith("Saldo insuficiente. Estoque atual:"))
                    mensagemFalha = "Estoque insuficiente para concluir a venda. Confira as quantidades dos produtos.";
                if (mensagemFalha === "Pagamento sem destino financeiro historico.")
                    mensagemFalha = "Esta forma de pagamento PIX não possui uma conta de destino configurada.";
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
        if (e.altKey || e.ctrlKey && e.key !== "Delete" || e.metaKey) return;
        if (["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"].includes(e.key)) e.preventDefault();
        if (confirmacaoEstoque || pagamentoAberto) return;
        if (finalizacao) { if (e.key === "Escape") { e.preventDefault(); fecharFinalizacao(); } return; }
        if (limpezaAberta) { if (e.key === "Escape") { e.preventDefault(); fecharLimpeza(); } return; }
        if (opcional) {
            if (e.key === "Escape") { e.preventDefault(); fecharOpcional(); }
            return;
        }
        if (e.key === "Escape") {
            if (listaAberta) { e.preventDefault(); setListaAberta(false); focarBusca(); return; }
            e.preventDefault(); navigate("/vendas"); return;
        }
        if (e.key === "F2" && sessaoCaixaResolvida && !salvando) { e.preventDefault(); abrirPagamento(); return; }
        if (bloqueado) return;
        const id = selecionado ?? rascunho.itens.at(-1)?.produto.id;
        if (e.ctrlKey && e.key === "Delete" && id) { e.preventDefault(); remover(id); }
        if (e.key === "F3") { e.preventDefault(); focarQuantidade(); return; }
        if (e.key === "F4") { e.preventDefault(); if (id) remover(id); return; }
        if (e.key === "F5") { e.preventDefault(); focarBusca(); return; }
        if (e.key === "F6") { e.preventDefault(); if (rascunho.itens.length) setLimpezaAberta(true); return; }
        if (e.key === "F7") { e.preventDefault(); setOpcional("desconto"); requestAnimationFrame(() => opcionalRef.current?.focus()); return; }
        if (e.key === "F8") { e.preventDefault(); setOpcional("cliente"); return; }
        const paineis: Record<string, Opcional> = { F9: "observacoes" };
        if (e.key in paineis) { e.preventDefault(); setOpcional(paineis[e.key]); requestAnimationFrame(() => opcionalRef.current?.focus()); }
    }

    useEffect(() => {
        window.addEventListener("keydown", atalhos);
        return () => window.removeEventListener("keydown", atalhos);
    });

    const comandos = <Box role="group" aria-label="Comandos do PDV" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(5, minmax(0, 1fr))", lg: "repeat(9, minmax(0, 1fr))" }, gap: 0.75, p: 1, bgcolor: cores.commands, borderBottom: 1, borderColor: cores.border, flexShrink: 0 }}>
        <PdvActionButton compacto categoria="consulta" icone={<SearchIcon />} atalho="F5" disabled={bloqueado} onClick={focarBusca}>Produto</PdvActionButton>
        <PdvActionButton compacto categoria="alteracao" icone={<EditRoundedIcon />} atalho="F3" disabled={bloqueado || !rascunho.itens.length} onClick={focarQuantidade}>Quantidade</PdvActionButton>
        <PdvActionButton compacto categoria="alteracao" icone={<PercentRoundedIcon />} atalho="F7" disabled={bloqueado} onClick={() => setOpcional("desconto")}>Desconto</PdvActionButton>
        <PdvActionButton compacto categoria="opcional" icone={<PersonOutlineRoundedIcon />} atalho="F8" aria-label="F8 Cliente" disabled={bloqueado} onClick={() => setOpcional("cliente")}>Cliente</PdvActionButton>
        <PdvActionButton compacto categoria="opcional" icone={<NotesRoundedIcon />} atalho="F9" aria-label="F9 Observações" disabled={bloqueado} onClick={() => setOpcional("observacoes")}>Observações</PdvActionButton>
        <PdvActionButton compacto categoria="opcional" icone={<LocalShippingOutlinedIcon />} disabled={bloqueado} onClick={() => setOpcional("entrega")}>Entrega</PdvActionButton>
        <PdvActionButton compacto categoria="confirmacao" icone={<ShoppingCartCheckoutRoundedIcon />} atalho="F2" aria-label="Abrir pagamento · F2" disabled={revisaoDesabilitada} onClick={abrirPagamento}>Finalizar</PdvActionButton>
        <PdvActionButton compacto categoria="cancelamento" icone={<DeleteOutlineRoundedIcon />} atalho="F4" disabled={bloqueado || !rascunho.itens.length} onClick={() => { const id = itemAtual?.produto.id; if (id) remover(id); }}>Cancelar item</PdvActionButton>
        <PdvActionButton compacto categoria="cancelamento" icone={<CloseRoundedIcon />} atalho="F6" disabled={bloqueado || !rascunho.itens.length} onClick={() => setLimpezaAberta(true)}>Cancelar venda</PdvActionButton>
    </Box>;

    return <Box sx={{ height: { xs: "auto", md: "100dvh" }, minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: cores.canvas }}>
        <Dialog open={pagamentoAberto} onClose={fecharPagamento} fullWidth maxWidth="sm"
            aria-labelledby="pdv-pagamento-titulo" aria-describedby="pdv-pagamento-descricao"
            onKeyDown={evento => { if (evento.key !== "Escape") evento.stopPropagation(); }}
            slotProps={{ paper: { sx: { m: { xs: 1, sm: 4 }, width: { xs: "calc(100% - 16px)", sm: "100%" }, maxHeight: "calc(100dvh - 16px)" } } }}>
            <DialogTitle id="pdv-pagamento-titulo" sx={{ pb: 0 }}>Pagamento da venda</DialogTitle>
            <Box sx={{ px: 3, flexShrink: 0 }}>
                <Box sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography variant="body2" color="text.secondary">Total da venda</Typography><Typography aria-label="Total a pagar" sx={{ fontSize: 40, lineHeight: 1.25, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere", color: cores.total }}>{moeda(Math.max(0, t.total))}</Typography></Box>
                <Stack direction="row" useFlexGap spacing={2} aria-live="polite" sx={{ flexWrap: "wrap", py: 1, fontVariantNumeric: "tabular-nums" }}>
                    <Box><Typography variant="caption" color="text.secondary">Pago agora</Typography><Typography aria-label="Pago agora">{moeda(t.recebido)}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Falta a pagar</Typography><Typography aria-label="Falta a pagar" sx={{ fontWeight: 700 }}>{moeda(Math.max(0, t.restante))}</Typography></Box>
                    {t.troco > 0 && <Box><Typography variant="caption" color="text.secondary">Troco</Typography><Typography aria-label="Troco total" sx={{ fontWeight: 700 }}>{moeda(t.troco)}</Typography></Box>}
                </Stack>
            </Box>
            <DialogContent dividers sx={{ minHeight: 0, overscrollBehavior: "contain" }}>
                <Typography id="pdv-pagamento-descricao" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Escolha como receber. A venda será gravada somente ao confirmar o pagamento.
                </Typography>
                {erro && <Alert severity="error" tabIndex={-1} ref={erroPagamentoRef} sx={{ mb: 2 }}>{erro}</Alert>}
                {estoqueConfirmado && <Alert severity="warning" sx={{ mb: 2 }}>Estoque insuficiente autorizado. Confirme o pagamento para concluir a venda.</Alert>}
                <Box role="region" aria-label="Pagamentos da venda" sx={{ minWidth: 0 }}>
                <Stack spacing={1.5}>

                {carregandoConfig ? (
                    <Typography variant="body2" color="text.secondary">Carregando formas de pagamento…</Typography>
                ) : erroConfig ? (
                    <Alert severity="error" tabIndex={-1} ref={erroPagamentoRef}>{erroConfig}</Alert>
                ) : (
                    <>
                        {t.parcelas.map((p, i) => <Stack key={i} spacing={1} role="group" aria-label={`Pagamento ${i + 1}`}
                            sx={t.parcelas.length > 1 ? { py: 1.25, borderBottom: 1, borderColor: "divider" } : undefined}>
                        {t.parcelas.length > 1 && <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>Forma {i + 1}</Typography>
                            <Tooltip title="Remover forma"><IconButton aria-label={`Remover pagamento ${i + 1}`} disabled={bloqueado} sx={{ width: 36, height: 36 }}
                                onClick={() => alterar({ pagamentos: pagamentosRascunho(rascunho).filter((_, indice) => indice !== i) })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        </Stack>}
                        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
                        <TextField size="small" select sx={{ flex: "1 1 140px", minWidth: 0 }} label={i === 0 ? "Forma de pagamento" : `Forma de pagamento ${i + 1}`} value={p.formaPagamento === "A_PRAZO" ? "A_PRAZO" : p.configuracaoFormaPagamentoId ?? ""} disabled={bloqueado || carregandoConfig}
                            inputRef={(elemento: HTMLSelectElement | null) => { formasPagamentoRefs.current[i] = elemento; if (i === 0) formaPagamentoRef.current = elemento; }}
                            autoFocus={i === 0} slotProps={{ inputLabel: { shrink: true }, select: { native: true } }}
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
                                        valor: p.formaPagamento === "DINHEIRO" && p.recebido !== "" ? ((p.valorCentavos ?? 0) / 100).toFixed(2) : p.valor,
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
                            {configuracoes.map(config => (
                                <option key={config.id} value={config.id} disabled={t.parcelas.some((outra, indice) => indice !== i && outra.configuracaoFormaPagamentoId === config.id)}>
                                    {config.nomeExibicao}
                                </option>
                            ))}
                            <option value="A_PRAZO" disabled={t.parcelas.some((outra, indice) => indice !== i && outra.formaPagamento === "A_PRAZO")}>A prazo</option>
                        </TextField>
                        {p.formaPagamento !== "A_PRAZO" && <ValorMonetarioPDV size="small" label={p.formaPagamento === "DINHEIRO" ? "Recebido em dinheiro (R$)" : "Valor aplicado (R$)"}
                            sx={{ flex: p.formaPagamento === "DINHEIRO" ? "1 1 100%" : "0 0 140px", "& input": { fontWeight: 600 } }}
                            inputRef={p.formaPagamento === "DINHEIRO" ? recebidoRef : undefined}
                            helperText={p.formaPagamento === "DINHEIRO" && p.configuracaoFormaPagamentoId !== null && p.valorCentavos === 0 && t.total > 0 && t.restante === 0
                                ? "O total já está coberto pelas outras formas. Remova esta forma de pagamento." : undefined}
                            value={p.formaPagamento === "DINHEIRO" ? p.recebido : p.valor === "" && t.parcelas.length === 1 ? (Math.max(0, t.total) / 100).toFixed(2) : p.valor}
                            placeholder={p.formaPagamento === "DINHEIRO" ? formatarValorMonetario(((p.recebidoCentavos ?? 0) / 100).toFixed(2)) : undefined}
                            disabled={bloqueado} slotProps={{ htmlInput: { inputMode: "decimal" } }}
                            onKeyDown={evento => {
                                if (evento.key !== "Enter" || evento.nativeEvent.isComposing) return;
                                evento.preventDefault(); evento.stopPropagation();
                                if (!evento.repeat) confirmarLinhaPagamento();
                            }}
                            onChange={valor => alterarPagamento(i, p.formaPagamento === "DINHEIRO" ? { recebido: valor } : { valor })} />}
                        </Stack>
                        {p.formaPagamento === "A_PRAZO" ? <Stack spacing={1}>
                            {!rascunho.cliente && <Alert severity="warning">Selecione um cliente para vender a prazo.</Alert>}
                            <Button size="small" aria-label="Selecionar cliente do pagamento" startIcon={<PersonOutlineRoundedIcon />}
                                disabled={bloqueado} onClick={() => setOpcional("cliente")} sx={{ alignSelf: "flex-start" }}>
                                {rascunho.cliente ? `Cliente: ${rascunho.cliente.nome}` : "Selecionar cliente"}
                            </Button>
                            {t.parcelasPrazo.map((parcela, indice) => <Stack key={indice} spacing={0.5} role="group" aria-label={`Parcela a prazo ${indice + 1}`}>
                                {t.parcelasPrazo.length > 1 && <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                    <Typography variant="caption">Parcela {indice + 1}/{t.parcelasPrazo.length}</Typography>
                                    {t.parcelasPrazo.length > 1 && <Tooltip title="Remover parcela"><IconButton size="small" aria-label={`Remover parcela a prazo ${indice + 1}`} disabled={bloqueado}
                                        onClick={() => alterar({ parcelasPrazo: rascunho.parcelasPrazo?.filter((_, posicao) => posicao !== indice) })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                                </Stack>}
                                <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 105px", gap: 1 }}>
                                <TextField size="small" type="date" label={`Vencimento ${indice + 1}`} value={parcela.vencimento} disabled={bloqueado}
                                    error={!/^\d{4}-\d{2}-\d{2}$/.test(parcela.vencimento) || Number.isNaN(Date.parse(parcela.vencimento))}
                                    helperText={!parcela.vencimento ? "Informe o vencimento." : undefined}
                                    slotProps={{ inputLabel: { shrink: true } }} onChange={e => alterarParcelaPrazo(indice, { vencimento: e.target.value })} />
                                <ValorMonetarioPDV size="small" label="Valor (R$)" value={parcela.valor === "" && t.parcelas.length === 1 && t.parcelasPrazo.length === 1 ? (Math.max(0, t.total) / 100).toFixed(2) : parcela.valor}
                                    disabled={bloqueado} slotProps={{ htmlInput: { "aria-label": `Valor da parcela ${indice + 1} (R$)`, inputMode: "decimal" } }}
                                    onChange={valor => alterarParcelaPrazo(indice, { valor })} />
                                </Box>
                            </Stack>)}
                            <Button size="small" startIcon={<AddRoundedIcon />} sx={{ alignSelf: "flex-start" }} disabled={bloqueado || t.parcelasPrazo.length >= 120}
                                onClick={() => alterar({ parcelasPrazo: [
                                    ...t.parcelasPrazo.map(parcela => ({ valor: parcela.valor === "" ? ((parcela.valorCentavos ?? 0) / 100).toFixed(2) : parcela.valor, vencimento: parcela.vencimento })),
                                    { valor: (Math.max(0, t.restante) / 100).toFixed(2), vencimento: "" },
                                ] })}>Adicionar parcela</Button>
                        </Stack> : p.formaPagamento === "DINHEIRO" && (
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                <Typography variant="caption" color="text.secondary">Aplicado à venda: {moeda(p.valorCentavos ?? 0)}</Typography>
                                {p.troco > 0 && <Stack sx={{ alignItems: "flex-end", flexShrink: 0 }}>
                                    <Typography variant="caption">Troco</Typography>
                                    <Typography aria-label={`Troco do pagamento ${i + 1}`} sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moeda(p.troco)}</Typography>
                                </Stack>}
                            </Stack>
                        )}
                        </Stack>)}
                        <Button size="small" startIcon={<AddRoundedIcon />} sx={{ alignSelf: "flex-start" }} disabled={bloqueado || t.parcelas.length >= 20} onClick={adicionarForma}>Adicionar forma</Button>
                        {t.usaPrazo && <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>A receber</span><Typography aria-label="A receber">{moeda(t.totalPrazo)}</Typography></Stack>}
                    </>
                )}
                </Stack>
                </Box>

            </DialogContent>
                <Stack spacing={1.5} sx={{ flexShrink: 0, bgcolor: "background.paper", p: 2, borderTop: 1, borderColor: "divider" }}>

                {!carregandoConfig && !erroConfig && t.restante !== 0 && <Alert severity={t.restante > 0 ? "warning" : "error"} icon={false} sx={{ py: 0.75, border: 1, borderColor: t.restante > 0 ? "warning.main" : "error.main", "& .MuiAlert-message": { width: "100%" } }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", fontWeight: 700 }}><span>{t.restante > 0 ? "Falta distribuir" : "Valor excedente"}</span><Typography aria-label={t.restante > 0 ? "Falta distribuir" : "Valor excedente"} sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moeda(Math.abs(t.restante))}</Typography></Stack>
                    <Typography variant="caption" sx={{ display: "block" }}>{t.restante > 0 ? "Distribua o restante para confirmar o pagamento." : "Reduza o valor aplicado em uma forma de pagamento."}</Typography>
                </Alert>}
                <PdvActionButton categoria="confirmacao" icone={<ShoppingCartCheckoutRoundedIcon />} aria-label="Confirmar pagamento"
                    ref={confirmarPagamentoRef}
                    disabled={pagarDesabilitado} onClick={() => void confirmarPagamento()}>
                    {salvando ? "Finalizando…" : "Confirmar pagamento"}
                </PdvActionButton>
                <Button disabled={salvando} onClick={fecharPagamento} startIcon={<ArrowBackRoundedIcon />}>Voltar para a venda</Button>
                </Stack>
        </Dialog>
        <SessaoCaixaPDVDialog resolvida={sessaoCaixaResolvida} onResolvida={definirSessaoCaixa} />
        <Dialog open={!!confirmacaoEstoque} fullWidth maxWidth="sm" onClose={() => setConfirmacaoEstoque(null)}
            aria-labelledby="pdv-estoque-titulo" aria-describedby="pdv-estoque-descricao">
            <DialogTitle id="pdv-estoque-titulo">Estoque insuficiente</DialogTitle>
            <DialogContent>
                <Typography id="pdv-estoque-descricao" sx={{ mb: 2 }}>
                    {confirmacaoEstoque?.permitido ? "Confira as quantidades. Continuar poderá deixar o estoque negativo; sua confirmação será registrada."
                        : "A empresa não permite vender com estoque insuficiente. Revise as quantidades ou solicite ao administrador a configuração em Empresas."}
                </Typography>
                <Stack spacing={1}>{confirmacaoEstoque?.itens.map(item => <Box key={item.produtoId}>
                    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{item.nome}</Typography>
                    <Typography color="text.secondary" variant="body2">Disponível: {item.disponivel.toLocaleString("pt-BR")} · Solicitado: {item.solicitada.toLocaleString("pt-BR")}</Typography>
                </Box>)}</Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button autoFocus onClick={() => setConfirmacaoEstoque(null)}>Voltar e revisar</Button>
                {confirmacaoEstoque?.permitido && <Button variant="contained" color="warning" disabled={salvando}
                    onClick={() => { setEstoqueConfirmado(true); setConfirmacaoEstoque(null); }}>Autorizar estoque insuficiente</Button>}
            </DialogActions>
        </Dialog>
        <Dialog open={limpezaAberta} onClose={fecharLimpeza} aria-labelledby="pdv-limpar-titulo">
            <DialogTitle id="pdv-limpar-titulo">Limpar esta venda?</DialogTitle>
            <DialogContent>Os itens e os dados desta venda em andamento serão descartados.</DialogContent>
            <DialogActions><Button onClick={fecharLimpeza}>Voltar</Button><Button onClick={limparVenda} color="error">Limpar venda</Button></DialogActions>
        </Dialog>
        {finalizacao && <VendaFinalizacaoDialog
            open
            estado={finalizacao.estado}
            quantidadeItens={finalizacao.quantidadeItens}
            total={finalizacao.total}
            formaPagamento={finalizacao.formaPagamento}
            troco={finalizacao.troco}
            mensagemErro={finalizacao.mensagemErro}
            onVoltar={fecharFinalizacao}
            onTentarNovamente={finalizacao.podeTentarNovamente ? fecharFinalizacao : undefined} />}
        <Stack component="header" direction="row" aria-label="Topo operacional" sx={{ minHeight: 48, bgcolor: cores.header, color: cores.headerText, px: 1.5, py: 0.75, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minWidth: 0, flexWrap: "wrap" }}>
                <PointOfSaleRoundedIcon sx={{ color: cores.accent, fontSize: 24 }} />
                <Typography component="h1" sx={{ fontSize: 16, fontWeight: 800 }}>Novexa <Box component="span" sx={{ color: cores.headerMuted, fontWeight: 500 }}> / Vender</Box></Typography>
                <Typography variant="caption" sx={{ color: cores.operator, overflowWrap: "anywhere" }}>{sessao?.empresa.nomeFantasia || sessao?.empresa.razaoSocial} · {sessao?.nomeUsuario}
                    {rascunho.sessaoCaixaId !== null && ` · Sessão #${rascunho.sessaoCaixaId}`}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
                <Button size="small" color="inherit" sx={{ fontSize: 12, color: cores.exit, "&.Mui-disabled": { color: cores.disabled } }} startIcon={<DeleteOutlineRoundedIcon />} disabled={bloqueado || !rascunho.itens.length} onClick={() => setLimpezaAberta(true)}>Limpar venda</Button>
                <Button component={Link} to="/dashboard" color="inherit" size="small" sx={{ fontSize: 12, color: cores.exit }} startIcon={<ArrowBackRoundedIcon />} disabled={salvando}>Voltar ao ERP</Button>
            </Stack>
        </Stack>
        {comandos}
        {erro && <Alert severity="error" role="alert">{erro}</Alert>}
        {erroConfig && <Alert severity="error" role="alert">{erroConfig}</Alert>}
        {rascunho.pendente && !salvando && !erro && <Alert severity="info">Finalização pendente de confirmação. Abra o pagamento para consultar o resultado com segurança, sem duplicar a venda.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 320px", xl: "minmax(0, 1fr) 360px" }, gap: 1, p: 1, flex: 1, minHeight: 0, minWidth: 0 }}>
            <Stack spacing={1} sx={{ minHeight: 0, minWidth: 0, display: { xs: "contents", md: "flex" } }}>
                <Box role="group" aria-label="Inclusão de produto" sx={{ order: { xs: 0 }, bgcolor: "background.paper", p: 1.25, border: 1, borderColor: cores.border }}>
                    <Typography variant="caption" sx={{ display: "block", color: cores.title, fontWeight: 800, mb: 1 }}>INCLUSÃO DE PRODUTO</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) 100px", sm: "minmax(0, 1fr) 110px 100px 90px" }, gap: 1, alignItems: "start" }}>
                    <Box sx={{ position: "relative", minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                    <TextField fullWidth size="small" autoFocus inputRef={buscaRef} disabled={!sessaoCaixaResolvida || salvando} value={busca}
                        label="Buscar produto ou ler código de barras" placeholder={carregando ? "Buscando produtos…" : "Nome, código interno ou código de barras"}
                        sx={{ "& input": { fontSize: 14 } }}
                        helperText={avisoBusca || (!busca.trim() ? "Digite nome, código interno ou código de barras." : undefined)}
                        onChange={e => { setBusca(e.target.value); setListaAberta(true); setIndice(0); }}
                        slotProps={{ input: {
                            startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                            endAdornment: <InputAdornment position="end"><Tooltip title="Buscar produtos"><IconButton
                                edge="end" size="small" aria-label="Abrir lista de produtos" aria-expanded={listaAberta}
                                onMouseDown={e => e.preventDefault()} onClick={() => { setListaAberta(aberta => !aberta); setIndice(0); focarBusca(); }}>
                                <ArrowDropDownIcon /></IconButton></Tooltip></InputAdornment>,
                        }, formHelperText: { "aria-live": "polite" }, htmlInput: { role: "combobox", "aria-busy": carregando, "aria-expanded": listaAberta && resultados.length > 0, "aria-controls": "pdv-resultados",
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
                    {listaAberta && !!resultados.length && !bloqueado && <Box id="pdv-resultados" role="listbox" sx={{ position: "absolute", zIndex: 10, top: "100%", width: "100%", maxHeight: 280, overflowY: "auto", bgcolor: "background.paper", border: 1, borderColor: "divider", boxShadow: cores.shadow }}>
                        {resultados.map((p, i) => <Box key={p.id} id={"pdv-opcao-" + i} role="option" aria-selected={i === indice}
                            onMouseDown={e => e.preventDefault()} onClick={() => adicionar(p)} sx={{ p: 1, cursor: "pointer", bgcolor: i === indice ? "action.selected" : undefined, display: "flex", justifyContent: "space-between" }}>
                            <span>{p.nome} <Typography component="span" variant="caption" color="text.secondary">{p.composto ? "Kit/Combo - disponivel: " + p.estoqueAtual + " - " : ""}{p.codigoBarras || p.codigoInterno} · {p.unidadeMedida}</Typography></span>
                            <strong>{moeda(Math.round(p.precoVenda * 100))}</strong>
                        </Box>)}
                    </Box>}
                    {listaAberta && busca.trim() && buscaConcluida && !carregando && !resultados.length && !erroCatalogo && !bloqueado &&
                        <Box sx={{ position: "absolute", zIndex: 10, top: "100%", width: "100%", bgcolor: "background.paper", border: 1, borderColor: "divider", p: 1 }}>
                            <Typography role="status" variant="body2" color="text.secondary">Nenhum produto encontrado para esta busca.</Typography>
                        </Box>}
                    </Box>
                    <Tooltip describeChild title={emInclusao ? "Inclusão de uma unidade; ajuste a quantidade no item adicionado" : itemAtual ? "Quantidade do item selecionado na lista" : "Adicione um item para ajustar sua quantidade"}>
                        <TextField size="small" label="Quantidade" value={emInclusao ? "1" : itemAtual?.quantidade ?? ""} disabled={bloqueado || !emInclusao && !itemAtual}
                            slotProps={{ input: { readOnly: emInclusao }, htmlInput: { "aria-label": "Quantidade do item selecionado", inputMode: "decimal" } }}
                            onFocus={e => { quantidadeAntesRef.current = itemAtual?.quantidade ?? ""; e.target.select(); }}
                            onChange={e => { if (itemAtual) alterar({ itens: rascunho.itens.map(i => i === itemAtual ? { ...i, quantidade: e.target.value } : i) }); }}
                            onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); focarBusca(); }
                                if (e.key === "Escape") {
                                    e.preventDefault(); e.stopPropagation();
                                    if (itemAtual && !emInclusao) alterar({ itens: rascunho.itens.map(i => i === itemAtual ? { ...i, quantidade: quantidadeAntesRef.current } : i) });
                                    focarBusca();
                                }
                            }} />
                    </Tooltip>
                    <TextField size="small" label="Unitário" value={produtoExibido ? moeda(Math.round(produtoExibido.precoVenda * 100)) : ""}
                        slotProps={{ input: { readOnly: true }, htmlInput: { "aria-label": "Unitário do item selecionado" } }} />
                    <Button variant="contained" startIcon={<AddRoundedIcon />} disabled={bloqueado || !busca.trim()} onMouseDown={e => e.preventDefault()} onClick={() => void adicionarPorCodigo()}
                        sx={{ height: 44, px: 1, fontSize: 12, bgcolor: cores.blue, color: pdvTokens.light.headerText, "&:hover": { bgcolor: cores.blueHover } }}>Adicionar</Button>
                    </Box>
                </Box>
                {erroCatalogo && <Alert severity="error" action={<Button onClick={() => { refresh(); focarBusca(); }}>Recarregar</Button>}>{erroCatalogo}</Alert>}
                <Box sx={{ flex: 1, order: { xs: 3 }, minHeight: 120, maxHeight: { xs: 260, md: "none" }, overflow: "auto", border: 1, borderColor: cores.border, bgcolor: cores.rows, backgroundImage: theme.palette.mode === "dark" ? "none" : "linear-gradient(#E2E8F0 1px, transparent 1px)", backgroundSize: "100% 40px" }}>
                    <Table stickyHeader size="small" aria-label="Itens da venda" sx={{ minWidth: { xs: 0, sm: 560 }, display: { xs: "block", sm: "table" },
                        "& td, & th": { py: 0.5, px: 1, height: { xs: "auto", sm: 40 }, fontVariantNumeric: "tabular-nums" },
                        "& th": { bgcolor: cores.tableHead, color: cores.tableHeadText, fontSize: 11, fontWeight: 800 },
                        "& tbody tr": { bgcolor: cores.row, "&:nth-of-type(even)": { bgcolor: cores.alternate } },
                        "& tr.Mui-selected": { bgcolor: cores.selected, "&:hover": { bgcolor: cores.selectedHover }, "& td:first-of-type": { boxShadow: `inset 3px 0 ${cores.blue}` } },
                        "& td": { display: { xs: "block", sm: "table-cell" }, borderBottom: { xs: 0, sm: theme.palette.mode === "dark" ? `1px solid ${cores.border}` : "1px solid" }, borderColor: "divider", minWidth: 0 },
                        "& input": { p: "5px 6px", fontSize: 14, fontWeight: 700 } }}>
                        <TableHead sx={{ display: { xs: "none", sm: "table-header-group" } }}><TableRow><TableCell>Produto</TableCell><TableCell width={150}>Quantidade</TableCell><TableCell align="right">Unitário</TableCell><TableCell align="right">Subtotal</TableCell><TableCell width={42} /></TableRow></TableHead>
                        <TableBody sx={{ display: { xs: "block", sm: "table-row-group" } }}>{rascunho.itens.map((item, i) => <TableRow key={item.produto.id} selected={selecionado === item.produto.id} onClick={() => setSelecionado(item.produto.id)}
                            sx={{ display: { xs: "grid", sm: "table-row" }, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", py: { xs: 1, sm: 0 },
                                borderBottom: { xs: theme.palette.mode === "dark" ? `1px solid ${cores.border}` : 1, sm: 0 }, borderColor: "divider" }}>
                            <TableCell sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, overflowWrap: "anywhere", fontWeight: 600 }}><Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1 }}>{String(i + 1).padStart(2, "0")}</Typography>{item.produto.nome}
                                {item.produto.composto && <Box>
                                    <Typography variant="caption" color="text.secondary">Kit/Combo · disponibilidade: {item.produto.estoqueAtual} {item.produto.unidadeMedida}</Typography>
                                    <Box component="details"><Typography component="summary" variant="caption" sx={{ cursor: "pointer" }}>Consumo previsto dos componentes</Typography>
                                        {item.produto.componentes?.map(c => <Typography key={c.produtoId} variant="caption" sx={{ display: "block" }} color="text.secondary">{c.nome}: {((decimal(item.quantidade, 3) ?? 0) / 1000 * c.quantidadePorKit).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {c.unidade} · disponível {c.estoqueAtual}</Typography>)}
                                    </Box>
                                </Box>}
                            </TableCell>
                            <TableCell sx={{ gridRow: { xs: 3, sm: "auto" }, gridColumn: { xs: 1, sm: "auto" } }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" }, mb: 0.5 }}>Quantidade</Typography>
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                <Tooltip title="Diminuir quantidade"><span><IconButton tabIndex={-1} aria-label={"Diminuir uma unidade: " + item.produto.nome} size="small" disabled={bloqueado || (decimal(item.quantidade, 3) ?? 0) <= 1000}
                                    sx={{ width: 26, height: 28, borderRadius: "4px", bgcolor: cores.removeSurface, color: cores.remove }} onClick={e => { e.stopPropagation(); ajustarQuantidade(item.produto.id, -1); }}><RemoveRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                                <TextField fullWidth size="small" sx={{ "& .MuiInputBase-root": { minHeight: { xs: 44, sm: 0 } } }} value={item.quantidade} disabled={bloqueado}
                                inputRef={(el: HTMLInputElement | null) => { quantidadesRef.current[item.produto.id] = el; }}
                                slotProps={{ htmlInput: { "aria-label": "Quantidade de " + item.produto.nome, inputMode: "decimal" } }}
                                onFocus={e => { quantidadeAntesRef.current = item.quantidade; setSelecionado(item.produto.id); e.target.select(); }}
                                onKeyDown={e => {
                                    if (e.key === "Enter") { e.preventDefault(); focarBusca(); }
                                    if (e.key === "Escape") {
                                        e.preventDefault(); e.stopPropagation();
                                        alterar({ itens: rascunho.itens.map(x => x === item ? { ...x, quantidade: quantidadeAntesRef.current } : x) });
                                        focarBusca();
                                    }
                                }}
                                onChange={e => alterar({ itens: rascunho.itens.map(x => x === item ? { ...x, quantidade: e.target.value } : x) })} />
                                <Tooltip title="Aumentar quantidade"><span><IconButton tabIndex={-1} aria-label={"Aumentar uma unidade: " + item.produto.nome} size="small" disabled={bloqueado || decimal(item.quantidade, 3) === null}
                                    sx={{ width: 26, height: 28, borderRadius: "4px", bgcolor: cores.addSurface, color: cores.add }} onClick={e => { e.stopPropagation(); ajustarQuantidade(item.produto.id, 1); }}><AddRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                                </Stack></TableCell>
                            <TableCell align="right" sx={{ gridRow: { xs: 2, sm: "auto" }, gridColumn: { xs: 1, sm: "auto" }, textAlign: { xs: "left", sm: "right" } }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Unitário</Typography>
                                {moeda(Math.round(item.produto.precoVenda * 100))}</TableCell>
                            <TableCell align="right" sx={{ gridRow: { xs: 2, sm: "auto" }, gridColumn: { xs: 2, sm: "auto" }, fontWeight: { xs: 600, sm: "inherit" } }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>Subtotal</Typography>
                                {subtotalItem(item) === null ? "—" : moeda(subtotalItem(item)!)}</TableCell>
                            <TableCell sx={{ gridRow: { xs: 3, sm: "auto" }, gridColumn: { xs: 2, sm: "auto" }, textAlign: { xs: "right", sm: "left" }, alignSelf: "end" }}>
                                <Tooltip title={"Remover " + item.produto.nome}><IconButton size="small" color="inherit" aria-label={"Remover " + item.produto.nome} disabled={bloqueado}
                                    sx={{ width: { xs: 44, sm: 26 }, height: { xs: 44, sm: 26 } }}
                                    onClick={e => { e.stopPropagation(); remover(item.produto.id); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip></TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                    {!rascunho.itens.length && <Box sx={{ py: 2, px: 1, textAlign: "center", color: "text.secondary", bgcolor: cores.rows }}><Typography variant="body2">Leia o primeiro produto para começar</Typography></Box>}
                </Box>
                <Box sx={{ order: { xs: 4 }, px: 1.5, py: 1, bgcolor: cores.tableHead, borderLeft: `3px solid ${cores.title}`, minWidth: 0 }}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{itemAtual?.produto.nome ?? "Venda em andamento"}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, flexShrink: 0 }}>{itemAtual && subtotalItem(itemAtual) !== null ? moeda(subtotalItem(itemAtual)!) : ""}</Typography></Stack>
                    <Typography variant="caption" color="text.secondary">{itemAtual ? `${itemAtual.produto.codigoInterno || itemAtual.produto.codigoBarras || ""} · ${itemAtual.produto.unidadeMedida} · ` : ""}{rascunho.itens.length} itens · Enter adicionar · Esc fechar opção</Typography>
                </Box>
            </Stack>
            <Stack component="aside" aria-label="Resumo e pagamento" spacing={1} sx={{ bgcolor: "background.paper", border: 1, borderColor: cores.border, p: 1.5, overflow: { xs: "visible", md: "hidden" }, minHeight: 0, minWidth: 0, display: { xs: "contents", md: "flex" } }}>
                <Stack spacing={0.75} sx={{ flexShrink: 0, order: { xs: 1, md: 0 } }}>
                <Typography variant="overline">Resumo da venda · {rascunho.itens.length} itens</Typography>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                    <PersonOutlineRoundedIcon sx={{ color: cores.purple, fontSize: 20 }} />
                    <Typography variant="body2" sx={{ flex: 1, overflowWrap: "anywhere" }}>{rascunho.cliente ? `Cliente: ${rascunho.cliente.nome}` : "Cliente não informado"}</Typography>
                    <Tooltip title="Selecionar cliente · F8"><IconButton aria-label="Selecionar cliente" size="small" disabled={bloqueado} onClick={() => setOpcional("cliente")}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Subtotal</span><span>{moeda(t.subtotal)}</span></Stack>
                {!!t.desconto && <Stack direction="row" sx={{ justifyContent: "space-between" }}><span>Desconto</span><span>− {moeda(t.desconto)}</span></Stack>}
                </Stack>
                <Stack spacing={1.5} sx={{ mt: { md: "auto !important" }, order: { xs: 6, md: 0 }, position: { xs: "sticky", md: "static" }, bottom: 0, zIndex: 2, bgcolor: "background.paper", p: { xs: 1, md: 0 }, borderTop: 1, borderColor: "divider" }}>
                <Box sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography variant="body2" color="text.secondary">Total da venda</Typography><Typography aria-label="Total da venda" sx={{ fontSize: 40, lineHeight: 1.25, fontWeight: 800, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere", color: cores.total }}>{moeda(Math.max(0, t.total))}</Typography></Box>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>Revise os itens e o total. Escolha o pagamento na próxima etapa.</Typography>
                    <PdvActionButton categoria="confirmacao" icone={<ShoppingCartCheckoutRoundedIcon />} atalho="F2"
                        aria-label="Finalizar venda · F2" disabled={revisaoDesabilitada} onClick={abrirPagamento}>Finalizar venda</PdvActionButton>
                </Stack>
            </Stack>
        </Box>
        <Dialog open={opcional !== null} onClose={fecharOpcional} disableRestoreFocus fullWidth maxWidth="sm" aria-labelledby="pdv-opcional-titulo">
            <DialogTitle id="pdv-opcional-titulo">{opcional === "cliente" ? "Cliente" : opcional === "desconto" ? "Desconto" : opcional === "entrega" ? "Entrega" : "Observações"}</DialogTitle>
            <DialogContent sx={{ pt: "12px !important" }}>
                {opcional === "cliente" && <ClienteAutocomplete value={rascunho.cliente} disabled={bloqueado} inputRef={registrarOpcional}
                    onChange={cliente => { alterar({ cliente }); setOpcional(null); if (!pagamentoAberto) focarBusca(); }} />}
                {opcional && opcional !== "cliente" && <TextField fullWidth inputRef={registrarOpcional} disabled={bloqueado}
                    label={opcional === "desconto" ? "Desconto em R$" : opcional === "entrega" ? "Endereço / instruções de entrega" : "Observações"}
                    value={rascunho[opcional]} multiline={opcional !== "desconto"} minRows={opcional !== "desconto" ? 2 : undefined}
                    slotProps={{ htmlInput: { maxLength: opcional === "entrega" ? 500 : opcional === "observacoes" ? 2000 : 12 } }}
                    onChange={e => alterar({ [opcional]: e.target.value })} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setOpcional(null); focarBusca(); } }} />}
            </DialogContent>
            <DialogActions><Button onClick={fecharOpcional}>Concluir</Button></DialogActions>
        </Dialog>
    </Box>;
}
