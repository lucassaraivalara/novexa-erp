import { formatarDataHora } from "../../utils/dataHora";
import { consultarConfiguracaoRecebimentos, type ConfiguracaoRecebimentos } from "../../services/configuracaoRecebimentosService";
import { conferenciaMeios } from "./conferenciaMeios";
import ConferenciaMeiosPagamento from "./ConferenciaMeiosPagamento";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import axios from "axios";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Alert, alpha, Box, Button, Checkbox, FormControlLabel, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer,
    FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import {
    adicionarMovimentacao, buscarCaixa, buscarDetalheSessao, buscarResumoSessao, fecharSessaoCaixa,
    inativarCaixa, listarCaixas, listarMovimentacoes, listarSessoesAbertas, listarSessoesFechadas,
    mensagemCaixa,
} from "../../services/caixaService";
import { listarVendasSessao } from "../../services/vendaService";
import EntregaCofreCampos from "./EntregaCofreCampos";
import { novaEntregaCofre, lerEntregaCofre, centavosDinheiro } from "./cofreFormulario";
import type {
    CaixaCompleta, CaixaResumo, ResumoSessaoCaixa, SessaoCaixaAberta,
    SessaoCaixaHistorico, SessaoCaixaDetalhe,
} from "../../types/caixa";
import CaixaForm from "./CaixaForm";
import AberturaCaixaDialog from "./AberturaCaixaDialog";
import { criarTimeline, type ItemTimeline } from "./caixaTimeline";
import { podeExecutarAcaoGerencial, podeFecharSessao } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const intervaloAtualizacaoSessao = 2000;
const dinheiro = (valor: number | null | undefined) => moeda.format(valor ?? 0);
const data = formatarDataHora;
const valorDecimal = (texto: string) => {
    const valor = centavosDinheiro(texto);
    return valor === null ? null : valor / 100;
};
const valorEditavel = (valor: number) => valor.toFixed(2).replace(".", ",");
const chave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const rotuloMovimentacao: Record<string, string> = {
    ABERTURA: "Abertura", VENDA: "Venda", VENDA_CANCELADA: "Venda cancelada",
    SUPRIMENTO: "Suprimento", SANGRIA: "Sangria", ESTORNO_VENDA: "Cancelamento de venda", FECHAMENTO: "Fechamento",
};

type ModalMovimento = "SUPRIMENTO" | "SANGRIA" | null;
export default function Caixa() {
    const usuarioAtual = obterSessao();
    const podeMovimentar = podeExecutarAcaoGerencial(usuarioAtual?.perfil);
    const [aba, setAba] = useState(0);
    const [destinarAoCofre, setDestinarAoCofre] = useState(false);
    const [entregaCofre, setEntregaCofre] = useState(novaEntregaCofre);
    const [chaveMovimento, setChaveMovimento] = useState(chave);
    const [abertas, setAbertas] = useState<SessaoCaixaAberta[]>([]);
    const [sessaoId, setSessaoId] = useState<number | null>(null);
    const [resumo, setResumo] = useState<ResumoSessaoCaixa | null>(null);
    const [timeline, setTimeline] = useState<ItemTimeline[]>([]);
    const [historico, setHistorico] = useState<SessaoCaixaHistorico[]>([]);
    const [paginaHistorico, setPaginaHistorico] = useState(0);
    const [porPaginaHistorico, setPorPaginaHistorico] = useState(10);
    const [caixas, setCaixas] = useState<CaixaResumo[]>([]);
    const [situacaoCadastros, setSituacaoCadastros] = useState("ativos");
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [erroModal, setErroModal] = useState("");
    const [modalMovimento, setModalMovimento] = useState<ModalMovimento>(null);
    const [modalAbertura, setModalAbertura] = useState(false);
    const [modalFechamento, setModalFechamento] = useState(false);
    const [valoresConferidos, setValoresConferidos] = useState<Record<string, string>>({});
    const [politicaFechamento, setPoliticaFechamento] = useState<ConfiguracaoRecebimentos | null>(null);
    const [erroPolitica, setErroPolitica] = useState("");
    const [totalConferido, setTotalConferido] = useState("");
    useEffect(() => {
        if (!modalFechamento) return;
        const controller = new AbortController();
        consultarConfiguracaoRecebimentos(controller.signal).then(p => { if (!controller.signal.aborted) setPoliticaFechamento(p); })
            .catch(e => { if (!controller.signal.aborted) setErroPolitica(mensagemCaixa(e, "Não foi possível carregar a configuração. Feche e abra a conferência para tentar novamente.")); });
        return () => controller.abort();
    }, [modalFechamento]);
    const [observacaoFechamento, setObservacaoFechamento] = useState("");
    const [detalhe, setDetalhe] = useState<SessaoCaixaHistorico | null>(null);
    const [drawerDetalhe, setDrawerDetalhe] = useState<SessaoCaixaDetalhe | null>(null);
    const [drawerCarregando, setDrawerCarregando] = useState(false);
    const [drawerErro, setDrawerErro] = useState("");
    const [gerenciando, setGerenciando] = useState(false);
    const [editor, setEditor] = useState<{ caixa: CaixaCompleta | null } | null>(null);
    const [processando, setProcessando] = useState(false);
    const [saldo, setSaldo] = useState("");
    const [observacao, setObservacao] = useState("");
    const fechamentoEmAndamento = useRef(false);
    const erroFechamento = useRef<HTMLDivElement>(null);

    useEffect(() => { if (modalFechamento && erroModal) erroFechamento.current?.focus(); }, [modalFechamento, erroModal]);

    const sessaoAtual = abertas.find((sessao) => sessao.sessaoId === sessaoId) ?? null;

    function carregar(signal?: AbortSignal) {
        return Promise.all([
            listarSessoesAbertas(signal), listarCaixas(signal), listarSessoesFechadas(signal),
        ]).then(([sessoes, cadastros, fechadas]) => {
            if (signal?.aborted) return;
            setAbertas(sessoes);
            setCaixas(cadastros);
            setHistorico(fechadas);
            setSessaoId((atual) => sessoes.some((sessao) => sessao.sessaoId === atual) ? atual : sessoes[0]?.sessaoId ?? null);
            if (sessoes.length === 0) { setResumo(null); setTimeline([]); }
        }).catch((e) => {
            if (!signal?.aborted) setErro(mensagemCaixa(e, "Não foi possível carregar o Caixa operacional."));
        }).finally(() => {
            if (!signal?.aborted) setCarregando(false);
        });
    }

    function recarregar() {
        setCarregando(true);
        setErro("");
        return carregar();
    }

    async function carregarSessao(id: number, signal?: AbortSignal) {
        const [novoResumo, movimentos, vendas] = await Promise.all([
            buscarResumoSessao(id, signal), listarMovimentacoes(id, signal), listarVendasSessao(id, signal),
        ]);
        if (signal?.aborted) return;
        setResumo(novoResumo);
        setTimeline(criarTimeline(movimentos, vendas));
    }

    useEffect(() => {
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (sessaoId === null) return;
        const controller = new AbortController();
        const atualizar = () => carregarSessao(sessaoId, controller.signal).catch((e) => {
            if (!controller.signal.aborted) setErro(mensagemCaixa(e, "Não foi possível carregar o resumo do Caixa."));
        });
        void atualizar();
        const intervalo = window.setInterval(() => void atualizar(), intervaloAtualizacaoSessao);
        return () => { controller.abort(); window.clearInterval(intervalo); };
    }, [sessaoId]);

    useEffect(() => {
        if (detalhe === null) return;
        const controller = new AbortController();
        buscarDetalheSessao(detalhe.sessaoId, controller.signal).then((resultado) => {
            if (controller.signal.aborted) return;
            setDrawerDetalhe(resultado);
        }).catch((e) => {
            if (!controller.signal.aborted) setDrawerErro(mensagemCaixa(e, "Não foi possível carregar o detalhe da sessão."));
        }).finally(() => {
            if (!controller.signal.aborted) setDrawerCarregando(false);
        });
        return () => controller.abort();
    }, [detalhe]);

    function abrirDetalhe(sessao: SessaoCaixaHistorico) {
        setDrawerDetalhe(null);
        setDrawerErro("");
        setDrawerCarregando(true);
        setDetalhe(sessao);
    }

    async function executar(acao: () => Promise<void>, mensagem: string, atualizarSessaoId?: number | null) {
        setProcessando(true); setErroModal("");
        try {
            await acao();
            await recarregar();
            if (atualizarSessaoId !== null && atualizarSessaoId !== undefined) await carregarSessao(atualizarSessaoId);
        } catch (e) {
            setErroModal(e instanceof Error && !("isAxiosError" in e) ? e.message : mensagemCaixa(e, mensagem));
        } finally {
            setProcessando(false);
        }
    }

    async function movimentar(evento: FormEvent) {
        evento.preventDefault();
        const valor = valorDecimal(saldo);
        if (sessaoId === null || modalMovimento === null || valor === null || valor === 0) { setErroModal("Informe um valor positivo válido."); return; }
        await executar(async () => {
            await adicionarMovimentacao(sessaoId, { chaveRequisicao: chaveMovimento, tipo: modalMovimento, valor, observacao: observacao.trim() || null,
                ...(destinarAoCofre && modalMovimento === "SANGRIA" ? { cofre: lerEntregaCofre(entregaCofre, valor) } : {}) });
            setModalMovimento(null); setSaldo(""); setObservacao("");
        }, "Não foi possível registrar a movimentação.", sessaoId);
    }

    async function fechar(evento: FormEvent) {
        evento.preventDefault();
        if (fechamentoEmAndamento.current) return;
        const final = valorDecimal(saldo);
        if (sessaoAtual === null || sessaoId === null || final === null) { setErroModal("Informe um valor final válido."); return; }
        if (!politicaFechamento) { setErroModal("Aguarde a configuração do fechamento."); return; }
        if (conferencia.invalido || formasIncompletas) { setErroModal("Informe o valor conferido para todas as formas de pagamento."); return; }
        if (temDiferencaFechamento && observacaoFechamento.trim() === "") { setErroModal("Informe uma observação para confirmar a divergência."); return; }
        fechamentoEmAndamento.current = true;
        setProcessando(true); setErroModal("");
        try {
            const cofre = lerEntregaCofre(entregaCofre);
            if (Math.round((cofre.valor + cofre.valorTroco) * 100) !== Math.round(final * 100))
                throw new Error("Troco mantido mais recolhimento ao cofre devem corresponder ao dinheiro contado.");
            if (cofre.valor > 0 && (!cofre.contaCofreId || !cofre.responsavel))
                throw new Error("Informe cofre e responsável pelo recebimento.");
            await fecharSessaoCaixa(sessaoAtual.caixaId, sessaoId, { saldoFinal: final, conferenciaMeios: conferencia.pedido(observacaoFechamento), cofre });
            setModalFechamento(false); setSaldo(""); setObservacaoFechamento(""); setValoresConferidos({});
            await recarregar();
        } catch (e) {
            if (axios.isAxiosError(e) && e.response?.status === 409) {
                setErroModal(`${mensagemCaixa(e, "O resumo do Caixa mudou.")} Atualize o resumo e confira os valores novamente.`);
                await carregarSessao(sessaoId).catch(() => {});
            } else {
                const mensagem = e instanceof Error && !("isAxiosError" in e) ? e.message : mensagemCaixa(e, "Não foi possível fechar o Caixa.");
                setErroModal(/^Requisi[çc][ãa]o inv[áa]lida\.?$/i.test(mensagem)
                    ? "Não foi possível confirmar o fechamento. Revise o dinheiro contado, a destinação e os valores conferidos; para recolhimento, informe cofre e responsável." : mensagem);
            }
        } finally {
            fechamentoEmAndamento.current = false;
            setProcessando(false);
        }
    }

    function informarDinheiroContado(texto: string) {
        setSaldo(texto);
        const contado = centavosDinheiro(texto);
        if (contado === null) return;
        setEntregaCofre(atual => {
            const troco = Math.min(centavosDinheiro(atual.troco) ?? 0, contado);
            return { ...atual, troco: valorEditavel(troco / 100), valor: valorEditavel((contado - troco) / 100) };
        });
    }

    async function editar(id: number) {
        try { setEditor({ caixa: await buscarCaixa(id) }); }
        catch (e) { setErro(mensagemCaixa(e, "Não foi possível abrir o caixa.")); }
    }

    async function inativar(caixa: CaixaResumo) {
        if (!window.confirm(`Tem certeza que deseja inativar o caixa "${caixa.descricao}"?`)) return;
        try { await inativarCaixa(caixa.id); setCaixas((atuais) => atuais.map((atual) => atual.id === caixa.id ? { ...atual, ativo: false } : atual)); }
        catch (e) { setErro(mensagemCaixa(e, "Não foi possível inativar o caixa.")); }
    }

    function salvo(caixa: CaixaCompleta) {
        setCaixas((atuais) => atuais.some((atual) => atual.id === caixa.id) ? atuais.map((atual) => atual.id === caixa.id ? caixa : atual) : [...atuais, caixa]);
        setEditor(null);
    }

    const colunasCadastro: Coluna<CaixaResumo>[] = [
        { campo: "id", cabecalho: "Código", largura: 90 }, { campo: "descricao", cabecalho: "Descrição" },
        { campo: "ativo", cabecalho: "Ativo", render: (valor) => <Chip size="small" label={valor ? "Sim" : "Não"} color={valor ? "success" : "default"} variant="outlined" /> },
    ];
    const acoesCadastro: AcaoTabela<CaixaResumo>[] = [
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: (caixa) => void editar(caixa.id), tooltip: "Editar caixa" },
        { rotulo: "Inativar", icone: <BlockRoundedIcon fontSize="small" />, onClick: (caixa) => void inativar(caixa), desabilitado: (caixa) => !caixa.ativo, cor: "error", tooltip: "Inativar caixa" },
    ];
    const caixasAtivos = caixas.filter((caixa) => caixa.ativo);
    const caixasFiltrados = caixas.filter((caixa) =>
        situacaoCadastros === "todos" || caixa.ativo === (situacaoCadastros === "ativos"));
    const paginaHistoricoAtual = Math.min(paginaHistorico, Math.max(0, Math.ceil(historico.length / porPaginaHistorico) - 1));
    const historicoPagina = historico.slice(paginaHistoricoAtual * porPaginaHistorico, paginaHistoricoAtual * porPaginaHistorico + porPaginaHistorico);
    const saldoFinalInformado = valorDecimal(saldo);
    const diferencaFechamento = resumo && saldoFinalInformado !== null ? saldoFinalInformado - resumo.saldoEsperadoDinheiro : null;
    const temDiferencaDinheiro = diferencaFechamento !== null && Math.abs(diferencaFechamento) >= 0.005;
    const vendasEmDinheiro = resumo?.totaisPorFormaPagamento
        .filter((forma) => forma.tipo === "DINHEIRO")
        .reduce((total, forma) => total + forma.total, 0) ?? 0;
    const conferencia = conferenciaMeios(resumo, politicaFechamento, valoresConferidos, totalConferido);
    const formasIncompletas = conferencia.incompleto;
    const temDiferencaFormas = conferencia.divergencia;
    const temDiferencaFechamento = temDiferencaDinheiro || temDiferencaFormas;
    const valorTroco = centavosDinheiro(entregaCofre.troco), valorRecolhido = centavosDinheiro(entregaCofre.valor);
    const destinacaoCompleta = saldoFinalInformado !== null && valorTroco !== null && valorRecolhido !== null
        && valorTroco + valorRecolhido === Math.round(saldoFinalInformado * 100);
    const podeFechar = politicaFechamento !== null && saldoFinalInformado !== null && destinacaoCompleta && !conferencia.invalido && !formasIncompletas && (!temDiferencaFechamento || observacaoFechamento.trim() !== "");

    return <PageContainer>
        <PageHeader titulo="Caixas" descricao="Sessões e dinheiro do caixa físico. Saldos e extratos de contas financeiras ficam em Contas e saldos."
            acaoPrincipal={<Button variant="contained" startIcon={<AccountBalanceWalletRoundedIcon />} onClick={() => setModalAbertura(true)} disabled={abertas.length > 0}>Abrir Caixa</Button>}
            acoesSecundarias={<Button variant="outlined" startIcon={<SettingsRoundedIcon />} onClick={() => setGerenciando(true)}>Cadastro de caixas</Button>} />
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void recarregar()}>Tentar novamente</Button>}>{erro}</Alert>}
        <Paper variant="outlined"><Tabs value={aba} onChange={(_, valor) => setAba(valor)} aria-label="Sessões do caixa físico" variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44 }}><Tab id="caixa-atual-tab" aria-controls="caixa-atual-painel" label="Caixa Atual" sx={{ minHeight: 44, py: 1 }} /><Tab id="caixas-anteriores-tab" aria-controls="caixas-anteriores-painel" label="Caixas Anteriores" sx={{ minHeight: 44, py: 1 }} /></Tabs></Paper>
        {aba === 0 && (carregando ? <Skeleton variant="rounded" height={300} /> : abertas.length === 0 ? <Box id="caixa-atual-painel" role="tabpanel" aria-labelledby="caixa-atual-tab"><Vazio onAbrir={() => setModalAbertura(true)} /></Box> : resumo === null ? <Skeleton variant="rounded" height={300} /> : <Box id="caixa-atual-painel" role="tabpanel" aria-labelledby="caixa-atual-tab"><Atual abertas={abertas} sessaoId={sessaoId} onSessao={setSessaoId} resumo={resumo} timeline={timeline} podeMovimentar={podeMovimentar} podeFechar={podeFecharSessao(usuarioAtual?.perfil, usuarioAtual?.id, resumo.operadorAbertura.id)} onSuprimento={() => { setErroModal(""); setDestinarAoCofre(false); setEntregaCofre(novaEntregaCofre()); setChaveMovimento(chave()); setModalMovimento("SUPRIMENTO"); }} onSangria={() => { setErroModal(""); setDestinarAoCofre(false); setEntregaCofre(novaEntregaCofre()); setChaveMovimento(chave()); setModalMovimento("SANGRIA"); }} onFechar={() => { setErroModal(""); setObservacaoFechamento(""); setValoresConferidos({}); setDestinarAoCofre(false); setSaldo(""); setEntregaCofre({ ...novaEntregaCofre(), troco: valorEditavel(Math.min(resumo.saldoInicial, Math.max(0, resumo.saldoEsperadoDinheiro))), valor: valorEditavel(Math.max(0, resumo.saldoEsperadoDinheiro - resumo.saldoInicial)) }); setChaveMovimento(chave()); setPoliticaFechamento(null); setErroPolitica(""); setTotalConferido(""); setModalFechamento(true); }} /></Box>)}
        {aba === 1 && <Box id="caixas-anteriores-painel" role="tabpanel" aria-labelledby="caixas-anteriores-tab"><AppTable colunas={[
            { campo: "descricaoCaixa", cabecalho: "Caixa", largura: 180 }, { campo: "dataHoraAbertura", cabecalho: "Abertura", largura: 170, render: (valor) => data(valor as string) },
            { campo: "dataHoraFechamento", cabecalho: "Fechamento", largura: 170, render: (valor) => data(valor as string | null) }, { campo: "operadorAbertura.nome", cabecalho: "Operador", largura: 180 },
            { campo: "saldoInicial", cabecalho: "Saldo inicial", alinhar: "right", render: (valor) => dinheiro(valor as number) }, { campo: "totalVendas", cabecalho: "Vendas", alinhar: "right", render: (valor) => dinheiro(valor as number) },
            { campo: "dinheiroEsperado", cabecalho: "Esperado", alinhar: "right", render: (valor) => dinheiro(valor as number) }, { campo: "valorInformado", cabecalho: "Informado", alinhar: "right", render: (valor) => dinheiro(valor as number | null) },
            { campo: "diferenca", cabecalho: "Diferença", alinhar: "right", render: (valor) => <Typography color={(valor as number | null) === 0 ? "success.main" : "error.main"} sx={{ fontWeight: 700 }}>{dinheiro(valor as number | null)}</Typography> },
        ]} linhas={historicoPagina} carregando={carregando} obterChaveLinha={(sessao) => sessao.sessaoId} minWidth={1100} alturaCorpo={480} linhaCliqueavel onLinhaClick={abrirDetalhe}
            acoes={[{ rotulo: "Ver detalhes", icone: <VisibilityRoundedIcon fontSize="small" />, onClick: abrirDetalhe, tooltip: "Ver detalhes da sessão" }]}
            vazio={{ titulo: "Nenhuma sessão encerrada", descricao: "As sessões fechadas aparecerão aqui." }} paginacao={{
            pagina: paginaHistoricoAtual,
            linhasPorPagina: porPaginaHistorico,
            total: historico.length,
            onPageChange: setPaginaHistorico,
            onRowsPerPageChange: (valor) => { setPorPaginaHistorico(valor); setPaginaHistorico(0); },
            opcoesLinhasPorPagina: [10, 25, 50],
        }} /></Box>}

        {modalAbertura && <AberturaCaixaDialog caixasAtivos={caixasAtivos} onClose={() => setModalAbertura(false)} onSucesso={() => { setModalAbertura(false); void recarregar(); }} />}
        <Dialog open={modalMovimento !== null} fullWidth maxWidth="xs" aria-labelledby="caixa-movimento-titulo" onClose={() => !processando && setModalMovimento(null)}><form onSubmit={movimentar}><DialogTitle id="caixa-movimento-titulo">{modalMovimento === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{erroModal && <Alert severity="error">{erroModal}</Alert>}<TextField required autoFocus name="valor" autoComplete="off" label="Valor (R$)" value={saldo} onChange={(e) => setSaldo(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} />{modalMovimento === "SANGRIA" && <><FormControlLabel control={<Checkbox checked={destinarAoCofre} disabled={processando} onChange={e => setDestinarAoCofre(e.target.checked)} />} label="Destino desta sangria: COFRE" />
                {destinarAoCofre && <EntregaCofreCampos value={entregaCofre} onChange={setEntregaCofre} disabled={processando} valorFixo={valorDecimal(saldo) ?? 0} />}</>}
                <TextField name="observacao" autoComplete="off" label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} /></Stack></DialogContent><DialogActions><Button type="button" onClick={() => setModalMovimento(null)}>Cancelar</Button><Button type="submit" variant="contained" disabled={processando}>{processando ? "Registrando…" : "Confirmar"}</Button></DialogActions></form></Dialog>
        <Dialog open={modalFechamento} fullWidth maxWidth="md" aria-labelledby="caixa-fechamento-titulo" aria-describedby="caixa-fechamento-descricao" onClose={() => { if (!processando) { setObservacaoFechamento(""); setModalFechamento(false); } }}
            slotProps={{ paper: { sx: { m: { xs: 1, md: 3 }, width: "calc(100% - 16px)", maxHeight: "calc(100dvh - 32px)", borderRadius: 2 } } }}>
            <Box component="form" onSubmit={fechar} sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                <DialogTitle id="caixa-fechamento-titulo" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
                    <Box><Typography component="span" variant="h5" sx={{ fontWeight: 700 }}>Fechamento de caixa</Typography>
                        <Typography variant="body2" color="text.secondary">PDV Novexa · Sessão #{sessaoId} · {resumo?.descricaoCaixa}</Typography></Box>
                    <IconButton aria-label="Fechar conferência de caixa" disabled={processando} onClick={() => { setObservacaoFechamento(""); setModalFechamento(false); }}><CloseRoundedIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 2, minHeight: 0, overscrollBehavior: "contain" }}>
                    <Stack spacing={1.5}>
                        {erroModal && <Alert ref={erroFechamento} tabIndex={-1} severity="error">{erroModal}</Alert>}
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, .9fr) minmax(0, 1fr)" }, gap: 2 }}>
                            <Box component="section" aria-label="Resumo da sessão" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: theme => alpha(theme.palette.primary.main, .06), minWidth: 0 }}>
                                <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>Resumo da sessão</Typography>
                                {resumo && <Box component="dl" sx={{ m: 0, display: "grid", gap: .75 }}>
                                    {[["Saldo inicial", resumo.saldoInicial, "text.primary"], ["Vendas em dinheiro", vendasEmDinheiro, "text.primary"],
                                        ["Suprimentos", resumo.suprimentos, "success.main"], ["Sangrias", resumo.sangrias, "error.main"]].map(([rotulo, valor, cor]) =>
                                        <Stack key={String(rotulo)} direction="row" sx={{ gap: 1, justifyContent: "space-between" }}>
                                            <Typography component="dt" variant="body2">{rotulo}</Typography><Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 700, color: cor, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{dinheiro(Number(valor))}</Typography>
                                        </Stack>)}
                                </Box>}
                                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                                    <Typography variant="subtitle2">Dinheiro esperado</Typography><Typography aria-label="Dinheiro esperado" sx={{ fontSize: 32, lineHeight: 1.25, fontWeight: 800, color: "primary.main", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{dinheiro(resumo?.saldoEsperadoDinheiro)}</Typography>
                                </Box>
                            </Box>
                            <Box component="section" aria-label="Conferência do dinheiro" sx={{ py: 1, minWidth: 0 }}>
                            <Typography component="h3" variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>Conferência do dinheiro</Typography>
                            <Typography id="caixa-fechamento-descricao" variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Informe o valor físico contado no caixa.</Typography>
                            <TextField id="input-saldoFinal" required autoFocus fullWidth name="saldoFinal" autoComplete="off" label="Dinheiro físico contado (R$)" value={saldo}
                                disabled={processando} onChange={(e) => informarDinheiroContado(e.target.value)}
                                slotProps={{ htmlInput: { inputMode: "decimal", "aria-describedby": "caixa-fechamento-descricao" } }} />
                            <Box role="status" aria-live="polite" sx={{ mt: 1.5, borderRadius: 1.5, bgcolor: theme => alpha(temDiferencaDinheiro ? theme.palette.warning.main : theme.palette.primary.main, .06), p: 1.5 }}>
                                {diferencaFechamento === null ? <Typography variant="body2">Informe o dinheiro contado para conferir a diferença.</Typography>
                                    : <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                                        {temDiferencaDinheiro ? <BlockRoundedIcon color="warning" /> : <CheckCircleOutlineRoundedIcon color="primary" />}
                                        <Box><Typography variant="subtitle2">{temDiferencaDinheiro ? diferencaFechamento > 0 ? "Sobra de dinheiro" : "Falta de dinheiro" : "Diferença de caixa"}</Typography>
                                            <Typography aria-label="Diferença de caixa" sx={{ fontSize: 28, fontWeight: 800, color: temDiferencaDinheiro ? "text.primary" : "primary.main", fontVariantNumeric: "tabular-nums" }}>{diferencaFechamento > 0 ? "+ " : ""}{dinheiro(diferencaFechamento)}</Typography>
                                        </Box>
                                    </Stack>}
                            </Box>
                            </Box>
                        </Box>
                        <Box><Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>Destino do dinheiro contado</Typography>
                            <Typography variant="body2" color="text.secondary">Distribua o valor entre o troco da próxima abertura e o recolhimento ao cofre.</Typography></Box>
                        <EntregaCofreCampos value={entregaCofre} onChange={setEntregaCofre} disabled={processando} valorContado={saldoFinalInformado} />
                        {erroPolitica && <Alert severity="error">{erroPolitica}</Alert>}
                        {!politicaFechamento && !erroPolitica && <Typography role="status">Carregando configuração do fechamento…</Typography>}
                        {politicaFechamento && (conferencia.porTotal || conferencia.linhas.length > 0) && <ConferenciaMeiosPagamento politica={politicaFechamento} conferencia={conferencia}
                            valores={valoresConferidos} total={totalConferido} onTotal={setTotalConferido} disabled={processando}
                            onValor={(chave, valor) => setValoresConferidos(atuais => ({ ...atuais, [chave]: valor }))} />}
                        {temDiferencaFechamento && <TextField required multiline minRows={2} fullWidth name="observacaoFechamento" autoComplete="off"
                            label="Observação da divergência" value={observacaoFechamento} onChange={(e) => setObservacaoFechamento(e.target.value)}
                            helperText="Obrigatório: descreva a sobra ou falta identificada para concluir o fechamento com divergência."
                            slotProps={{ htmlInput: { maxLength: 500 } }} />}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1.5, borderTop: 1, borderColor: "divider", flexShrink: 0, flexDirection: { xs: "column-reverse", sm: "row" }, "& > :not(style) ~ :not(style)": { ml: 0 } }}>
                    <Button fullWidth type="button" variant="outlined" startIcon={<ArrowBackRoundedIcon />} sx={{ minHeight: 48 }} onClick={() => { setObservacaoFechamento(""); setModalFechamento(false); }} disabled={processando}>Cancelar</Button>
                    <Button fullWidth type="submit" variant="contained" startIcon={<CheckRoundedIcon />} sx={{ minHeight: 48 }} disabled={processando || !podeFechar}>
                        {processando ? "Fechando…" : temDiferencaFechamento ? "Confirmar fechamento com divergência" : "Confirmar fechamento"}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
        <Drawer anchor="right" open={detalhe !== null} onClose={() => setDetalhe(null)} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 540 } } } }}>
            {detalhe && <Box role="dialog" aria-labelledby="caixa-detalhe-titulo" sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <Box sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                    <Box>
                        <Typography id="caixa-detalhe-titulo" variant="h6">{detalhe.descricaoCaixa}</Typography>
                        <Typography variant="body2" color="text.secondary">Sessão #{detalhe.sessaoId}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Chip size="small" label="Fechado" variant="outlined" />
                        <IconButton aria-label="Fechar detalhe da sessão" onClick={() => setDetalhe(null)}><CloseRoundedIcon fontSize="small" /></IconButton>
                    </Stack>
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
                    <Stack spacing={3}>
                        {drawerErro && <Alert severity="error">{drawerErro}</Alert>}
                        {drawerCarregando && <Skeleton variant="rounded" height={120} />}
                        <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, m: 0 }}>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Abertura</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{data(detalhe.dataHoraAbertura)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Fechamento</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{data(detalhe.dataHoraFechamento)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Operador de abertura</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{detalhe.operadorAbertura.nome}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Operador de fechamento</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{detalhe.operadorFechamento?.nome ?? "—"}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Saldo inicial</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.saldoInicial)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Total de vendas</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.totalVendas)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Suprimentos</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{drawerDetalhe ? dinheiro(drawerDetalhe.resumo.suprimentos) : "—"}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Sangrias</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{drawerDetalhe ? dinheiro(drawerDetalhe.resumo.sangrias) : "—"}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Saldo esperado</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.dinheiroEsperado)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Saldo informado</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.valorInformado)}</Typography></Box>
                        </Box>
                        {drawerDetalhe && <Box component="section" aria-labelledby="origem-abertura-titulo">
                            <Typography id="origem-abertura-titulo" variant="subtitle1" component="h3" sx={{ fontWeight: 700, mb: 1 }}>Composição da abertura</Typography>
                            {drawerDetalhe.composicaoAbertura ? <Stack spacing={1} sx={{ overflowWrap: "anywhere" }}>
                                {drawerDetalhe.composicaoAbertura.sessaoOrigemTrocoId && <Typography variant="body2">{dinheiro(drawerDetalhe.composicaoAbertura.valorTrocoHerdado)} · Troco herdado da sessão #{drawerDetalhe.composicaoAbertura.sessaoOrigemTrocoId} · {data(drawerDetalhe.composicaoAbertura.dataFechamentoOrigem)}</Typography>}
                                {drawerDetalhe.composicaoAbertura.contaCofreId && <Typography variant="body2">{dinheiro(drawerDetalhe.composicaoAbertura.valorRetiradoCofre)} · Retirada do {drawerDetalhe.composicaoAbertura.contaCofreNome} · movimento #{drawerDetalhe.composicaoAbertura.movimentoFinanceiroId}</Typography>}
                                {drawerDetalhe.composicaoAbertura.valorAporteExterno > 0 && <Typography variant="body2">{dinheiro(drawerDetalhe.composicaoAbertura.valorAporteExterno)} · Aporte externo. Motivo: {drawerDetalhe.composicaoAbertura.observacaoAporte}</Typography>}
                                <Typography variant="caption" color="text.secondary">Confirmada por {drawerDetalhe.composicaoAbertura.operadorAbertura} em {data(drawerDetalhe.composicaoAbertura.dataCriacao)}</Typography>
                            </Stack> : <Typography variant="body2" color="text.secondary">Abertura legada sem composição de origens registrada.</Typography>}
                        </Box>}
                        <Box sx={{ borderLeft: 3, borderColor: !detalhe.diferenca ? "success.main" : "warning.main", bgcolor: "action.hover", px: 2, py: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">Diferença</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{dinheiro(detalhe.diferenca)}</Typography>
                        </Box>

                        <Divider />
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Conferência do fechamento</Typography>
                            <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.5, m: 0 }}>
                                <Box><Typography component="dt" variant="caption" color="text.secondary">Esperado</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.dinheiroEsperado)}</Typography></Box>
                                <Box><Typography component="dt" variant="caption" color="text.secondary">Informado</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.valorInformado)}</Typography></Box>
                                <Box><Typography component="dt" variant="caption" color="text.secondary">Diferença</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(detalhe.diferenca)}</Typography></Box>
                            </Box>
                            {drawerDetalhe?.modalidadeConferencia === "LEGADA" && <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
                                Fechamento legado: somente o dinheiro físico foi informado. Os demais meios não têm valores conferidos.
                            </Alert>}
                            {drawerDetalhe?.observacaoFechamento && <Typography variant="body2" sx={{ mt: 1.5 }}>{drawerDetalhe.observacaoFechamento}</Typography>}
                        </Box>

                        <Divider />
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Meios de pagamento</Typography>
                            {drawerCarregando ? <Skeleton variant="rounded" height={72} /> : drawerDetalhe && <Stack spacing={0} sx={{ overflowX: "auto" }}>
                                <Box sx={{ display: "grid", minWidth: 430, gridTemplateColumns: "minmax(0, 1fr) repeat(3, 92px)", gap: 1, pb: 1, borderBottom: 1, borderColor: "divider" }}>
                                    <Typography variant="caption">Forma</Typography><Typography variant="caption" align="right">Esperado</Typography>
                                    <Typography variant="caption" align="right">Informado</Typography><Typography variant="caption" align="right">Diferença</Typography>
                                </Box>
                                {(drawerDetalhe.modalidadeConferencia === "POR_CONFIGURACAO" || drawerDetalhe.modalidadeConferencia === "TOTAL_MEIOS")
                                    ? drawerDetalhe.conferencias.map((linha, index) => <Box key={index} sx={{ display: "grid", minWidth: 430, gridTemplateColumns: "minmax(0, 1fr) repeat(3, 92px)", gap: 1, py: 1.25, borderBottom: 1, borderColor: "divider", fontVariantNumeric: "tabular-nums" }}>
                                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{linha.descricao}</Typography>
                                        <Typography variant="body2" align="right">{dinheiro(linha.valorEsperado)}</Typography>
                                        <Typography variant="body2" align="right">{linha.valorInformado == null ? "Não informado" : dinheiro(linha.valorInformado)}</Typography>
                                        <Typography variant="body2" align="right">{linha.diferenca == null ? "—" : dinheiro(linha.diferenca)}</Typography>
                                    </Box>)
                                    : [
                                    { formaPagamentoId: null, descricao: "Dinheiro", total: detalhe.dinheiroEsperado, tipo: "DINHEIRO" },
                                    ...drawerDetalhe.resumo.totaisPorFormaPagamento.filter((forma) => forma.tipo !== "DINHEIRO"),
                                ].map((forma) => {
                                    const conferencia = drawerDetalhe.conferencias.find((linha) => forma.formaPagamentoId === null
                                        ? linha.escopo === "DINHEIRO_FISICO" : linha.formaPagamentoId === forma.formaPagamentoId);
                                    const informado = forma.formaPagamentoId === null ? detalhe.valorInformado : conferencia?.valorInformado;
                                    const diferenca = forma.formaPagamentoId === null ? detalhe.diferenca : conferencia?.diferenca;
                                    return <Box key={forma.formaPagamentoId ?? "dinheiro"} sx={{ display: "grid", minWidth: 430, gridTemplateColumns: "minmax(0, 1fr) repeat(3, 92px)", gap: 1, py: 1.25, borderBottom: 1, borderColor: "divider", fontVariantNumeric: "tabular-nums" }}>
                                        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{forma.formaPagamentoId === null ? "Dinheiro físico" : forma.descricao}</Typography>
                                        <Typography variant="body2" align="right">{dinheiro(forma.total)}</Typography>
                                        <Typography variant="body2" align="right">{informado == null ? "—" : dinheiro(informado)}</Typography>
                                        <Typography variant="body2" align="right" color={diferenca == null ? "text.secondary" : diferenca === 0 ? "success.main" : "error.main"}>{diferenca == null ? "—" : dinheiro(diferenca)}</Typography>
                                    </Box>;
                                })}
                                {drawerDetalhe.resumo.totaisPorFormaPagamento.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ pt: 1.5 }}>Nenhuma venda registrada nesta sessão.</Typography>}
                                {drawerDetalhe.modalidadeConferencia === "LEGADA" && <Typography role="status" variant="caption" color="text.secondary" sx={{ pt: 1 }}>Sem conferência por forma de pagamento.</Typography>}
                            </Stack>}
                        </Box>

                        {!drawerCarregando && drawerDetalhe && <>
                            <Divider />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Movimentações</Typography>
                                <Stack spacing={1.5}>
                                    {drawerDetalhe.movimentacoes.map((movimento, indice) => <Box key={`${movimento.tipo}-${movimento.vendaId ?? indice}-${indice}`} sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2 }}>
                                        <Box>
                                            <Typography variant="body2">{rotuloMovimentacao[movimento.tipo]}{movimento.vendaId ? ` #${movimento.vendaId}` : ""}</Typography>
                                            <Typography variant="caption" color="text.secondary">{data(movimento.dataHora)}{movimento.observacao ? ` · ${movimento.observacao}` : ""}</Typography>
                                        </Box>
                                        <Typography variant="body2" color={movimento.tipo === "VENDA_CANCELADA" ? "text.secondary" : "text.primary"}
                                            sx={{ fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
                                                textDecoration: movimento.tipo === "VENDA_CANCELADA" ? "line-through" : "none" }}>
                                            {movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA" ? "−" : ""}{dinheiro(movimento.valor)}
                                        </Typography>
                                    </Box>)}
                                </Stack>
                            </Box>
                        </>}
                    </Stack>
                </Box>
            </Box>}
        </Drawer>
        <Dialog open={gerenciando} fullWidth maxWidth="lg" aria-labelledby="caixa-gerenciar-titulo" onClose={() => setGerenciando(false)}><DialogTitle id="caixa-gerenciar-titulo">Cadastro de caixas</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Cadastre e edite os caixas físicos. Abertura, fechamento e movimentações pertencem às sessões.</Typography><AppTable colunas={colunasCadastro} linhas={caixasFiltrados} obterChaveLinha={(caixa) => caixa.id} acoes={acoesCadastro} minWidth={600} filtros={<FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id="caixa-situacao-label">Situação</InputLabel><Select labelId="caixa-situacao-label" label="Situação" value={situacaoCadastros} inputProps={{ "aria-label": "Filtrar caixas por situação", name: "situacao" }} onChange={(evento) => setSituacaoCadastros(evento.target.value)}><MenuItem value="todos">Todas</MenuItem><MenuItem value="ativos">Ativos</MenuItem><MenuItem value="inativos">Inativos</MenuItem></Select></FormControl>} vazio={{ titulo: "Nenhum caixa encontrado", descricao: situacaoCadastros !== "todos" ? "Tente ajustar o filtro de situação." : "Cadastre um caixa para habilitar a abertura de sessões." }} /></DialogContent><DialogActions><Button type="button" onClick={() => setGerenciando(false)}>Fechar</Button><Button type="button" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ caixa: null })}>Novo caixa</Button></DialogActions></Dialog>
        {editor && <CaixaForm caixa={editor.caixa} onFechar={() => setEditor(null)} onSalvo={salvo} />}
    </PageContainer>;
}

const focoOperacional = {
    "& .MuiButton-root.Mui-focusVisible, & .MuiSelect-select:focus-visible": {
        outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3,
    },
};

function Vazio({ onAbrir }: { onAbrir: () => void }) {
    return <Box component="section" aria-labelledby="caixa-vazio-titulo"
        sx={{ py: { xs: 5, sm: 7 }, px: 2, textAlign: "center", borderBlock: 1, borderColor: "divider", ...focoOperacional }}>
        <AccountBalanceWalletRoundedIcon aria-hidden="true" sx={{ fontSize: 40, color: "text.secondary", mb: 2 }} />
        <Typography id="caixa-vazio-titulo" component="h2" variant="h6">Nenhuma sessão aberta no momento.</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: "auto" }}>
            Abra uma sessão para iniciar a operação.
        </Typography>
        <Button type="button" variant="contained" startIcon={<AddRoundedIcon />} sx={{ mt: 3 }}
            aria-label="Abrir sessão de Caixa" onClick={onAbrir}>Abrir Caixa</Button>
    </Box>;
}

function Atual({ abertas, sessaoId, onSessao, resumo, timeline, podeMovimentar, podeFechar, onSuprimento, onSangria, onFechar }: {
    abertas: SessaoCaixaAberta[]; sessaoId: number | null; onSessao: (id: number) => void; resumo: ResumoSessaoCaixa; timeline: ItemTimeline[];
    podeMovimentar: boolean; podeFechar: boolean;
    onSuprimento: () => void; onSangria: () => void; onFechar: () => void;
}) {
    const [filtroTimeline, setFiltroTimeline] = useState("TODOS");
    const formasEletronicas = resumo.totaisPorFormaPagamento.filter((forma) => forma.tipo !== "DINHEIRO");
    const vendasEmDinheiro = resumo.totaisPorFormaPagamento
        .filter((forma) => forma.tipo === "DINHEIRO")
        .reduce((total, forma) => total + forma.total, 0);
    const timelineFiltrada = filtroTimeline === "TODOS" ? timeline : timeline.filter((movimento) =>
        filtroTimeline === "VENDA" ? movimento.tipo === "VENDA"
            : filtroTimeline === "SUPRIMENTO" ? movimento.tipo === "SUPRIMENTO"
                : movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA");
    const iconeForma = (tipo: string) => tipo === "DINHEIRO" ? <PaymentsRoundedIcon fontSize="small" aria-hidden="true" />
        : tipo === "PIX" ? <QrCode2RoundedIcon fontSize="small" aria-hidden="true" />
            : tipo.startsWith("CARTAO") ? <CreditCardRoundedIcon fontSize="small" aria-hidden="true" />
                : <AccountBalanceWalletRoundedIcon fontSize="small" aria-hidden="true" />;
    const linhaForma = (chaveLinha: string | number, descricao: string, valor: number, icone: ReactNode) => (
        <Stack key={chaveLinha} direction="row" spacing={1.25} sx={{ alignItems: "center", py: 1.25 }}>
            <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 1, display: "grid", placeItems: "center",
                bgcolor: "action.hover", color: "text.secondary" }}>
                {icone}
            </Box>
            <Typography variant="body2" sx={{ flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{descricao}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{dinheiro(valor)}</Typography>
        </Stack>
    );
    return <Stack spacing={0} sx={{ minWidth: 0, fontVariantNumeric: "tabular-nums", ...focoOperacional }}>
        <Box sx={{ display: "grid", gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)", xl: "minmax(0, 0.95fr) minmax(0, 1.05fr) minmax(0, 1.15fr)" } }}>
            <Paper component="section" variant="outlined" aria-labelledby="resumo-caixa-titulo" sx={{ minWidth: 0, p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography id="resumo-caixa-titulo" component="h2" variant="h6" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                        {resumo.descricaoCaixa}
                    </Typography>
                    <Chip label={resumo.status} color="success" size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: "anywhere" }}>
                    Sessão #{resumo.sessaoId} · Abertura {data(resumo.dataHoraAbertura)} · {resumo.operadorAbertura.nome}
                </Typography>
                {abertas.length > 1 && <FormControl size="small" fullWidth sx={{ mt: 2 }}>
                    <InputLabel id="sessao-atual-label">Sessão de caixa</InputLabel>
                    <Select labelId="sessao-atual-label" label="Sessão de caixa" name="sessaoAtual"
                        inputProps={{ "aria-label": "Selecionar sessão de caixa" }} value={sessaoId ?? ""}
                        onChange={(e) => onSessao(Number(e.target.value))}>
                        {abertas.map((sessao) => <MenuItem key={sessao.sessaoId} value={sessao.sessaoId}>{sessao.descricaoCaixa}</MenuItem>)}
                    </Select>
                </FormControl>}
                <Box sx={{ mt: 2.5, p: 2, borderRadius: 1.5, bgcolor: "success.light" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "success.main" }}>
                        <AccountBalanceWalletRoundedIcon fontSize="small" aria-hidden="true" />
                        <Typography variant="body2" component="h3" sx={{ fontWeight: 600 }}>Saldo esperado em dinheiro</Typography>
                    </Stack>
                    <Typography sx={{ mt: 0.5, fontSize: { xs: 26, sm: 30 }, lineHeight: 1.2, fontWeight: 750, color: "success.main", overflowWrap: "anywhere" }}>
                        {dinheiro(resumo.saldoEsperadoDinheiro)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "success.main" }}>
                        Saldo inicial + vendas em dinheiro + suprimentos − sangrias
                    </Typography>
                </Box>
                <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", m: 0, mt: 2.5, gap: 2 }}>
                    <Metric titulo="Saldo inicial" valor={resumo.saldoInicial} icone={<AccountBalanceWalletRoundedIcon sx={{ fontSize: 15 }} aria-hidden="true" />} />
                    <Metric titulo="Total de vendas" valor={resumo.totalVendas} icone={<PaymentsRoundedIcon sx={{ fontSize: 15 }} aria-hidden="true" />} />
                    <Metric titulo="Suprimentos" valor={resumo.suprimentos} cor="success.main" icone={<ArrowDownwardRoundedIcon sx={{ fontSize: 15 }} aria-hidden="true" />} />
                    <Metric titulo="Sangrias" valor={resumo.sangrias} cor="error.main" icone={<ArrowUpwardRoundedIcon sx={{ fontSize: 15 }} aria-hidden="true" />} />
                </Box>
                {podeMovimentar && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 2.5 }}>
                    <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowDownwardRoundedIcon />}
                        aria-label="Registrar suprimento" onClick={onSuprimento}>Suprimento</Button>
                    <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowUpwardRoundedIcon />}
                        aria-label="Registrar sangria" onClick={onSangria}>Sangria</Button>
                </Box>}
            </Paper>

            <Paper component="section" variant="outlined" aria-labelledby="pagamentos-caixa-titulo"
                sx={{ minWidth: 0, p: { xs: 2, sm: 2.5 }, borderRadius: 2, display: "flex", flexDirection: "column" }}>
                <Typography id="pagamentos-caixa-titulo" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Meios de pagamento
                </Typography>
                {resumo.totaisPorFormaPagamento.length === 0
                    ? <Typography role="status" variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        Nenhuma venda registrada nesta sessão.
                    </Typography>
                    : <>
                        <Stack divider={<Divider flexItem />} sx={{ mt: 0.5 }}>
                            {linhaForma("dinheiro", "Vendas em dinheiro", vendasEmDinheiro, iconeForma("DINHEIRO"))}
                            {formasEletronicas.map((forma) => linhaForma(forma.formaPagamentoId, forma.descricao, forma.total, iconeForma(forma.tipo)))}
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 2,
                            mt: "auto", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>Total vendido</Typography>
                            <Typography variant="body2" align="right" sx={{ fontWeight: 700 }}>{dinheiro(resumo.totalVendas)}</Typography>
                        </Box>
                    </>}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                    Vendas em dinheiro compõem o saldo físico do caixa. Meios eletrônicos seguem para as contas financeiras configuradas.
                </Typography>
            </Paper>

            <Paper component="section" variant="outlined" aria-labelledby="movimentos-caixa-titulo"
                sx={{ minWidth: 0, p: { xs: 2, sm: 2.5 }, pr: { xs: 2, sm: 1.5 }, borderRadius: 2, gridColumn: { md: "1 / -1", xl: "auto" },
                    display: "flex", flexDirection: "column" }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
                        <Typography id="movimentos-caixa-titulo" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Movimentações da sessão
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {timelineFiltrada.length} {timelineFiltrada.length === 1 ? "registro" : "registros"}
                        </Typography>
                    </Stack>
                    <FormControl size="small" sx={{ minWidth: 165 }}>
                        <Select aria-label="Filtrar movimentações" value={filtroTimeline}
                            onChange={(e) => setFiltroTimeline(e.target.value)}>
                            <MenuItem value="TODOS">Todos</MenuItem>
                            <MenuItem value="VENDA">Vendas</MenuItem>
                            <MenuItem value="SUPRIMENTO">Suprimentos</MenuItem>
                            <MenuItem value="SANGRIA">Sangrias e estornos</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
                {timeline.length === 0
                    ? <Box role="status" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">Nenhuma movimentação registrada nesta sessão.</Typography>
                        <Typography variant="caption" color="text.secondary">Vendas, suprimentos e sangrias aparecerão aqui.</Typography>
                    </Box>
                    : timelineFiltrada.length === 0
                        ? <Typography role="status" variant="body2" color="text.secondary" sx={{ py: 3 }}>
                            Nenhuma movimentação deste tipo nesta sessão.
                        </Typography>
                        : <Box component="ol" aria-label="Histórico de movimentações da sessão"
                            sx={{ listStyle: "none", p: 0, m: 0, pr: { sm: 1 }, maxHeight: { md: 340, xl: 520 }, overflowY: { md: "auto" } }}>
                            {timelineFiltrada.map((movimento) => <Box component="li" key={movimento.chave}
                                sx={{ position: "relative", display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", columnGap: 1.5, pb: 2.5,
                                    contentVisibility: "auto", containIntrinsicSize: "auto 88px",
                                    "&:not(:last-child)::before": { content: '""', position: "absolute", top: 32, bottom: 0, left: 15,
                                        borderLeft: "1px solid", borderColor: "divider" } }}>
                                <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center",
                                    bgcolor: "action.hover", color: movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA" ? "error.main" : movimento.tipo === "SUPRIMENTO" ? "success.main" : "text.secondary" }}>
                                    {movimento.tipo === "VENDA" ? <AccountBalanceWalletRoundedIcon fontSize="small" aria-hidden="true" />
                                        : movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA" ? <ArrowUpwardRoundedIcon fontSize="small" aria-hidden="true" />
                                            : <ArrowDownwardRoundedIcon fontSize="small" aria-hidden="true" />}
                                </Box>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 0.8fr)" }, gap: 0.5 }}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{movimento.descricao}</Typography>
                                        {movimento.formaPagamento && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                            {movimento.formaPagamento}
                                        </Typography>}
                                        <Typography component="time" dateTime={movimento.dataHora} variant="caption" color="text.secondary">
                                            {data(movimento.dataHora)}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ textAlign: { sm: "right" }, fontWeight: 700, overflowWrap: "anywhere" }}
                                        color={movimento.tipo === "SANGRIA" || movimento.tipo === "ESTORNO_VENDA" ? "error.main" : "text.primary"}>
                                        {movimento.sinal}{dinheiro(movimento.valor)}
                                    </Typography>
                                </Box>
                            </Box>)}
                        </Box>}
                {podeFechar && <Button type="button" variant="contained" size="large" fullWidth onClick={onFechar}
                    aria-label="Fechar Caixa" startIcon={<BlockRoundedIcon />} sx={{ mt: 2, minHeight: 48 }}>
                    Fechar Caixa
                </Button>}
            </Paper>
        </Box>
    </Stack>;
}

function Metric({ titulo, valor, cor = "text.primary", icone }: { titulo: string; valor: number; cor?: string; icone?: ReactNode }) {
    return <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: "text.secondary" }}>
            {icone}
            <Typography component="dt" variant="caption">{titulo}</Typography>
        </Stack>
        <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 20, fontWeight: 650, color: cor, overflowWrap: "anywhere" }}>
            {dinheiro(valor)}
        </Typography>
    </Box>;
}
