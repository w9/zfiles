export type QuickFilterKeyEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

export function isQuickFilterTypeaheadKey(event: QuickFilterKeyEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (event.key.length !== 1) {
    return false;
  }
  if (event.key === " " || event.key === "\\") {
    return false;
  }
  const codePoint = event.key.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }
  // Printable characters only — mirrors server filename rules (no `\`) plus `/` for regex mode.
  if (codePoint <= 0x1f || codePoint === 0x7f) {
    return false;
  }
  return true;
}

export type QuickFilterNavigableEntry = {
  quickFilterMatched?: boolean;
};

export function firstQuickFilterMatchIndex(
  entries: QuickFilterNavigableEntry[],
): number {
  return entries.findIndex((entry) => entry.quickFilterMatched !== false);
}

export function nextQuickFilterMatchIndex(
  entries: QuickFilterNavigableEntry[],
  currentIndex: number,
  direction: "up" | "down",
): number {
  const matchedIndexes = entries.flatMap((entry, index) =>
    entry.quickFilterMatched === false ? [] : [index],
  );
  if (matchedIndexes.length === 0) {
    return -1;
  }
  const currentPosition = matchedIndexes.indexOf(currentIndex);
  if (currentPosition < 0) {
    return direction === "down"
      ? matchedIndexes[0]!
      : matchedIndexes[matchedIndexes.length - 1]!;
  }
  const nextPosition =
    direction === "down"
      ? Math.min(currentPosition + 1, matchedIndexes.length - 1)
      : Math.max(currentPosition - 1, 0);
  return matchedIndexes[nextPosition]!;
}

export function normalizeQuickFilterQuery(query: string): string {
  return query.trim();
}

export type QuickFilterMode =
  | { kind: "substring"; pattern: string }
  | { kind: "regex"; pattern: string; caseSensitive: boolean };

export function parseQuickFilterMode(query: string): QuickFilterMode | null {
  const normalized = normalizeQuickFilterQuery(query);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("/")) {
    let pattern = normalized.slice(1);
    let caseSensitive = true;
    if (pattern.endsWith("/i")) {
      pattern = pattern.slice(0, -2);
      caseSensitive = false;
    }
    return { kind: "regex", pattern, caseSensitive };
  }
  return { kind: "substring", pattern: normalized };
}

export function isValidQuickFilterRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, "");
    return true;
  } catch {
    return false;
  }
}

export function entryMatchesQuickFilter(name: string, query: string): boolean {
  const mode = parseQuickFilterMode(query);
  if (!mode) {
    return true;
  }
  if (mode.kind === "substring") {
    return name.toLowerCase().includes(mode.pattern.toLowerCase());
  }
  try {
    const re = new RegExp(mode.pattern, mode.caseSensitive ? "" : "i");
    return re.test(name);
  } catch {
    return false;
  }
}

export function filterEntriesByQuickFilter<T extends { name: string }>(
  entries: T[],
  query: string,
): T[] {
  const mode = parseQuickFilterMode(query);
  if (!mode) {
    return entries;
  }
  return entries.filter((entry) => entryMatchesQuickFilter(entry.name, query));
}
