import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import Sidebar from "../../components/Sidebar/Sidebar";
import { removerSessao } from "../../utils/auth/sessao";

function PaginaInicial() {
    const navigate = useNavigate();

    function handleSair() {
        removerSessao();
        navigate("/login", { replace: true });
    }

    return (
        <Box
            sx={{
                display: "flex",
                minHeight: "100vh",
                backgroundColor: "background.default",
            }}
        >
            <Sidebar onSair={handleSair} />

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    p: { xs: 3, md: 5 },
                }}
            >
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                    Página Inicial
                </Typography>

                <Typography color="text.secondary" sx={{ mt: 1 }}>
                    Bem-vindo ao Novexa ERP.
                </Typography>
            </Box>
        </Box>
    );
}

export default PaginaInicial;
