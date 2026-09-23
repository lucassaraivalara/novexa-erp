import { useEffect, useState, type FormEvent } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import {
    adicionarMovimentacao, abrirSessaoCaixa, buscarCaixa, buscarResumoSessao, fecharSessaoCaixa,
    inativarCaixa, listarCaixas, listarMovimentacoes, listarSessoesAbertas, listarSessoesFechadas,
    mensagemCaixa,
} from "../../services/caixaService";
import { buscarVenda, listarVendas, type VendaDetalhe } from "../../services/vendaService";
import type {
    CaixaCompleta, CaixaResumo, MovimentacaoCaixa, ResumoSessaoCaixa, SessaoCaixaAberta,
    SessaoCaixaHistorico,
} from "../../types/caixa";
import CaixaForm from "./CaixaForm";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const intervaloAtualizacaoSessao = 2000;
const dinheiro = (valor: number | null | undefined) => moeda.format(valor ?? 0);
const data = (valor: string | null | undefined) => valor ? dataHora.format(new Date(valor)) : "—";
const valorDecimal = (texto: string) => {
    const numero = Number(texto.trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : null;
};
const chave = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const rotuloFormaPagamento: Record<NonNullable<VendaDetalhe["formaPagamento"]>, string> = {
    DINHEIRO: "Dinheiro", PIX: "PIX", CARTAO_DEBITO: "Débito", CARTAO_CREDITO: "Crédito",
};
const rotuloTipoFormaPagamento: Record<string, string> = {
    DINHEIRO: "Dinheiro", PIX: "PIX", DEBITO: "Débito", CREDITO: "Crédito",
};

type ModalMovimento = "SUPRIMENTO" | "SANGRIA" | null;
type ItemTimeline = {
    chave: string;
    tipo: "VENDA" | "SUPRIMENTO" | "SANGRIA";
    dataHora: string;
    valor: number;
    descricao: string;
    formaPagamento: string | null;
};

function criarTimeline(movimentos: MovimentacaoCaixa[], vendas: VendaDetalhe[]): ItemTimeline[] {
    const vendasTimeline = vendas.map((venda) => ({
        chave: `venda-${venda.id}`,
        tipo: "VENDA" as const,
        dataHora: venda.dataHora,
        valor: venda.total,
        descricao: `Venda #${venda.id}`,
        formaPagamento: venda.formaPagamento ? rotuloFormaPagamento[venda.formaPagamento] : "Pagamento",
    }));
    const movimentosTimeline = movimentos
        .filter((movimento) => movimento.tipo !== "VENDA")
        .map((movimento) => ({
            chave: `movimento-${movimento.id}`,
            tipo: movimento.tipo,
            dataHora: movimento.dataHora,
            valor: movimento.valor,
            descricao: movimento.tipo === "SUPRIMENTO" ? "Suprimento" : "Sangria",
            formaPagamento: null,
        }));
    return [...vendasTimeline, ...movimentosTimeline].sort(
        (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime(),
    );
}

export default function Caixa() {
    const [aba, setAba] = useState(0);
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
    const [diferencaConfirmada, setDiferencaConfirmada] = useState(false);
    const [detalhe, setDetalhe] = useState<SessaoCaixaHistorico | null>(null);
    const [gerenciando, setGerenciando] = useState(false);
    const [editor, setEditor] = useState<{ caixa: CaixaCompleta | null } | null>(null);
    const [processando, setProcessando] = useState(false);
    const [saldo, setSaldo] = useState("");
    const [observacao, setObservacao] = useState("");
    const [caixaAbertura, setCaixaAbertura] = useState<number | "">("");

    const sessaoAtual = abertas.find((sessao) => sessao.sessaoId === sessaoId) ?? null;

    async function carregar(signal?: AbortSignal) {
        setCarregando(true);
        setErro("");
        try {
            const [sessoes, cadastros, fechadas] = await Promise.all([
                listarSessoesAbertas(signal), listarCaixas(signal), listarSessoesFechadas(signal),
            ]);
            if (signal?.aborted) return;
            setAbertas(sessoes);
            setCaixas(cadastros);
            setHistorico(fechadas);
            setSessaoId((atual) => sessoes.some((sessao) => sessao.sessaoId === atual) ? atual : sessoes[0]?.sessaoId ?? null);
            if (sessoes.length === 0) { setResumo(null); setTimeline([]); }
        } catch (e) {
            if (!signal?.aborted) setErro(mensagemCaixa(e, "Não foi possível carregar o Caixa operacional."));
        } finally {
            if (!signal?.aborted) setCarregando(false);
        }
    }

    async function carregarSessao(id: number, signal?: AbortSignal) {
        const [novoResumo, movimentos, vendas] = await Promise.all([
            buscarResumoSessao(id, signal), listarMovimentacoes(id, signal), listarVendas({ status: "FATURADA" }, signal),
        ]);
        const vendasDaSessao = vendas.filter((venda) => venda.sessaoCaixaId === id);
        const detalhes = await Promise.all(vendasDaSessao.map((venda) => buscarVenda(venda.id, signal)));
        if (signal?.aborted) return;
        setResumo(novoResumo);
        setTimeline(criarTimeline(movimentos, detalhes));
    }

    useEffect(() => {
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (sessaoId === null) { setResumo(null); setTimeline([]); return; }
        const controller = new AbortController();
        const atualizar = () => carregarSessao(sessaoId, controller.signal).catch((e) => {
            if (!controller.signal.aborted) setErro(mensagemCaixa(e, "Não foi possível carregar o resumo do Caixa."));
        });
        void atualizar();
        const intervalo = window.setInterval(() => void atualizar(), intervaloAtualizacaoSessao);
        return () => { controller.abort(); window.clearInterval(intervalo); };
    }, [sessaoId]);

    async function executar(acao: () => Promise<void>, mensagem: string, atualizarSessaoId?: number | null) {
        setProcessando(true); setErroModal("");
        try {
            await acao();
            await carregar();
            if (atualizarSessaoId !== null && atualizarSessaoId !== undefined) await carregarSessao(atualizarSessaoId);
        } catch (e) {
            setErroModal(mensagemCaixa(e, mensagem));
        } finally {
            setProcessando(false);
        }
    }

    async function abrir(evento: FormEvent) {
        evento.preventDefault();
        const inicial = valorDecimal(saldo);
        if (caixaAbertura === "" || inicial === null) { setErroModal("Selecione um caixa e informe um saldo inicial válido."); return; }
        await executar(async () => { await abrirSessaoCaixa(caixaAbertura, { saldoInicial: inicial }); setModalAbertura(false); setSaldo(""); setCaixaAbertura(""); }, "Não foi possível abrir o Caixa.");
    }

    async function movimentar(evento: FormEvent) {
        evento.preventDefault();
        const valor = valorDecimal(saldo);
        if (sessaoId === null || modalMovimento === null || valor === null || valor === 0) { setErroModal("Informe um valor positivo válido."); return; }
        await executar(async () => {
            await adicionarMovimentacao(sessaoId, { chaveRequisicao: chave(), tipo: modalMovimento, valor, observacao: observacao.trim() || null });
            setModalMovimento(null); setSaldo(""); setObservacao("");
        }, "Não foi possível registrar a movimentação.", sessaoId);
    }

    async function fechar(evento: FormEvent) {
        evento.preventDefault();
        const final = valorDecimal(saldo);
        if (sessaoAtual === null || sessaoId === null || final === null) { setErroModal("Informe um valor final válido."); return; }
        if (temDiferencaFechamento && !diferencaConfirmada) { setErroModal("Confirme a divergência para concluir o fechamento."); return; }
        await executar(async () => { await fecharSessaoCaixa(sessaoAtual.caixaId, sessaoId, { saldoFinal: final }); setModalFechamento(false); setSaldo(""); setDiferencaConfirmada(false); }, "Não foi possível fechar o Caixa.");
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
    const temDiferencaFechamento = diferencaFechamento !== null && Math.abs(diferencaFechamento) >= 0.005;
    const vendasEmDinheiro = resumo?.totaisPorFormaPagamento
        .filter((forma) => forma.tipo === "DINHEIRO")
        .reduce((total, forma) => total + forma.total, 0) ?? 0;
    const totaisEletronicos = resumo?.totaisPorFormaPagamento.filter((forma) =>
        ["PIX", "DEBITO", "CREDITO"].includes(forma.tipo)) ?? [];

    return <PageContainer>
        <PageHeader titulo="Caixas" descricao="Acompanhe a operação do PDV e o histórico de sessões."
            acaoPrincipal={<Button variant="contained" startIcon={<AccountBalanceWalletRoundedIcon />} onClick={() => setModalAbertura(true)} disabled={abertas.length > 0}>Abrir Caixa</Button>}
            acoesSecundarias={<Button variant="outlined" startIcon={<SettingsRoundedIcon />} onClick={() => setGerenciando(true)}>Gerenciar caixas</Button>} />
        {erro && <Alert severity="error" action={<Button color="inherit" onClick={() => void carregar()}>Tentar novamente</Button>}>{erro}</Alert>}
        <Paper variant="outlined"><Tabs value={aba} onChange={(_, valor) => setAba(valor)} aria-label="Visões do Caixa" variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44 }}><Tab id="caixa-atual-tab" aria-controls="caixa-atual-painel" label="Caixa atual" sx={{ minHeight: 44, py: 1 }} /><Tab id="caixas-anteriores-tab" aria-controls="caixas-anteriores-painel" label="Caixas anteriores" sx={{ minHeight: 44, py: 1 }} /></Tabs></Paper>
        {aba === 0 && (carregando ? <Skeleton variant="rounded" height={300} /> : abertas.length === 0 ? <Box id="caixa-atual-painel" role="tabpanel" aria-labelledby="caixa-atual-tab"><Vazio onAbrir={() => setModalAbertura(true)} /></Box> : resumo === null ? <Skeleton variant="rounded" height={300} /> : <Box id="caixa-atual-painel" role="tabpanel" aria-labelledby="caixa-atual-tab"><Atual abertas={abertas} sessaoId={sessaoId} onSessao={setSessaoId} resumo={resumo} timeline={timeline} onSuprimento={() => { setErroModal(""); setModalMovimento("SUPRIMENTO"); }} onSangria={() => { setErroModal(""); setModalMovimento("SANGRIA"); }} onFechar={() => { setErroModal(""); setDiferencaConfirmada(false); setModalFechamento(true); }} /></Box>)}
        {aba === 1 && <Box id="caixas-anteriores-painel" role="tabpanel" aria-labelledby="caixas-anteriores-tab"><AppTable colunas={[
            { campo: "descricaoCaixa", cabecalho: "Caixa", largura: 180 }, { campo: "dataHoraAbertura", cabecalho: "Abertura", largura: 170, render: (valor) => data(valor as string) },
            { campo: "dataHoraFechamento", cabecalho: "Fechamento", largura: 170, render: (valor) => data(valor as string | null) }, { campo: "operadorAbertura.nome", cabecalho: "Operador", largura: 180 },
            { campo: "saldoInicial", cabecalho: "Saldo inicial", alinhar: "right", render: (valor) => dinheiro(valor as number) }, { campo: "totalVendas", cabecalho: "Vendas", alinhar: "right", render: (valor) => dinheiro(valor as number) },
            { campo: "dinheiroEsperado", cabecalho: "Esperado", alinhar: "right", render: (valor) => dinheiro(valor as number) }, { campo: "valorInformado", cabecalho: "Informado", alinhar: "right", render: (valor) => dinheiro(valor as number | null) },
            { campo: "diferenca", cabecalho: "Diferença", alinhar: "right", render: (valor) => <Typography color={(valor as number | null) === 0 ? "success.main" : "error.main"} sx={{ fontWeight: 700 }}>{dinheiro(valor as number | null)}</Typography> },
        ]} linhas={historicoPagina} carregando={carregando} obterChaveLinha={(sessao) => sessao.sessaoId} minWidth={1100} alturaCorpo={480} linhaCliqueavel onLinhaClick={setDetalhe} vazio={{ titulo: "Nenhuma sessão encerrada", descricao: "As sessões fechadas aparecerão aqui." }} paginacao={{
            pagina: paginaHistoricoAtual,
            linhasPorPagina: porPaginaHistorico,
            total: historico.length,
            onPageChange: setPaginaHistorico,
            onRowsPerPageChange: (valor) => { setPorPaginaHistorico(valor); setPaginaHistorico(0); },
            opcoesLinhasPorPagina: [10, 25, 50],
        }} /></Box>}

        <Dialog open={modalAbertura} fullWidth maxWidth="xs" aria-labelledby="caixa-abertura-titulo" onClose={() => !processando && setModalAbertura(false)}><form onSubmit={abrir}><DialogTitle id="caixa-abertura-titulo">Abrir Caixa</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{erroModal && <Alert severity="error">{erroModal}</Alert>}<TextField select required name="caixaAbertura" autoComplete="off" label="Caixa" value={caixaAbertura} onChange={(e) => setCaixaAbertura(Number(e.target.value))} helperText={caixasAtivos.length === 0 ? "Nenhum Caixa ativo está disponível." : undefined}>{caixasAtivos.map((caixa) => <MenuItem key={caixa.id} value={caixa.id}>{caixa.descricao}</MenuItem>)}</TextField><TextField required name="saldoInicial" autoComplete="off" label="Saldo inicial (R$)" value={saldo} onChange={(e) => setSaldo(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} /></Stack></DialogContent><DialogActions><Button type="button" onClick={() => setModalAbertura(false)}>Cancelar</Button><Button type="submit" variant="contained" disabled={processando || caixasAtivos.length === 0}>{processando ? "Abrindo…" : "Abrir Caixa"}</Button></DialogActions></form></Dialog>
        <Dialog open={modalMovimento !== null} fullWidth maxWidth="xs" aria-labelledby="caixa-movimento-titulo" onClose={() => !processando && setModalMovimento(null)}><form onSubmit={movimentar}><DialogTitle id="caixa-movimento-titulo">{modalMovimento === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{erroModal && <Alert severity="error">{erroModal}</Alert>}<TextField required autoFocus name="valor" autoComplete="off" label="Valor (R$)" value={saldo} onChange={(e) => setSaldo(e.target.value)} slotProps={{ htmlInput: { inputMode: "decimal" } }} /><TextField name="observacao" autoComplete="off" label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} /></Stack></DialogContent><DialogActions><Button type="button" onClick={() => setModalMovimento(null)}>Cancelar</Button><Button type="submit" variant="contained" disabled={processando}>{processando ? "Registrando…" : "Confirmar"}</Button></DialogActions></form></Dialog>
        <Dialog open={modalFechamento} fullWidth maxWidth="sm" aria-labelledby="caixa-fechamento-titulo" aria-describedby="caixa-fechamento-descricao" onClose={() => { if (!processando) { setDiferencaConfirmada(false); setModalFechamento(false); } }}>
            <form onSubmit={fechar}>
                <DialogTitle id="caixa-fechamento-titulo">Fechar Caixa</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                        {erroModal && <Alert severity="error">{erroModal}</Alert>}
                        <Typography id="caixa-fechamento-descricao" color="text.secondary">
                            Confira os valores da sessão. Informe abaixo somente o dinheiro físico contado no caixa.
                        </Typography>
                        {resumo && <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, m: 0 }}>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Saldo inicial</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(resumo.saldoInicial)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Vendas em dinheiro</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(vendasEmDinheiro)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Suprimentos</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700, color: "success.main" }}>{dinheiro(resumo.suprimentos)}</Typography></Box>
                            <Box><Typography component="dt" variant="caption" color="text.secondary">Sangrias</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700, color: "error.main" }}>{dinheiro(resumo.sangrias)}</Typography></Box>
                            {totaisEletronicos.map((forma) => <Box key={forma.formaPagamentoId}><Typography component="dt" variant="caption" color="text.secondary">{rotuloTipoFormaPagamento[forma.tipo] ?? forma.descricao}</Typography><Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>{dinheiro(forma.total)}</Typography></Box>)}
                        </Box>}
                        <Box sx={{ borderBlock: 1, borderColor: "divider", py: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">Saldo esperado em dinheiro</Typography>
                            <Typography variant="h5" sx={{ mt: 0.25, fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>{dinheiro(resumo?.saldoEsperadoDinheiro)}</Typography>
                        </Box>
                        <TextField required autoFocus name="saldoFinal" autoComplete="off" label="Dinheiro físico contado (R$)" value={saldo}
                            helperText="Este valor representa apenas o dinheiro físico contado no caixa."
                            onChange={(e) => { setSaldo(e.target.value); setDiferencaConfirmada(false); }}
                            slotProps={{ htmlInput: { inputMode: "decimal", "aria-describedby": "caixa-fechamento-descricao" } }} />
                        <Box role="status" aria-live="polite" sx={{ borderLeft: 3, borderColor: diferencaFechamento === null ? "divider" : temDiferencaFechamento ? "warning.main" : "success.main", bgcolor: "action.hover", px: 2, py: 1.5 }}>
                            {diferencaFechamento === null ? <Typography variant="body2">Informe o dinheiro contado para conferir a diferença.</Typography>
                                : temDiferencaFechamento ? <><Typography variant="body2" sx={{ fontWeight: 700 }}>{diferencaFechamento > 0 ? "Sobra de dinheiro" : "Falta de dinheiro"}: {dinheiro(Math.abs(diferencaFechamento))}</Typography><Typography variant="caption" color="text.secondary">A confirmação abaixo é necessária para fechar com divergência.</Typography></>
                                    : <Typography variant="body2" sx={{ fontWeight: 700 }}>Conferência sem diferença.</Typography>}
                        </Box>
                        {temDiferencaFechamento && <FormControlLabel
                            control={<Checkbox checked={diferencaConfirmada} onChange={(e) => setDiferencaConfirmada(e.target.checked)} slotProps={{ input: { "aria-label": "Confirmar fechamento com divergência" } }} sx={{ "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }} />}
                            label="Confirmo que conferi a sobra ou falta de dinheiro e desejo fechar o caixa." />}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button type="button" onClick={() => { setDiferencaConfirmada(false); setModalFechamento(false); }} disabled={processando}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={processando || saldoFinalInformado === null || (temDiferencaFechamento && !diferencaConfirmada)}>
                        {processando ? "Fechando…" : temDiferencaFechamento ? "Confirmar fechamento com divergência" : "Confirmar fechamento"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
        <Dialog open={detalhe !== null} fullWidth maxWidth="sm" aria-labelledby="caixa-detalhe-titulo" onClose={() => setDetalhe(null)}><DialogTitle id="caixa-detalhe-titulo">Detalhes da sessão</DialogTitle><DialogContent dividers>{detalhe && <Stack spacing={1.5}><Typography variant="h6">{detalhe.descricaoCaixa}</Typography><Typography color="text.secondary">{data(detalhe.dataHoraAbertura)} até {data(detalhe.dataHoraFechamento)}</Typography><Divider /><Typography>Operador: <strong>{detalhe.operadorAbertura.nome}</strong></Typography><Typography>Saldo inicial: <strong>{dinheiro(detalhe.saldoInicial)}</strong></Typography><Typography>Total de vendas: <strong>{dinheiro(detalhe.totalVendas)}</strong></Typography><Typography>Dinheiro esperado: <strong>{dinheiro(detalhe.dinheiroEsperado)}</strong></Typography><Typography>Dinheiro informado: <strong>{dinheiro(detalhe.valorInformado)}</strong></Typography><Typography>Diferença: <strong>{dinheiro(detalhe.diferenca)}</strong></Typography></Stack>}</DialogContent><DialogActions><Button type="button" onClick={() => setDetalhe(null)}>Fechar</Button></DialogActions></Dialog>
        <Dialog open={gerenciando} fullWidth maxWidth="lg" aria-labelledby="caixa-gerenciar-titulo" onClose={() => setGerenciando(false)}><DialogTitle id="caixa-gerenciar-titulo">Gerenciar caixas</DialogTitle><DialogContent dividers><AppTable colunas={colunasCadastro} linhas={caixasFiltrados} obterChaveLinha={(caixa) => caixa.id} acoes={acoesCadastro} minWidth={600} filtros={<FormControl size="small" sx={{ minWidth: 160 }}><InputLabel id="caixa-situacao-label">Situação</InputLabel><Select labelId="caixa-situacao-label" label="Situação" value={situacaoCadastros} inputProps={{ "aria-label": "Filtrar caixas por situação", name: "situacao" }} onChange={(evento) => setSituacaoCadastros(evento.target.value)}><MenuItem value="todos">Todas</MenuItem><MenuItem value="ativos">Ativos</MenuItem><MenuItem value="inativos">Inativos</MenuItem></Select></FormControl>} vazio={{ titulo: "Nenhum caixa encontrado", descricao: situacaoCadastros !== "todos" ? "Tente ajustar o filtro de situação." : "Cadastre um caixa para habilitar a abertura de sessões." }} /></DialogContent><DialogActions><Button type="button" onClick={() => setGerenciando(false)}>Fechar</Button><Button type="button" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditor({ caixa: null })}>Novo caixa</Button></DialogActions></Dialog>
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
        <Typography id="caixa-vazio-titulo" component="h2" variant="h6">Nenhum caixa aberto no momento.</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: "auto" }}>
            Abra uma sessão para iniciar a operação.
        </Typography>
        <Button type="button" variant="contained" startIcon={<AddRoundedIcon />} sx={{ mt: 3 }}
            aria-label="Abrir sessão de Caixa" onClick={onAbrir}>Abrir Caixa</Button>
    </Box>;
}

function Atual({ abertas, sessaoId, onSessao, resumo, timeline, onSuprimento, onSangria, onFechar }: {
    abertas: SessaoCaixaAberta[]; sessaoId: number | null; onSessao: (id: number) => void; resumo: ResumoSessaoCaixa; timeline: ItemTimeline[];
    onSuprimento: () => void; onSangria: () => void; onFechar: () => void;
}) {
    return <Stack spacing={0} sx={{ minWidth: 0, fontVariantNumeric: "tabular-nums", ...focoOperacional }}>
        <Box component="section" aria-labelledby="resumo-caixa-titulo" sx={{ py: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" } }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                        <Typography id="resumo-caixa-titulo" component="h2" variant="h6" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                            {resumo.descricaoCaixa}
                        </Typography>
                        <Chip label={resumo.status} color="success" size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: "anywhere" }}>
                        Abertura {data(resumo.dataHoraAbertura)} · {resumo.operadorAbertura.nome}
                    </Typography>
                </Box>
                {abertas.length > 1 && <FormControl size="small" sx={{ width: { xs: "100%", sm: 240 }, flexShrink: 0 }}>
                    <InputLabel id="sessao-atual-label">Sessão de caixa</InputLabel>
                    <Select labelId="sessao-atual-label" label="Sessão de caixa" name="sessaoAtual"
                        inputProps={{ "aria-label": "Selecionar sessão de caixa" }} value={sessaoId ?? ""}
                        onChange={(e) => onSessao(Number(e.target.value))}>
                        {abertas.map((sessao) => <MenuItem key={sessao.sessaoId} value={sessao.sessaoId}>{sessao.descricaoCaixa}</MenuItem>)}
                    </Select>
                </FormControl>}
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" },
                alignItems: "center", gap: 3, mt: 3, py: 3, px: { xs: 2, sm: 3 },
                bgcolor: "action.hover", borderLeft: 3, borderColor: "success.main" }}>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "text.secondary" }}>
                        <AccountBalanceWalletRoundedIcon fontSize="small" aria-hidden="true" />
                        <Typography variant="body2" component="h3">Saldo esperado em dinheiro</Typography>
                    </Stack>
                    <Typography sx={{ mt: 1, fontSize: 32, lineHeight: 1.25, fontWeight: 750, overflowWrap: "anywhere" }}>
                        {dinheiro(resumo.saldoEsperadoDinheiro)}
                    </Typography>
                </Box>
                <Stack spacing={1.5} sx={{ width: { xs: "100%", md: 292 }, minWidth: 0 }}>
                    <Button type="button" variant="contained" size="large" onClick={onFechar}
                        aria-label="Fechar Caixa" startIcon={<BlockRoundedIcon />} sx={{ minHeight: 44 }}>
                        Fechar Caixa
                    </Button>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowDownwardRoundedIcon />}
                            aria-label="Registrar suprimento" onClick={onSuprimento}>Suprimento</Button>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowUpwardRoundedIcon />}
                            aria-label="Registrar sangria" onClick={onSangria}>Sangria</Button>
                    </Box>
                </Stack>
            </Box>
            <Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
                m: 0, mt: 2, gap: { xs: 2, md: 3 }, py: 1.5 }}>
                <Metric titulo="Saldo inicial" valor={resumo.saldoInicial} />
                <Metric titulo="Total de vendas" valor={resumo.totalVendas} />
                <Metric titulo="Suprimentos" valor={resumo.suprimentos} cor="success.main" />
                <Metric titulo="Sangrias" valor={resumo.sangrias} cor="error.main" />
            </Box>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 0.85fr) minmax(0, 1.4fr)" },
            borderTop: 1, borderColor: "divider" }}>
            <Box component="section" aria-labelledby="pagamentos-caixa-titulo"
                sx={{ minWidth: 0, py: 3, pr: { md: 3 }, borderRight: { md: 1 }, borderColor: "divider" }}>
                <Typography id="pagamentos-caixa-titulo" component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                    Totais por forma de pagamento
                </Typography>
                {resumo.totaisPorFormaPagamento.length === 0
                    ? <Typography role="status" variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        Nenhuma venda registrada nesta sessão.
                    </Typography>
                    : <Box component="dl" sx={{ m: 0 }}>
                        {resumo.totaisPorFormaPagamento.map((forma) => <Box key={forma.formaPagamentoId}
                            sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 2,
                                py: 1.75, borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
                            <Typography component="dt" variant="body2" sx={{ overflowWrap: "anywhere" }}>{forma.descricao}</Typography>
                            <Typography component="dd" variant="body2" sx={{ m: 0, textAlign: "right", fontWeight: 700, overflowWrap: "anywhere" }}>
                                {dinheiro(forma.total)}
                            </Typography>
                        </Box>)}
                    </Box>}
            </Box>
            <Box component="section" aria-labelledby="movimentos-caixa-titulo" sx={{ minWidth: 0, py: 3, pl: { md: 3 },
                borderTop: { xs: 1, md: 0 }, borderColor: "divider" }}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
                    <Typography id="movimentos-caixa-titulo" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Movimentações da sessão
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{timeline.length} registros</Typography>
                </Stack>
                {timeline.length === 0
                    ? <Box role="status" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">Nenhuma movimentação registrada nesta sessão.</Typography>
                        <Typography variant="caption" color="text.secondary">Vendas, suprimentos e sangrias aparecerão aqui.</Typography>
                    </Box>
                    : <Box component="ol" aria-label="Histórico de movimentações da sessão" sx={{ listStyle: "none", p: 0, m: 0 }}>
                        {timeline.map((movimento) => <Box component="li" key={movimento.chave}
                            sx={{ position: "relative", display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", columnGap: 1.5, pb: 2.5,
                                contentVisibility: "auto", containIntrinsicSize: "auto 88px",
                                "&:not(:last-child)::before": { content: '""', position: "absolute", top: 32, bottom: 0, left: 15,
                                    borderLeft: "1px solid", borderColor: "divider" } }}>
                            <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center",
                                bgcolor: "action.hover", color: movimento.tipo === "SANGRIA" ? "error.main" : movimento.tipo === "SUPRIMENTO" ? "success.main" : "text.secondary" }}>
                                {movimento.tipo === "VENDA" ? <AccountBalanceWalletRoundedIcon fontSize="small" aria-hidden="true" />
                                    : movimento.tipo === "SANGRIA" ? <ArrowUpwardRoundedIcon fontSize="small" aria-hidden="true" />
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
                                    color={movimento.tipo === "SANGRIA" ? "error.main" : "text.primary"}>
                                    {movimento.tipo === "SANGRIA" ? "−" : "+"}{dinheiro(movimento.valor)}
                                </Typography>
                            </Box>
                        </Box>)}
                    </Box>}
            </Box>
        </Box>
    </Stack>;
}

function Metric({ titulo, valor, cor = "text.primary" }: { titulo: string; valor: number; cor?: string }) {
    return <Box sx={{ minWidth: 0 }}>
        <Typography component="dt" variant="caption" color="text.secondary">{titulo}</Typography>
        <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 20, fontWeight: 650, color: cor, overflowWrap: "anywhere" }}>
            {dinheiro(valor)}
        </Typography>
    </Box>;
}
