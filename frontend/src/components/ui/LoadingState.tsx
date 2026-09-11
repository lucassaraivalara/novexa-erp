import { CircularProgress, Stack, Typography } from "@mui/material";
import type { SxProps } from "@mui/system";

interface LoadingStateProps {
    mensagem?: string;
    tamanho?: "pequeno" | "medio" | "grande";
    sx?: SxProps;
}

const tamanhoMap = {
    pequeno: { progress: 24, font: "0.75rem", gap: 1 },
    medio: { progress: 32, font: "0.875rem", gap: 1.5 },
    grande: { progress: 40, font: "1rem", gap: 2 },
};

export default function LoadingState({ mensagem = "Carregando...", tamanho = "medio", sx }: LoadingStateProps) {
    const { progress, font, gap } = tamanhoMap[tamanho];

    return (
        <Stack
            sx={{
                alignItems: "center",
                justifyContent: "center",
                gap,
                py: 6,
                px: 3,
                ...sx,
            }}
        >
            <CircularProgress size={progress} thickness={4} color="primary" />
            {mensagem && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: font, fontWeight: 500 }}
                >
                    {mensagem}
                </Typography>
            )}
        </Stack>
    );
}