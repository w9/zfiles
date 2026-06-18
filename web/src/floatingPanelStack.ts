const BASE_Z_INDEX = 50;

type Listener = () => void;

const stack: string[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeFloatingPanelStack(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerFloatingPanel(id: string): void {
  bringFloatingPanelToFront(id);
}

export function unregisterFloatingPanel(id: string): void {
  const index = stack.indexOf(id);
  if (index < 0) {
    return;
  }
  stack.splice(index, 1);
  notify();
}

export function bringFloatingPanelToFront(id: string): void {
  const index = stack.indexOf(id);
  if (index >= 0) {
    stack.splice(index, 1);
  }
  stack.push(id);
  notify();
}

export function getFloatingPanelZIndex(id: string): number {
  const index = stack.indexOf(id);
  if (index < 0) {
    return BASE_Z_INDEX;
  }
  return BASE_Z_INDEX + index;
}

export function isTopmostFloatingPanel(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function resetFloatingPanelStackForTests(): void {
  stack.length = 0;
  notify();
}

export function getFloatingPanelStackForTests(): readonly string[] {
  return [...stack];
}
