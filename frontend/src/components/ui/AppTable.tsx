import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Typography,
    ButtonBase,
    Toolbar,
    Tooltip,
    CircularProgress,
    Paper,
    InputAdornment,
    IconButton,
    TextField,
    Stack,
} from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
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
    pesquisavel?: boolean;
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
    /** @deprecated Renderize a busca na Page com PageFilters. Mantido durante a migração das telas existentes. */
    busca?: {
        placeholder: string;
        onChange: (valor: string) => void;
        valor: string;
        carregando?: boolean;
        onKeyDown?: (evento: KeyboardEvent<HTMLInputElement>) => void;
    };
    /** @deprecated Renderize filtros de domínio na Page com PageFilters. Mantido durante a migração das telas existentes. */
    filtros?: ReactNode;
    paginacao?: {
        pagina: number;
        linhasPorPagina: number;
        total: number;
        onPageChange: (pagina: number) => void;
        onRowsPerPageChange: (linhas: number) => void;
        opcoesLinhasPorPagina?: number[];
    };
    contagem?: {
        total: number;
        inicio?: number;
        fim?: number;
    };
    ordenacao?: {
        campo: string;
        direcao: "asc" | "desc";
        onSort: (campo: string) => void;
    };
    buscaPorColuna?: {
        campo: string | null;
        onSelecionar: (campo: string) => void;
    };
    ordenacaoComIcone?: boolean;
    linhaCliqueavel?: boolean;
    onLinhaClick?: (linha: T) => void;
    obterChaveLinha: (linha: T) => string | number;
    sx?: SxProps;
    minWidth?: number | string;
    compacta?: boolean;
    /** Altura reservada para o corpo rolável em desktop. */
    alturaCorpo?: number | string;
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
    contagem,
    ordenacao,
    buscaPorColuna,
    ordenacaoComIcone = false,
    linhaCliqueavel = false,
    onLinhaClick,
    obterChaveLinha,
    sx,
    minWidth = 1000,
    compacta = false,
    alturaCorpo,
}: AppTableProps<T>) {
    const [ordemLocal, setOrdemLocal] = useState<{ campo: string; direcao: "asc" | "desc" } | null>(null);

    const ordenacaoAtiva = ordenacao ?? ordemLocal;
    const controlesCabecalhoSeparados = Boolean(buscaPorColuna || ordenacaoComIcone);

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

    const contagemExibida = useMemo(() => {
        const total = paginacao?.total ?? contagem?.total;
        if (total === undefined) return null;
        if (total === 0) return { inicio: 0, fim: 0, total };
        if (paginacao) {
            const inicio = paginacao.pagina * paginacao.linhasPorPagina + 1;
            return { inicio, fim: Math.min(inicio + paginacao.linhasPorPagina - 1, total), total };
        }
        return {
            inicio: contagem?.inicio ?? (linhasOrdenadas.length ? 1 : 0),
            fim: contagem?.fim ?? Math.min(linhasOrdenadas.length, total),
            total,
        };
    }, [contagem, linhasOrdenadas.length, paginacao]);

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
            {/* Compatibilidade temporária para páginas ainda não migradas para PageFilters. */}
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
                                aria-label={`Pesquisar: ${busca.placeholder}`}
                                placeholder={busca.placeholder}
                                value={busca.valor}
                                onChange={(e) => busca.onChange(e.target.value)}
                                onKeyDown={busca.onKeyDown}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchRoundedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: busca.carregando ? <CircularProgress size={18} aria-label="Pesquisando…" /> : undefined,
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

            <TableContainer
                sx={{
                    height: alturaCorpo ? { xs: "auto", md: alturaCorpo } : undefined,
                    maxHeight: alturaCorpo ? { xs: 480, md: alturaCorpo } : { xs: 480, md: 600 },
                    overflowX: "auto",
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                }}
            >
                <Table
                    stickyHeader
                    aria-label="Tabela de resultados"
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
                                    sortDirection={controlesCabecalhoSeparados && ordenacaoAtiva?.campo === String(coluna.campo) ? ordenacaoAtiva.direcao : false}
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
                                    {controlesCabecalhoSeparados ? (
                                        <Stack direction="row" sx={{ alignItems: "center", justifyContent: coluna.alinhar === "right" ? "flex-end" : "flex-start", gap: 0.5, minWidth: 0 }}>
                                            {buscaPorColuna && coluna.pesquisavel ? (
                                                <ButtonBase
                                                    type="button"
                                                    onClick={() => buscaPorColuna.onSelecionar(String(coluna.campo))}
                                                    aria-label={`Buscar por: ${coluna.cabecalho}`}
                                                    aria-pressed={buscaPorColuna.campo === String(coluna.campo)}
                                                    sx={{
                                                        font: "inherit", textAlign: "inherit", px: 0.5, py: 0.5,
                                                        borderRadius: 1, minWidth: 0,
                                                        color: buscaPorColuna.campo === String(coluna.campo) ? "primary.main" : "inherit",
                                                        bgcolor: buscaPorColuna.campo === String(coluna.campo) ? "action.selected" : "transparent",
                                                        "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                                                    }}
                                                >
                                                    {coluna.cabecalho}
                                                </ButtonBase>
                                            ) : coluna.cabecalho}
                                            {coluna.ordenavel && (
                                                <Tooltip title={`Ordenar por ${coluna.cabecalho}: ${ordenacaoAtiva?.campo === String(coluna.campo) && ordenacaoAtiva.direcao === "asc" ? "decrescente" : "crescente"}`}>
                                                    <IconButton
                                                        type="button"
                                                        size="small"
                                                        aria-label={`Ordenar por ${coluna.cabecalho}: ${ordenacaoAtiva?.campo === String(coluna.campo) && ordenacaoAtiva.direcao === "asc" ? "decrescente" : "crescente"}`}
                                                        onClick={() => handleOrdenar(String(coluna.campo))}
                                                        color={ordenacaoAtiva?.campo === String(coluna.campo) ? "primary" : "default"}
                                                        sx={{ flexShrink: 0, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}
                                                    >
                                                        {ordenacaoAtiva?.campo !== String(coluna.campo) ? <SwapVertRoundedIcon fontSize="small" />
                                                            : ordenacaoAtiva.direcao === "asc" ? <ArrowUpwardRoundedIcon fontSize="small" /> : <ArrowDownwardRoundedIcon fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    ) : coluna.ordenavel && ordenacaoAtiva ? (
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
                                    <LoadingState tamanho="pequeno" mensagem="Carregando dados…" />
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
                                    onKeyDown={linhaCliqueavel || onLinhaClick ? (evento) => {
                                        if (evento.key === "Enter" || evento.key === " ") {
                                            evento.preventDefault();
                                            onLinhaClick?.(linha);
                                        }
                                    } : undefined}
                                    tabIndex={linhaCliqueavel || onLinhaClick ? 0 : undefined}
                                >
                                    {colunas.map((coluna) => {
                                        const valor = String(coluna.campo).split(".").reduce((obj: unknown, key: string) => (obj as Record<string, unknown>)?.[key], linha as Record<string, unknown>);
                                        return (
                                            <TableCell
                                                key={String(coluna.campo)}
                                                align={coluna.alinhar ?? "left"}
                                                sx={{
                                                    padding: layoutTokens.table.cellPadding,
                                                    ...(compacta ? { padding: layoutTokens.table.cellPaddingCompact } : {}),
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
                                                                onClick={(evento) => {
                                                                    evento.stopPropagation();
                                                                    acao.onClick(linha);
                                                                }}
                                                                disabled={acao.desabilitado?.(linha)}
                                                                aria-label={acao.tooltip ?? acao.rotulo}
                                                                sx={{
                                                                    borderRadius: 8,
                                                                    "&:hover": {
                                                                        backgroundColor: "action.hover",
                                                                        color: "primary.main",
                                                                    },
                                                                    "&.Mui-focusVisible": {
                                                                        outline: "2px solid",
                                                                        outlineColor: "primary.main",
                                                                        outlineOffset: 2,
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

            {contagemExibida && (
                <Toolbar
                    component="footer"
                    aria-label="Contagem e paginação da tabela"
                    sx={{
                        px: { xs: 1, md: 2 },
                        py: 1,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "background.default",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {`${contagemExibida.inicio}–${contagemExibida.fim} de ${contagemExibida.total}`}
                    </Typography>
                    {paginacao && <TablePagination
                        component="div"
                        count={paginacao.total}
                        page={paginacao.pagina}
                        rowsPerPage={paginacao.linhasPorPagina}
                        rowsPerPageOptions={paginacao.opcoesLinhasPorPagina ?? [10, 25, 50]}
                        onPageChange={(_, p) => paginacao.onPageChange(p)}
                        onRowsPerPageChange={(e) => paginacao.onRowsPerPageChange(Number(e.target.value))}
                        labelDisplayedRows={() => ""}
                        labelRowsPerPage="Itens por página"
                        getItemAriaLabel={(tipo) => tipo === "next" ? "Próxima página" : "Página anterior"}
                        sx={{
                            "& .MuiSelect-root": { minWidth: 80 },
                            "& .MuiIconButton-root:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                        }}
                    />}
                </Toolbar>
            )}
        </Paper>
    );
}
