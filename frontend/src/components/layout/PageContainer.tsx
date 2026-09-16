import { Stack, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

type PageContainerProps = {
    children: ReactNode;
    sx?: SxProps<Theme>;
};

// Espaçamento vertical padrão entre header, alertas, filtros/ações e conteúdo de uma página interna.
export default function PageContainer({ children, sx }: PageContainerProps) {
    return (
        <Stack spacing={2.5} sx={sx}>
            {children}
        </Stack>
    );
}
