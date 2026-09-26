import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const KEY = "erasmus-pisa:theme";

/** Cor da barra de estado do telemóvel (igual ao fundo da app) em cada tema. */
export const THEME_COLOR: Record<Theme, string> = { light: "#faf6f1", dark: "#140e0a" };

/** Script inline para aplicar o tema antes da hidratação (evita flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark');var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='dark'?${JSON.stringify("#140e0a")}:${JSON.stringify("#faf6f1")})}catch(e){}})();`;

const syncThemeColor = (t: Theme) =>
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[t]);

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(t);
    syncThemeColor(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      syncThemeColor(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
