import { Box, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useTheme } from "@mui/material";
import type { ResumoAnaliseVendas } from "../../services/analiseVendasService";
import { formatarData } from "../../utils/dataHora";
import { moedaVenda } from "./centralVendasUtils";

export default function EvolucaoVendas({ resumo }: { resumo: ResumoAnaliseVendas }) {
    const theme = useTheme();
    const atual = resumo.evolucao, anterior = resumo.evolucaoAnterior;
    const teto = Math.max(1, ...atual.map(d => d.faturamento), ...anterior.map(d => d.faturamento));
    const x = (indice: number) => 12 + (atual.length === 1 ? 438 : indice * 876 / (atual.length - 1));
    const y = (valor: number) => 205 - valor / teto * 190;
    const linha = (dias: typeof atual) => dias.map((d, i) => `${x(i)},${y(d.faturamento)}`).join(" ");
    const eixo = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
    const rotulo = (p: ResumoAnaliseVendas["periodoAnterior"]) => `${formatarData(p.dataInicial)} a ${formatarData(p.dataFinal)}`;

    return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 1, justifyContent: "space-between", mb: 2 }}>
            <Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650 }}>Evolução das vendas</Typography><Typography variant="body2" color="text.secondary">Faturamento diário em reais · dias alinhados pela posição no período</Typography></Box>
            <Stack spacing={0.5}>
                {[false, true].map(anterior => <Stack key={String(anterior)} direction="row" sx={{ gap: 1, alignItems: "center" }}>
                    <Box component="span" sx={{ width: 24, borderTop: "2px", borderTopStyle: anterior ? "dashed" : "solid", borderColor: anterior ? "text.secondary" : "primary.main" }} />
                    <Typography variant="caption" color="text.secondary">{anterior ? "Anterior" : "Atual"}: {rotulo(anterior ? resumo.periodoAnterior : resumo.periodo)}</Typography>
                </Stack>)}
            </Stack>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr)", columnGap: 0.5 }}>
            <Stack sx={{ justifyContent: "space-between", height: 220, py: "10px", textAlign: "right" }}>
                {[teto, teto / 2, 0].map((valor, i) => <Typography key={i} variant="caption" color="text.secondary" title={moedaVenda(valor)}>{eixo.format(valor)}</Typography>)}
            </Stack>
            <Box component="svg" viewBox="0 0 900 220" preserveAspectRatio="none" role="img" aria-labelledby="evolucao-titulo" aria-describedby="evolucao-descricao" sx={{ width: "100%", height: 220, overflow: "visible" }}>
                <title id="evolucao-titulo">Faturamento diário atual e anterior</title>
                <desc id="evolucao-descricao">Linha contínua com círculos: período atual. Linha tracejada com quadrados: período anterior. Valores completos disponíveis na tabela abaixo.</desc>
                {[0, teto / 2, teto].map((valor, i) => <line key={i} x1="0" x2="900" y1={y(valor)} y2={y(valor)} stroke={theme.palette.divider} strokeDasharray={i ? "4 4" : undefined} vectorEffect="non-scaling-stroke" />)}
                <polyline points={linha(anterior)} fill="none" stroke={theme.palette.text.secondary} strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
                <polyline points={linha(atual)} fill="none" stroke={theme.palette.primary.main} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                {anterior.map((d, i) => <rect key={d.data} x={x(i) - 3} y={y(d.faturamento) - 3} width="6" height="6" fill={theme.palette.text.secondary}><title>Anterior: {formatarData(d.data)} · {moedaVenda(d.faturamento)}</title></rect>)}
                {atual.map((d, i) => <circle key={d.data} cx={x(i)} cy={y(d.faturamento)} r="3.5" fill={theme.palette.background.paper} stroke={theme.palette.primary.main} strokeWidth="2" vectorEffect="non-scaling-stroke"><title>Atual: {formatarData(d.data)} · {moedaVenda(d.faturamento)}</title></circle>)}
            </Box>
            <Box sx={{ gridColumn: 2, display: "flex", justifyContent: "space-between", gap: 1, mt: 0.5 }}>
                {[...new Set([0, Math.floor((atual.length - 1) / 2), atual.length - 1])].map(i => <Typography key={i} variant="caption" color="text.secondary">{formatarData(atual[i]?.data)}</Typography>)}
            </Box>
        </Box>
        <Box component="details" sx={{ mt: 2 }}>
            <Typography component="summary" variant="body2" sx={{ cursor: "pointer", color: "primary.main", width: "fit-content", p: 0.5, "&:focus-visible": { outline: "2px solid", outlineOffset: 2 } }}>Consultar valores diários</Typography>
            <TableContainer sx={{ maxHeight: 320, mt: 1 }}>
                <Table size="small" stickyHeader aria-label="Valores diários da evolução">
                    <TableHead><TableRow><TableCell>Dia atual</TableCell><TableCell align="right">Faturamento atual</TableCell><TableCell>Dia anterior</TableCell><TableCell align="right">Faturamento anterior</TableCell></TableRow></TableHead>
                    <TableBody>{atual.map((d, i) => <TableRow key={d.data}><TableCell>{formatarData(d.data)}</TableCell><TableCell align="right">{moedaVenda(d.faturamento)}</TableCell><TableCell>{formatarData(anterior[i]?.data)}</TableCell><TableCell align="right">{moedaVenda(anterior[i]?.faturamento ?? 0)}</TableCell></TableRow>)}</TableBody>
                </Table>
            </TableContainer>
        </Box>
    </Paper>;
}
