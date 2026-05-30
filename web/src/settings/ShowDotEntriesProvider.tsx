import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredShowDotEntries,
  showDotEntriesEnabled,
  storeShowDotEntries,
  toggleShowDotEntriesVisibility,
  type ShowDotEntriesVisibility,
} from "./showDotEntries";

type ShowDotEntriesContextValue = {
  visibility: ShowDotEntriesVisibility;
  showDotEntries: boolean;
  setVisibility: (value: ShowDotEntriesVisibility) => void;
  toggleShowDotEntries: () => void;
};

const ShowDotEntriesContext = createContext<ShowDotEntriesContextValue | null>(null);

export function ShowDotEntriesProvider({ children }: { children: ReactNode }) {
  const [visibility, setVisibilityState] = useState<ShowDotEntriesVisibility>(() =>
    readStoredShowDotEntries(),
  );

  const setVisibility = useCallback((next: ShowDotEntriesVisibility) => {
    storeShowDotEntries(next);
    setVisibilityState(next);
  }, []);

  const toggleShowDotEntries = useCallback(() => {
    setVisibilityState((current) => {
      const next = toggleShowDotEntriesVisibility(current);
      storeShowDotEntries(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      visibility,
      showDotEntries: showDotEntriesEnabled(visibility),
      setVisibility,
      toggleShowDotEntries,
    }),
    [visibility, setVisibility, toggleShowDotEntries],
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
