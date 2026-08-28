import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: "#087EBC",
            dark: "#075C91",
            light: "#E6F4FB",
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: "#102A43",
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
        borderRadius: 12,
    },
});

export default theme;
