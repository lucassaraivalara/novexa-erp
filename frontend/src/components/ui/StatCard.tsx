import { Paper, Stack, Typography } from "@mui/material";

interface StatCardProps {
    titulo: string;
    valor: string | number;
    descricao?: string;
    cor?: string;
}

function StatCard({ titulo, valor, descricao, cor = "primary" }: StatCardProps) {
    return (
        <Paper variant="outlined" sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Stack sx={{ gap: 0.5 }}>
                <Typography color="text.secondary" sx={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {titulo}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2, color: cor === "primary" ? "primary.main" : "text.primary" }}>
                    {valor}
                </Typography>
            </Stack>
            {descricao && (
                <Typography color="text.secondary" sx={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                    {descricao}
                </Typography>
            )}
        </Paper>
    );
}

export default StatCard;