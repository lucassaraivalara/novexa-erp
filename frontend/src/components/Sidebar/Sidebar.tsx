import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
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

type SidebarProps = {
    onSair: () => void;
};

const larguraSidebar = { xs: 72, sm: 248 };

function Sidebar({ onSair }: SidebarProps) {
    return (
        <Drawer
            variant="permanent"
            sx={{
                width: larguraSidebar,
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                    width: larguraSidebar,
                    boxSizing: "border-box",
                    borderRight: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "background.paper",
                },
            }}
        >
            <Stack sx={{ height: "100%" }}>
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                        alignItems: "center",
                        px: { xs: 1.5, sm: 2.5 },
                        py: 2.5,
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            flexShrink: 0,
                            width: 40,
                            height: 40,
                            placeItems: "center",
                            borderRadius: 2,
                            color: "primary.contrastText",
                            backgroundColor: "primary.main",
                        }}
                    >
                        <HubRoundedIcon fontSize="small" />
                    </Box>

                    <Box sx={{ display: { xs: "none", sm: "block" } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                            NOVEXA
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            ERP
                        </Typography>
                    </Box>
                </Stack>

                <Divider />

                <List sx={{ p: 1 }}>
                    <ListItemButton
                        selected
                        aria-current="page"
                        sx={{
                            minHeight: 48,
                            borderRadius: 2,
                            justifyContent: { xs: "center", sm: "flex-start" },
                            px: { xs: 1.5, sm: 2 },
                            "&.Mui-selected": {
                                color: "primary.main",
                                backgroundColor: "primary.light",
                            },
                            "&.Mui-selected:hover": {
                                backgroundColor: "primary.light",
                            },
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: { xs: 0, sm: 40 },
                                color: "inherit",
                            }}
                        >
                            <HomeRoundedIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Página Inicial"
                            slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                            sx={{ display: { xs: "none", sm: "block" } }}
                        />
                    </ListItemButton>
                </List>

                <Box sx={{ mt: "auto", p: 1 }}>
                    <Divider sx={{ mb: 1 }} />
                    <ListItemButton
                        onClick={onSair}
                        sx={{
                            minHeight: 48,
                            borderRadius: 2,
                            color: "text.secondary",
                            justifyContent: { xs: "center", sm: "flex-start" },
                            px: { xs: 1.5, sm: 2 },
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: { xs: 0, sm: 40 },
                                color: "inherit",
                            }}
                        >
                            <LogoutRoundedIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Sair"
                            sx={{ display: { xs: "none", sm: "block" } }}
                        />
                    </ListItemButton>
                </Box>
            </Stack>
        </Drawer>
    );
}

export default Sidebar;
