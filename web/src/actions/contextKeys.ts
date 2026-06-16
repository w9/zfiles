export type ContextKeys = {
  "focus.pane": string;
  "selection.count": number;
  "selection.file-count": number;
  "selection.paths": string[];
  "current-path": string;
  "connection.online": boolean;
  "server.read-only": boolean;
  "clipboard.count": number;
  "preview.is-image": boolean;
  "preview.path": string;
  "viewer.image-count": number;
  "listing.show-dot-entries": boolean;
  "listing.loaded": boolean;
  "listing.visible-count": number;
  "listing.view": string;
  "slideshow.open": boolean;
  "preview.inline-available": boolean;
  "preview.sheet-open": boolean;
};

export function defaultContextKeys(): ContextKeys {
  return {
    "focus.pane": "file-list",
    "selection.count": 0,
    "selection.file-count": 0,
    "selection.paths": [],
    "current-path": "",
    "connection.online": false,
    "server.read-only": false,
    "preview.is-image": false,
    "preview.path": "",
    "viewer.image-count": 0,
    "listing.show-dot-entries": false,
    "listing.loaded": false,
    "listing.visible-count": 0,
    "listing.view": "table",
    "clipboard.count": 0,
    "slideshow.open": false,
    "preview.inline-available": false,
    "preview.sheet-open": false,
  };
}

export function getContextValue(
  keys: ContextKeys,
  path: string,
): string | number | boolean | string[] | undefined {
  return keys[path as keyof ContextKeys];
}
