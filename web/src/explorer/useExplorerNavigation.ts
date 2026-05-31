import { useCallback, useRef, useState } from "react";

import {
  createNavigationStacks,
  navigateBack,
  navigateForward,
  pushNavigationPath,
  type NavigationStacks,
} from "./navigationHistory";
import { parentExplorerPath } from "./path";

type LoadListing = (path: string) => Promise<boolean>;

export function useExplorerNavigation(loadListing: LoadListing) {
  const currentPathRef = useRef("");
  const stacksRef = useRef<NavigationStacks>(createNavigationStacks());
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const syncStacks = useCallback((stacks: NavigationStacks) => {
    stacksRef.current = stacks;
    setCanGoBack(stacks.back.length > 0);
    setCanGoForward(stacks.forward.length > 0);
  }, []);

  const navigateTo = useCallback(
    async (path: string) => {
      const current = currentPathRef.current;
      const nextStacks = pushNavigationPath(stacksRef.current, current, path);
      if (!nextStacks) {
        return;
      }
      const loaded = await loadListing(path);
      if (loaded) {
        currentPathRef.current = path;
        syncStacks(nextStacks);
      }
    },
    [loadListing, syncStacks],
  );

  const goBack = useCallback(async () => {
    const result = navigateBack(stacksRef.current, currentPathRef.current);
    if (!result) {
      return;
    }
    const loaded = await loadListing(result.path);
    if (loaded) {
      currentPathRef.current = result.path;
      syncStacks(result.stacks);
    }
  }, [loadListing, syncStacks]);

  const goForward = useCallback(async () => {
    const result = navigateForward(stacksRef.current, currentPathRef.current);
    if (!result) {
      return;
    }
    const loaded = await loadListing(result.path);
    if (loaded) {
      currentPathRef.current = result.path;
      syncStacks(result.stacks);
    }
  }, [loadListing, syncStacks]);

  const goUp = useCallback(async () => {
    const current = currentPathRef.current;
    if (!current) {
      return;
    }
    await navigateTo(parentExplorerPath(current));
  }, [navigateTo]);

  const trackCurrentPath = useCallback((path: string) => {
    currentPathRef.current = path;
  }, []);

  return {
    navigateTo,
    goBack,
    goForward,
    goUp,
    canGoBack,
    canGoForward,
    trackCurrentPath,
  };
}
