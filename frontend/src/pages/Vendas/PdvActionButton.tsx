import type { ReactNode } from "react";
import { alpha, Box, Button, Tooltip, type ButtonProps } from "@mui/material";

const cores = {
    confirmacao: "#16A34A", cancelamento: "#DC2626", alteracao: "#F59E0B",
    consulta: "#2563EB", auxiliar: "#64748B",
};

type Props = Omit<ButtonProps, "color" | "startIcon" | "children"> & {
    categoria: keyof typeof cores;
    icone: ReactNode;
    atalho?: string;
    children: ReactNode;
    explicacao?: string;
    compacto?: boolean;
};

export default function PdvActionButton({ categoria, icone, atalho, children, explicacao, compacto = false, sx, ...props }: Props) {
    const cor = cores[categoria];
    const principal = categoria === "confirmacao";
    return <Tooltip title={explicacao ?? ""}>
        <Box component="span" sx={{ display: "flex", minWidth: 0 }}>
            <Button aria-keyshortcuts={atalho} {...props} fullWidth disableElevation sx={[
                {
                    minHeight: compacto ? 50 : 60, px: compacto ? 1 : 1.5, py: 0.75, gap: 0.75,
                    borderRadius: "6px", border: "1px solid", borderColor: alpha(cor, 0.3),
                    bgcolor: compacto || principal ? cor : alpha(cor, 0.08),
                    color: compacto ? categoria === "alteracao" ? "#422006" : principal ? "#052E16" : "#FFFFFF" : principal ? "#FFFFFF" : categoria === "alteracao" ? "#92400E" : cor,
                    textTransform: "none", justifyContent: "flex-start", lineHeight: 1.2,
                    "&:hover": { bgcolor: compacto ? cor : principal ? "#15803D" : alpha(cor, 0.14), filter: compacto ? "brightness(.93)" : undefined, borderColor: cor },
                    "&.Mui-focusVisible": { outline: `3px solid ${cor}`, outlineOffset: 2 },
                    "&.Mui-disabled": { bgcolor: "#F1F3F5", color: "#7B8492", borderColor: "#E1E5EA" },
                    "& .MuiSvgIcon-root": { fontSize: compacto ? 20 : 26, flexShrink: 0 },
                },
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}>
                {icone}
                <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, textAlign: "left" }}>
                    {atalho && <Box component="kbd" sx={{ fontFamily: "inherit", fontSize: 11, fontWeight: 800, color: principal ? "#052E16" : "inherit" }}>{atalho}</Box>}
                    <Box component="span" sx={{ fontSize: compacto ? 12 : principal ? 20 : 13, fontWeight: 700, overflowWrap: "anywhere" }}>{children}</Box>
                </Box>
            </Button>
        </Box>
    </Tooltip>;
}
