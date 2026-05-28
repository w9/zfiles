export type ContextKeys = {
  "focus.pane": string;
  "selection.count": number;
  "selection.paths": string[];
  "current-path": string;
  "connection.online": boolean;
  "server.read-only": boolean;
  "preview.is-image": boolean;
  "preview.path": string;
};

export function defaultContextKeys(): ContextKeys {
  return {
    "focus.pane": "file-list",
    "selection.count": 0,
    "selection.paths": [],
    "current-path": "",
    "connection.online": false,
    "server.read-only": false,
    "preview.is-image": false,
    "preview.path": "",
  };
}

export function getContextValue(
  keys: ContextKeys,
  path: string,
): string | number | boolean | string[] | undefined {
  return keys[path as keyof ContextKeys];
}
