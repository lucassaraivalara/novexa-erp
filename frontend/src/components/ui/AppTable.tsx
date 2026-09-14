import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Toolbar,
    Tooltip,
    Typography,
    Paper,
    InputAdornment,
    IconButton,
    TextField,
    Stack,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useMemo, useState, type ReactNode } from "react";
import { layoutTokens } from "../layout/layoutTokens";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import type { SxProps } from "@mui/system";

export interface Coluna<T> {
    campo: keyof T | string;
    cabecalho: string;
    largura?: string | number;
    alinhar?: "left" | "center" | "right" | "inherit" | "justify";
    ordenavel?: boolean;
    render?: (valor: unknown, linha: T, indice: number) => ReactNode;
}

export interface AcaoTabela<T> {
    rotulo: string;
    icone?: ReactNode;
    onClick: (linha: T) => void;
    desabilitado?: (linha: T) => boolean;
    cor?: "primary" | "secondary" | "error" | "inherit";
    tooltip?: string;
}

interface AppTableProps<T> {
    colunas: Coluna<T>[];
    linhas: T[];
    carregando?: boolean;
    vazio?: {
        titulo: string;
        descricao?: string;
        icone?: ReactNode;
        acao?: ReactNode;
    };
    acoes?: AcaoTabela<T>[];
    busca?: {
        placeholder: string;
        onChange: (valor: string) => void;
        valor: string;
    };
    filtros?: ReactNode;
    paginacao?: {
        pagina: number;
        linhasPorPagina: number;
        total: number;
        onPageChange: (pagina: number) => void;
        onRowsPerPageChange: (linhas: number) => void;
        opcoesLinhasPorPagina?: number[];
    };
    ordenacao?: {
        campo: string;
        direcao: "asc" | "desc";
        onSort: (campo: string) => void;
    };
    linhaCliqueavel?: boolean;
    onLinhaClick?: (linha: T) => void;
    obterChaveLinha: (linha: T) => string | number;
    sx?: SxProps;
    minWidth?: number | string;
}

export default function AppTable<T extends Record<string, unknown>>({
    colunas,
    linhas,
    carregando = false,
    vazio,
    acoes,
    busca,
    filtros,
    paginacao,
    ordenacao,
    linhaCliqueavel = false,
    onLinhaClick,
    obterChaveLinha,
    sx,
    minWidth = 1000,
}: AppTableProps<T>) {
    const [ordemLocal, setOrdemLocal] = useState<{ campo: string; direcao: "asc" | "desc" } | null>(null);

    const ordenacaoAtiva = ordenacao ?? ordemLocal;

    const linhasOrdenadas = useMemo(() => {
        if (!ordenacaoAtiva) return linhas;
        const { campo, direcao } = ordenacaoAtiva;
        return [...linhas].sort((a, b) => {
            const va = a[campo] as string | number | boolean | null | undefined;
            const vb = b[campo] as string | number | boolean | null | undefined;
            if (va === vb) return 0;
            if (va === null || va === undefined) return 1;
            if (vb === null || vb === undefined) return -1;
            const cmp = va > vb ? 1 : -1;
            return direcao === "asc" ? cmp : -cmp;
        });
    }, [linhas, ordenacaoAtiva]);

    function handleOrdenar(campo: string) {
        if (ordenacao) {
            ordenacao.onSort(campo);
        } else {
            setOrdemLocal((prev) => ({
                campo,
                direcao: prev?.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
            }));
        }
    }

    return (
        <Paper variant="outlined" sx={{ overflow: "hidden", ...sx }}>
            {(busca || filtros) && (
                <Toolbar
                    sx={{
                        px: { xs: 2, md: 3 },
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "background.default",
                    }}
                >
                    <Stack
                        sx={{
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 2,
                            flexWrap: "wrap",
                            width: "100%",
                        }}
                    >
                        {busca && (
                            <TextField
                                fullWidth
                                size="small"
                                placeholder={busca.placeholder}
                                value={busca.valor}
                                onChange={(e) => busca.onChange(e.target.value)}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchRoundedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{
                                    flex: 1,
                                    minWidth: 280,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: layoutTokens.radius.field,
                                    },
                                }}
                            />
                        )}
                        {filtros}
                    </Stack>
                </Toolbar>
            )}

            <TableContainer sx={{ maxHeight: 600 }}>
                <Table
                    size="medium"
                    sx={{
                        minWidth,
                        tableLayout: "fixed",
                    }}
                >
                    <TableHead>
                        <TableRow>
                            {colunas.map((coluna) => (
                                <TableCell
                                    key={String(coluna.campo)}
                                    align={coluna.alinhar ?? "left"}
                                    style={{ width: coluna.largura }}
                                    sx={{
                                        fontWeight: 700,
                                        color: "text.primary",
                                        backgroundColor: layoutTokens.table.headerBg,
                                        textTransform: "none",
                                        letterSpacing: "0.01em",
                                        fontSize: layoutTokens.typography.body,
                                        borderBottom: `2px solid ${layoutTokens.table.borderColor}`,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {coluna.ordenavel && ordenacaoAtiva ? (
                                        <TableSortLabel
                                            active={ordenacaoAtiva.campo === String(coluna.campo)}
                                            direction={ordenacaoAtiva.campo === String(coluna.campo) ? ordenacaoAtiva.direcao : "asc"}
                                            onClick={() => handleOrdenar(String(coluna.campo))}
                                        >
                                            {coluna.cabecalho}
                                        </TableSortLabel>
                                    ) : (
                                        coluna.cabecalho
                                    )}
                                </TableCell>
                            ))}
                            {acoes && acoes.length > 0 && (
                                <TableCell
                                    align="center"
                                    sx={{
                                        fontWeight: 700,
                                        color: "text.primary",
                                        backgroundColor: layoutTokens.table.headerBg,
                                        textTransform: "none",
                                        letterSpacing: "0.01em",
                                        fontSize: layoutTokens.typography.body,
                                        borderBottom: `2px solid ${layoutTokens.table.borderColor}`,
                                        whiteSpace: "nowrap",
                                        width: acoes.length * 44 + 16,
                                    }}
                                >
                                    Ações
                                </TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {carregando ? (
                            <TableRow>
                                <TableCell colSpan={colunas.length + (acoes && acoes.length > 0 ? 1 : 0)} align="center">
                                    <LoadingState tamanho="pequeno" mensagem="Carregando dados..." />
                                </TableCell>
                            </TableRow>
                        ) : linhasOrdenadas.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={colunas.length + (acoes && acoes.length > 0 ? 1 : 0)} align="center">
                                    {vazio ? (
                                        <EmptyState
                                            titulo={vazio.titulo}
                                            descricao={vazio.descricao}
                                            acao={vazio.acao}
                                            icone={vazio.icone}
                                        />
                                    ) : (
                                        <EmptyState
                                            titulo="Nenhum registro encontrado"
                                            descricao="Tente ajustar os filtros ou cadastre um novo item."
                                        />
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            linhasOrdenadas.map((linha, indice) => (
                                <TableRow
                                    key={obterChaveLinha(linha)}
                                    hover
                                    sx={{
                                        cursor: linhaCliqueavel || onLinhaClick ? "pointer" : "default",
                                        "&:hover": {
                                            backgroundColor: linhaCliqueavel || onLinhaClick
                                                ? "rgba(15, 23, 42, 0.03)"
                                                : "rgba(15, 23, 42, 0.02)",
                                        },
                                    }}
                                    onClick={linhaCliqueavel || onLinhaClick ? () => onLinhaClick?.(linha) : undefined}
                                >
                                    {colunas.map((coluna) => {
                                        const valor = String(coluna.campo).split(".").reduce((obj: unknown, key: string) => (obj as Record<string, unknown>)?.[key], linha as Record<string, unknown>);
                                        return (
                                            <TableCell
                                                key={String(coluna.campo)}
                                                align={coluna.alinhar ?? "left"}
                                                sx={{
                                                    padding: layoutTokens.table.cellPadding,
                                                    fontSize: layoutTokens.typography.body,
                                                    lineHeight: 1.4,
                                                    borderBottom: `1px solid ${layoutTokens.table.borderColor}`,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {coluna.render ? coluna.render(valor, linha, indice) : String(valor ?? "—")}
                                            </TableCell>
                                        );
                                    })}
                                    {acoes && acoes.length > 0 && (
                                        <TableCell align="center" sx={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                                            <Stack
                                                sx={{
                                                    flexDirection: "row",
                                                    gap: 0.5,
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {acoes.map((acao, idx) => (
                                                    <Tooltip key={idx} title={acao.tooltip ?? acao.rotulo}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color={acao.cor ?? "inherit"}
                                                                onClick={() => acao.onClick(linha)}
                                                                disabled={acao.desabilitado?.(linha)}
                                                                aria-label={acao.tooltip ?? acao.rotulo}
                                                                sx={{
                                                                    borderRadius: 8,
                                                                    "&:hover": {
                                                                        backgroundColor: "rgba(15, 23, 42, 0.04)",
                                                                    },
                                                                }}
                                                            >
                                                                {acao.icone}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                ))}
                                            </Stack>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {paginacao && (
                <Toolbar
                    sx={{
                        px: { xs: 1, md: 2 },
                        py: 1,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "background.default",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1,
                    }}
                >
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: layoutTokens.typography.caption }}>
                        {paginacao.total === 0
                            ? "Nenhum registro"
                            : `${Math.min(paginacao.pagina * paginacao.linhasPorPagina + 1, paginacao.total)}–${Math.min((paginacao.pagina + 1) * paginacao.linhasPorPagina, paginacao.total)} de ${paginacao.total}`}
                    </Typography>
                    <TablePagination
                        component="div"
                        count={paginacao.total}
                        page={paginacao.pagina}
                        rowsPerPage={paginacao.linhasPorPagina}
                        rowsPerPageOptions={paginacao.opcoesLinhasPorPagina ?? [10, 25, 50]}
                        onPageChange={(_, p) => paginacao.onPageChange(p)}
                        onRowsPerPageChange={(e) => paginacao.onRowsPerPageChange(Number(e.target.value))}
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                        labelRowsPerPage="Por página"
                        sx={{ "& .MuiSelect-root": { minWidth: 80 } }}
                    />
                </Toolbar>
            )}
        </Paper>
    );
}