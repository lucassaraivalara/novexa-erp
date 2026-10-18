// Camadas e estados do modo escuro. O tema claro mantém suas cores atuais.
export const darkTokens = {
    canvas: "#0E1828", rail: "#101D30", sidebar: "#142236", header: "#18283B",
    surface: "#1B2B40", elevated: "#23364D", input: "#122136", tableHead: "#25394F",
    border: "#34495F", borderStrong: "#6D849D",
    text: "#E5EDF6", secondary: "#B1C1D3", disabled: "#8FA2B8",
    hover: "#293E55", selected: "#214C4B", selectedHover: "#2B5D57",
    teal: "#62D0BA", tealHover: "#45B49F", tealSurface: "#183D3B", onTeal: "#092620",
    blue: "#93BDF8", blueSurface: "#203853", purple: "#C8ABF8",
    success: "#7AD6A8", successSurface: "#1B3E34",
    warning: "#EFC17A", warningSurface: "#433622",
    error: "#F5A0A8", errorSurface: "#472C37",
    disabledSurface: "#233247",
    shadow: "0 2px 8px rgba(3,10,20,.18)", elevatedShadow: "0 12px 30px rgba(3,10,20,.30)",
    backdrop: "rgba(4,10,20,.68)",
} as const;

export const pdvTokens = {
    light: {
        canvas: "#E9EEF3", commands: "#E2E8F0", border: "#CBD5E1", header: "#202C3A",
        headerText: "#FFFFFF", headerMuted: "#AAB8C8", operator: "#D4DDE7", accent: "#4ADE80",
        exit: "#FCA5A5", disabled: "#8997A7", title: "#0E7C66", rows: "#F1F4F7",
        tableHead: "#DEE6ED", tableHeadText: "#475569", row: "#FFFFFF", alternate: "#F8FAFC",
        selected: "#EFF6FF", selectedHover: "#DBEAFE", blue: "#2563EB", blueHover: "#1D4ED8",
        removeSurface: "#FEE2E2", remove: "#DC2626", addSurface: "#DCFCE7", add: "#16A34A",
        purple: "#7C3AED", total: "#14532D", shadow: "0 8px 20px #202C3A20",
    },
    dark: {
        canvas: darkTokens.canvas, commands: darkTokens.sidebar, border: darkTokens.border, header: darkTokens.header,
        headerText: darkTokens.text, headerMuted: darkTokens.secondary, operator: darkTokens.secondary, accent: darkTokens.teal,
        exit: darkTokens.error, disabled: darkTokens.disabled, title: darkTokens.teal, rows: darkTokens.input,
        tableHead: darkTokens.tableHead, tableHeadText: darkTokens.secondary, row: darkTokens.surface, alternate: darkTokens.header,
        selected: darkTokens.blueSurface, selectedHover: darkTokens.hover, blue: "#2563EB", blueHover: "#1D4ED8",
        removeSurface: darkTokens.errorSurface, remove: darkTokens.error, addSurface: darkTokens.successSurface, add: darkTokens.success,
        purple: darkTokens.purple, total: darkTokens.success, shadow: darkTokens.elevatedShadow,
    },
} as const;
