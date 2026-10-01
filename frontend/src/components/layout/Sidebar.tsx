import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
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
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { itemMenuAtivo, menuPrincipal, obterCaminhoDaRota, type ItemMenu } from "../../routes/navigation";
import { podeGerenciarUsuarios } from "../../utils/auth/perfis";
import { obterSessao } from "../../utils/auth/sessao";
import { layoutTokens } from "./layoutTokens";

function Sidebar() {
    const theme = useTheme();
    const somenteIcones = useMediaQuery(theme.breakpoints.down("sm"));
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
                    borderRight: "1px solid",
                    borderColor: "#233047",
                    borderRadius: 0,
                    boxShadow: "inset -1px 0 0 rgba(255,255,255,.03)",
                    color: "#E6EBF2",
                    backgroundColor: "#111B2B",
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
                        flexShrink: 0,
                        minHeight: layoutTokens.header.altura,
                        px: { xs: 0.75, sm: 1.5 },
                        py: 1.25,
                        m: { xs: 0, sm: 1.5 },
                        borderRadius: "10px",
                        bgcolor: { xs: "transparent", sm: "primary.main" },
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            flexShrink: 0,
                            width: 32,
                            height: 32,
                            placeItems: "center",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: "8px",
                            color: "primary.dark",
                            backgroundColor: "primary.light",
                        }}
                    >
                        <StorefrontRoundedIcon sx={{ fontSize: 18 }} />
                    </Box>

                    <Box sx={{ display: { xs: "none", sm: "block" } }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.2, letterSpacing: 0, color: "#FFFFFF" }}
                        >
                            NOVEXA
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "11px", color: "#E7F4F0" }}>
                            ERP para pequenos negócios
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{ borderColor: "#233047" }} />

                <Box
                    component="nav"
                    aria-label="Menu principal"
                    sx={{
                        minHeight: 0,
                        overflowX: "hidden",
                        overflowY: "auto",
                        flex: 1,
                        scrollbarWidth: "thin",
                        scrollbarColor: `${theme.palette.divider} transparent`,
                        "&::-webkit-scrollbar": { width: 4 },
                        "&::-webkit-scrollbar-thumb": {
                            borderRadius: 4,
                            backgroundColor: "divider",
                        },
                    }}
                >
                    <List sx={{ px: 0.75, py: 1 }}>
                        {menuPrincipal.map(item => <EntradaMenu key={item.id} item={item} somenteIcones={somenteIcones} />)}
                    </List>
                </Box>

            </Stack>
        </Drawer>
    );
}

function EntradaMenu({ item, nivel = 0, somenteIcones }: { item: ItemMenu; nivel?: number; somenteIcones: boolean }) {
    const location = useLocation();
    const ativo = itemMenuAtivo(item, location.pathname);
    const grupo = item.tipo === "grupo";
    const indisponivel = item.tipo === "indisponivel";
    const [expansao, setExpansao] = useState({
        localizacao: location.key,
        aberto: grupo && (ativo || Boolean(item.abertoInicialmente)),
    });
    if (item.id === "usuarios" && !podeGerenciarUsuarios(obterSessao()?.perfil)) return null;
    // Ao navegar para um descendente, revela sua categoria mesmo se estava fechada.
    const aberto = expansao.aberto || (ativo && expansao.localizacao !== location.key);
    const titulo = item.tipo === "rota" ? item.titulo ?? item.rota.titulo : item.titulo;
    const icone = item.tipo === "rota" ? item.rota.icone : item.icone;
    const conteudo = <>
        <ListItemIcon sx={{ minWidth: 0, flexShrink: 0, color: "inherit", "& svg": { fontSize: layoutTokens.sidebar.tamanhoIconeMenu } }}>
            {icone}
        </ListItemIcon>
        <ListItemText
            primary={titulo}
            slotProps={{
                primary: {
                    noWrap: true,
                    sx: { fontSize: grupo ? "12px" : "14px", fontWeight: grupo ? 600 : 500, lineHeight: 1.35, letterSpacing: 0, textTransform: grupo ? "uppercase" : "none" },
                },
            }}
            sx={{ display: { xs: "none", sm: "block" }, minWidth: 0, my: 0 }}
        />
        {grupo && <ChevronRightRoundedIcon sx={{
            position: { xs: "absolute", sm: "static" },
            right: 2,
            fontSize: { xs: 12, sm: 15 },
            flexShrink: 0,
            opacity: 0.65,
            transform: aberto ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }} />}
    </>;
    const estilo = {
        position: "relative",
        minHeight: { xs: 42, sm: layoutTokens.sidebar.alturaItemMenu },
        width: "100%",
        mb: 0.125,
        borderRadius: `${layoutTokens.radius.button}px`,
        color: indisponivel
            ? "#7D8BA0"
            : grupo ? "#AAB7C9" : ativo ? "primary.dark" : "#E6EBF2",
        justifyContent: { xs: "center", sm: "flex-start" },
        columnGap: { xs: 0, sm: 1 },
        pl: { xs: 0, sm: nivel ? 2 : 1.25 },
        pr: { xs: 0, sm: 1 },
        py: 0.5,
        textAlign: "left",
        transition: "background-color 120ms ease, color 120ms ease",
        "&.Mui-selected": {
            color: "primary.dark",
            backgroundColor: "#CDEEE2",
            "&::before": {
                position: "absolute",
                top: 8,
                bottom: 8,
                left: 0,
                width: 3,
                borderRadius: "2px",
                backgroundColor: "primary.main",
                content: "\"\"",
            },
        },
        "&.Mui-selected:hover": { color: "primary.dark", backgroundColor: "#CDEEE2" },
        "&:hover": { backgroundColor: "rgba(255,255,255,.06)" },
        "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
        "&[aria-disabled=true]": {
            color: "#7D8BA0",
            cursor: "default",
            backgroundColor: "transparent",
            "&:hover": { color: "#7D8BA0", backgroundColor: "transparent" },
        },
    };

    return <Box component="li" sx={{
        listStyle: "none",
        ...(grupo && nivel === 0 ? {
            mt: 1,
            pt: 1,
            borderTop: "1px solid",
            borderColor: "#233047",
        } : {}),
    }}>
        <Tooltip title={somenteIcones ? (indisponivel ? `${titulo} — ainda não disponível` : titulo) : ""} placement="right">
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
            <List id={`menu-${item.id}`} aria-label={titulo} disablePadding sx={{ pt: 0.25 }}>
                {item.filhos.map(filho => <EntradaMenu key={filho.id} item={filho} nivel={nivel + 1} somenteIcones={somenteIcones} />)}
            </List>
        </Collapse>}
    </Box>;
}

export default Sidebar;
