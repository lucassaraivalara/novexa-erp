export const layoutTokens = {
    sidebar: {
        largura: { xs: 64, sm: 232 },
        alturaItemMenu: 42,
        tamanhoIconeMenu: 20,
        paddingX: { xs: 0.75, sm: 1.5 },
    },
    header: {
        altura: { xs: 56, md: 60 },
        paddingX: { xs: 2, md: 3 },
    },
    conteudo: {
        padding: { xs: 2, sm: 2.5, md: 3 },
        maxWidth: 1440,
    },
    radius: {
        card: 12,
        button: 10,
        field: 10,
        dialog: 16,
        badge: 6,
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
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)",
        cardHover: "0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 20px rgba(15, 23, 42, 0.06)",
        elevated: "0 4px 12px rgba(15, 23, 42, 0.08), 0 12px 28px rgba(15, 23, 42, 0.08)",
        dialog: "0 20px 50px rgba(15, 23, 42, 0.16)",
        button: "0 2px 8px rgba(15, 110, 110, 0.25)",
    },
    typography: {
        pageTitle: { xs: "1.5rem", md: "1.625rem" },
        pageSubtitle: "0.875rem",
        sectionTitle: "1rem",
        body: "0.875rem",
        caption: "0.75rem",
    },
    table: {
        headerBg: "#F8FAFC",
        rowHeight: 48,
        cellPadding: "10px 16px",
        borderColor: "#E2E8F0",
    },
    form: {
        fieldGap: 1.5,
        sectionGap: 2.5,
        columnGap: 2,
    },
} as const;

export type LayoutTokens = typeof layoutTokens;