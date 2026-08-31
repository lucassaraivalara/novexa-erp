import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import { layoutTokens } from "./layoutTokens";
import Sidebar from "./Sidebar";

function MainLayout() {
    return (
        <Box
            sx={{
                display: "flex",
                minHeight: "100vh",
                backgroundColor: "background.default",
            }}
        >
            <Sidebar />

            <Box
                sx={{
                    display: "flex",
                    flexGrow: 1,
                    flexDirection: "column",
                    minWidth: 0,
                }}
            >
                <AppHeader />

                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        p: layoutTokens.conteudo.padding,
                    }}
                >
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
}

export default MainLayout;
