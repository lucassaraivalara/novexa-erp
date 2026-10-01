import { createTheme } from "@mui/material/styles";

export const visualTokens = {
    radius: { control: 6, surface: 10, dialog: 10, pill: 999 },
    shadow: {
        surface: "0 1px 3px rgba(16,24,40,.06)",
        elevated: "0 8px 24px rgba(16,24,40,.12)",
    },
    numeric: { fontVariantNumeric: "tabular-nums" },
} as const;

const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: "#0E7C66", dark: "#0A5F4E", light: "#E7F4F0", contrastText: "#FFFFFF" },
        secondary: { main: "#101828", contrastText: "#FFFFFF" },
        background: { default: "#F7F9FB", paper: "#FFFFFF" },
        text: { primary: "#101828", secondary: "#5D6B7A", disabled: "#98A2B3" },
        divider: "#E4E8EC",
        success: { main: "#16794A", light: "#E8F5EE", contrastText: "#FFFFFF" },
        warning: { main: "#B25E09", light: "#FDF3E2", contrastText: "#FFFFFF" },
        error: { main: "#C4372E", light: "#FCECEA", contrastText: "#FFFFFF" },
        info: { main: "#2F5BD3", light: "#ECF1FD", contrastText: "#FFFFFF" },
        action: {
            active: "#5D6B7A", hover: "rgba(16,24,40,.04)", selected: "rgba(14,124,102,.08)",
            disabled: "#98A2B3", disabledBackground: "rgba(16,24,40,.04)",
        },
    },
    typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
        allVariants: { letterSpacing: 0 },
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        h3: { fontWeight: 700 },
        h4: { fontSize: "32px", fontWeight: 700 },
        h5: { fontWeight: 600 },
        h6: { fontSize: "18px", fontWeight: 600 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        body1: { fontSize: "15px", lineHeight: 1.5 },
        body2: { fontSize: "14px", lineHeight: 1.5 },
        caption: { fontSize: "12px", lineHeight: 1.4 },
        overline: { fontSize: "12px", fontWeight: 600, textTransform: "uppercase" },
    },
    shape: { borderRadius: visualTokens.radius.control },
    components: {
        MuiCssBaseline: {
            styleOverrides: (theme) => ({
                body: { backgroundColor: theme.palette.background.default, color: theme.palette.text.primary,
                    fontFamily: theme.typography.fontFamily },
            }),
        },
        MuiPaper: {
            styleOverrides: {
                root: ({ theme }) => ({ borderRadius: visualTokens.radius.surface, borderColor: theme.palette.divider }),
                elevation: { boxShadow: visualTokens.shadow.surface },
                elevation0: { boxShadow: "none" },
                elevation1: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }),
                outlined: { borderWidth: 1, boxShadow: visualTokens.shadow.surface },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}`, borderRadius: visualTokens.radius.surface }),
            },
        },
        MuiButton: {
            styleOverrides: {
                root: { textTransform: "none", fontWeight: 600, borderRadius: visualTokens.radius.control,
                    minHeight: 40, padding: "8px 16px" },
                contained: { boxShadow: "none", "&:hover, &:active": { boxShadow: "none" } },
                outlined: ({ theme, ownerState }) => ({ borderRadius: 999,
                    ...(ownerState.color === "primary" ? { borderColor: theme.palette.divider, color: theme.palette.text.primary,
                        "&:hover": { borderColor: theme.palette.text.disabled, backgroundColor: theme.palette.action.hover } } : {}),
                }),
                sizeSmall: { minHeight: 36, padding: "6px 12px", fontSize: "13px" },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&:hover": { backgroundColor: theme.palette.action.hover },
                    "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
                }),
                sizeSmall: { width: 32, height: 32, padding: 6, fontSize: "18px" },
            },
        },
        // OutlinedInput covers TextField and outlined Select without duplicated selectors.
        MuiOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => ({
                    borderRadius: visualTokens.radius.control, backgroundColor: theme.palette.background.paper,
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.text.disabled },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main, borderWidth: 2 },
                    "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.error.main },
                    "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.divider },
                }),
                notchedOutline: ({ theme }) => ({ borderColor: theme.palette.divider }),
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: ({ theme }) => ({ borderColor: theme.palette.divider, padding: "10px 16px", fontSize: "14px", lineHeight: 1.4 }),
                head: ({ theme }) => ({ fontWeight: 600, color: theme.palette.text.secondary,
                    backgroundColor: theme.palette.background.default, textTransform: "none", letterSpacing: 0 }),
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: ({ theme }) => ({ "&.MuiTableRow-hover:hover": { backgroundColor: theme.palette.action.hover } }),
            },
        },
        MuiTablePagination: {
            styleOverrides: {
                root: ({ theme }) => ({ color: theme.palette.text.secondary, fontSize: theme.typography.body2.fontSize }),
                toolbar: { minHeight: 52, paddingLeft: 16, paddingRight: 8 },
                selectLabel: { fontSize: "14px" },
                displayedRows: { fontSize: "14px", ...visualTokens.numeric },
            },
        },
        MuiDialog: {
            styleOverrides: { paper: { borderRadius: visualTokens.radius.dialog, boxShadow: visualTokens.shadow.elevated } },
        },
        MuiDialogTitle: { styleOverrides: { root: { padding: "20px 24px 8px", fontSize: "20px", fontWeight: 600 } } },
        MuiDialogContent: { styleOverrides: { root: { padding: "16px 24px" } } },
        MuiDialogActions: { styleOverrides: { root: { padding: "12px 24px 20px", gap: 8 } } },
        MuiChip: {
            styleOverrides: {
                root: { height: 24, borderRadius: visualTokens.radius.pill, fontWeight: 500, fontSize: "12px" },
                sizeSmall: { height: 22, fontSize: "12px" },
                outlined: ({ theme, ownerState }) => {
                    const color = ownerState.color;
                    return color && color !== "default" ? { borderColor: "transparent", backgroundColor: theme.palette[color].light, color: theme.palette[color].dark } : {};
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: ({ theme }) => ({ backgroundColor: theme.palette.text.primary, color: theme.palette.background.paper,
                    fontSize: "12px", lineHeight: 1.4, borderRadius: visualTokens.radius.control, boxShadow: visualTokens.shadow.surface }),
                arrow: ({ theme }) => ({ color: theme.palette.text.primary }),
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: { minHeight: 44 },
                indicator: ({ theme }) => ({ height: 3, borderRadius: 3, backgroundColor: theme.palette.primary.main }),
                scrollButtons: { width: 32 },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: ({ theme }) => ({ textTransform: "none", fontWeight: 600, fontSize: "14px", minHeight: 44,
                    color: theme.palette.text.secondary, "&.Mui-selected": { color: theme.palette.text.primary } }),
            },
        },
    },
});

export default theme;
