import { createContext, useContext, type ReactNode } from "react";

const CloudDisconnectContext = createContext<(() => void) | null>(null);

type CloudDisconnectProviderProps = {
  onDisconnect: () => void;
  children: ReactNode;
};

export function CloudDisconnectProvider({
  onDisconnect,
  children,
}: CloudDisconnectProviderProps) {
  return (
    <CloudDisconnectContext.Provider value={onDisconnect}>
      {children}
    </CloudDisconnectContext.Provider>
  );
}

export function useCloudDisconnect(): (() => void) | null {
  return useContext(CloudDisconnectContext);
}
