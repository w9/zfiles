import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clampGridCardSize,
  readStoredGridCardDefaultSize,
  readStoredGridCardMaxSize,
  readStoredGridCardMinSize,
  readStoredGridCardSize,
  storeGridCardDefaultSize,
  storeGridCardMaxSize,
  storeGridCardMinSize,
  storeGridCardSize,
  type GridCardSize,
} from "./gridCardSize";

type GridCardSizeContextValue = {
  cardSize: GridCardSize;
  defaultSize: GridCardSize;
  minSize: GridCardSize;
  maxSize: GridCardSize;
  setCardSize: (size: GridCardSize) => void;
  setDefaultSize: (size: GridCardSize) => void;
  setMinSize: (size: GridCardSize) => void;
  setMaxSize: (size: GridCardSize) => void;
  resetToDefault: () => void;
};

const GridCardSizeContext = createContext<GridCardSizeContextValue | null>(null);

export function GridCardSizeProvider({ children }: { children: ReactNode }) {
  const [defaultSize, setDefaultSizeState] = useState<GridCardSize>(() =>
    readStoredGridCardDefaultSize(),
  );
  const [minSize, setMinSizeState] = useState<GridCardSize>(() => readStoredGridCardMinSize());
  const [maxSize, setMaxSizeState] = useState<GridCardSize>(() => readStoredGridCardMaxSize());
  const [cardSize, setCardSizeState] = useState<GridCardSize>(() => readStoredGridCardSize());

  const clampWithBounds = useCallback(
    (size: GridCardSize) => clampGridCardSize(size, minSize, maxSize),
    [maxSize, minSize],
  );

  const setCardSize = useCallback(
    (size: GridCardSize) => {
      const next = clampWithBounds(size);
      storeGridCardSize(next);
      setCardSizeState(next);
    },
    [clampWithBounds],
  );

  const setDefaultSize = useCallback(
    (size: GridCardSize) => {
      const next = clampWithBounds(size);
      storeGridCardDefaultSize(next);
      setDefaultSizeState(next);
    },
    [clampWithBounds],
  );

  const setMinSize = useCallback(
    (size: GridCardSize) => {
      storeGridCardMinSize(size);
      setMinSizeState(size);
      setCardSizeState((current) => {
        const next = clampGridCardSize(current, size, maxSize);
        storeGridCardSize(next);
        return next;
      });
    },
    [maxSize],
  );

  const setMaxSize = useCallback(
    (size: GridCardSize) => {
      storeGridCardMaxSize(size);
      setMaxSizeState(size);
      setCardSizeState((current) => {
        const next = clampGridCardSize(current, minSize, size);
        storeGridCardSize(next);
        return next;
      });
    },
    [minSize],
  );

  const resetToDefault = useCallback(() => {
    const next = clampWithBounds(defaultSize);
    storeGridCardSize(next);
    setCardSizeState(next);
  }, [clampWithBounds, defaultSize]);

  const value = useMemo(
    () => ({
      cardSize,
      defaultSize,
      minSize,
      maxSize,
      setCardSize,
      setDefaultSize,
      setMinSize,
      setMaxSize,
      resetToDefault,
    }),
    [
      cardSize,
      defaultSize,
      maxSize,
      minSize,
      resetToDefault,
      setCardSize,
      setDefaultSize,
      setMaxSize,
      setMinSize,
    ],
  );

  return (
    <GridCardSizeContext.Provider value={value}>{children}</GridCardSizeContext.Provider>
  );
}

export function useGridCardSize(): GridCardSizeContextValue {
  const value = useContext(GridCardSizeContext);
  if (!value) {
    throw new Error("useGridCardSize must be used within GridCardSizeProvider");
  }
  return value;
}
