import { useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Skeleton, Snackbar, Stack, TextField,
    Tooltip, Typography } from "@mui/material";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/ui/PageHeader";
import PageFilters from "../../components/ui/PageFilters";
import AppTable, { type AcaoTabela, type Coluna } from "../../components/ui/AppTable";
import { alterarSituacaoContaFinanceira, listarContasFinanceiras, listarContasFinanceirasPaginado, resumirContasFinanceiras,
    mensagemContaFinanceira } from "../../services/contaFinanceiraService";
import { rotulosTipoContaFinanceira, tiposContaFinanceiraFuncionais, type ContaFinanceira, type ContaFinanceiraResumo, type TipoContaFinanceira } from "../../types/contaFinanceira";
import ContaFinanceiraDrawer from "./ContaFinanceiraDrawer";
import MovimentacaoFinanceiraDrawer from "./MovimentacaoFinanceiraDrawer";
import ExtratoFinanceiroDrawer from "./ExtratoFinanceiroDrawer";
import TransferenciaFinanceiraDrawer from "./TransferenciaFinanceiraDrawer";
import CofrePainel from "./CofrePainel";
import RecebimentosContaDrawer from "./RecebimentosContaDrawer";
import { resumirRecebimentosContas } from "../../services/recebimentoContaService";
import type { RecebimentoContaResumo } from "../../types/recebimentoConta";
import { podeExecutarAcaoGerencial } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function ContasFinanceiras() {
    const gerencial = podeExecutarAcaoGerencial(obterSessao()?.perfil);
    const [contas, setContas] = useState<ContaFinanceira[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [busca, setBusca] = useState("");
    const [tipo, setTipo] = useState<TipoContaFinanceira | "">("");
    const [ativo, setAtivo] = useState<"" | "true" | "false">("");
    const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [porPagina, setPorPagina] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [ordenacao, setOrdenacao] = useState({ campo: "nome", direcao: "asc" as "asc" | "desc" });
    const [resumo, setResumo] = useState<ContaFinanceiraResumo[] | null>(null);
    const [resumoConsultadoEm, setResumoConsultadoEm] = useState(-1);
    const [erroResumo, setErroResumo] = useState("");
    const [contasTransferencia, setContasTransferencia] = useState<ContaFinanceira[] | null>(null);
    const [editor, setEditor] = useState<ContaFinanceira | null | undefined>(undefined);
    const [movimentarId, setMovimentarId] = useState<number | null>(null);
    const [extratoId, setExtratoId] = useState<number | null>(null);
    const [transferirId, setTransferirId] = useState<number | null>(null);
    const [situacao, setSituacao] = useState<ContaFinanceira | null>(null);
    const [processando, setProcessando] = useState(false);
    const [recebimentosResumo, setRecebimentosResumo] = useState<RecebimentoContaResumo[] | null>(null);
    const [recebimentosConsultadosEm, setRecebimentosConsultadosEm] = useState(-1);
    const [erroRecebimentos, setErroRecebimentos] = useState("");
    const [recebimentos, setRecebimentos] = useState<{ contaId?: number; nome?: string; semDestino?: boolean } | null>(null);
    const [menuAcoes, setMenuAcoes] = useState<{ ancora: HTMLElement; conta: ContaFinanceira } | null>(null);
    const carregandoRecebimentos = recebimentosConsultadosEm !== tentativa;
    const carregandoResumo = resumoConsultadoEm !== tentativa;

    useEffect(() => {
        const controller = new AbortController();
        resumirRecebimentosContas(controller.signal)
            .then(dados => { if (!controller.signal.aborted) { setRecebimentosResumo(dados); setErroRecebimentos(""); } })
            .catch(e => { if (!controller.signal.aborted) {
                setRecebimentosResumo(null);
                setErroRecebimentos(mensagemContaFinanceira(e, "Não foi possível consultar os valores a liquidar."));
            } })
            .finally(() => { if (!controller.signal.aborted) setRecebimentosConsultadosEm(tentativa); });
        return () => controller.abort();
    }, [tentativa]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true);
            let ajustandoPagina = false;
            listarContasFinanceirasPaginado({ page: pagina, size: porPagina, termo: busca.trim() || undefined,
                tipo: tipo || undefined, ativo: ativo === "" ? undefined : ativo === "true",
                sort: `${ordenacao.campo},${ordenacao.direcao}` }, controller.signal)
                .then((resposta) => {
                    if (controller.signal.aborted) return;
                    setContas(resposta.items); setTotalItems(resposta.totalItems); setPorPagina(resposta.size); setErro("");
                    if (resposta.page > 0 && !resposta.items.length) {
                        ajustandoPagina = true; setPagina(Math.max(0, resposta.totalPages - 1));
                    } else setPagina(resposta.page);
                })
                .catch((e) => { if (!controller.signal.aborted) setErro(mensagemContaFinanceira(e, "Não foi possível carregar as contas financeiras.")); })
                .finally(() => { if (!controller.signal.aborted && !ajustandoPagina) setCarregando(false); });
        }, busca.trim() ? 350 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [tentativa, pagina, porPagina, busca, tipo, ativo, ordenacao]);

    useEffect(() => {
        const controller = new AbortController();
        resumirContasFinanceiras(controller.signal)
            .then((dados) => { if (!controller.signal.aborted) { setResumo(dados); setErroResumo(""); } })
            .catch((e) => { if (!controller.signal.aborted) {
                setResumo(null); setErroResumo(mensagemContaFinanceira(e, "Não foi possível carregar os saldos globais."));
            } })
            .finally(() => { if (!controller.signal.aborted) setResumoConsultadoEm(tentativa); });
        return () => controller.abort();
    }, [tentativa]);

    useEffect(() => {
        if (transferirId === null) return;
        const controller = new AbortController();
        // A lista simples atende somente os seletores da transferencia, nunca a tabela administrativa.
        listarContasFinanceiras(controller.signal)
            .then((lista) => { if (!controller.signal.aborted) setContasTransferencia(lista); })
            .catch((e) => { if (!controller.signal.aborted) {
                setErro(mensagemContaFinanceira(e, "Não foi possível carregar as contas para transferência."));
                setTransferirId(null);
            } });
        return () => controller.abort();
    }, [transferirId]);

    function atualizar() {
        setCarregando(true);
        setTentativa((n) => n + 1);
    }

    async function confirmarSituacao() {
        if (!situacao || processando) return;
        setProcessando(true); setErro("");
        try {
            await alterarSituacaoContaFinanceira(situacao.id, !situacao.ativo);
            atualizar();
            setSucesso(situacao.ativo ? "Conta inativada." : "Conta ativada.");
            setSituacao(null);
        } catch (e) { setErro(mensagemContaFinanceira(e, "Não foi possível alterar a situação da conta.")); }
        finally { setProcessando(false); }
    }

    const grupos: { titulo: string; tipos: TipoContaFinanceira[]; cor: string }[] = [
        { titulo: "Saldo registrado total", tipos: Object.keys(rotulosTipoContaFinanceira) as TipoContaFinanceira[], cor: "primary.main" },
        { titulo: "Bancos", tipos: ["BANCO"], cor: "info.main" },
        { titulo: "Cofre financeiro", tipos: ["COFRE"], cor: "warning.main" },
        { titulo: "Carteiras digitais", tipos: ["CARTEIRA_DIGITAL"], cor: "success.main" },
        { titulo: "Outros", tipos: ["OUTROS"], cor: "secondary.main" },
    ];
    const colunas: Coluna<ContaFinanceira>[] = [
        { campo: "nome", cabecalho: "Conta", largura: 260, ordenavel: true, render: (_, conta) => <Box>
            <Typography variant="body2">{conta.nome}</Typography>
            {conta.tipo === "BANCO" && <Typography variant="caption" color="text.secondary">
                {conta.contaBancaria ? `${conta.contaBancaria.bancoNome} · ${conta.contaBancaria.numero}${conta.contaBancaria.digito ? `-${conta.contaBancaria.digito}` : ""}` : "Legado: vínculo bancário pendente"}
            </Typography>}
        </Box> },
        { campo: "tipo", cabecalho: "Tipo", largura: 180, ordenavel: true, render: (_, conta) => rotulosTipoContaFinanceira[conta.tipo] },
        { campo: "saldoAtual", cabecalho: "Saldo registrado", largura: 170, ordenavel: true, alinhar: "right", render: valor =>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moeda.format(Number(valor))}</Typography> },
        { campo: "aLiquidar", cabecalho: "A liquidar", largura: 170, alinhar: "right", render: (_, conta) => {
            if (conta.tipo !== "BANCO" && conta.tipo !== "CARTEIRA_DIGITAL") return <Typography color="text.secondary">—</Typography>;
            if (!recebimentosResumo) return <Typography color={erroRecebimentos ? "error.main" : "text.secondary"}>{erroRecebimentos ? "Indisponível" : "—"}</Typography>;
            const resumoConta = recebimentosResumo.find(r => r.contaDestinoId === conta.id);
            return <Stack spacing={0} sx={{ alignItems: "flex-end" }}>
                <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{moeda.format(resumoConta?.aLiquidar ?? 0)}</Typography>
                {!!resumoConta?.quantidadeSemValor && <Typography variant="caption" color="warning.main">+ valor não informado</Typography>}
            </Stack>;
        } },
        { campo: "ativo", cabecalho: "Situação", largura: 125, ordenavel: true, render: (_, conta) =>
            <Chip size="small" variant="outlined" label={conta.ativo ? "Ativa" : "Inativa"}
                color={conta.ativo ? "success" : "default"} /> },
        { campo: "acoes", cabecalho: "Ações", largura: 230, render: (_, conta) => <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", whiteSpace: "nowrap",
            "& .MuiIconButton-root": { width: 34, height: 34, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } } }}>
            <Button size="small" variant="contained" disableElevation startIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
                onClick={() => setExtratoId(conta.id)} aria-label={`Abrir extrato de ${conta.nome}`}>Extrato</Button>
            <Tooltip title="Editar conta"><IconButton size="small" aria-label={`Editar ${conta.nome}`} onClick={() => setEditor(conta)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Mais ações"><IconButton size="small" aria-label={`Mais ações da conta ${conta.nome}`} aria-haspopup="menu"
                aria-controls={menuAcoes?.conta.id === conta.id ? "menu-acoes-conta-financeira" : undefined}
                aria-expanded={menuAcoes?.conta.id === conta.id ? true : undefined}
                onClick={evento => setMenuAcoes({ ancora: evento.currentTarget, conta })}><MoreVertRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack> },
    ];
    const acoesTodas: AcaoTabela<ContaFinanceira>[] = [
        { rotulo: "PIX e cartões", icone: <PaymentsOutlinedIcon fontSize="small" />,
            onClick: conta => setRecebimentos({ contaId: conta.id, nome: conta.nome }), tooltip: "Consultar valores a liquidar e liquidados" },
        { rotulo: "Extrato", icone: <ReceiptLongOutlinedIcon fontSize="small" />, onClick: (conta) => setExtratoId(conta.id),
            cor: "primary", tooltip: "Ver extrato" },
        { rotulo: "Movimentar", icone: <SwapHorizRoundedIcon fontSize="small" />, onClick: (conta) => setMovimentarId(conta.id),
            desabilitado: (conta) => !conta.ativo, cor: "primary", tooltip: "Registrar entrada ou saída" },
        { rotulo: "Transferir", icone: <CompareArrowsRoundedIcon fontSize="small" />, onClick: (conta) => { setContasTransferencia(null); setTransferirId(conta.id); },
            desabilitado: (conta) => transferirId !== null || !conta.ativo || !tiposContaFinanceiraFuncionais.includes(conta.tipo), cor: "primary", tooltip: "Transferir" },
        { rotulo: "Editar", icone: <EditOutlinedIcon fontSize="small" />, onClick: setEditor, tooltip: "Editar conta" },
        { rotulo: "Alterar situação", icone: <PowerSettingsNewRoundedIcon fontSize="small" />,
            onClick: (conta) => { setErro(""); setSituacao(conta); }, tooltip: "Ativar ou inativar conta" },
    ];
    const acoesSecundarias = gerencial ? acoesTodas.filter(acao => acao.rotulo !== "Extrato" && acao.rotulo !== "Editar")
        : acoesTodas.filter(acao => !["Extrato", "Editar", "Transferir"].includes(acao.rotulo));
    const contaMovimentar = contas.find((conta) => conta.id === movimentarId);
    const contaExtrato = contas.find((conta) => conta.id === extratoId);
    const aLiquidar = recebimentosResumo?.filter(r => r.contaDestinoId !== null).reduce((soma, r) => soma + r.aLiquidar, 0);
    const semDestino = recebimentosResumo?.find(r => r.contaDestinoId === null);
    const semValor = recebimentosResumo?.reduce((total, r) => total + r.quantidadeSemValor, 0) ?? 0;

    return <PageContainer>
        <PageHeader titulo="Contas Financeiras"
            descricao="Consulte saldos registrados no ERP, extratos e valores a liquidar. O caixa físico do PDV é acompanhado na sessão operacional."
            acoesSecundarias={<Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setEditor(null)}>Nova conta</Button>} />
        {erro && !situacao && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro("")}
            action={contas.length === 0 ? <Button color="inherit" onClick={() => { setCarregando(true); setTentativa((n) => n + 1); }}>Tentar novamente</Button> : undefined}>{erro}</Alert>}
        {erroResumo && <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" onClick={atualizar}>Tentar novamente</Button>}>{erroResumo}</Alert>}
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 1 }}>
            Saldo registrado no ERP; não representa consulta bancária em tempo real. O total global inclui contas inativas e tipos legados, independentemente dos filtros.
        </Typography>
        <Box component="section" aria-label="Saldos por tipo de conta" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 1.5, mb: 2 }}>
            {grupos.map((grupo) => {
                const totais = resumo?.reduce((acumulado, item) => grupo.tipos.includes(item.tipo)
                    ? { saldo: acumulado.saldo + Number(item.saldoAtual), quantidade: acumulado.quantidade + item.quantidade }
                    : acumulado, { saldo: 0, quantidade: 0 });
                return <Paper key={grupo.titulo} variant="outlined" sx={{ p: 1.75, borderTop: 3, borderTopColor: grupo.cor, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">{grupo.titulo}</Typography>
                    <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, mt: 0.5, overflowWrap: "anywhere" }}>
                        {erroResumo ? "Indisponível" : resumo ? moeda.format(totais?.saldo ?? 0) : carregandoResumo ? <Skeleton aria-label="Consultando indicador" /> : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{erroResumo ? "Consulta não confirmada" : resumo ? `${totais?.quantidade ?? 0} ${(totais?.quantidade ?? 0) === 1 ? "conta" : "contas"}` : carregandoResumo ? "Consultando…" : "—"}</Typography>
                </Paper>;
            })}
        </Box>
        <Box component="section" aria-label="Previsão de PIX e cartões" sx={{ mb: 2 }}>
            {erroRecebimentos && <Alert severity="error" sx={{ mb: 1 }}
                action={<Button color="inherit" onClick={atualizar}>Tentar novamente</Button>}>{erroRecebimentos}</Alert>}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                <Typography variant="body2"><strong>A liquidar: {erroRecebimentos ? "Indisponível" : carregandoRecebimentos ? "Consultando…" : aLiquidar == null ? "—" : moeda.format(aLiquidar)}</strong> · PIX e cartões com destino registrado</Typography>
                <Button startIcon={<PaymentsOutlinedIcon />} onClick={() => setRecebimentos({})}>Ver PIX e cartões</Button>
            </Box>
            <Typography variant="caption" color="text.secondary">Valores previstos não compõem o saldo registrado nem representam dinheiro físico da sessão do PDV. Fechar o Caixa não liquida PIX ou cartões.</Typography>
            {semValor > 0 && <Alert severity="warning" sx={{ mt: 1 }}>{semValor} recebimento(s) com valor líquido não informado.
                A previsão soma somente valores conhecidos; confira o histórico antes de liquidar.</Alert>}
            {!!semDestino?.quantidadeALiquidar && <Alert severity="warning" sx={{ mt: 1 }}
                action={<Button color="inherit" onClick={() => setRecebimentos({ semDestino: true })}>Consultar</Button>}>
                {semDestino.quantidadeALiquidar} recebimento(s) sem destino histórico: {moeda.format(semDestino.aLiquidar)}. Não incluídos na previsão das contas.
            </Alert>}
        </Box>
        <PageFilters busca={{ placeholder: "Buscar por nome ou tipo", valor: busca,
            onChange: (valor) => { setBusca(valor); setPagina(0); } }}>
            <TextField select size="small" label="Situação" value={ativo} sx={{ minWidth: { xs: "100%", sm: 160 } }}
                onChange={e => { setAtivo(e.target.value as typeof ativo); setPagina(0); }}>
                <MenuItem value="">Todas</MenuItem><MenuItem value="true">Ativas</MenuItem><MenuItem value="false">Inativas</MenuItem>
            </TextField>
            <Button size="small" aria-expanded={filtrosExpandidos} aria-controls="filtros-contas-financeiras"
                onClick={() => setFiltrosExpandidos(v => !v)}>Mais filtros{tipo ? " · filtros ativos" : ""}</Button>
            <Collapse in={filtrosExpandidos} id="filtros-contas-financeiras" sx={{ width: "100%" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField select size="small" label="Tipo de conta" value={tipo} sx={{ minWidth: { xs: "100%", sm: 220 } }}
                        onChange={e => { setTipo(e.target.value as TipoContaFinanceira | ""); setPagina(0); }}>
                        <MenuItem value="">Todos os tipos</MenuItem>
                        {Object.entries(rotulosTipoContaFinanceira).map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
                    </TextField>
                    {(tipo || ativo || busca) && <Button size="small" onClick={() => { setBusca(""); setTipo(""); setAtivo(""); setPagina(0); }}>Limpar filtros</Button>}
                </Stack>
            </Collapse>
        </PageFilters>
        <AppTable colunas={colunas} linhas={contas} ordenacaoRemota
            sx={{ "& tbody .MuiTableCell-root": { py: 1, px: 1.5, verticalAlign: "middle" }, "& thead .MuiTableCell-root": { px: 1.5 },
                "& > footer": { gap: 1, py: 0.75, alignItems: { xs: "flex-start", sm: "center" } },
                "& .MuiTablePagination-actions .MuiIconButton-root": { width: 36, height: 36, border: 1, borderColor: "divider", borderRadius: 1 } }}
            ordenacao={{ ...ordenacao, onSort: (campo) => {
                setPagina(0); setOrdenacao((atual) => ({ campo, direcao: atual.campo === campo && atual.direcao === "asc" ? "desc" : "asc" }));
            } }}
            carregando={carregando} obterChaveLinha={(conta) => conta.id} minWidth={1120}
            vazio={{ titulo: "Nenhuma conta financeira encontrada", descricao: busca || tipo || ativo ? "Ajuste os filtros." : "Cadastre a primeira conta financeira." }}
            paginacao={{ pagina, linhasPorPagina: porPagina, total: totalItems,
                onPageChange: setPagina, onRowsPerPageChange: (valor) => { setPorPagina(valor); setPagina(0); },
                opcoesLinhasPorPagina: [10, 25, 50] }} />
        <Menu id="menu-acoes-conta-financeira" anchorEl={menuAcoes?.ancora} open={Boolean(menuAcoes)} onClose={() => setMenuAcoes(null)}
            slotProps={{ list: { "aria-label": "Ações secundárias da conta" } }}>
            {menuAcoes && acoesSecundarias.map(acao => <MenuItem key={acao.rotulo} disabled={acao.desabilitado?.(menuAcoes.conta)}
                onClick={() => { const conta = menuAcoes.conta; setMenuAcoes(null); acao.onClick(conta); }}>
                <ListItemIcon>{acao.icone}</ListItemIcon><ListItemText>{acao.rotulo === "Transferir" ? "Registrar transferência" : acao.rotulo}</ListItemText>
            </MenuItem>)}
        </Menu>
        <CofrePainel versao={tentativa} onAlterado={atualizar} />
        {editor !== undefined && <ContaFinanceiraDrawer key={editor?.id ?? "nova"} conta={editor}
            onFechar={() => setEditor(undefined)} onSalvo={() => { atualizar(); setEditor(undefined); setSucesso("Conta salva."); }} />}
        {contaMovimentar && <MovimentacaoFinanceiraDrawer key={contaMovimentar.id} conta={contaMovimentar}
            onFechar={() => setMovimentarId(null)} onSalvo={() => { setMovimentarId(null); setTentativa((n) => n + 1); setSucesso("Movimentação registrada."); }} />}
        {transferirId !== null && contasTransferencia && <TransferenciaFinanceiraDrawer contas={contasTransferencia} origemId={transferirId}
            onFechar={() => setTransferirId(null)} onSalvo={() => { setTransferirId(null); setTentativa((n) => n + 1); setSucesso("Transferência concluída."); }} />}
        {contaExtrato && <ExtratoFinanceiroDrawer key={contaExtrato.id} conta={contaExtrato}
            onFechar={() => setExtratoId(null)} onSaldoAlterado={() => { setTentativa((n) => n + 1); setSucesso("Movimentação estornada."); }} />}
        {recebimentos && <RecebimentosContaDrawer {...recebimentos} onFechar={() => setRecebimentos(null)} onAlterado={atualizar} />}
        <Dialog open={situacao !== null} onClose={processando ? undefined : () => setSituacao(null)} aria-labelledby="situacao-conta-titulo">
            <DialogTitle id="situacao-conta-titulo">{situacao?.ativo ? "Inativar conta?" : "Ativar conta?"}</DialogTitle>
            <DialogContent>
                <Typography variant="body2">{situacao?.nome}</Typography>
                {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
            </DialogContent>
            <DialogActions><Button onClick={() => setSituacao(null)} disabled={processando}>Voltar</Button>
                <Button variant="contained" onClick={() => void confirmarSituacao()} disabled={processando}>
                    {processando ? "Salvando…" : "Confirmar"}
                </Button></DialogActions>
        </Dialog>
        <Snackbar open={Boolean(sucesso)} autoHideDuration={4000} onClose={() => setSucesso("")} message={sucesso} />
    </PageContainer>;
}
