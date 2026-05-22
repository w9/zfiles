import { useCallback, useEffect, useState } from "react";

import {
  applyTheme,
  readStoredThemeMode,
  resolvedTheme,
  storeThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme";

export function useTheme(): {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
} {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredThemeMode());
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = resolvedTheme(mode, prefersDark);

  useEffect(() => {
    applyTheme(mode, prefersDark);
  }, [mode, prefersDark]);

  const setMode = useCallback((next: ThemeMode) => {
    storeThemeMode(next);
    setModeState(next);
  }, []);

  return { mode, resolved, setMode };
}
