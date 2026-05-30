import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readStoredListingSortOrder,
  storeListingSortOrder,
  type ListingSortOrder,
} from "./listingSortOrder";

type ListingSortOrderContextValue = {
  order: ListingSortOrder;
  setOrder: (order: ListingSortOrder) => void;
};

const ListingSortOrderContext = createContext<ListingSortOrderContextValue | null>(
  null,
);

export function ListingSortOrderProvider({ children }: { children: ReactNode }) {
  const [order, setOrderState] = useState<ListingSortOrder>(() =>
    readStoredListingSortOrder(),
  );

  const setOrder = useCallback((next: ListingSortOrder) => {
    storeListingSortOrder(next);
    setOrderState(next);
  }, []);

  const value = useMemo(
    () => ({
      order,
      setOrder,
    }),
    [order, setOrder],
  );

  return (
    <ListingSortOrderContext.Provider value={value}>
      {children}
    </ListingSortOrderContext.Provider>
  );
}

export function useListingSortOrder(): ListingSortOrderContextValue {
  const value = useContext(ListingSortOrderContext);
  if (!value) {
    throw new Error("useListingSortOrder must be used within ListingSortOrderProvider");
  }
  return value;
}
