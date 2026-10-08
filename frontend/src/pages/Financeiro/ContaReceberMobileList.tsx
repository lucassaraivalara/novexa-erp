import { Box, Button, IconButton, MenuItem, Paper, Stack, TablePagination, TextField, Tooltip, Typography } from "@mui/material";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import StatusChip from "../../components/ui/StatusChip";
import type { ContaReceber } from "../../types/contaReceber";
import { formatarData, hoje, moeda, podeReceberConta, rotulosStatus } from "./contaReceberUtils";

type Props = {
    contas: ContaReceber[]; carregando: boolean; abrindo: boolean;
    vazio: { titulo: string; descricao: string };
    onDetalhe: (conta: ContaReceber) => void; onReceber: (conta: ContaReceber) => void;
    ordenacao: { campo: string; direcao: "asc" | "desc"; onSort: (campo: string) => void };
    camposOrdenacao: { campo: string; rotulo: string }[];
    paginacao: { pagina: number; linhasPorPagina: number; total: number;
        onPageChange: (pagina: number) => void; onRowsPerPageChange: (size: number) => void };
};

export default function ContaReceberMobileList({ contas, carregando, abrindo, vazio, onDetalhe, onReceber,
    ordenacao, camposOrdenacao, paginacao }: Props) {
    return <Paper data-app-table variant="outlined" sx={{ overflow: "hidden", minWidth: 0 }}>
        <Stack direction="row" sx={{ p: 1.5, gap: 1, alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
            <TextField select fullWidth size="small" label="Ordenar por" value={ordenacao.campo}
                onChange={e => ordenacao.onSort(e.target.value)}>
                {camposOrdenacao.map(c => <MenuItem key={c.campo} value={c.campo}>{c.rotulo}</MenuItem>)}
            </TextField>
            <Tooltip title={ordenacao.direcao === "asc" ? "Ordem crescente" : "Ordem decrescente"}>
                <IconButton aria-label={ordenacao.direcao === "asc" ? "Ordem crescente" : "Ordem decrescente"}
                    onClick={() => ordenacao.onSort(ordenacao.campo)} sx={{ width: 44, height: 44 }}>
                    {ordenacao.direcao === "asc" ? <ArrowUpwardRoundedIcon /> : <ArrowDownwardRoundedIcon />}
                </IconButton>
            </Tooltip>
        </Stack>
        {carregando ? <LoadingState tamanho="pequeno" mensagem="Carregando dados…" />
            : !contas.length ? <EmptyState {...vazio} /> : contas.map(c => <Box component="article" aria-label={`Conta ${c.id}`}
                key={c.id} sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", overflowWrap: "anywhere" }}>
                <Stack spacing={0.5}>
                    <Typography variant="subtitle2">{c.cliente.nome}</Typography>
                    <Typography variant="body2" color="text.secondary">{c.descricao}</Typography>
                    <Box><StatusChip status={c.status} label={rotulosStatus[c.status] +
                        ((c.status === "PENDENTE" || c.status === "PARCIAL") && c.dataVencimento < hoje() ? " · Vencida" : "")} /></Box>
                </Stack>
                <Stack direction="row" sx={{ mt: 1.5, gap: 1, justifyContent: "space-between", alignItems: "center" }}>
                    <Box><Typography variant="caption" color="text.secondary">Vencimento</Typography>
                        <Typography variant="body2">{formatarData(c.dataVencimento)}</Typography></Box>
                    <Box sx={{ textAlign: "right" }}><Typography variant="caption" color="text.secondary">Saldo</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, color: "primary.main", fontVariantNumeric: "tabular-nums" }}>{moeda.format(c.saldo)}</Typography></Box>
                </Stack>
                <Stack direction="row" sx={{ mt: 1, gap: 1, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <Typography variant="caption" color="text.secondary">Valor original: {moeda.format(c.valorOriginal)}</Typography>
                    <Typography variant="caption" color="text.secondary">Recebido: {moeda.format(c.valorRecebido)}</Typography>
                </Stack>
                <Stack direction="row" sx={{ mt: 1.5, gap: 1 }}>
                    <Button variant="contained" disableElevation startIcon={<CheckCircleOutlineRoundedIcon />}
                        disabled={abrindo || !podeReceberConta(c)} onClick={() => onReceber(c)} sx={{ minHeight: 44, flex: 1 }}>Receber</Button>
                    <Button variant="outlined" startIcon={<HistoryRoundedIcon />} aria-label="Consultar histórico"
                        onClick={() => onDetalhe(c)} sx={{ minHeight: 44, flex: 1 }}>Detalhes</Button>
                </Stack>
            </Box>)}
        <Box component="footer" aria-label="Contagem e paginação da tabela" sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" aria-live="polite">
                {paginacao.total ? paginacao.pagina * paginacao.linhasPorPagina + 1 : 0}–{Math.min((paginacao.pagina + 1) * paginacao.linhasPorPagina, paginacao.total)} de {paginacao.total}
            </Typography>
            <TablePagination component="div" count={paginacao.total} page={paginacao.pagina} rowsPerPage={paginacao.linhasPorPagina}
                rowsPerPageOptions={[10, 25, 50]} onPageChange={(_, p) => paginacao.onPageChange(p)}
                onRowsPerPageChange={e => paginacao.onRowsPerPageChange(Number(e.target.value))}
                labelRowsPerPage="Itens por página" labelDisplayedRows={() => ""}
                getItemAriaLabel={tipo => tipo === "next" ? "Próxima página" : "Página anterior"}
                sx={{ "& .MuiTablePagination-toolbar": { px: 0, minHeight: 44, flexWrap: "wrap", gap: 0.5 },
                    "& .MuiTablePagination-selectLabel": { fontSize: 12 }, "& .MuiTablePagination-actions": { ml: "auto" },
                    "& .MuiTablePagination-spacer": { display: "none" }, "& .MuiIconButton-root": { width: 44, height: 44 } }} />
        </Box>
    </Paper>;
}
