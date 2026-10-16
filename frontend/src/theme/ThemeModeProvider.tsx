import { useMemo, useState, type ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { createNovexaTheme } from "./theme";
import { ThemeModeContext, type ThemeChoice } from "./ThemeModeContext";

const STORAGE_KEY = "novexa-theme-choice";
export function ThemeModeProvider({ children }: { children: ReactNode }) {
    const [choice, setChoiceState] = useState<ThemeChoice>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
    });
    const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
    const mode = choice === "auto" ? (systemDark ? "dark" : "light") : choice;
    const theme = useMemo(() => createNovexaTheme(mode), [mode]);
    const value = useMemo(() => ({ choice, setChoice: (next: ThemeChoice) => { setChoiceState(next); localStorage.setItem(STORAGE_KEY, next); } }), [choice]);
    return <ThemeModeContext.Provider value={value}><ThemeProvider theme={theme}>{children}</ThemeProvider></ThemeModeContext.Provider>;
}

