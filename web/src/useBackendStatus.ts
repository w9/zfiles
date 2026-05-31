import { useEffect, useRef, useState } from "react";

import { useExplorerBackend, type BackendEvent, type BackendStatus } from "./backend";

export type { BackendEvent, BackendStatus };

export function backendStatusLabel(status: BackendStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "offline":
      return "Connection lost";
  }
}

export function useBackendStatus(onKernelEvent: (event: BackendEvent) => void): BackendStatus {
  const backend = useExplorerBackend();
  const [status, setStatus] = useState<BackendStatus>("connecting");
  const onKernelEventRef = useRef(onKernelEvent);
  onKernelEventRef.current = onKernelEvent;

  useEffect(() => {
    return backend.subscribe(
      (event) => onKernelEventRef.current(event),
      (next) =>
        setStatus((current) =>
          next === "connecting" && current === "connected" ? current : next,
        ),
    );
  }, [backend]);

  return status;
}
