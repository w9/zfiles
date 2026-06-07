import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredGridThumbnailBadge,
  storeGridThumbnailBadge,
  type BootMode,
} from "./gridThumbnailBadge";

type GridThumbnailBadgeContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
};

const GridThumbnailBadgeContext = createContext<GridThumbnailBadgeContextValue | null>(null);

export function GridThumbnailBadgeProvider({
  bootMode,
  children,
}: {
  bootMode: BootMode;
  children: ReactNode;
}) {
  const [enabled, setEnabledState] = useState(() => readStoredGridThumbnailBadge(bootMode));

  const setEnabled = useCallback((next: boolean) => {
    storeGridThumbnailBadge(next);
    setEnabledState(next);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <GridThumbnailBadgeContext.Provider value={value}>
      {children}
    </GridThumbnailBadgeContext.Provider>
  );
}

export function useGridThumbnailBadge(): GridThumbnailBadgeContextValue {
  const value = useContext(GridThumbnailBadgeContext);
  if (!value) {
    throw new Error("useGridThumbnailBadge must be used within GridThumbnailBadgeProvider");
  }
  return value;
}
