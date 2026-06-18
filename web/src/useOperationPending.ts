import { useCallback, useRef, useState } from "react";

import { ASYNC_VISUAL_DELAY_MS } from "./asyncVisualDelay";

export function useOperationPending() {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [showPendingVisual, setShowPendingVisual] = useState(false);
  const timerRef = useRef<number | null>(null);
  const generationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endPending = useCallback(() => {
    generationRef.current += 1;
    clearTimer();
    setPendingActionId(null);
    setShowPendingVisual(false);
  }, [clearTimer]);

  const beginPending = useCallback(
    (actionId: string) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      clearTimer();
      setPendingActionId(actionId);
      setShowPendingVisual(false);
      timerRef.current = window.setTimeout(() => {
        if (generationRef.current === generation) {
          setShowPendingVisual(true);
        }
      }, ASYNC_VISUAL_DELAY_MS);
    },
    [clearTimer],
  );

  const runWithPending = useCallback(
    async <T>(actionId: string, fn: () => Promise<T>): Promise<T> => {
      beginPending(actionId);
      try {
        return await fn();
      } finally {
        endPending();
      }
    },
    [beginPending, endPending],
  );

  return {
    pendingActionId,
    showPendingVisual,
    isPending: pendingActionId != null,
    runWithPending,
  };
}
