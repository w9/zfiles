import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredShowDotEntriesDefault,
  showDotEntriesFromDefault,
  storeShowDotEntriesDefault,
  type ShowDotEntriesDefault,
} from "./showDotEntriesDefault";

type ShowDotEntriesContextValue = {
  showDotEntries: boolean;
  toggleShowDotEntries: () => void;
  defaultVisibility: ShowDotEntriesDefault;
  setDefaultVisibility: (value: ShowDotEntriesDefault) => void;
};

const ShowDotEntriesContext = createContext<ShowDotEntriesContextValue | null>(null);

export function ShowDotEntriesProvider({ children }: { children: ReactNode }) {
  const [defaultVisibility, setDefaultVisibilityState] = useState<ShowDotEntriesDefault>(
    () => readStoredShowDotEntriesDefault(),
  );
  const [showDotEntries, setShowDotEntries] = useState(() =>
    showDotEntriesFromDefault(readStoredShowDotEntriesDefault()),
  );

  const toggleShowDotEntries = useCallback(() => {
    setShowDotEntries((current) => !current);
  }, []);

  const setDefaultVisibility = useCallback((next: ShowDotEntriesDefault) => {
    storeShowDotEntriesDefault(next);
    setDefaultVisibilityState(next);
    setShowDotEntries(showDotEntriesFromDefault(next));
  }, []);

  const value = useMemo(
    () => ({
      showDotEntries,
      toggleShowDotEntries,
      defaultVisibility,
      setDefaultVisibility,
    }),
    [showDotEntries, toggleShowDotEntries, defaultVisibility, setDefaultVisibility],
  );

  return (
    <ShowDotEntriesContext.Provider value={value}>
      {children}
    </ShowDotEntriesContext.Provider>
  );
}

export function useShowDotEntries(): ShowDotEntriesContextValue {
  const value = useContext(ShowDotEntriesContext);
  if (!value) {
    throw new Error("useShowDotEntries must be used within ShowDotEntriesProvider");
  }
  return value;
}
