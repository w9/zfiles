import { useCallback, useEffect, useRef, useState } from "react";

import { parentExplorerPath } from "@/explorer/path";
import {
  explorerHistoryHrefForPath,
  explorerPathFromPathname,
} from "./explorerUrl";

type LoadListing = (
  path: string,
  options?: { preserveSelection?: boolean; focusPath?: string },
) => Promise<boolean>;

function syncHistoryIndex(
  stack: string[],
  path: string,
): number {
  const index = stack.lastIndexOf(path);
  return index >= 0 ? index : 0;
}

export function useExplorerNavigation(
  loadListing: LoadListing,
  initialPath: string,
) {
  const currentPathRef = useRef(initialPath);
  const historyStackRef = useRef<string[]>([initialPath]);
  const historyIndexRef = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const syncHistoryControls = useCallback((index: number) => {
    historyIndexRef.current = index;
    setCanGoBack(index > 0);
    setCanGoForward(index < historyStackRef.current.length - 1);
  }, []);

  const applyLoadedPath = useCallback(
    (path: string, options?: { pushHistory?: boolean }) => {
      currentPathRef.current = path;
      if (options?.pushHistory) {
        const stack = historyStackRef.current.slice(0, historyIndexRef.current + 1);
        stack.push(path);
        historyStackRef.current = stack;
        syncHistoryControls(stack.length - 1);
        window.history.pushState(
          { explorerPath: path },
          "",
          explorerHistoryHrefForPath(path),
        );
      } else {
        syncHistoryControls(syncHistoryIndex(historyStackRef.current, path));
      }
    },
    [syncHistoryControls],
  );

  useEffect(() => {
    window.history.replaceState(
      { explorerPath: initialPath },
      "",
      explorerHistoryHrefForPath(initialPath),
    );
  }, [initialPath]);

  useEffect(() => {
    const onPopState = () => {
      const path = explorerPathFromPathname(window.location.pathname);
      const previousPath = currentPathRef.current;
      void (async () => {
        const loaded = await loadListing(path);
        if (!loaded) {
          window.history.replaceState(
            { explorerPath: previousPath },
            "",
            explorerHistoryHrefForPath(previousPath),
          );
          return;
        }
        applyLoadedPath(path);
      })();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyLoadedPath, loadListing]);

  const navigateTo = useCallback(
    async (path: string, options?: { focusPath?: string }) => {
      const listingPath = options?.focusPath
        ? parentExplorerPath(options.focusPath)
        : path;
      if (!options?.focusPath && listingPath === currentPathRef.current) {
        return;
      }
      const loaded = await loadListing(
        listingPath,
        options?.focusPath ? { focusPath: options.focusPath } : undefined,
      );
      if (loaded) {
        applyLoadedPath(listingPath, { pushHistory: true });
      }
    },
    [applyLoadedPath, loadListing],
  );

  const goBack = useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    window.history.back();
  }, []);

  const goForward = useCallback(() => {
    if (historyIndexRef.current >= historyStackRef.current.length - 1) {
      return;
    }
    window.history.forward();
  }, []);

  const trackCurrentPath = useCallback((path: string) => {
    currentPathRef.current = path;
  }, []);

  return {
    navigateTo,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    trackCurrentPath,
  };
}
