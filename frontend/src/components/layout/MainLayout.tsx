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
                width: "100%",
                minWidth: 0,
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
                    minHeight: "100vh",
                }}
            >
                <AppHeader />

                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        backgroundColor: "background.default",
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
