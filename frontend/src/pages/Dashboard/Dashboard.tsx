import { Paper, Stack, Typography } from "@mui/material";
import PageIntro from "../../components/layout/PageIntro";

function Dashboard() {
    return (
        <Stack spacing={2.5}>
            <PageIntro
                titulo="Dashboard"
                descricao="Bem-vindo ao Novexa ERP."
            />

            <Paper
                variant="outlined"
                sx={{
                    maxWidth: 640,
                    p: { xs: 2, sm: 2.5 },
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                }}
            >
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
                    Uma base simples para a operação do seu negócio.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: "0.875rem" }}>
                    Utilize o menu para acessar as áreas que serão evoluídas para vendas,
                    estoque e o futuro PDV.
                </Typography>
            </Paper>
        </Stack>
    );
}

export default Dashboard;
