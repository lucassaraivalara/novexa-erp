import { Box, Stack, Typography } from "@mui/material";
import { layoutTokens } from "../layout/layoutTokens";
import type { SxProps } from "@mui/system";

interface PageHeaderProps {
    titulo: string;
    descricao?: string;
    acaoPrincipal?: React.ReactNode;
    acoesSecundarias?: React.ReactNode;
    children?: React.ReactNode;
    sx?: SxProps;
}

export default function PageHeader({
    titulo,
    descricao,
    acaoPrincipal,
    acoesSecundarias,
    children,
    sx,
}: PageHeaderProps) {
    return (
        <Stack
            sx={{
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
                gap: 2,
                flexWrap: "wrap",
                ...sx,
            }}
        >
            <Stack sx={{ gap: 0.5 }}>
                <Typography
                    variant="h5"
                    component="h1"
                    sx={{
                        fontSize: layoutTokens.typography.pageTitle,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "text.primary",
                        lineHeight: 1.2,
                    }}
                >
                    {titulo}
                </Typography>
                {descricao && (
                    <Typography
                        color="text.secondary"
                        sx={{
                            fontSize: layoutTokens.typography.pageSubtitle,
                            lineHeight: 1.5,
                            fontWeight: 400,
                        }}
                    >
                        {descricao}
                    </Typography>
                )}
            </Stack>

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                {acoesSecundarias}
                {acaoPrincipal}
            </Box>

            {children}
        </Stack>
    );
}
