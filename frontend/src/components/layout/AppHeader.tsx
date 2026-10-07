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
    const noDashboard = location.pathname === "/dashboard";
    const hora = new Date().getHours();
    const saudacao = hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite";
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
                borderColor: "divider",
                borderRadius: noDashboard ? "8px" : 0,
                boxShadow: "none",
                backgroundColor: "background.paper",
                m: noDashboard ? { xs: 1, md: 1.25 } : 0,
                width: noDashboard ? "auto" : undefined,
            }}
        >
            <Toolbar
                sx={{
                    minHeight: `${noDashboard ? 60 : layoutTokens.header.altura}px !important`,
                    gap: { xs: 1, sm: 1.25 },
                    px: layoutTokens.header.paddingX,
                }}
            >
                {noDashboard ? <Box sx={{ display: "flex", flexGrow: 1, minWidth: 0, flexDirection: "column", justifyContent: "center" }}>
                    <Typography variant="h6" component="h1" noWrap sx={{ fontSize: { xs: 14, sm: 19 }, fontWeight: 700, lineHeight: 1.25, color: "text.primary" }}>
                        {saudacao}, {nomeUsuario}! 👋
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ display: { xs: "none", sm: "block" }, fontSize: 12, lineHeight: 1.25, color: "text.secondary" }}>
                        Aqui está o que está acontecendo na sua loja hoje.
                    </Typography>
                </Box> : <Typography variant="h6" component="h1" noWrap sx={{ flexGrow: 1, minWidth: 0, fontSize: "16px", fontWeight: 700, lineHeight: 1.3, color: "text.primary" }}>
                    {tituloPagina}
                </Typography>}

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
                            alignItems: "center",
                            gap: 1,
                            maxWidth: 300,
                            minWidth: 0,
                        }}
                    >
                        {mostrarLogomarca ? (
                            <Box
                                component="img"
                                src={logomarcaEmpresa}
                                alt={nomeEmpresa}
                                onError={() => setLogomarcaComErro(true)}
                                sx={{
                                    height: 32,
                                    width: 32,
                                    flexShrink: 0,
                                    borderRadius: "4px",
                                    objectFit: "contain",
                                    display: "block",
                                }}
                            />
                        ) : null}
                        <Box sx={{ minWidth: 0, maxWidth: 240 }}>
                            <TextoTruncado texto={nomeEmpresa} secundario />
                            <TextoTruncado texto={nomeUsuario} />
                        </Box>
                    </Box>

                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "primary.dark",
                            backgroundColor: "primary.light",
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        {iniciais}
                    </Avatar>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, height: 24, my: "auto" }} />

                    <Tooltip title="Sair">
                        <IconButton
                            aria-label="Sair"
                            onClick={handleSair}
                            size="small"
                            sx={{
                                width: 34,
                                height: 34,
                                color: "text.secondary",
                                borderRadius: `${layoutTokens.radius.button}px`,
                                transition: "background-color 120ms ease, color 120ms ease",
                                "&:hover": {
                                    color: "text.primary",
                                    backgroundColor: "action.hover",
                                },
                                "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
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

function TextoTruncado({ texto, secundario = false }: { texto: string; secundario?: boolean }) {
    const [truncado, setTruncado] = useState(false);
    return (
        <Tooltip title={truncado ? texto : ""}>
            <Typography
                noWrap
                variant="body2"
                onMouseEnter={(evento) => setTruncado(evento.currentTarget.scrollWidth > evento.currentTarget.clientWidth)}
                onFocus={(evento) => setTruncado(evento.currentTarget.scrollWidth > evento.currentTarget.clientWidth)}
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: secundario ? "12px" : "13px", fontWeight: secundario ? 400 : 600, color: secundario ? "text.secondary" : "text.primary" }}
            >
                {texto}
            </Typography>
        </Tooltip>
    );
}

export default AppHeader;
