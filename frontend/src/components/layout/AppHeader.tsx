import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { AppBar, Avatar, Box, Button, Toolbar, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { obterTituloDaPagina } from "../../routes/navigation";
import { obterSessao, removerSessao } from "../../utils/auth/sessao";
import { layoutTokens } from "./layoutTokens";

function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const sessao = obterSessao();
    const nomeUsuario = sessao?.nomeUsuario ?? "Usuário";

    function handleSair() {
        removerSessao();
        navigate("/login", { replace: true });
    }

    return (
        <AppBar
            position="static"
            elevation={0}
            color="transparent"
            sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
            }}
        >
            <Toolbar
                sx={{
                    minHeight: layoutTokens.header.altura,
                    gap: { xs: 1, sm: 1.5 },
                    px: { xs: 2, md: 3 },
                }}
            >
                <Typography
                    variant="h6"
                    component="h1"
                    sx={{ flexGrow: 1, fontSize: "1rem", fontWeight: 700 }}
                >
                    {obterTituloDaPagina(location.pathname)}
                </Typography>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Avatar
                        sx={{
                            width: 30,
                            height: 30,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "primary.dark",
                            backgroundColor: "primary.light",
                        }}
                    >
                        {nomeUsuario.charAt(0).toUpperCase()}
                    </Avatar>

                    <Typography
                        variant="body2"
                        sx={{
                            display: { xs: "none", sm: "block" },
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                        }}
                    >
                        {nomeUsuario}
                    </Typography>

                    <Button
                        color="inherit"
                        startIcon={<LogoutRoundedIcon />}
                        onClick={handleSair}
                        sx={{
                            minHeight: 36,
                            px: 1,
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            textTransform: "none",
                            "& .MuiButton-startIcon > *:nth-of-type(1)": {
                                fontSize: 18,
                            },
                        }}
                    >
                        Sair
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default AppHeader;
