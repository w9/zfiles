import { isPreviewable } from "./imagePaths";

export type FileActivation = "preview" | "download";

// How a non-directory listing entry responds to the default activation
// gesture (double-click / Enter): previewable types open the Preview overlay,
// everything else falls back to download.
export function resolveFileActivation(path: string): FileActivation {
  return isPreviewable(path) ? "preview" : "download";
}
