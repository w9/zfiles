type Listener = () => void;

let selectedPaths: ReadonlySet<string> = new Set();
const pathListeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

function notifyPath(path: string): void {
  const listeners = pathListeners.get(path);
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Replace the selection snapshot; notify only paths whose membership changed. */
export function setListingSelectionPaths(next: ReadonlySet<string>): void {
  const prev = selectedPaths;
  if (prev === next) {
    return;
  }
  selectedPaths = next;
  for (const path of prev) {
    if (!next.has(path)) {
      notifyPath(path);
    }
  }
  for (const path of next) {
    if (!prev.has(path)) {
      notifyPath(path);
    }
  }
  for (const listener of globalListeners) {
    listener();
  }
}

export function getListingSelectionPaths(): ReadonlySet<string> {
  return selectedPaths;
}

export function listingPathIsSelected(path: string): boolean {
  return selectedPaths.has(path);
}

export function subscribeListingPathSelected(
  path: string,
  listener: Listener,
): () => void {
  let listeners = pathListeners.get(path);
  if (!listeners) {
    listeners = new Set();
    pathListeners.set(path, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      pathListeners.delete(path);
    }
  };
}

export function subscribeListingSelection(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}
