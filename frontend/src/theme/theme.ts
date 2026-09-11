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
        divider: "#E2E8F0",
        action: {
            active: "#64748B",
            hover: "rgba(15, 23, 42, 0.04)",
            selected: "rgba(15, 110, 110, 0.08)",
            disabled: "rgba(15, 23, 42, 0.26)",
            disabledBackground: "rgba(15, 23, 42, 0.04)",
        },
    },

    typography: {
        fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        h1: { fontWeight: 800, letterSpacing: "-0.02em" },
        h2: { fontWeight: 700, letterSpacing: "-0.015em" },
        h3: { fontWeight: 700 },
        h4: { fontWeight: 700 },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 700 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        body1: { lineHeight: 1.5 },
        body2: { lineHeight: 1.5 },
        caption: { fontSize: "0.75rem", lineHeight: 1.4 },
        overline: { letterSpacing: "0.06em" },
    },

    shape: {
        borderRadius: 12,
    },

    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)",
                    borderColor: "#E2E8F0",
                },
                outlined: {
                    borderWidth: 1,
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 600,
                    borderRadius: 10,
                    minHeight: 40,
                    padding: "8px 16px",
                },
                contained: {
                    boxShadow: "0 2px 8px rgba(15, 110, 110, 0.25)",
                    "&:hover": {
                        boxShadow: "0 4px 12px rgba(15, 110, 110, 0.35)",
                    },
                },
                outlined: {
                    borderColor: "#CBD5E1",
                    "&:hover": {
                        borderColor: "#94A3B8",
                        backgroundColor: "rgba(15, 23, 42, 0.02)",
                    },
                },
                text: {
                    "&:hover": {
                        backgroundColor: "rgba(15, 23, 42, 0.04)",
                    },
                },
                sizeSmall: {
                    minHeight: 32,
                    padding: "6px 12px",
                    fontSize: "0.8125rem",
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: 10,
                        backgroundColor: "#FFFFFF",
                        "& fieldset": {
                            borderColor: "#E2E8F0",
                            borderWidth: 1,
                        },
                        "&:hover fieldset": {
                            borderColor: "#94A3B8",
                        },
                        "&.Mui-focused fieldset": {
                            borderColor: "#0F766E",
                            borderWidth: 2,
                        },
                        "&.Mui-error fieldset": {
                            borderColor: "#DC2626",
                        },
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: "#E2E8F0",
                    padding: "10px 16px",
                    fontSize: "0.875rem",
                    lineHeight: 1.4,
                },
                head: {
                    fontWeight: 700,
                    color: "#334155",
                    backgroundColor: "#F8FAFC",
                    textTransform: "none",
                    letterSpacing: "0.01em",
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    "&:hover": {
                        backgroundColor: "rgba(15, 23, 42, 0.02)",
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 16,
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    padding: "20px 24px 8px",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: "16px 24px",
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: "12px 24px 20px",
                    gap: 8,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    height: 24,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: "0.75rem",
                },
                sizeSmall: {
                    height: 22,
                    fontSize: "0.72rem",
                },
            },
        },
        MuiSwitch: {
            styleOverrides: {
                root: {
                    "& .MuiSwitch-switchBase": {
                        "&.Mui-checked": {
                            color: "#0F766E",
                        },
                        "&.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "#0F766E",
                            opacity: 0.5,
                        },
                    },
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: "#0F172A",
                    fontSize: "0.75rem",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.25)",
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    minHeight: 44,
                    "& .MuiTabs-indicator": {
                        height: 3,
                        borderRadius: 3,
                        backgroundColor: "#0F766E",
                    },
                },
                scrollButtons: {
                    width: 32,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    minHeight: 44,
                    color: "#64748B",
                    "&.Mui-selected": {
                        color: "#0F172A",
                    },
                },
            },
        },
    },
});

export default theme;
