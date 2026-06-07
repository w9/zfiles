import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clampSlideshowInterval,
  readStoredSlideshowAutoplay,
  readStoredSlideshowInterval,
  storeSlideshowAutoplay,
  storeSlideshowInterval,
} from "./slideshowSettings";

type SlideshowSettingsContextValue = {
  autoplayOnOpen: boolean;
  setAutoplayOnOpen: (value: boolean) => void;
  intervalSeconds: number;
  setIntervalSeconds: (value: number) => void;
};

const SlideshowSettingsContext = createContext<SlideshowSettingsContextValue | null>(null);

export function SlideshowSettingsProvider({ children }: { children: ReactNode }) {
  const [autoplayOnOpen, setAutoplayOnOpenState] = useState(readStoredSlideshowAutoplay);
  const [intervalSeconds, setIntervalSecondsState] = useState(readStoredSlideshowInterval);

  const setAutoplayOnOpen = useCallback((next: boolean) => {
    storeSlideshowAutoplay(next);
    setAutoplayOnOpenState(next);
  }, []);

  const setIntervalSeconds = useCallback((next: number) => {
    const clamped = clampSlideshowInterval(next);
    storeSlideshowInterval(clamped);
    setIntervalSecondsState(clamped);
  }, []);

  const value = useMemo(
    () => ({
      autoplayOnOpen,
      setAutoplayOnOpen,
      intervalSeconds,
      setIntervalSeconds,
    }),
    [autoplayOnOpen, intervalSeconds, setAutoplayOnOpen, setIntervalSeconds],
  );

  return (
    <SlideshowSettingsContext.Provider value={value}>
      {children}
    </SlideshowSettingsContext.Provider>
  );
}

export function useSlideshowSettings(): SlideshowSettingsContextValue {
  const value = useContext(SlideshowSettingsContext);
  if (!value) {
    throw new Error("useSlideshowSettings must be used within SlideshowSettingsProvider");
  }
  return value;
}
