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
};

export default function PdvActionButton({ categoria, icone, atalho, children, explicacao, sx, ...props }: Props) {
    const cor = cores[categoria];
    const principal = categoria === "confirmacao";
    return <Tooltip title={explicacao ?? ""}>
        <Box component="span" sx={{ display: "flex", minWidth: 0 }}>
            <Button aria-keyshortcuts={atalho} {...props} fullWidth disableElevation sx={[
                {
                    minHeight: principal ? 72 : 68, px: 1.5, py: 1, gap: 1,
                    borderRadius: "8px", border: "1px solid", borderColor: alpha(cor, 0.3),
                    bgcolor: principal ? cor : alpha(cor, 0.08),
                    color: principal ? "#FFFFFF" : categoria === "alteracao" ? "#92400E" : cor,
                    textTransform: "none", justifyContent: "flex-start", lineHeight: 1.2,
                    "&:hover": { bgcolor: principal ? "#15803D" : alpha(cor, 0.14), borderColor: cor },
                    "&.Mui-focusVisible": { outline: `3px solid ${cor}`, outlineOffset: 2 },
                    "&.Mui-disabled": { bgcolor: "#F1F3F5", color: "#7B8492", borderColor: "#E1E5EA" },
                    "& .MuiSvgIcon-root": { fontSize: principal ? 28 : 24, flexShrink: 0 },
                },
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}>
                {icone}
                <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, textAlign: "left" }}>
                    {atalho && <Box component="kbd" sx={{ fontFamily: "inherit", fontSize: 11, fontWeight: 800, opacity: 0.85 }}>{atalho}</Box>}
                    <Box component="span" sx={{ fontSize: principal ? 18 : 13, fontWeight: 700, overflowWrap: "anywhere" }}>{children}</Box>
                </Box>
            </Button>
        </Box>
    </Tooltip>;
}
