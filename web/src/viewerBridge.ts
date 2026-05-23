export type ViewerBridge = {
  zoomIn?: () => void;
  zoomOut?: () => void;
  fitScreen?: () => void;
  actualSize?: () => void;
  rotateCw?: () => void;
  toggleFullscreen?: () => void;
  toggleExif?: () => void;
};

let bridge: ViewerBridge = {};

export function getViewerBridge(): ViewerBridge {
  return bridge;
}

export function setViewerBridge(next: ViewerBridge): void {
  bridge = next;
}

export function clearViewerBridge(): void {
  bridge = {};
}
