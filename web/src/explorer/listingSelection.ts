export function pathsInIndexRange(
  entries: ReadonlyArray<{ path: string }>,
  anchorIndex: number,
  targetIndex: number,
): Set<string> {
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const next = new Set<string>();
  for (let i = start; i <= end; i += 1) {
    const path = entries[i]?.path;
    if (path) {
      next.add(path);
    }
  }
  return next;
}
