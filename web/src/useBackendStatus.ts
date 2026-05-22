import { useEffect, useRef, useState } from "react";

export type BackendStatus = "connecting" | "connected" | "offline";

export type KernelEvent =
  | { type: "connected"; version: string }
  | { type: "filesystem_changed"; path: string }
  | { type: "upload_progress"; id: string; offset: number; length?: number }
  | { type: "plugin_ready"; name: string }
  | { type: "listing_enrichment"; path: string; entries: unknown[] }
  | { type: "thumbnail_ready"; path: string; url: string };

const HEALTH_POLL_MS = 5_000;

export function backendStatusLabel(status: BackendStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "offline":
      return "Offline";
  }
}

export function useBackendStatus(onKernelEvent: (event: KernelEvent) => void): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("connecting");
  const onKernelEventRef = useRef(onKernelEvent);
  onKernelEventRef.current = onKernelEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let pollTimer: number | null = null;
    let cancelled = false;

    const clearPoll = () => {
      if (pollTimer != null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const scheduleHealthPoll = () => {
      clearPoll();
      pollTimer = window.setInterval(() => {
        void (async () => {
          if (cancelled) {
            return;
          }
          try {
            const response = await fetch("/api/health");
            if (response.ok) {
              reconnect();
            } else {
              setStatus("offline");
            }
          } catch {
            setStatus("offline");
          }
        })();
      }, HEALTH_POLL_MS);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      clearPoll();
      setStatus((current) => (current === "connected" ? current : "connecting"));

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const nextSocket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
      socket = nextSocket;

      nextSocket.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as KernelEvent;
        if (event.type === "connected") {
          setStatus("connected");
        }
        onKernelEventRef.current(event);
      };

      nextSocket.onerror = () => {
        setStatus("offline");
      };

      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          socket = null;
        }
        if (!cancelled) {
          setStatus("offline");
          scheduleHealthPoll();
        }
      };
    };

    const reconnect = () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      clearPoll();
      socket?.close();
    };
  }, []);

  return status;
}
