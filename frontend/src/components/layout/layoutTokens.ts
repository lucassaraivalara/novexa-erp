import theme, { visualTokens } from "../../theme/theme";

export const layoutTokens = {
    sidebar: {
        largura: { xs: 60, sm: 252 },
        alturaItemMenu: 40,
        tamanhoIconeMenu: 20,
        paddingX: { xs: 0.75, sm: 1.25 },
    },
    header: {
        altura: 64,
        paddingX: { xs: 1.5, sm: 2, md: 2.5 },
    },
    conteudo: {
        padding: { xs: 2, sm: 2.5, md: 3 },
        maxWidth: 1440,
    },
    radius: {
        card: visualTokens.radius.surface,
        button: visualTokens.radius.control,
        field: visualTokens.radius.control,
        dialog: visualTokens.radius.dialog,
        badge: visualTokens.radius.pill,
    },
    spacing: {
        xs: 0.5,
        sm: 1,
        md: 1.5,
        lg: 2,
        xl: 2.5,
        xxl: 3,
    },
    shadows: {
        card: visualTokens.shadow.surface,
        cardHover: visualTokens.shadow.surface,
        elevated: visualTokens.shadow.elevated,
        dialog: visualTokens.shadow.elevated,
        button: "none",
    },
    typography: {
        pageTitle: { xs: theme.typography.h4.fontSize, md: theme.typography.h4.fontSize },
        pageSubtitle: theme.typography.body2.fontSize,
        sectionTitle: theme.typography.h6.fontSize,
        body: theme.typography.body2.fontSize,
        caption: theme.typography.caption.fontSize,
    },
    table: {
        headerBg: theme.palette.background.default,
        rowHeight: 48,
        cellPadding: "10px 16px",
        cellPaddingCompact: "6px 12px",
        borderColor: theme.palette.divider,
    },
    form: {
        fieldGap: 1.5,
        sectionGap: 2.5,
        columnGap: 2,
    },
} as const;

export type LayoutTokens = typeof layoutTokens;
