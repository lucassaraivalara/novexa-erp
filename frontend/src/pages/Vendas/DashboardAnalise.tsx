import { useMemo, type ReactNode } from "react";
import { Alert, Box, Chip, LinearProgress, Paper, Skeleton, Stack, Typography, useTheme } from "@mui/material";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DiaAnalise, IndicadoresVendas, ResumoAnaliseVendas } from "../../services/analiseVendasService";
import { formatarData } from "../../utils/dataHora";
import { moedaVenda } from "./centralVendasUtils";
import { variacao } from "./analiseVendasUtils";
import { useDistribuicoesAnalise } from "./useDistribuicoesAnalise";

const cores = ["#2ed4b5", "#3295fa", "#ab7aee", "#ffb668", "#afc8ed"];
const mudanca = (a: number, b: number) => b <= 0 ? (a === 0 ? "Sem varia\u00e7\u00e3o" : "Sem base anterior") : variacao(a, b).split("%")[0] + "%";
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const indicadores = [
    { key: "faturamento", titulo: "Faturamento", cor: cores[0], Icon: BarChartRoundedIcon },
    { key: "quantidadeVendas", titulo: "Vendas realizadas", cor: cores[1], Icon: ShoppingCartOutlinedIcon },
    { key: "ticketMedio", titulo: "Ticket médio", cor: cores[2], Icon: ConfirmationNumberOutlinedIcon },
    { key: "descontos", titulo: "Descontos concedidos", cor: cores[3], Icon: PercentRoundedIcon },
] as const;
function valor(key: keyof IndicadoresVendas, n: number) { return key === "quantidadeVendas" ? n.toLocaleString("pt-BR") : moedaVenda(n); }
function Painel({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
    return <Paper variant="outlined" component="section" aria-label={titulo} sx={{ p: { xs: 2, xl: 2.5 }, minWidth: 0, height: "100%", borderRadius: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2, color: "text.primary" }}><Box sx={{ color: "var(--analise-accent)" }}>{icone}</Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{titulo}</Typography></Stack>{children}
    </Paper>;
}
function Tendencia({ dias, campo, cor }: { dias: DiaAnalise[]; campo: Exclude<keyof IndicadoresVendas, "participacaoDescontos">; cor: string }) {
    if (!dias.length || dias.some(d => typeof d[campo] !== "number")) return null;
    return <Box aria-hidden="true" sx={{ width: 64, height: 28, flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={dias}><Line type="linear" dataKey={campo} stroke={cor} strokeWidth={1.7} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></Box>;
}
export default function DashboardAnalise({ resumo }: { resumo: ResumoAnaliseVendas }) {
    const theme = useTheme(), dark = theme.palette.mode === "dark";
    const distribuicoes = useDistribuicoesAnalise(resumo.periodo);
    const serie = useMemo(() => resumo.evolucao.map((d, i) => ({ ...d, anterior: resumo.evolucaoAnterior[i]?.faturamento ?? null, dataAnterior: resumo.evolucaoAnterior[i]?.data })), [resumo]);
    const destaques = useMemo(() => {
        if (!resumo.atual.quantidadeVendas || !serie.length) return [];
        const ordenados = [...serie].sort((a, b) => b.faturamento - a.faturamento || a.data.localeCompare(b.data));
        return [ordenados[0], [...serie].sort((a, b) => a.faturamento - b.faturamento || a.data.localeCompare(b.data))[0]];
    }, [resumo.atual.quantidadeVendas, serie]);
    const tip = { background: dark ? "#11283b" : "#fff", border: `1px solid ${theme.palette.divider}`, borderRadius: 8, color: theme.palette.text.primary };
    const categorias = distribuicoes.categorias;
    return <Box sx={{ "--analise-accent": dark ? "#23dbc8" : "#007f77", "& .MuiPaper-root": { backgroundImage: "none", bgcolor: dark ? "#102638" : "background.paper", borderColor: dark ? "#234257" : "divider" }, fontVariantNumeric: "tabular-nums" }}>
        <Box component="section" aria-label="Resumo do período" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }, gap: 2, mb: 2 }}>
            {indicadores.map(({ key, titulo, cor, Icon }) => <Paper key={key} variant="outlined" sx={{ p: { xs: 1.5, xl: 2 }, borderRadius: 2.5, display: "flex", gap: { xs: 1.25, xl: 1.5 }, minWidth: 0, alignItems: "flex-start" }}>
                <Box sx={{ width: { xs: 40, xl: 48 }, height: { xs: 40, xl: 48 }, borderRadius: "50%", bgcolor: `${cor}25`, color: cor, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon sx={{ fontSize: { xs: 24, xl: 27 } }} /></Box>
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" noWrap>{titulo}</Typography><Stack direction="row" sx={{ alignItems: "center", gap: .75, flexWrap: "nowrap", my: .25, minWidth: 0 }}><Typography sx={{ fontSize: { xs: 22, lg: 21, xl: 27 }, fontWeight: 750, lineHeight: 1.2, whiteSpace: "nowrap", letterSpacing: { xs: -.35, xl: "normal" } }}>{valor(key, resumo.atual[key])}</Typography>{key !== "descontos" && <Chip size="small" label={mudanca(resumo.atual[key], resumo.anterior[key])} sx={{ flexShrink: 0, height: 23, "& .MuiChip-label": { px: .75 }, bgcolor: resumo.atual[key] >= resumo.anterior[key] ? `${cores[0]}22` : "#f4718122", color: resumo.atual[key] >= resumo.anterior[key] ? (dark ? "#5ee0c6" : "#006852") : (dark ? "#ffa5b1" : "#a31d39") }} />}</Stack>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: .5, minWidth: 0 }}><Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>{key === "descontos" ? `${resumo.atual.participacaoDescontos === undefined ? "" : pct(resumo.atual.participacaoDescontos) + " · "}Sobre bruto` : `Anterior: ${valor(key, resumo.anterior[key])}`}</Typography><Tendencia dias={resumo.evolucao} campo={key} cor={cor} /></Stack>
                </Box>
            </Paper>)}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,2.15fr) minmax(290px,1fr)" }, gap: 1.5, mb: 1.5 }}>
            <Painel titulo="Evolução do faturamento" icone={<CalendarMonthOutlinedIcon />}>
                <Typography variant="body2" color="text.secondary" sx={{ mt: -1, mb: 2 }}>Faturamento diário em reais comparado ao período anterior.</Typography>
                <Box role="img" aria-label={"Faturamento di\u00e1rio atual e anterior"} sx={{ height: { xs: 210, md: 220, xl: 250 }, minWidth: 0 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={serie} margin={{ top: 30, right: 10, left: 0, bottom: 0 }} accessibilityLayer>
                    <CartesianGrid vertical={false} stroke={theme.palette.divider} strokeDasharray="4 4" /><XAxis dataKey="data" tickFormatter={d => formatarData(d).slice(0, 5)} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis tickFormatter={n => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 0 }).format(n)} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload ? `${formatarData(p[0].payload.data)} · anterior ${formatarData(p[0].payload.dataAnterior)}` : ""} formatter={v => moedaVenda(Number(v))} /><Bar name="Faturamento (atual)" dataKey="faturamento" fill={cores[1]} radius={[4, 4, 0, 0]} maxBarSize={65} isAnimationActive={false} /><Line name="Faturamento (período anterior)" dataKey="anterior" stroke={dark ? "#c8deef" : "#536a87"} strokeDasharray="4 4" strokeWidth={2} dot={serie.length <= 31 ? { r: 3 } : false} isAnimationActive={false} />
                {serie.length <= 31 && destaques.filter((d, i, todos) => i === 0 || d.data !== todos[0].data).map((d, i) => <ReferenceDot key={i} x={d.data} y={d.faturamento} r={5} fill={i ? "#ff8798" : cores[0]} stroke={theme.palette.background.paper} label={{ value: `${i ? "Menor" : "Maior"}: ${moedaVenda(d.faturamento)}`, position: "top", fill: theme.palette.text.primary, fontSize: 11 }} />)}
                </ComposedChart></ResponsiveContainer></Box>
                <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", mt: 1 }}><Typography variant="caption" color="text.secondary">● Faturamento (atual)</Typography><Typography variant="caption" color="text.secondary">┄ Faturamento (período anterior)</Typography></Stack>
                <Box component="details" sx={{ mt: 1 }}><Typography component="summary" variant="caption" sx={{ cursor: "pointer" }}>Consultar valores diários</Typography><Box sx={{ maxHeight: 200, overflowY: "auto" }}><table aria-label={"Valores di\u00e1rios da evolu\u00e7\u00e3o"} style={{ width: "100%", fontSize: 12 }}><thead><tr><th>Dia atual</th><th>Faturamento atual</th><th>Dia anterior</th><th>Faturamento anterior</th></tr></thead><tbody>{serie.map(d => <tr key={d.data}><td>{formatarData(d.data)}</td><td>{moedaVenda(d.faturamento)}</td><td>{formatarData(d.dataAnterior)}</td><td>{d.anterior === null ? "Não disponível" : moedaVenda(d.anterior)}</td></tr>)}</tbody></table></Box></Box>
            </Painel>
            <Stack spacing={1.25}><Painel titulo="Destaques do período" icone={<CalendarMonthOutlinedIcon />}><Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 1 }}>
                {destaques.length ? destaques.map((d, i) => <Box key={i} sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 2 }}><Box sx={{ color: i ? "error.main" : "var(--analise-accent)", mb: .5 }}>{i ? <TrendingDownRoundedIcon /> : <EmojiEventsOutlinedIcon />}</Box><Typography variant="caption" color="text.secondary">{i ? "Pior dia do período" : "Melhor dia do período"}</Typography><Typography variant="body2" sx={{ my: .25 }}>{formatarData(d.data)}</Typography><Typography sx={{ fontSize: 21, fontWeight: 750 }}>{moedaVenda(d.faturamento)}</Typography><Typography variant="caption" color="text.secondary">{resumo.atual.faturamento > 0 ? pct(d.faturamento / resumo.atual.faturamento * 100) : "0%"} do faturamento</Typography></Box>) : <Typography variant="body2" color="text.secondary">Sem vendas faturadas para destacar.</Typography>}
            </Box></Painel><Painel titulo="Meta de faturamento" icone={<TrackChangesRoundedIcon />}><Typography sx={{ fontSize: 24, fontWeight: 700 }}>{moedaVenda(resumo.atual.faturamento)}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Meta não configurada</Typography><Typography variant="caption" color="text.secondary">Sem configuração de metas disponível.</Typography></Painel></Stack>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>
            <Painel titulo="Formas de pagamento" icone={<CreditCardOutlinedIcon />}>
                <Typography variant="caption" color="text.secondary">Distribuição comercial · não representa liquidação bancária</Typography>
                {distribuicoes.erroPagamentos ? <Alert severity="warning">{distribuicoes.erroPagamentos}</Alert> : !distribuicoes.pagamentos ? <Skeleton height={160} /> : distribuicoes.pagamentos.faturamentoPeriodo !== resumo.atual.faturamento ? <Alert severity="warning">Os totais mudaram. Atualize a consulta.</Alert> : !distribuicoes.pagamentos.items.length ? <Typography sx={{ py: 3 }}>Sem pagamentos comerciais no período.</Typography> : <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ width: 160, height: 170, position: "relative", mx: "auto" }}><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={distribuicoes.pagamentos.items} nameKey="nome" dataKey="valor" innerRadius={50} outerRadius={72} paddingAngle={1} stroke="none" isAnimationActive={false}>{distribuicoes.pagamentos.items.map((p, i) => <Cell key={p.nome} fill={cores[i % cores.length]} />)}</Pie><Tooltip contentStyle={tip} formatter={v => moedaVenda(Number(v))} /></PieChart></ResponsiveContainer><Box sx={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center", pointerEvents: "none" }}><Typography variant="caption" sx={{ fontWeight: 700 }}>{moedaVenda(resumo.atual.faturamento)}</Typography><Typography variant="caption" color="text.secondary">Comercial</Typography></Box></Box>
                    <Stack spacing={1} sx={{ flex: 1, minWidth: 180 }}>{distribuicoes.pagamentos.items.map((p, i) => <Stack direction="row" key={p.nome} sx={{ gap: .75, alignItems: "center" }}><Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: cores[i % cores.length], flexShrink: 0 }} /><Typography variant="caption" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{p.nome}</Typography><Typography variant="caption">{pct(p.participacao)}</Typography><Typography variant="caption" sx={{ minWidth: 80, textAlign: "right" }}>{moedaVenda(p.valor)}</Typography></Stack>)}</Stack>
                </Box>}
            </Painel>
            <Painel titulo="Top 5 categorias" icone={<SellOutlinedIcon />}>
                <Typography variant="caption" color="text.secondary">Classificação atual · valores após rateio de descontos</Typography>
                {distribuicoes.erroCategorias ? <Alert severity="warning">{distribuicoes.erroCategorias}</Alert> : !categorias ? <Skeleton height={160} /> : categorias.faturamentoPeriodo !== resumo.atual.faturamento ? <Alert severity="warning">Os totais mudaram. Atualize a análise para reconciliar as seções.</Alert> : !categorias.items.length ? <Typography sx={{ py: 3 }}>Sem categorias no período.</Typography> : <Stack spacing={2} sx={{ mt: 2 }}>{categorias.items.slice(0, 5).map((c, i) => <Box key={c.categoriaId ?? "sem"} sx={{ display: "grid", gridTemplateColumns: "minmax(55px,1fr) minmax(30px,1fr) auto auto", alignItems: "center", gap: 1 }}><Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>{c.nome}</Typography><LinearProgress aria-label={c.nome} variant="determinate" value={Math.min(100, c.participacao)} sx={{ height: 12, borderRadius: 1, bgcolor: dark ? "#213c51" : "#e4edf3", "& .MuiLinearProgress-bar": { borderRadius: 1, bgcolor: cores[i % cores.length] } }} /><Typography variant="caption">{pct(c.participacao)}</Typography><Typography variant="caption" sx={{ textAlign: "right" }}>{moedaVenda(c.valorVendido)}</Typography></Box>)}</Stack>}
            </Painel>
            <Painel titulo="Comparação com o período anterior" icone={<BarChartRoundedIcon />}><Stack spacing={0}>{indicadores.map(({ key, titulo }) => <Box key={key} sx={{ py: .9, borderBottom: 1, borderColor: "divider", display: "flex", gap: .75, alignItems: "center", flexWrap: "wrap" }}><Typography variant="body2" sx={{ flex: 1, fontSize: { xs: "0.875rem", lg: 12, xl: "0.875rem" } }}>{titulo}</Typography><Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: "0.875rem", lg: 12, xl: "0.875rem" } }}>{valor(key, resumo.atual[key])}</Typography><Typography variant="caption" sx={{ width: { lg: 82, xl: 115 }, textAlign: "right" }} title={`Anterior: ${valor(key, resumo.anterior[key])}`}>{mudanca(resumo.atual[key], resumo.anterior[key])}</Typography></Box>)}</Stack></Painel>
        </Box>
    </Box>;
}
