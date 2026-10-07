import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import WarehouseRoundedIcon from "@mui/icons-material/WarehouseRounded";
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Typography,
} from "@mui/material";
import { buscarResumoDashboard, mensagemDashboard, type DashboardResumo } from "../../services/dashboardService";
import { listarVendasPaginado, type VendaResumo } from "../../services/vendaService";
import { dataHoraVenda, moedaVenda, rotulosStatus } from "../Vendas/centralVendasUtils";

const corStatus = (status: VendaResumo["status"]) =>
    status === "FATURADA" ? "success" : status === "CANCELADA" ? "default" : "warning";

export default function Dashboard() {
    const [resumo, setResumo] = useState<DashboardResumo | null>(null);
    const [ultimasVendas, setUltimasVendas] = useState<VendaResumo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [erroVendas, setErroVendas] = useState("");

    const carregar = useCallback((signal?: AbortSignal) => {
        return buscarResumoDashboard(signal).then(async (dadosResumo) => {
            setResumo(dadosResumo);
            if (!signal?.aborted) setCarregando(false);

            try {
                const vendas = await listarVendasPaginado({}, 0, 5, "dataHora,desc", signal);
                setUltimasVendas(vendas.items);
            } catch {
                if (!signal?.aborted) setErroVendas("Não foi possível carregar as últimas vendas.");
            }
        }, (e) => {
            if (!signal?.aborted) {
                setErro(mensagemDashboard(e));
                setCarregando(false);
            }
        });
    }, []);

    function recarregar() {
        setCarregando(true);
        setErro("");
        setErroVendas("");
        void carregar();
    }

    useEffect(() => {
        const controller = new AbortController();
        void carregar(controller.signal);
        return () => controller.abort();
    }, [carregar]);

    const hoje = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

    return <Stack spacing={{ xs: 1.5, md: 1.75 }}>
        <Stack direction="row" sx={{ minHeight: 32, alignItems: "center", justifyContent: "flex-end" }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: "text.secondary" }}>
                <CalendarMonthOutlinedIcon sx={{ fontSize: 17, color: "primary.main" }} />
                <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600 }}>Movimento de hoje</Typography>
                <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" }, fontSize: 12 }}>· Hoje, {hoje}</Typography>
            </Stack>
        </Stack>

        {erro && <Alert severity="error" action={<Button color="inherit" onClick={recarregar}>Tentar novamente</Button>}>{erro}</Alert>}

        {carregando && !resumo ? <DashboardSkeleton /> : resumo && <>
            <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" } }}>
                <MetricCard titulo="Faturamento hoje" valor={moedaVenda(resumo.faturamentoHoje)} detalhe="Vendas faturadas" icone={<PaymentsOutlinedIcon />} tom="green" />
                <MetricCard titulo="Vendas hoje" valor={resumo.quantidadeVendasHoje} detalhe="Vendas faturadas" icone={<PointOfSaleRoundedIcon />} tom="blue" />
                <MetricCard titulo="Caixas abertos" valor={resumo.sessoesCaixaAbertas.length} detalhe={resumo.sessoesCaixaAbertas.length === 1 ? "Sessão em andamento" : "Sessões em andamento"} icone={<StorefrontRoundedIcon />} tom="green" />
                <MetricCard titulo="Ticket médio hoje" valor={moedaVenda(resumo.ticketMedioHoje)} detalhe="Média por venda" icone={<ConfirmationNumberOutlinedIcon />} tom="blue" />
                <MetricCard titulo="Estoque baixo" valor={resumo.quantidadeProdutosEstoqueBaixo} detalhe="Produtos no mínimo ou abaixo" icone={<WarehouseRoundedIcon />} tom="amber" />
                <MetricCard titulo="Clientes ativos" valor={resumo.quantidadeClientesAtivos} detalhe="Cadastros disponíveis" icone={<PeopleAltRoundedIcon />} tom="teal" />
            </Box>

            <Box sx={{ display: "grid", gap: 1.5, alignItems: "stretch", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.85fr) minmax(260px, 1fr)" } }}>
                <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 1.75 }, minWidth: 0 }}>
                    <SectionHeading icone={<StorefrontRoundedIcon />} titulo="Caixa operacional">
                        <Chip size="small" color={resumo.sessoesCaixaAbertas.length ? "success" : "default"}
                            label={resumo.sessoesCaixaAbertas.length ? "Caixa aberto" : "Caixa fechado"} />
                    </SectionHeading>
                    {resumo.sessoesCaixaAbertas.length === 0 ? <Stack direction={{ xs: "column", sm: "row" }} sx={{ minHeight: 112, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: "#F2F6F8" }}>
                        <Box>
                            <Typography sx={{ fontSize: 17, fontWeight: 700 }}>Nenhum caixa aberto no momento.</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Abra um caixa para iniciar as vendas.</Typography>
                        </Box>
                        <Button size="small" variant="outlined" component={Link} to="/financeiro/caixas" sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}>Abrir caixa</Button>
                    </Stack> : <>
                        <Box sx={{ display: "grid", gap: 1, p: 1.5, borderRadius: 2, bgcolor: "#EAF7F3" }}>
                            {resumo.sessoesCaixaAbertas.map(sessao => <Stack key={sessao.sessaoId} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, py: 0.25 }}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: 15, fontWeight: 700 }} noWrap>{sessao.descricaoCaixa}</Typography>
                                    <Typography variant="caption" color="text.secondary">Saldo inicial {moedaVenda(sessao.saldoInicial)}</Typography>
                                </Box>
                                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                                    <Typography variant="caption" color="text.secondary">Esperado em dinheiro</Typography>
                                    <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{moedaVenda(sessao.saldoEsperadoDinheiro)}</Typography>
                                </Box>
                            </Stack>)}
                        </Box>
                        <Stack direction="row" sx={{ justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
                            <Button size="small" variant="outlined" component={Link} to="/financeiro/caixas">Ver caixa</Button>
                            <Button size="small" variant="contained" component={Link} to="/pdv" startIcon={<AddShoppingCartRoundedIcon fontSize="small" />}>Vender</Button>
                        </Stack>
                    </>}
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 1.75 }, minWidth: 0 }}>
                    <SectionHeading icone={<ArrowForwardRoundedIcon />} titulo="Ações rápidas" />
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        <QuickAction to="/pdv" titulo="Nova venda" descricao="Abrir PDV" icone={<AddShoppingCartRoundedIcon />} tom="green" />
                        <QuickAction to="/estoque?aba=entradas" titulo="Entrada de mercadoria" descricao="Acessar entradas" icone={<Inventory2OutlinedIcon />} tom="blue" />
                        <QuickAction to="/vendas" titulo="Confirmar PIX" descricao="Acessar vendas e pagamentos" icone={<QrCode2RoundedIcon />} tom="amber" />
                        <QuickAction to="/financeiro/contas-pagar" titulo="Pagar conta" descricao="Contas a Pagar" icone={<ReceiptLongRoundedIcon />} tom="teal" />
                    </Box>
                </Paper>
            </Box>

            <Box sx={{ display: "grid", gap: 1.5, alignItems: "stretch", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.85fr) minmax(260px, 1fr)" } }}>
                <Paper variant="outlined" sx={{ overflow: "hidden", minWidth: 0 }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: { xs: 1.5, md: 1.75 }, py: 1.25 }}>
                        <SectionHeading icone={<PointOfSaleRoundedIcon />} titulo="Últimas vendas" />
                        <Button size="small" component={Link} to="/vendas" sx={{ minWidth: 0, px: 1 }}>Ver todas</Button>
                    </Stack>
                    {erroVendas ? <Alert severity="warning" sx={{ mx: 1.5, mb: 1.5 }}>{erroVendas}</Alert>
                        : ultimasVendas.length === 0
                        ? <Typography color="text.secondary" sx={{ px: 1.75, pb: 2, fontSize: 13 }}>Nenhuma venda registrada.</Typography>
                        : <TableContainer sx={{ overflowX: "hidden" }}>
                            <Table size="small" aria-label="Últimas vendas" sx={{ tableLayout: "fixed" }}>
                                <TableHead><TableRow>
                                    <TableCell sx={{ width: { xs: "42%", sm: "12%" }, px: 1.25 }}>Venda</TableCell>
                                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, width: "19%", px: 1 }}>Data / hora</TableCell>
                                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, px: 1 }}>Cliente</TableCell>
                                    <TableCell align="right" sx={{ width: { xs: "30%", sm: "20%" }, px: 1 }}>Total</TableCell>
                                    <TableCell sx={{ width: { xs: "28%", sm: "18%" }, px: 1 }}>Status</TableCell>
                                </TableRow></TableHead>
                                <TableBody>{ultimasVendas.map(venda => <TableRow key={venda.id} hover>
                                    <TableCell sx={{ px: 1.25, overflow: "hidden" }}>
                                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>#{venda.id}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: "block", sm: "none" }, fontSize: 10 }}>{venda.nomeCliente || "Consumidor final"}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" }, fontSize: 10 }}>{dataHoraVenda(venda.dataHora)}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, px: 1, fontSize: 12 }}>{dataHoraVenda(venda.dataHora)}</TableCell>
                                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, px: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{venda.nomeCliente || "Consumidor final"}</TableCell>
                                    <TableCell align="right" sx={{ px: 1, fontSize: 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{moedaVenda(venda.total)}</TableCell>
                                    <TableCell sx={{ px: 0.75 }}><Chip size="small" color={corStatus(venda.status)} label={rotulosStatus[venda.status]} sx={{ fontSize: 10, maxWidth: "100%" }} /></TableCell>
                                </TableRow>)}</TableBody>
                            </Table>
                        </TableContainer>}
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 1.75 }, minWidth: 0 }}>
                    <SectionHeading icone={<WarehouseRoundedIcon />} titulo="Alertas operacionais" />
                    {resumo.quantidadeProdutosEstoqueBaixo > 0 ? <ButtonBase component={Link} to="/estoque" aria-label={`${resumo.quantidadeProdutosEstoqueBaixo} produtos abaixo do mínimo. Revisar estoque.`} sx={{ width: "100%", textAlign: "left", borderRadius: 2 }}>
                        <Paper variant="outlined" sx={{ display: "flex", width: "100%", alignItems: "center", gap: 1.25, p: 1.25, bgcolor: "#FFF7E9", borderColor: "#F4E4C8", boxShadow: "none" }}>
                            <ToneIcon tom="amber"><WarehouseRoundedIcon /></ToneIcon>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{resumo.quantidadeProdutosEstoqueBaixo} produtos abaixo do mínimo</Typography>
                                <Typography variant="caption" color="text.secondary">Revise o estoque e evite falta de produtos.</Typography>
                            </Box>
                            <ArrowForwardRoundedIcon sx={{ ml: "auto", flexShrink: 0, fontSize: 17, color: "warning.main" }} />
                        </Paper>
                    </ButtonBase> : <Typography color="text.secondary" sx={{ py: 1.5, fontSize: 13 }}>Nenhum alerta operacional no momento.</Typography>}
                </Paper>
            </Box>
        </>}
    </Stack>;
}

type Tone = "green" | "blue" | "amber" | "teal";

function ToneIcon({ tom, children }: { tom: Tone; children: ReactNode }) {
    const colors: Record<Tone, { color: string; background: string }> = {
        green: { color: "#07866D", background: "#E4F5EF" },
        blue: { color: "#2563EB", background: "#EAF2FF" },
        amber: { color: "#D97706", background: "#FFF2DD" },
        teal: { color: "#0E7C66", background: "#E6F4F0" },
    };
    return <Box sx={{ display: "grid", width: 34, height: 34, flexShrink: 0, placeItems: "center", borderRadius: 1.5, color: colors[tom].color, bgcolor: colors[tom].background, "& svg": { fontSize: 20 } }}>{children}</Box>;
}

function MetricCard({ titulo, valor, detalhe, icone, tom }: { titulo: string; valor: ReactNode; detalhe: string; icone: ReactNode; tom: Tone }) {
    return <Paper variant="outlined" sx={{ display: "flex", minWidth: 0, minHeight: 136, flexDirection: "column", p: 1.25, gap: 0.75 }}>
        <Stack direction="row" spacing={0.75} sx={{ minWidth: 0, alignItems: "center" }}>
            <ToneIcon tom={tom}>{icone}</ToneIcon>
            <Typography noWrap sx={{ minWidth: 0, fontSize: 12, fontWeight: 600, color: "text.secondary" }}>{titulo}</Typography>
        </Stack>
        <Typography noWrap sx={{ mt: "auto", fontSize: { xs: 19, md: 21 }, lineHeight: 1.15, fontWeight: 750, color: "#18283D", fontVariantNumeric: "tabular-nums" }}>{valor}</Typography>
        <Typography noWrap variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>{detalhe}</Typography>
    </Paper>;
}

function SectionHeading({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
    return <Stack direction="row" sx={{ minWidth: 0, alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
        <Stack direction="row" spacing={0.75} sx={{ minWidth: 0, alignItems: "center" }}>
            <Box sx={{ display: "grid", color: "#21344E", "& svg": { fontSize: 20 } }}>{icone}</Box>
            <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, color: "#17283F" }}>{titulo}</Typography>
        </Stack>
        {children}
    </Stack>;
}

function QuickAction({ to, titulo, descricao, icone, tom }: { to: string; titulo: string; descricao: string; icone: ReactNode; tom: Tone }) {
    return <ButtonBase component={Link} to={to} aria-label={`${titulo}: ${descricao}`} sx={{ minWidth: 0, borderRadius: 2, textAlign: "left", "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
        <Paper variant="outlined" sx={{ display: "flex", width: "100%", minHeight: 68, alignItems: "center", gap: 1, p: 1, boxShadow: "none", transition: "background-color 120ms ease", "&:hover": { bgcolor: "action.hover" } }}>
            <ToneIcon tom={tom}>{icone}</ToneIcon>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 12, lineHeight: 1.25, fontWeight: 700 }}>{titulo}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "block" }, fontSize: 10, lineHeight: 1.2 }}>{descricao}</Typography>
            </Box>
            <ArrowForwardRoundedIcon sx={{ flexShrink: 0, fontSize: 16, color: "text.secondary" }} />
        </Paper>
    </ButtonBase>;
}

function DashboardSkeleton() {
    return <Stack spacing={1.5} aria-label="Carregando resumo operacional">
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" } }}>
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} variant="rounded" height={136} />)}
        </Box>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.85fr) minmax(260px, 1fr)" } }}>
            <Skeleton variant="rounded" height={205} />
            <Skeleton variant="rounded" height={205} />
        </Box>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.85fr) minmax(260px, 1fr)" } }}>
            <Skeleton variant="rounded" height={250} />
            <Skeleton variant="rounded" height={250} />
        </Box>
    </Stack>;
}
