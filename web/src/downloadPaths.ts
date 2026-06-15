import type { ExplorerBackend } from "@/backend/types";
import type { FileEntry } from "@/backend/types";

export function filterDownloadablePaths(
  paths: string[],
  entries: FileEntry[],
): string[] {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  return paths.filter((path) => {
    const entry = byPath.get(path);
    return entry != null && !entry.is_dir;
  });
}

export function triggerBrowserDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadFiles(
  backend: ExplorerBackend,
  paths: string[],
): Promise<void> {
  for (const path of paths) {
    const url = await Promise.resolve(backend.downloadUrl(path));
    triggerBrowserDownload(url, path.split("/").pop() ?? path);
  }
}
