export function isDotEntryName(name: string): boolean {
  return name.startsWith(".");
}

export function shouldDimDotEntry(name: string, key: string): boolean {
  return key !== ".." && isDotEntryName(name);
}

export function filterDotEntries<T extends { name: string }>(
  entries: T[],
  showDotEntries: boolean,
): T[] {
  if (showDotEntries) {
    return entries;
  }
  return entries.filter((entry) => !isDotEntryName(entry.name));
}
