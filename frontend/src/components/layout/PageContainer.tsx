import { Stack, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

type PageContainerProps = {
    children: ReactNode;
    sx?: SxProps<Theme>;
};

// Espaçamento vertical padrão entre header, alertas, filtros/ações e conteúdo de uma página interna.
export default function PageContainer({ children, sx }: PageContainerProps) {
    return (
        <Stack spacing={2.5} sx={[
            {
                "& [data-page-filters]:has(+ [data-app-table])": { borderBottom: 0, borderRadius: "10px 10px 0 0", boxShadow: "none" },
                "& [data-page-filters] + [data-app-table]": { mt: 0, borderRadius: "0 0 10px 10px" },
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}>
            {children}
        </Stack>
    );
}
