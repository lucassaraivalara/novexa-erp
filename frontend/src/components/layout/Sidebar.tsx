import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import {
    Box,
    Divider,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { obterCaminhoDaRota, rotasInternas } from "../../routes/navigation";
import { layoutTokens } from "./layoutTokens";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();

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

                <List sx={{ px: 0.75, py: 1.5 }}>
                    {rotasInternas.map((rota) => {
                        const caminho = obterCaminhoDaRota(rota);
                        const selecionada = location.pathname === caminho;

                        return (
                            <ListItemButton
                                key={rota.caminho}
                                selected={selecionada}
                                aria-current={selecionada ? "page" : undefined}
                                aria-label={rota.titulo}
                                onClick={() => navigate(caminho)}
                                sx={{
                                    minHeight: layoutTokens.sidebar.alturaItemMenu,
                                    mb: 0.25,
                                    borderRadius: 1.5,
                                    color: "inherit",
                                    justifyContent: { xs: "center", sm: "flex-start" },
                                    px: { xs: 1.25, sm: 1.5 },
                                    "&.Mui-selected": {
                                        backgroundColor: "rgba(255, 255, 255, 0.14)",
                                    },
                                    "&.Mui-selected:hover, &:hover": {
                                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: { xs: 0, sm: 32 },
                                        color: "inherit",
                                        "& svg": {
                                            fontSize: layoutTokens.sidebar.tamanhoIconeMenu,
                                        },
                                    }}
                                >
                                    {rota.icone}
                                </ListItemIcon>
                                <ListItemText
                                    primary={rota.titulo}
                                    slotProps={{
                                        primary: { sx: { fontSize: "0.84rem", fontWeight: 600 } },
                                    }}
                                    sx={{ display: { xs: "none", sm: "block" } }}
                                />
                            </ListItemButton>
                        );
                    })}
                </List>

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

export default Sidebar;
