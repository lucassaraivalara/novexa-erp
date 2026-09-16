import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useState } from "react";
import {
    Box,
    Collapse,
    Divider,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { itemMenuAtivo, menuPrincipal, obterCaminhoDaRota, type ItemMenu } from "../../routes/navigation";
import { layoutTokens } from "./layoutTokens";

function Sidebar() {

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: layoutTokens.sidebar.largura,
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                    width: layoutTokens.sidebar.largura,
                    boxSizing: "border-box",
                    border: 0,
                    borderRight: "1px solid rgba(148, 163, 184, 0.12)",
                    borderRadius: 0,
                    boxShadow: "none",
                    color: "#E2E8F0",
                    backgroundColor: "#0B1220",
                },
            }}
        >
            <Stack sx={{ height: "100%" }}>
                <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{
                        alignItems: "center",
                        justifyContent: { xs: "center", sm: "flex-start" },
                        minHeight: 60,
                        px: { xs: 0.75, sm: 1.5 },
                        py: 1.25,
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            flexShrink: 0,
                            width: 32,
                            height: 32,
                            placeItems: "center",
                            border: "1px solid rgba(94, 234, 212, 0.2)",
                            borderRadius: 2,
                            color: "#5EEAD4",
                            backgroundColor: "rgba(20, 184, 166, 0.14)",
                        }}
                    >
                        <StorefrontRoundedIcon sx={{ fontSize: 18 }} />
                    </Box>

                    <Box sx={{ display: { xs: "none", sm: "block" } }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontSize: "0.82rem", fontWeight: 800, lineHeight: 1.1, letterSpacing: "0.08em" }}
                        >
                            NOVEXA
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.62rem", color: "rgba(203, 213, 225, 0.62)" }}>
                            ERP para pequenos negócios
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.12)" }} />

                <Box
                    component="nav"
                    aria-label="Menu principal"
                    sx={{
                        minHeight: 0,
                        overflowY: "auto",
                        flex: 1,
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(148, 163, 184, 0.28) transparent",
                        "&::-webkit-scrollbar": { width: 4 },
                        "&::-webkit-scrollbar-thumb": {
                            borderRadius: 4,
                            backgroundColor: "rgba(148, 163, 184, 0.28)",
                        },
                    }}
                >
                    <List sx={{ px: 0.75, py: 1 }}>
                        {menuPrincipal.map(item => <EntradaMenu key={item.id} item={item} />)}
                    </List>
                </Box>

                <Box sx={{ mt: "auto", px: { xs: 1, sm: 1.5 }, py: 1.25, borderTop: "1px solid rgba(148, 163, 184, 0.12)" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: { xs: "center", sm: "flex-start" } }}>
                        <Box sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", backgroundColor: "#2DD4BF" }} />
                        <Typography
                            variant="caption"
                            sx={{
                                display: { xs: "none", sm: "block" },
                                fontSize: "0.66rem",
                                color: "rgba(203, 213, 225, 0.58)",
                            }}
                        >
                            Base preparada para o PDV.
                        </Typography>
                    </Stack>
                </Box>
            </Stack>
        </Drawer>
    );
}

function EntradaMenu({ item, nivel = 0 }: { item: ItemMenu; nivel?: number }) {
    const location = useLocation();
    const ativo = itemMenuAtivo(item, location.pathname);
    const grupo = item.tipo === "grupo";
    const indisponivel = item.tipo === "indisponivel";
    const [expansao, setExpansao] = useState({
        localizacao: location.key,
        aberto: grupo && (ativo || Boolean(item.abertoInicialmente)),
    });
    // Ao navegar para um descendente, revela sua categoria mesmo se estava fechada.
    const aberto = expansao.aberto || (ativo && expansao.localizacao !== location.key);
    const titulo = item.tipo === "rota" ? item.titulo ?? item.rota.titulo : item.titulo;
    const icone = item.tipo === "rota" ? item.rota.icone : item.icone;
    const conteudo = <>
        <ListItemIcon sx={{ minWidth: { xs: 0, sm: nivel ? 24 : 29 }, justifyContent: "center", color: "inherit", "& svg": { fontSize: layoutTokens.sidebar.tamanhoIconeMenu } }}>
            {icone}
        </ListItemIcon>
        <ListItemText
            primary={titulo}
            slotProps={{
                primary: {
                    noWrap: true,
                    sx: { fontSize: nivel ? "0.75rem" : "0.8rem", fontWeight: grupo ? 650 : nivel ? 500 : 600, lineHeight: 1.35 },
                },
            }}
            sx={{ display: { xs: "none", sm: "block" }, minWidth: 0 }}
        />
        {grupo && (aberto
            ? <ExpandMoreRoundedIcon sx={{ display: { xs: "none", sm: "block" }, fontSize: 15, flexShrink: 0 }} />
            : <ChevronRightRoundedIcon sx={{ display: { xs: "none", sm: "block" }, fontSize: 15, flexShrink: 0 }} />)}
    </>;
    const estilo = {
        position: "relative",
        minHeight: layoutTokens.sidebar.alturaItemMenu,
        width: "100%",
        mb: 0.125,
        borderRadius: 1.25,
        color: indisponivel
            ? "rgba(203, 213, 225, 0.38)"
            : ativo
                ? "#F8FAFC"
                : nivel
                    ? "rgba(203, 213, 225, 0.72)"
                    : "rgba(226, 232, 240, 0.88)",
        justifyContent: { xs: "center", sm: "flex-start" },
        pl: { xs: grupo ? 0.5 : 1, sm: 1.25 + nivel * 0.75 },
        pr: { xs: grupo ? 0.5 : 1, sm: 0.75 },
        textAlign: "left",
        transition: "background-color 120ms ease, color 120ms ease",
        "&.Mui-selected": {
            color: "#F8FAFC",
            backgroundColor: "rgba(45, 212, 191, 0.12)",
            "&::before": {
                position: "absolute",
                top: 8,
                bottom: 8,
                left: 0,
                width: 2,
                borderRadius: 2,
                backgroundColor: "#2DD4BF",
                content: "\"\"",
            },
        },
        "&.Mui-selected:hover": { backgroundColor: "rgba(45, 212, 191, 0.16)" },
        "&:hover": { color: "#F8FAFC", backgroundColor: "rgba(148, 163, 184, 0.08)" },
        "&[aria-disabled=true]": {
            color: "rgba(203, 213, 225, 0.38)",
            cursor: "default",
            backgroundColor: "transparent",
            "&:hover": { color: "rgba(203, 213, 225, 0.38)", backgroundColor: "transparent" },
        },
    };

    return <Box component="li" sx={{ mt: nivel === 0 && grupo ? 0.5 : 0, listStyle: "none" }}>
        <Tooltip title={indisponivel ? `${titulo} — ainda não disponível` : titulo} placement="right">
            {item.tipo === "rota" ? (
                <ListItemButton component={Link} to={obterCaminhoDaRota(item.rota)} selected={ativo} aria-current={ativo ? "page" : undefined} aria-label={titulo} sx={estilo}>
                    {conteudo}
                </ListItemButton>
            ) : (
                <ListItemButton component="button" type="button" selected={ativo && !grupo} aria-label={indisponivel ? `${titulo} — ainda não disponível` : titulo}
                    aria-disabled={indisponivel || undefined} aria-expanded={grupo ? aberto : undefined} aria-controls={grupo ? `menu-${item.id}` : undefined}
                    onClick={grupo ? () => setExpansao({ localizacao: location.key, aberto: !aberto }) : undefined} sx={estilo}>
                    {conteudo}
                </ListItemButton>
            )}
        </Tooltip>
        {grupo && <Collapse in={aberto} timeout={140}>
            <List id={`menu-${item.id}`} aria-label={titulo} disablePadding>
                {item.filhos.map(filho => <EntradaMenu key={filho.id} item={filho} nivel={nivel + 1} />)}
            </List>
        </Collapse>}
    </Box>;
}

export default Sidebar;
