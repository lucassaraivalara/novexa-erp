import { createTheme, type PaletteMode } from "@mui/material/styles";
import { darkTokens as d } from "./darkTokens";

export const visualTokens = {
    radius: { control: 6, surface: 10, dialog: 10, pill: 999 },
    shadow: {
        surface: "0 1px 3px rgba(16,24,40,.06)",
        elevated: "0 8px 24px rgba(16,24,40,.12)",
    },
    numeric: { fontVariantNumeric: "tabular-nums" },
} as const;

export function createNovexaTheme(mode: PaletteMode = "light") {
    const dark = mode === "dark";
    return createTheme({
    palette: {
        mode,
        primary: dark ? { main: d.teal, dark: d.tealHover, light: d.tealSurface, contrastText: d.onTeal }
            : { main: "#0E7C66", dark: "#0A5F4E", light: "#E7F4F0", contrastText: "#FFFFFF" },
        secondary: dark ? { main: d.secondary, contrastText: d.canvas } : { main: "#101828", contrastText: "#FFFFFF" },
        background: { default: dark ? d.canvas : "#F7F9FB", paper: dark ? d.surface : "#FFFFFF" },
        text: { primary: dark ? d.text : "#101828", secondary: dark ? d.secondary : "#5D6B7A", disabled: dark ? d.disabled : "#98A2B3" },
        divider: dark ? d.border : "#E4E8EC",
        success: dark ? { main: d.success, light: d.successSurface, contrastText: d.canvas } : { main: "#16794A", light: "#E8F5EE", contrastText: "#FFFFFF" },
        warning: dark ? { main: d.warning, light: d.warningSurface, contrastText: d.canvas } : { main: "#B25E09", light: "#FDF3E2", contrastText: "#FFFFFF" },
        error: dark ? { main: d.error, light: d.errorSurface, contrastText: d.canvas } : { main: "#C4372E", light: "#FCECEA", contrastText: "#FFFFFF" },
        info: dark ? { main: d.blue, light: d.blueSurface, contrastText: d.canvas } : { main: "#2F5BD3", light: "#ECF1FD", contrastText: "#FFFFFF" },
        action: {
            active: dark ? d.secondary : "#5D6B7A", hover: dark ? d.hover : "rgba(16,24,40,.04)", selected: dark ? d.selected : "rgba(14,124,102,.12)",
            disabled: dark ? d.disabled : "#98A2B3", disabledBackground: dark ? d.disabledSurface : "rgba(16,24,40,.04)",
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
                    fontFamily: theme.typography.fontFamily, ...(dark ? { colorScheme: "dark" } : {}) },
                ...(dark ? { "a:focus-visible, button:focus-visible, [tabindex]:focus-visible": { outline: `2px solid ${d.teal}`, outlineOffset: 2 } } : {}),
            }),
        },
        MuiPaper: {
            styleOverrides: {
                root: ({ theme }) => ({ borderRadius: visualTokens.radius.surface, borderColor: theme.palette.divider,
                    ...(dark ? { backgroundImage: "none" } : {}) }),
                elevation: { boxShadow: dark ? d.shadow : visualTokens.shadow.surface, ...(dark ? { backgroundColor: d.elevated } : {}) },
                elevation0: { boxShadow: "none" },
                elevation1: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }),
                outlined: { borderWidth: 1, boxShadow: dark ? d.shadow : visualTokens.shadow.surface },
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
                    minHeight: 40, padding: "8px 16px", ...(dark ? { "&.Mui-disabled": { color: d.disabled, backgroundColor: d.disabledSurface } } : {}) },
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
                    borderRadius: visualTokens.radius.control, backgroundColor: dark ? d.input : theme.palette.background.paper,
                    ...(dark ? { "& input::placeholder, & textarea::placeholder": { color: d.secondary, opacity: 1 },
                        "&.Mui-disabled": { backgroundColor: d.disabledSurface },
                        "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: d.disabled, opacity: 1 } } : {}),
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.text.disabled },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.primary.main, borderWidth: 2 },
                    "&.Mui-error .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.error.main },
                    "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: theme.palette.divider },
                }),
                notchedOutline: ({ theme }) => ({ borderColor: dark ? d.borderStrong : theme.palette.divider }),
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: ({ theme }) => ({ borderColor: theme.palette.divider, padding: "10px 16px", fontSize: "14px", lineHeight: 1.4 }),
                head: ({ theme }) => ({ fontWeight: 600, color: theme.palette.text.secondary,
                    backgroundColor: dark ? d.tableHead : theme.palette.background.default, textTransform: "none", letterSpacing: 0 }),
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: ({ theme }) => ({ "&.MuiTableRow-hover:hover": { backgroundColor: theme.palette.action.hover },
                    ...(dark ? { "&.Mui-selected": { backgroundColor: d.selected }, "&.Mui-selected:hover": { backgroundColor: d.selectedHover } } : {}) }),
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
            styleOverrides: { paper: { borderRadius: visualTokens.radius.dialog, boxShadow: dark ? d.elevatedShadow : visualTokens.shadow.elevated,
                ...(dark ? { border: `1px solid ${d.border}`, backgroundColor: d.elevated } : {}) } },
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
                    return color && color !== "default" ? { borderColor: "transparent", backgroundColor: theme.palette[color].light, color: dark ? theme.palette[color].main : theme.palette[color].dark } : {};
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
        ...(dark ? {
            MuiAlert: { styleOverrides: { root: ({ ownerState, theme }) => {
                const cor = theme.palette[ownerState.severity ?? "info"];
                return ownerState.variant === "standard" ? { backgroundColor: cor.light, color: cor.main,
                    border: `1px solid ${theme.palette.divider}` } : {};
            } } },
            MuiBackdrop: { styleOverrides: { root: { backgroundColor: d.backdrop } } },
            MuiMenu: { styleOverrides: { paper: { backgroundColor: d.elevated, border: `1px solid ${d.border}`, boxShadow: d.elevatedShadow } } },
            MuiAutocomplete: { styleOverrides: { paper: { backgroundColor: d.elevated, border: `1px solid ${d.border}` },
                option: { '&[aria-selected="true"]': { backgroundColor: `${d.selected} !important` }, '&.Mui-focused': { backgroundColor: `${d.hover} !important` } } } },
            MuiInputLabel: { styleOverrides: { root: { color: d.secondary, '&.Mui-disabled': { color: d.disabled } } } },
            MuiFormHelperText: { styleOverrides: { root: { color: d.secondary, '&.Mui-error': { color: d.error }, '&.Mui-disabled': { color: d.disabled } } } },
            MuiToggleButton: { styleOverrides: { root: { borderColor: d.borderStrong, color: d.secondary,
                '&.Mui-selected': { backgroundColor: d.selected, color: d.teal }, '&.Mui-selected:hover': { backgroundColor: d.selectedHover } } } },
        } : {}),
    },
    });
}

const theme = createNovexaTheme("light");

export default theme;
