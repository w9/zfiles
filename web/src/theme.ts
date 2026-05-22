export type ThemeMode = "light" | "dark" | "auto";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "zfiles-theme";

export const DEFAULT_THEME_MODE: ThemeMode = "auto";

export function parseThemeMode(value: string | null): ThemeMode {
  if (value === "light" || value === "dark" || value === "auto") {
    return value;
  }
  return DEFAULT_THEME_MODE;
}

export function resolvedTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "auto") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME_MODE;
  }
  return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  const resolved = resolvedTheme(mode, prefersDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  return resolved;
}

export function storeThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}
