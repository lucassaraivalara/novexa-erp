import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { AppBar, Avatar, Box, Button, Divider, Toolbar, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { obterTituloDaPagina } from "../../routes/navigation";
import { obterSessao, removerSessao } from "../../utils/auth/sessao";
import { layoutTokens } from "./layoutTokens";

function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const sessao = obterSessao();
    const nomeUsuario = sessao?.nomeUsuario ?? "Usuário";
    const nomeEmpresa = sessao?.empresa?.nomeFantasia ?? "Empresa";
    const iniciais = nomeUsuario
        .split(" ")
        .map((parte) => parte.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("");

    function handleSair() {
        removerSessao();
        navigate("/login", { replace: true });
    }

    const tituloPagina = obterTituloDaPagina(location.pathname);

    return (
        <AppBar
            position="static"
            elevation={0}
            color="transparent"
            sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.paper",
                backdropFilter: "blur(8px)",
            }}
        >
            <Toolbar
                sx={{
                    minHeight: layoutTokens.header.altura,
                    gap: { xs: 1, sm: 1.5 },
                    px: layoutTokens.header.paddingX,
                }}
            >
                <Typography
                    variant="h6"
                    component="h1"
                    sx={{ flexGrow: 1, fontSize: "1rem", fontWeight: 700, color: "text.primary", letterSpacing: "-0.01em" }}
                >
                    {tituloPagina}
                </Typography>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                    }}
                >
                    <Box
                        sx={{
                            display: { xs: "none", md: "flex" },
                            flexDirection: "column",
                            alignItems: "flex-end",
                            maxWidth: 220,
                            mr: 0.5,
                        }}
                    >
                        <Typography
                            noWrap
                            sx={{
                                color: "text.secondary",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                lineHeight: 1.2,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                            }}
                        >
                            {nomeEmpresa}
                        </Typography>
                        <Typography
                            noWrap
                            variant="body2"
                            sx={{ fontSize: "0.825rem", fontWeight: 600, lineHeight: 1.25, color: "text.primary" }}
                        >
                            {nomeUsuario}
                        </Typography>
                    </Box>

                    <Avatar
                        sx={{
                            width: 34,
                            height: 34,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "primary.dark",
                            backgroundColor: "primary.light",
                            border: "2px solid rgba(15, 110, 110, 0.12)",
                        }}
                    >
                        {iniciais}
                    </Avatar>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, height: 28, opacity: 0.4 }} />

                    <Button
                        color="inherit"
                        startIcon={<LogoutRoundedIcon />}
                        onClick={handleSair}
                        sx={{
                            minHeight: 38,
                            px: 1,
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            textTransform: "none",
                            color: "text.secondary",
                            "&:hover": {
                                color: "text.primary",
                                backgroundColor: "rgba(15, 23, 42, 0.04)",
                            },
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