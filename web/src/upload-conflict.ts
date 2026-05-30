import type { ExplorerBackend } from "./backend/types";

export type UploadConflictResolution = "replace" | "keep_both" | "skip";

export async function pathExistsAsFile(
  backend: ExplorerBackend,
  path: string,
): Promise<boolean> {
  try {
    const stat = await backend.stat(path);
    return !stat.is_dir;
  } catch {
    return false;
  }
}

export function suggestKeepBothPath(destPath: string, attempt: number): string {
  const lastSlash = destPath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? destPath.slice(0, lastSlash) : "";
  const baseName = lastSlash >= 0 ? destPath.slice(lastSlash + 1) : destPath;
  const dot = baseName.lastIndexOf(".");
  const hasExt = dot > 0;
  const stem = hasExt ? baseName.slice(0, dot) : baseName;
  const ext = hasExt ? baseName.slice(dot) : "";
  const numbered = `${stem} (${attempt})${ext}`;
  return dir ? `${dir}/${numbered}` : numbered;
}

export async function findKeepBothPath(
  backend: ExplorerBackend,
  destPath: string,
): Promise<string> {
  for (let attempt = 1; attempt < 10_000; attempt += 1) {
    const candidate = suggestKeepBothPath(destPath, attempt);
    if (!(await pathExistsAsFile(backend, candidate))) {
      return candidate;
    }
  }
  throw new Error("unable to find a unique filename");
}
