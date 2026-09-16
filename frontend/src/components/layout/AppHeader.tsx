import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { AppBar, Avatar, Box, Divider, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { obterTituloDaPagina } from "../../routes/navigation";
import { obterSessao, removerSessao } from "../../utils/auth/sessao";
import { layoutTokens } from "./layoutTokens";

function AppHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const sessao = obterSessao();
    const [logomarcaComErro, setLogomarcaComErro] = useState(false);
    const nomeUsuario = sessao?.nomeUsuario ?? "Usuário";
    const nomeEmpresa = sessao?.empresa?.nomeFantasia?.trim() || sessao?.empresa?.razaoSocial?.trim() || "Empresa";
    const logomarcaEmpresa = sessao?.empresa?.logomarca;
    const mostrarLogomarca = !!logomarcaEmpresa && !logomarcaComErro;
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
                borderColor: "rgba(15, 23, 42, 0.08)",
                backgroundColor: "background.paper",
            }}
        >
            <Toolbar
                sx={{
                    minHeight: `${layoutTokens.header.altura}px !important`,
                    gap: { xs: 1, sm: 1.25 },
                    px: layoutTokens.header.paddingX,
                }}
            >
                <Typography
                    variant="h6"
                    component="h1"
                    noWrap
                    sx={{ flexGrow: 1, minWidth: 0, fontSize: "0.875rem", fontWeight: 700, lineHeight: 1.3, color: "text.primary" }}
                >
                    {tituloPagina}
                </Typography>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: { xs: 0.75, sm: 1 },
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            display: { xs: "none", md: "flex" },
                            flexDirection: "column",
                            alignItems: "flex-end",
                            maxWidth: 208,
                        }}
                    >
                        {mostrarLogomarca ? (
                            <Box
                                component="img"
                                src={logomarcaEmpresa}
                                alt={nomeEmpresa}
                                onError={() => setLogomarcaComErro(true)}
                                sx={{
                                    maxHeight: 32,
                                    maxWidth: 120,
                                    height: "auto",
                                    width: "auto",
                                    objectFit: "contain",
                                    display: "block",
                                }}
                            />
                        ) : (
                            <Typography
                                noWrap
                                sx={{
                                    color: "text.secondary",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    lineHeight: 1.15,
                                    textTransform: "uppercase",
                                }}
                            >
                                {nomeEmpresa}
                            </Typography>
                        )}
                        <Typography
                            noWrap
                            variant="body2"
                            sx={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.2, color: "text.primary" }}
                        >
                            {nomeUsuario}
                        </Typography>
                    </Box>

                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "primary.dark",
                            backgroundColor: "#E6F7F5",
                            border: "1px solid rgba(15, 118, 110, 0.18)",
                        }}
                    >
                        {iniciais}
                    </Avatar>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, height: 24, my: "auto", borderColor: "rgba(15, 23, 42, 0.1)" }} />

                    <Tooltip title="Sair">
                        <IconButton
                            aria-label="Sair"
                            onClick={handleSair}
                            size="small"
                            sx={{
                                width: 34,
                                height: 34,
                                color: "text.secondary",
                                borderRadius: 1.25,
                                transition: "background-color 120ms ease, color 120ms ease",
                                "&:hover": {
                                    color: "text.primary",
                                    backgroundColor: "rgba(15, 23, 42, 0.05)",
                                },
                                "& svg": { fontSize: 18 },
                            }}
                        >
                            <LogoutRoundedIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default AppHeader;
