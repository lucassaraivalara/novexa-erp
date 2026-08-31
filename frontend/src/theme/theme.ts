import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: "#0F766E",
            dark: "#115E59",
            light: "#CCFBF1",
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: "#0F172A",
            contrastText: "#FFFFFF",
        },
        background: {
            default: "#F8FAFC",
            paper: "#FFFFFF",
        },
        text: {
            primary: "#0F172A",
            secondary: "#475569",
        },
    },

    typography: {
        fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },

    shape: {
        borderRadius: 14,
    },
});

export default theme;
