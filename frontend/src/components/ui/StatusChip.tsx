import { Box, Chip, useTheme } from "@mui/material";
import type { ReactNode } from "react";

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const statusTones: Record<string, StatusTone> = {
    ATIVO: "success",
    ATIVA: "success",
    FATURADA: "success",
    PAGO: "success",
    PAGA: "success",
    LIQUIDADO: "success",
    PENDENTE: "warning",
    BAIXO: "warning",
    VENCIDA: "error",
    CANCELADO: "error",
    CANCELADA: "error",
    ZERADO: "error",
    ABERTA: "info",
    INATIVO: "neutral",
    INATIVA: "neutral",
    "SEM CONTROLE": "neutral",
};

export interface StatusChipProps {
    status: string;
    label?: ReactNode;
}

export default function StatusChip({ status, label }: StatusChipProps) {
    const theme = useTheme();
    const tone = statusTones[status.trim().toLocaleUpperCase()] ?? "neutral";
    const palette = tone === "neutral" ? theme.palette.text.secondary : theme.palette[tone].main;
    const background = tone === "neutral" ? theme.palette.action.hover : theme.palette[tone].light;

    return (
        <Chip
            size="small"
            label={(
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <Box
                        component="span"
                        aria-hidden="true"
                        sx={{ width: 6, height: 6, flex: "0 0 6px", borderRadius: "50%", bgcolor: palette }}
                    />
                    <span>{label ?? status}</span>
                </Box>
            )}
            sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: background,
                color: palette,
                "& .MuiChip-label": { px: 1, display: "inline-flex", alignItems: "center" },
            }}
        />
    );
}
