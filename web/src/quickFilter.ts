export type QuickFilterOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  fadeUnmatched: boolean;
};

export const QUICK_FILTER_OPTIONS_STORAGE_KEY = "zfiles-quick-filter-options";

export const defaultQuickFilterOptions: QuickFilterOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  fadeUnmatched: false,
};

function parseStoredBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function parseQuickFilterOptions(value: unknown): QuickFilterOptions {
  if (!value || typeof value !== "object") {
    return defaultQuickFilterOptions;
  }
  const stored = value as Partial<Record<keyof QuickFilterOptions, unknown>>;
  return {
    caseSensitive: parseStoredBoolean(
      stored.caseSensitive,
      defaultQuickFilterOptions.caseSensitive,
    ),
    wholeWord: parseStoredBoolean(stored.wholeWord, defaultQuickFilterOptions.wholeWord),
    useRegex: parseStoredBoolean(stored.useRegex, defaultQuickFilterOptions.useRegex),
    fadeUnmatched: parseStoredBoolean(
      stored.fadeUnmatched,
      defaultQuickFilterOptions.fadeUnmatched,
    ),
  };
}

export function readStoredQuickFilterOptions(): QuickFilterOptions {
  if (typeof window === "undefined") {
    return defaultQuickFilterOptions;
  }
  const stored = window.localStorage.getItem(QUICK_FILTER_OPTIONS_STORAGE_KEY);
  if (!stored) {
    return defaultQuickFilterOptions;
  }
  try {
    return parseQuickFilterOptions(JSON.parse(stored));
  } catch {
    return defaultQuickFilterOptions;
  }
}

export function storeQuickFilterOptions(options: QuickFilterOptions): void {
  window.localStorage.setItem(QUICK_FILTER_OPTIONS_STORAGE_KEY, JSON.stringify(options));
}

export type QuickFilterKeyEvent = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

export function isPlainQuickFilterLetterKey(event: QuickFilterKeyEvent): boolean {
  return (
    event.key.length === 1 &&
    /^[a-z]$/i.test(event.key) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey
  );
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

function buildRegex(
  pattern: string,
  options: QuickFilterOptions,
): RegExp | null {
  try {
    const flags = options.caseSensitive ? "" : "i";
    if (options.wholeWord) {
      return new RegExp(`^(?:${pattern})$`, flags);
    }
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function entryMatchesQuickFilter(
  name: string,
  query: string,
  options: QuickFilterOptions = defaultQuickFilterOptions,
): boolean {
  const normalized = normalizeQuickFilterQuery(query);
  if (!normalized) {
    return true;
  }

  if (options.useRegex) {
    const regex = buildRegex(normalized, options);
    return regex?.test(name) ?? false;
  }

  const haystack = options.caseSensitive ? name : name.toLowerCase();
  const needle = options.caseSensitive
    ? normalized
    : normalized.toLowerCase();

  if (options.wholeWord) {
    return haystack === needle;
  }

  return haystack.includes(needle);
}

export function filterEntriesByQuickFilter<T extends { name: string }>(
  entries: T[],
  query: string,
  options: QuickFilterOptions = defaultQuickFilterOptions,
): T[] {
  const normalized = normalizeQuickFilterQuery(query);
  if (!normalized) {
    return entries;
  }
  return entries.filter((entry) =>
    entryMatchesQuickFilter(entry.name, normalized, options),
  );
}
