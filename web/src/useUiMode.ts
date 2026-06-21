import { useCallback, useEffect, useState } from "react";

import {
  applyUiMode,
  hasCoarsePointer,
  readStoredUiMode,
  resolvedUiMode,
  storeUiMode,
  type ResolvedUiMode,
  type UiMode,
} from "./uiMode";

export function useUiMode(): {
  mode: UiMode;
  resolved: ResolvedUiMode;
  setMode: (mode: UiMode) => void;
} {
  const [mode, setModeState] = useState<UiMode>(() => readStoredUiMode());
  const [coarsePointer, setCoarsePointer] = useState(() => hasCoarsePointer());

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const onChange = (event: MediaQueryListEvent) => {
      setCoarsePointer(event.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved = resolvedUiMode(mode, coarsePointer);

  useEffect(() => {
    applyUiMode(mode, coarsePointer);
  }, [mode, coarsePointer]);

  const setMode = useCallback((next: UiMode) => {
    storeUiMode(next);
    setModeState(next);
  }, []);

  return { mode, resolved, setMode };
}
