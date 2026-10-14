import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, ClickAwayListener, Divider, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { itemMenuAtivo, menuPrincipal, obterCaminhoDaRota, rotaPdv, type AreaMenu } from "../../routes/navigation";
import { podeGerenciarUsuarios } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";
import { layoutTokens } from "./layoutTokens";

const estiloItem = {
    minHeight: 44, px: 1.5, gap: 1, borderRadius: "6px", color: "text.secondary",
    "&.Mui-selected": { bgcolor: "#DDF2E9", color: "#075E4B", "&:hover": { bgcolor: "#D2EBDF" } },
    "&:hover": { bgcolor: "#F0F5F3" },
    "&.Mui-focusVisible": { outline: "2px solid #0E7C66", outlineOffset: -2 },
    "& .MuiListItemIcon-root": { minWidth: 20, color: "inherit", "& svg": { fontSize: 20 } },
    "& .MuiListItemText-primary": { fontSize: 14, fontWeight: 500 },
};

export default function Sidebar() {
    const location = useLocation();
    const theme = useTheme();
    const mobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [selecao, setSelecao] = useState<{ key: string; id: string | null }>({ key: location.key, id: null });
    const acionadorRef = useRef<HTMLButtonElement | null>(null);
    const painelRef = useRef<HTMLDivElement | null>(null);
    const areas = menuPrincipal.map(area => ({ ...area, filhos: area.filhos.filter(item => item.id !== "usuarios" || podeGerenciarUsuarios(obterSessao()?.perfil)) }));
    const aberta = selecao.key === location.key ? areas.find(area => area.id === selecao.id) : undefined;
    const fechar = useCallback((restaurarFoco = true) => {
        setSelecao({ key: location.key, id: null });
        if (restaurarFoco) acionadorRef.current?.focus();
    }, [location.key]);

    useEffect(() => {
        if (!aberta) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); fechar(); }
        };
        window.addEventListener("keydown", escape);
        return () => window.removeEventListener("keydown", escape);
    }, [aberta, fechar]);

    function abrir(area: AreaMenu, acionador: HTMLButtonElement, focarPainel = false) {
        acionadorRef.current = acionador;
        setSelecao({ key: location.key, id: focarPainel || aberta?.id !== area.id ? area.id : null });
        if (focarPainel) requestAnimationFrame(() => painelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    }

    return <Box sx={{ width: layoutTokens.sidebar.largura, flexShrink: 0 }}>
        <ClickAwayListener onClickAway={() => fechar(false)}>
            <Box component="nav" aria-label="Menu principal" sx={{
                position: "fixed", zIndex: theme.zIndex.drawer, left: 8, top: 8,
                height: "calc(100dvh - 16px)", display: "flex", overflow: "hidden",
                width: mobile ? aberta ? "min(320px, calc(100vw - 16px))" : layoutTokens.sidebar.faixaIcones
                    : layoutTokens.sidebar.faixaIcones + layoutTokens.sidebar.colunaPrincipal + (aberta ? layoutTokens.sidebar.colunaSecundaria : 0),
                bgcolor: "background.paper", border: "1px solid #DCE3E9", borderRadius: "12px",
                boxShadow: "0 8px 28px rgba(16,27,43,.12)",
            }}>
                <Stack aria-label="Áreas compactas" sx={{ width: layoutTokens.sidebar.faixaIcones, flexShrink: 0, bgcolor: "#111B2B", color: "#D9E3EF", alignItems: "center", py: 2, gap: 0.75 }}>
                    <Box sx={{ height: 64, display: "flex", alignItems: "flex-start", color: "#4FCAA4" }}><StorefrontRoundedIcon sx={{ fontSize: 26 }} /></Box>
                    <Tooltip title="Vender" placement="right"><IconButton component={Link} to={obterCaminhoDaRota(rotaPdv)} aria-label="Vender (ícone)"
                        sx={{ width: 40, height: 44, color: "#FFFFFF", bgcolor: "#0E7C66", borderRadius: "6px", "&:hover": { bgcolor: "#096653" } }}>{rotaPdv.icone}</IconButton></Tooltip>
                    <Divider flexItem sx={{ borderColor: "#28364A", my: 1 }} />
                    {areas.map(area => {
                        const ativo = aberta?.id === area.id || itemMenuAtivo(area, location.pathname, location.search);
                        return <Tooltip key={area.id} title={area.titulo} placement="right"><IconButton aria-label={`${area.titulo} (ícone)`}
                            aria-expanded={aberta?.id === area.id} aria-controls={aberta?.id === area.id ? "funcoes-area" : undefined}
                            onClick={event => abrir(area, event.currentTarget)} onKeyDown={event => {
                                if (event.key === "ArrowRight") { event.preventDefault(); abrir(area, event.currentTarget, true); }
                            }} sx={{ width: 40, height: 44, borderRadius: "6px", color: ativo ? "#91E0C1" : "#C7D2E2",
                                bgcolor: ativo ? "#223E3D" : "transparent", "&:hover": { bgcolor: "#25354A" },
                                "&.Mui-focusVisible": { outline: "2px solid #4FCAA4", outlineOffset: -2 } }}>{area.icone}</IconButton></Tooltip>;
                    })}
                </Stack>
                {!mobile && <Stack sx={{ width: layoutTokens.sidebar.colunaPrincipal, flexShrink: 0, borderRight: aberta ? "1px solid #E3E8ED" : undefined }}>
                    <Box sx={{ height: 96, px: 2.5, pt: 2.5, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#0E7C66" }}>NOVEXA</Typography>
                        <Typography variant="caption" color="text.secondary">Gestão</Typography>
                    </Box>
                    <Box sx={{ px: 1.25, pb: 1 }}><Button component={Link} to={obterCaminhoDaRota(rotaPdv)} fullWidth startIcon={rotaPdv.icone} variant="contained" disableElevation
                        sx={{ justifyContent: "flex-start", height: 44, borderRadius: "6px", fontSize: 14 }}>Vender</Button></Box>
                    <List aria-label="Áreas do sistema" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.25, pt: 1.5 }}>
                        {areas.map(area => <ListItemButton component="button" type="button" key={area.id} aria-label={area.titulo}
                            selected={aberta?.id === area.id || itemMenuAtivo(area, location.pathname, location.search)}
                            aria-expanded={aberta?.id === area.id} aria-controls={aberta?.id === area.id ? "funcoes-area" : undefined}
                            onClick={event => abrir(area, event.currentTarget)} onKeyDown={event => {
                                if (event.key === "ArrowRight") { event.preventDefault(); abrir(area, event.currentTarget, true); }
                            }} sx={{ ...estiloItem, width: "100%", mb: 0.5 }}>
                            <ListItemIcon>{area.icone}</ListItemIcon><ListItemText primary={area.titulo} />
                            <ChevronRightRoundedIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                        </ListItemButton>)}
                    </List>
                </Stack>}
                {aberta && <Stack ref={painelRef} id="funcoes-area" role="region" aria-label={`Funções de ${aberta.titulo}`} sx={{ minWidth: 0, flex: 1 }}
                    onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); fechar(); } }}>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", height: 72, px: 2, borderBottom: "1px solid #E3E8ED", flexShrink: 0 }}>
                        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>{aberta.titulo}</Typography>
                        <Tooltip title="Fechar funções"><IconButton aria-label="Fechar funções" size="small" onClick={() => fechar()}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                    </Stack>
                    <List sx={{ overflowY: "auto", minHeight: 0, p: 1.25 }}>
                        {aberta.filhos.map(item => <Box key={item.id} component="li" sx={{ listStyle: "none" }}>
                            {item.id === "formas-pagamento" && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, mb: 0.5, px: 1.5 }}>Configurações de pagamento</Typography>}
                            <ListItemButton component={Link} to={obterCaminhoDaRota(item.rota)} onClick={() => fechar(false)}
                                selected={itemMenuAtivo(item, location.pathname, location.search)} aria-current={itemMenuAtivo(item, location.pathname, location.search) ? "page" : undefined}
                                sx={{ ...estiloItem, mb: 0.5 }}>
                                <ListItemIcon>{item.rota.icone}</ListItemIcon><ListItemText primary={item.titulo ?? item.rota.titulo} />
                            </ListItemButton>
                        </Box>)}
                    </List>
                </Stack>}
            </Box>
        </ClickAwayListener>
    </Box>;
}
