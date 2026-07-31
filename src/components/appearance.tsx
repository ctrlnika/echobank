import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type TextScale = "normal" | "large" | "xlarge";

export const TEXT_SCALE_LABEL: Record<TextScale, string> = {
  normal: "Standard",
  large: "Large",
  xlarge: "Extra large",
};

type AppearanceValue = {
  theme: ThemeMode;
  textScale: TextScale;
  setTheme: (theme: ThemeMode) => void;
  setTextScale: (scale: TextScale) => void;
};

const STORAGE_KEY = "echobank.appearance";
const DEFAULTS: { theme: ThemeMode; textScale: TextScale } = { theme: "dark", textScale: "large" };

const AppearanceContext = createContext<AppearanceValue | null>(null);

/** Inline script so the stored theme is applied before first paint (no flash). */
export const appearanceBootScript = `(function(){try{var d=document.documentElement;var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"null")||{};var t=s.theme==="light"?"light":"dark";d.classList.toggle("dark",t==="dark");d.classList.toggle("light",t==="light");d.setAttribute("data-text-scale",s.textScale||"large");}catch(e){}})();`;

function apply(theme: ThemeMode, textScale: TextScale) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.classList.toggle("light", theme === "light");
  el.setAttribute("data-text-scale", textScale);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULTS.theme);
  const [textScale, setTextScaleState] = useState<TextScale>(DEFAULTS.textScale);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AppearanceValue> | null;
      if (stored?.theme === "light" || stored?.theme === "dark") setThemeState(stored.theme);
      if (stored?.textScale) setTextScaleState(stored.textScale);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    apply(theme, textScale);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, textScale }));
    } catch {
      /* ignore */
    }
  }, [theme, textScale]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const setTextScale = useCallback((next: TextScale) => setTextScaleState(next), []);

  const value = useMemo(
    () => ({ theme, textScale, setTheme, setTextScale }),
    [theme, textScale, setTheme, setTextScale],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside AppearanceProvider");
  return value;
}
