import { useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, MenuItem, Paper, Stack, TablePagination, TextField, Typography } from "@mui/material";
import LoadingState from "../../components/ui/LoadingState";
import { consultarCategoriasAnalise, consultarProdutosAnalise, type CategoriasAnalise, type CriterioRanking, type PeriodoAnalise, type RankingAnalise } from "../../services/analiseVendasService";
import { mensagemVenda } from "../../services/vendaService";
import { moedaVenda } from "./centralVendasUtils";

type Props = { periodo: PeriodoAnalise; criterio: CriterioRanking; onCriterio: (valor: CriterioRanking) => void; faturamento: number; onAtualizar: () => void };
const percentual = (valor: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor)}%`;
const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export default function RankingsVendas({ periodo, criterio, onCriterio, faturamento, onAtualizar }: Props) {
    const { dataInicial, dataFinal } = periodo;
    const { ordem, unidade } = criterio;
    const [pagina, setPagina] = useState(0);
    const [resultado, setResultado] = useState<{ chave: string; dados?: RankingAnalise; erro?: string } | null>(null);
    const [categorias, setCategorias] = useState<CategoriasAnalise | null>(null);
    const [erroCategorias, setErroCategorias] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [tentativaCategorias, setTentativaCategorias] = useState(0);
    const chave = `${dataInicial}|${dataFinal}|${ordem}|${unidade}|${pagina}|${tentativa}`;
    const ranking = resultado?.chave === chave ? resultado.dados : undefined;
    const erro = resultado?.chave === chave ? resultado.erro : undefined;
    // Mantém as opções enquanto troca ordem/página, sem usar linhas antigas como resultado novo.
    const unidades = resultado?.dados?.unidades ?? [];

    useEffect(() => {
        const controller = new AbortController();
        consultarProdutosAnalise({ dataInicial, dataFinal }, { ordem, unidade }, pagina, controller.signal)
            .then(dados => { if (!controller.signal.aborted) setResultado({ chave, dados }); })
            .catch(e => { if (!controller.signal.aborted) setResultado(anterior => ({ chave, dados: anterior?.dados, erro: mensagemVenda(e, "Não foi possível consultar os produtos. Tente novamente.") })); });
        return () => controller.abort();
    }, [dataInicial, dataFinal, ordem, unidade, pagina, tentativa, chave]);

    useEffect(() => {
        const controller = new AbortController();
        consultarCategoriasAnalise({ dataInicial, dataFinal }, controller.signal)
            .then(dados => { if (!controller.signal.aborted) { setCategorias(dados); setErroCategorias(""); } })
            .catch(e => { if (!controller.signal.aborted) setErroCategorias(mensagemVenda(e, "Não foi possível consultar as categorias. Tente novamente.")); });
        return () => controller.abort();
    }, [dataInicial, dataFinal, tentativaCategorias]);

    const mudou = (ranking && ranking.faturamentoPeriodo !== faturamento) || (categorias && categorias.faturamentoPeriodo !== faturamento);
    return <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        {mudou && <Alert severity="info" action={<Button color="inherit" onClick={onAtualizar}>Atualizar análise</Button>}>As vendas mudaram entre as consultas. Atualize para sincronizar os indicadores.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.8fr) minmax(280px, 1fr)" }, gap: 2 }}>
            <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ p: 2, gap: 1.5, justifyContent: "space-between", alignItems: { sm: "center" } }}>
                    <Box><Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650 }}>Produtos mais vendidos</Typography><Typography variant="caption" color="text.secondary">Participação no faturamento total do período</Typography></Box>
                    <Stack direction="row" spacing={1}>
                        <TextField select size="small" label="Ranking" value={ordem} sx={{ minWidth: 130 }} onChange={e => { setPagina(0); onCriterio({ ordem: e.target.value as CriterioRanking["ordem"], unidade: e.target.value === "quantidade" ? unidades[0] ?? "" : "" }); }}>
                            <MenuItem value="valor">Por valor</MenuItem><MenuItem value="quantidade" disabled={!unidades.length}>Por quantidade</MenuItem>
                        </TextField>
                        {ordem === "quantidade" && <TextField select size="small" label="Unidade" value={unidade} sx={{ minWidth: 95 }} onChange={e => { setPagina(0); onCriterio({ ordem, unidade: e.target.value }); }}>
                            {unidades.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>}
                    </Stack>
                </Stack>
                {(ranking?.itensSemUnidade ?? 0) > 0 && <Alert severity="warning">Há {ranking?.itensSemUnidade} item(ns) sem unidade histórica no período. Não é possível comparar suas quantidades com segurança.</Alert>}
                {ordem === "quantidade" && <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, pb: 1 }}>Comparação restrita a {unidade}. Quantidades de unidades diferentes não são somadas.</Typography>}
                {erro ? <Alert severity="error" action={<Button color="inherit" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button>}>{erro}</Alert>
                    : !ranking ? <LoadingState mensagem="Consultando produtos…" />
                    : ranking.pagina.totalItems === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>Nenhum produto vendido no período.</Typography> : <>
                        <Box aria-hidden="true" sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 95px 130px 70px", px: 2, py: 1, gap: 1, bgcolor: "action.hover", color: "text.secondary", fontSize: "0.75rem" }}>
                            <span>Produto</span><Box component="span" sx={{ textAlign: "right" }}>Quantidade</Box><Box component="span" sx={{ textAlign: "right" }}>Valor vendido</Box><Box component="span" sx={{ textAlign: "right" }}>Part.</Box>
                        </Box>
                        <Box component="ol" aria-label="Ranking de produtos" sx={{ listStyle: "none", m: 0, p: 0 }}>
                            {ranking.pagina.items.map((p, i) => <Box component="li" key={`${p.produtoId}|${p.unidade ?? "sem-unidade"}`} sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "minmax(0, 1fr) 95px 130px 70px" }, gap: 1, p: 2, borderBottom: 1, borderColor: "divider", alignItems: "center" }}>
                                <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" }, overflowWrap: "anywhere" }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}><Typography component="span" color="text.secondary" sx={{ mr: 1, fontSize: "inherit" }}>{pagina * 5 + i + 1}.</Typography>{p.nome}</Typography>
                                    <Typography variant="caption" color="text.secondary">{p.categoria}</Typography>
                                </Box>
                                {[["Quantidade", p.quantidade === null || p.unidade === null ? "Não registrada" : `${quantidade.format(p.quantidade)} ${p.unidade}`], ["Valor vendido", moedaVenda(p.valorVendido)], ["Participação", percentual(p.participacao)]].map(([label, valor]) => <Box component="dl" key={label} sx={{ m: 0, minWidth: 0, textAlign: { xs: "left", sm: "right" } }}>
                                    <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>{label}</Typography>
                                    <Typography component="dd" variant="body2" sx={{ m: 0, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" }, position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)" }}>{label}: </Box>{valor}</Typography>
                                </Box>)}
                            </Box>)}
                        </Box>
                        <TablePagination component="div" count={ranking.pagina.totalItems} page={pagina} rowsPerPage={5} rowsPerPageOptions={[]} onPageChange={(_, p) => setPagina(p)}
                            getItemAriaLabel={tipo => tipo === "next" ? "Próxima página" : tipo === "previous" ? "Página anterior" : tipo === "first" ? "Primeira página" : "Última página"}
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count} registros`} sx={{ "& .MuiTablePagination-toolbar": { px: 1, flexWrap: "wrap" }, "& .MuiTablePagination-actions": { ml: 1 } }} />
                    </>}
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650 }}>Vendas por categoria</Typography>
                <Typography variant="caption" color="text.secondary">Distribuição do valor vendido após descontos</Typography>
                {erroCategorias ? <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" onClick={() => setTentativaCategorias(v => v + 1)}>Tentar novamente</Button>}>{erroCategorias}</Alert>
                    : !categorias ? <LoadingState mensagem="Consultando categorias…" /> : <>
                        <Stack spacing={2} sx={{ mt: 2, maxHeight: 420, overflowY: "auto" }}>
                            {categorias.items.length === 0 && <Typography variant="body2" color="text.secondary">Nenhuma categoria com vendas no período.</Typography>}
                            {categorias.items.map(c => <Box key={c.categoriaId ?? "sem-categoria"}>
                                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mb: 0.75, alignItems: "baseline" }}>
                                    <Typography variant="body2" sx={{ overflowWrap: "anywhere", minWidth: 0 }}>{c.nome}</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{moedaVenda(c.valorVendido)} <Typography component="span" variant="caption" color="text.secondary">{percentual(c.participacao)}</Typography></Typography>
                                </Stack>
                                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, c.participacao))} aria-label={c.nome} aria-valuetext={`${percentual(c.participacao)} do faturamento`} sx={{ height: 6, borderRadius: 1 }} />
                            </Box>)}
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1, mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}>
                            <Typography variant="body2" color="text.secondary">Total do período</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{moedaVenda(categorias.faturamentoPeriodo)}</Typography>
                        </Stack>
                    </>}
            </Paper>
        </Box>
        <Typography variant="caption" color="text.secondary">Nome e unidade registrados no item da venda; categoria atual do produto. Unidades diferentes aparecem em linhas separadas. Itens sem unidade histórica conservam seu valor vendido, com quantidade não registrada; não participam da ordenação por quantidade. Kits aparecem pelo produto vendido, sem somar os componentes consumidos.</Typography>
    </Stack>;
}
