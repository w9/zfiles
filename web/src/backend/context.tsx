import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createKernelBackend } from "./kernelBackend";
import type { ExplorerBackend } from "./types";

const ExplorerBackendContext = createContext<ExplorerBackend | null>(null);

type ExplorerBackendProviderProps = {
  backend?: ExplorerBackend;
  children: ReactNode;
};

export function ExplorerBackendProvider({
  backend,
  children,
}: ExplorerBackendProviderProps) {
  const value = useMemo(() => backend ?? createKernelBackend(), [backend]);
  return (
    <ExplorerBackendContext.Provider value={value}>
      {children}
    </ExplorerBackendContext.Provider>
  );
}

export function useExplorerBackend(): ExplorerBackend {
  const backend = useContext(ExplorerBackendContext);
  if (!backend) {
    throw new Error("useExplorerBackend must be used within ExplorerBackendProvider");
  }
  return backend;
}
