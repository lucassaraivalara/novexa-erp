import { Box, Typography } from "@mui/material";
import { layoutTokens } from "../layout/layoutTokens";
import type { SxProps } from "@mui/system";

interface EmptyStateProps {
    titulo: string;
    descricao?: string;
    acao?: React.ReactNode;
    icone?: React.ReactNode;
    sx?: SxProps;
}

export default function EmptyState({ titulo, descricao, acao, icone, sx }: EmptyStateProps) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                maxWidth: 480,
                minWidth: 0,
                boxSizing: "border-box",
                mx: "auto",
                py: { xs: layoutTokens.spacing.xl, sm: layoutTokens.spacing.xxl },
                px: { xs: layoutTokens.spacing.lg, sm: layoutTokens.spacing.xxl },
                textAlign: "center",
                ...sx,
            }}
        >
            {icone && (
                <Box
                    aria-hidden="true"
                    sx={{
                        display: "grid",
                        placeItems: "center",
                        width: 48,
                        height: 48,
                        mb: layoutTokens.spacing.md,
                        borderRadius: "50%",
                        bgcolor: "action.hover",
                        color: "text.secondary",
                    }}
                >
                    {icone}
                </Box>
            )}
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    mb: layoutTokens.spacing.xs,
                }}
            >
                {titulo}
            </Typography>
            {descricao && (
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: layoutTokens.typography.body,
                        lineHeight: 1.5,
                        maxWidth: 400,
                        overflowWrap: "anywhere",
                    }}
                >
                    {descricao}
                </Typography>
            )}
            {acao && <Box sx={{ mt: layoutTokens.spacing.md }}>{acao}</Box>}
        </Box>
    );
}
