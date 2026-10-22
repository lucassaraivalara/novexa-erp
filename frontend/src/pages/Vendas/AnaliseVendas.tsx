import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Menu, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import LoadingState from "../../components/ui/LoadingState";
import { consultarResumoVendas, exportarAnalise, type CriterioRanking, type PeriodoAnalise, type ResumoAnaliseVendas, type SecaoExportacao } from "../../services/analiseVendasService";
import { mensagemVenda } from "../../services/vendaService";
import { formatarData, hojeBrasilia } from "../../utils/dataHora";
import { moedaVenda } from "./centralVendasUtils";
import { erroPeriodo, periodoAnalise, variacao } from "./analiseVendasUtils";
import EvolucaoVendas from "./EvolucaoVendas";
import RankingsVendas from "./RankingsVendas";

export default function AnaliseVendas({ onVerVendas }: { onVerVendas: (periodo: PeriodoAnalise) => void }) {
    const [params, setParams] = useSearchParams();
    const padrao = periodoAnalise(7);
    const periodo = { dataInicial: params.get("dataInicial") ?? padrao.dataInicial, dataFinal: params.get("dataFinal") ?? padrao.dataFinal };
    const [resultado, setResumo] = useState<ResumoAnaliseVendas | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [menuExportacao, setMenuExportacao] = useState<HTMLElement | null>(null);
    const [exportando, setExportando] = useState(false);
    const [erroExportacao, setErroExportacao] = useState("");
    const [criterioSalvo, setCriterio] = useState<CriterioRanking & { periodo: string }>({ periodo: "", ordem: "valor", unidade: "" });
    const invalido = erroPeriodo(periodo);
    const { dataInicial, dataFinal } = periodo;
    const chavePeriodo = `${dataInicial}|${dataFinal}`;
    const criterio = criterioSalvo.periodo === chavePeriodo ? criterioSalvo : { ordem: "valor" as const, unidade: "" };
    const resumo = resultado?.periodo.dataInicial === dataInicial && resultado.periodo.dataFinal === dataFinal ? resultado : null;

    useEffect(() => {
        if (invalido) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setCarregando(true); setErro(""); setResumo(null);
            consultarResumoVendas({ dataInicial, dataFinal }, controller.signal)
                .then(dados => { if (!controller.signal.aborted) setResumo(dados); })
                .catch(e => { if (!controller.signal.aborted) setErro(mensagemVenda(e, "Não foi possível consultar a análise. Tente novamente.")); })
                .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
        }, 200);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [dataInicial, dataFinal, invalido, tentativa]);

    function atualizarPeriodo(inicio: string, fim: string, escolha = "personalizado") {
        const novos = new URLSearchParams(params);
        novos.set("dataInicial", inicio); novos.set("dataFinal", fim); novos.set("periodo", escolha);
        setParams(novos, { replace: true });
    }
    function verVendas() {
        const novos = new URLSearchParams(params);
        novos.delete("aba"); novos.delete("periodo"); novos.delete("clienteId"); novos.delete("vendaId");
        novos.set("dataInicial", dataInicial); novos.set("dataFinal", dataFinal); novos.set("status", "FATURADA"); novos.set("referenciaData", "FATURAMENTO");
        setParams(novos); onVerVendas(periodo);
    }

    async function exportar(secao: SecaoExportacao) {
        if (exportando) return;
        setMenuExportacao(null); setExportando(true); setErroExportacao("");
        try {
            const arquivo = await exportarAnalise(periodo, secao, criterio);
            const url = URL.createObjectURL(arquivo), link = document.createElement("a");
            link.href = url; link.download = `analise-${secao}-${dataInicial}-${dataFinal}.csv`;
            link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { setErroExportacao(mensagemVenda(e, "Não foi possível exportar a análise. Tente novamente.")); }
        finally { setExportando(false); }
    }

    return <Stack component="section" aria-label="Análise de vendas" spacing={2} sx={{ minWidth: 0 }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, alignItems: { sm: "center" }, flexWrap: "wrap" }}>
            <TextField select size="small" label="Período" value={params.get("periodo") ?? (params.has("dataInicial") ? "personalizado" : "7")} sx={{ minWidth: 180 }}
                onChange={e => { if (e.target.value === "personalizado") atualizarPeriodo(dataInicial, dataFinal); else { const p = periodoAnalise(Number(e.target.value)); atualizarPeriodo(p.dataInicial, p.dataFinal, e.target.value); } }}>
                <MenuItem value="1">Hoje</MenuItem><MenuItem value="7">Últimos 7 dias</MenuItem><MenuItem value="30">Últimos 30 dias</MenuItem><MenuItem value="personalizado">Intervalo personalizado</MenuItem>
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField size="small" type="date" label="Data inicial" value={dataInicial} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hojeBrasilia() } }} onChange={e => atualizarPeriodo(e.target.value, dataFinal)} />
                <TextField size="small" type="date" label="Data final" value={dataFinal} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hojeBrasilia() } }} onChange={e => atualizarPeriodo(dataInicial, e.target.value)} />
            </Stack>
            <Button variant="outlined" startIcon={<ReceiptLongOutlinedIcon />} onClick={verVendas} disabled={Boolean(invalido)} sx={{ ml: { lg: "auto" } }}>Ver vendas do período</Button>
            <Button id="exportar-analise" variant="contained" startIcon={<FileDownloadOutlinedIcon />} onClick={e => setMenuExportacao(e.currentTarget)} disabled={Boolean(invalido) || carregando || !resumo || exportando}
                aria-busy={exportando} aria-haspopup="menu" aria-expanded={Boolean(menuExportacao)} aria-controls={menuExportacao ? "opcoes-exportar-analise" : undefined}>{exportando ? "Exportando…" : "Exportar CSV"}</Button>
        </Stack>
        <Menu id="opcoes-exportar-analise" anchorEl={menuExportacao} open={Boolean(menuExportacao)} onClose={() => setMenuExportacao(null)} slotProps={{ list: { "aria-labelledby": "exportar-analise" } }}>
            {([ ["resumo", "Indicadores do período"], ["evolucao", "Evolução diária"], ["produtos", "Produtos · ranking completo"], ["categorias", "Categorias · distribuição completa"] ] as [SecaoExportacao, string][])
                .map(([secao, label]) => <MenuItem key={secao} onClick={() => void exportar(secao)}>{label}</MenuItem>)}
        </Menu>
        {erroExportacao && <Alert severity="error" onClose={() => setErroExportacao("")}>{erroExportacao}</Alert>}
        <Typography variant="caption" color="text.secondary">Data de referência: faturamento efetivo · Horário de Brasília. Faturamento após descontos; não representa recebimento financeiro.</Typography>
        {invalido ? <Alert severity="warning">{invalido}</Alert> : erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button>}>{erro}</Alert>
            : carregando || !resumo ? <LoadingState mensagem="Consultando vendas do período…" /> : <>
                <Typography variant="body2" color="text.secondary">{formatarData(dataInicial)} a {formatarData(dataFinal)} · Comparado a {formatarData(resumo.periodoAnterior.dataInicial)} a {formatarData(resumo.periodoAnterior.dataFinal)}.{resumo.periodo.incompleto ? " Período atual incompleto: o dia de hoje ainda está em andamento; a comparação anterior usa dias completos." : ""}</Typography>
                <Paper component="section" aria-label="Resumo do período" aria-live="polite" variant="outlined" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, overflow: "hidden" }}>
                    {[
                        ["Faturamento", moedaVenda(resumo.atual.faturamento), variacao(resumo.atual.faturamento, resumo.anterior.faturamento)],
                        ["Vendas realizadas", resumo.atual.quantidadeVendas.toLocaleString("pt-BR"), variacao(resumo.atual.quantidadeVendas, resumo.anterior.quantidadeVendas)],
                        ["Ticket médio", moedaVenda(resumo.atual.ticketMedio), variacao(resumo.atual.ticketMedio, resumo.anterior.ticketMedio)],
                        ["Descontos concedidos", moedaVenda(resumo.atual.descontos), "Descontos gerais das vendas faturadas"],
                    ].map(([label, valor, comparacao]) => <Box key={label} sx={{ p: 2.5, minWidth: 0 }}>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                        <Typography sx={{ mt: 0.75, fontSize: "1.75rem", fontWeight: 650, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{valor}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>{comparacao}</Typography>
                    </Box>)}
                </Paper>
                {resumo.atual.quantidadeVendas === 0 && <Alert severity="info">{resumo.vendasSemDataFaturamento > 0
                    ? "Nenhuma venda com data de faturamento registrada neste período."
                    : "Nenhuma venda faturada neste período."}</Alert>}
                {resumo.vendasSemDataFaturamento > 0 && <Alert severity="warning">Há {resumo.vendasSemDataFaturamento} venda(s) faturada(s) na empresa sem data de faturamento confiável. Elas não entram em nenhum período da análise e continuam disponíveis na Consulta por criação.</Alert>}
                <EvolucaoVendas resumo={resumo} />
                <RankingsVendas key={chavePeriodo} periodo={periodo} criterio={criterio} onCriterio={c => setCriterio({ ...c, periodo: chavePeriodo })} faturamento={resumo.atual.faturamento} onAtualizar={() => setTentativa(v => v + 1)} />
                <Typography variant="caption" color="text.secondary">Vendas abertas e canceladas não entram nos resultados. Cancelamentos posteriores retiram a venda do período em que foi faturada.</Typography>
            </>}
    </Stack>;
}
