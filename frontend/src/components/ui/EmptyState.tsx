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
                py: 6,
                px: 3,
                textAlign: "center",
                ...sx,
            }}
        >
            {icone && (
                <Box
                    sx={{
                        mb: 2,
                        opacity: 0.4,
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
                    mb: 1,
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
                        maxWidth: 360,
                    }}
                >
                    {descricao}
                </Typography>
            )}
            {acao && <Box sx={{ mt: 3 }}>{acao}</Box>}
        </Box>
    );
}