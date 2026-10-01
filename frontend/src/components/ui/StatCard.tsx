import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { layoutTokens } from "../layout/layoutTokens";

type StatTone = "success" | "warning" | "error" | "info";

const toneLabels: Record<StatTone, string> = {
    success: "Positivo",
    warning: "Atenção",
    error: "Crítico",
    info: "Informativo",
};

interface StatCardProps {
    titulo: string;
    valor: string | number;
    descricao?: string;
    cor?: string;
    aoClicar?: () => void;
    tone?: StatTone;
    icone?: ReactNode;
}

function StatCard({ titulo, valor, descricao, cor, aoClicar, tone, icone }: StatCardProps) {
    const theme = useTheme();
    const tonePalette = tone ? theme.palette[tone] : undefined;

    return (
        <Paper
            variant="outlined"
            onClick={aoClicar}
            role={aoClicar ? "button" : undefined}
            tabIndex={aoClicar ? 0 : undefined}
            onKeyDown={aoClicar ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoClicar(); } } : undefined}
            sx={{
                p: layoutTokens.spacing.xl, minWidth: 0, height: "100%", display: "flex", flexDirection: "column",
                justifyContent: "space-between", borderRadius: layoutTokens.radius.card,
                ...(tonePalette ? { borderTop: `3px solid ${tonePalette.main}` } : {}),
                ...(aoClicar ? { cursor: "pointer", "&:hover": { borderColor: "primary.main" } } : {}),
            }}
        >
            <Stack>
                <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: layoutTokens.spacing.sm }}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.4, minWidth: 0, overflowWrap: "anywhere" }}>
                        {titulo}
                    </Typography>
                    {(icone || tone) && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: layoutTokens.spacing.xs,
                                flex: "0 0 auto",
                            }}
                        >
                            {tone && <Typography variant="caption" color="text.secondary">{toneLabels[tone]}</Typography>}
                            {icone && (
                                <Box
                                    aria-hidden="true"
                                    sx={{
                                        display: "grid",
                                        placeItems: "center",
                                        flex: "0 0 32px",
                                        width: 32,
                                        height: 32,
                                        borderRadius: layoutTokens.radius.button,
                                        bgcolor: tonePalette?.light ?? "action.hover",
                                        color: tonePalette?.main ?? "text.secondary",
                                        "& > svg": { fontSize: 18 },
                                    }}
                                >
                                    {icone}
                                </Box>
                            )}
                        </Box>
                    )}
                </Stack>
                <Typography variant="h4" sx={{ mt: layoutTokens.spacing.lg, fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: tone ? "text.primary" : cor === "primary" ? "primary.main" : "text.primary", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                    {valor}
                </Typography>
            </Stack>
            {descricao && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: layoutTokens.spacing.xs, lineHeight: 1.4 }}>
                    {descricao}
                </Typography>
            )}
        </Paper>
    );
}

export default StatCard;