import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredSlideshowStartAtActiveItem,
  storeSlideshowStartAtActiveItem,
} from "./slideshowSettings";

type SlideshowSettingsContextValue = {
  startAtActiveItem: boolean;
  setStartAtActiveItem: (value: boolean) => void;
};

const SlideshowSettingsContext = createContext<SlideshowSettingsContextValue | null>(null);

export function SlideshowSettingsProvider({ children }: { children: ReactNode }) {
  const [startAtActiveItem, setStartAtActiveItemState] = useState(
    readStoredSlideshowStartAtActiveItem,
  );

  const setStartAtActiveItem = useCallback((next: boolean) => {
    storeSlideshowStartAtActiveItem(next);
    setStartAtActiveItemState(next);
  }, []);

  const value = useMemo(
    () => ({
      startAtActiveItem,
      setStartAtActiveItem,
    }),
    [startAtActiveItem, setStartAtActiveItem],
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
