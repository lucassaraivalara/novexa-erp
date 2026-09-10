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
                    color: "secondary.contrastText",
                    backgroundColor: "secondary.main",
                },
            }}
        >
            <Stack sx={{ height: "100%" }}>
                <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{
                        alignItems: "center",
                        px: { xs: 1.25, sm: 2 },
                        py: 2,
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            flexShrink: 0,
                            width: 36,
                            height: 36,
                            placeItems: "center",
                            borderRadius: 2.5,
                            color: "primary.contrastText",
                            backgroundColor: "primary.main",
                        }}
                    >
                        <StorefrontRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>

                    <Box sx={{ display: { xs: "none", sm: "block" } }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontSize: "0.875rem", fontWeight: 800, lineHeight: 1.1 }}
                        >
                            NOVEXA
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.65rem", opacity: 0.72 }}>
                            ERP para pequenos negócios
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.12)" }} />

                <Box component="nav" aria-label="Menu principal" sx={{ minHeight: 0, overflowY: "auto", flex: 1 }}>
                    <List sx={{ px: 0.75, py: 1.5 }}>
                        {menuPrincipal.map(item => <EntradaMenu key={item.id} item={item} />)}
                    </List>
                </Box>

                <Box sx={{ mt: "auto", px: 2, py: 2 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            display: { xs: "none", sm: "block" },
                            fontSize: "0.7rem",
                            opacity: 0.62,
                        }}
                    >
                        Base preparada para o PDV.
                    </Typography>
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
        <ListItemIcon sx={{ minWidth: { xs: 0, sm: nivel ? 26 : 32 }, color: "inherit", "& svg": { fontSize: layoutTokens.sidebar.tamanhoIconeMenu } }}>
            {icone}
        </ListItemIcon>
        <ListItemText primary={titulo} slotProps={{ primary: { sx: { fontSize: nivel ? "0.78rem" : "0.84rem", fontWeight: grupo || !nivel ? 600 : 400, lineHeight: 1.4 } } }} sx={{ display: { xs: "none", sm: "block" } }} />
        {grupo && (aberto ? <ExpandMoreRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 16, flexShrink: 0 }} />)}
    </>;
    const estilo = {
        minHeight: layoutTokens.sidebar.alturaItemMenu,
        width: "100%",
        mb: 0.25,
        borderRadius: 1.5,
        color: "inherit",
        justifyContent: { xs: "center", sm: "flex-start" },
        pl: { xs: grupo ? 0.5 : 1.25, sm: 1.5 + nivel * 1.25 },
        pr: { xs: grupo ? 0.5 : 1.25, sm: 1 },
        textAlign: "left",
        "&.Mui-selected": { backgroundColor: "rgba(255, 255, 255, 0.14)" },
        "&.Mui-selected:hover, &:hover": { backgroundColor: "rgba(255, 255, 255, 0.2)" },
        "&[aria-disabled=true]": { opacity: 0.5, cursor: "default", backgroundColor: "transparent" },
    };

    return <Box component="li" sx={{ listStyle: "none" }}>
        <Tooltip title={indisponivel ? `${titulo} — ainda não disponível` : titulo} placement="right">
            {item.tipo === "rota" ? (
                <ListItemButton component={Link} to={obterCaminhoDaRota(item.rota)} selected={ativo} aria-current={ativo ? "page" : undefined} aria-label={titulo} sx={estilo}>
                    {conteudo}
                </ListItemButton>
            ) : (
                <ListItemButton component="button" type="button" selected={ativo} aria-label={indisponivel ? `${titulo} — ainda não disponível` : titulo}
                    aria-disabled={indisponivel || undefined} aria-expanded={grupo ? aberto : undefined} aria-controls={grupo ? `menu-${item.id}` : undefined}
                    onClick={grupo ? () => setExpansao({ localizacao: location.key, aberto: !aberto }) : undefined} sx={estilo}>
                    {conteudo}
                </ListItemButton>
            )}
        </Tooltip>
        {grupo && <Collapse in={aberto}>
            <List id={`menu-${item.id}`} aria-label={titulo} disablePadding>
                {item.filhos.map(filho => <EntradaMenu key={filho.id} item={filho} nivel={nivel + 1} />)}
            </List>
        </Collapse>}
    </Box>;
}

export default Sidebar;
