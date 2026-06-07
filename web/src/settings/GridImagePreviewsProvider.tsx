import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredGridImagePreviews,
  storeGridImagePreviews,
  type BootMode,
} from "./gridImagePreviews";

type GridImagePreviewsContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
};

const GridImagePreviewsContext = createContext<GridImagePreviewsContextValue | null>(null);

export function GridImagePreviewsProvider({
  bootMode,
  children,
}: {
  bootMode: BootMode;
  children: ReactNode;
}) {
  const [enabled, setEnabledState] = useState(() => readStoredGridImagePreviews(bootMode));

  const setEnabled = useCallback((next: boolean) => {
    storeGridImagePreviews(next);
    setEnabledState(next);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <GridImagePreviewsContext.Provider value={value}>
      {children}
    </GridImagePreviewsContext.Provider>
  );
}

export function useGridImagePreviews(): GridImagePreviewsContextValue {
  const value = useContext(GridImagePreviewsContext);
  if (!value) {
    throw new Error("useGridImagePreviews must be used within GridImagePreviewsProvider");
  }
  return value;
}
