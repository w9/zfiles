export type QuickFilterOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
};

export const defaultQuickFilterOptions: QuickFilterOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
};

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
