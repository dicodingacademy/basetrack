import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "ocean" | "forest" | "lavender";

const VALID_THEMES: Theme[] = ["light", "dark", "ocean", "forest", "lavender"];
const THEME_CLASSES = ["dark", "theme-ocean", "theme-forest", "theme-lavender"];

function getClassForTheme(theme: Theme): string | null {
  if (theme === "light") return null;
  if (theme === "dark") return "dark";
  return `theme-${theme}`;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored && VALID_THEMES.includes(stored)) return stored;
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    THEME_CLASSES.forEach(c => root.classList.remove(c));
    const cls = getClassForTheme(theme);
    if (cls) root.classList.add(cls);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
