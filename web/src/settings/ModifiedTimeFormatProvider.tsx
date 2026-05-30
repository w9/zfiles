import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredModifiedTimeFormat,
  storeModifiedTimeFormat,
  type ModifiedTimeFormat,
} from "./modifiedTimeFormat";

type ModifiedTimeFormatContextValue = {
  format: ModifiedTimeFormat;
  setFormat: (format: ModifiedTimeFormat) => void;
};

const ModifiedTimeFormatContext = createContext<ModifiedTimeFormatContextValue | null>(
  null,
);

export function ModifiedTimeFormatProvider({ children }: { children: ReactNode }) {
  const [format, setFormatState] = useState<ModifiedTimeFormat>(() =>
    readStoredModifiedTimeFormat(),
  );

  const setFormat = useCallback((next: ModifiedTimeFormat) => {
    storeModifiedTimeFormat(next);
    setFormatState(next);
  }, []);

  const value = useMemo(
    () => ({
      format,
      setFormat,
    }),
    [format, setFormat],
  );

  return (
    <ModifiedTimeFormatContext.Provider value={value}>
      {children}
    </ModifiedTimeFormatContext.Provider>
  );
}

export function useModifiedTimeFormat(): ModifiedTimeFormatContextValue {
  const value = useContext(ModifiedTimeFormatContext);
  if (!value) {
    throw new Error("useModifiedTimeFormat must be used within ModifiedTimeFormatProvider");
  }
  return value;
}
