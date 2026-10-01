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
                flexDirection: { xs: "column", md: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", md: "center" },
                gap: layoutTokens.spacing.lg,
                flexWrap: "wrap",
                ...sx,
            }}
        >
            <Stack sx={{ gap: layoutTokens.spacing.xs, minWidth: 0 }}>
                <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                        fontSize: layoutTokens.typography.pageTitle,
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

            <Box sx={{ display: "flex", gap: layoutTokens.spacing.md, flexWrap: "wrap", alignItems: "center" }}>
                {acoesSecundarias}
                {acaoPrincipal}
            </Box>

            {children}
        </Stack>
    );
}
