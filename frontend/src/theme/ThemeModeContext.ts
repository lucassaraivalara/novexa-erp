import { createContext, useContext } from "react";

export type ThemeChoice = "auto" | "light" | "dark";

export const ThemeModeContext = createContext<{ choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void }>({ choice: "auto", setChoice: () => undefined });

export const useThemeMode = () => useContext(ThemeModeContext);
