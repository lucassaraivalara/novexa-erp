import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: "#087EBC",
        },
        secondary: {
            main: "#0D223D",
        },
        background: {
            default: "#F4F7FA",
            paper: "#FFFFFF",
        },
        text: {
            primary: "#172033",
            secondary: "#64748B",
        },
    },

    typography: {
        fontFamily: "Roboto, Arial, sans-serif",
    },

    shape: {
        borderRadius: 10,
    },
});

export default theme;