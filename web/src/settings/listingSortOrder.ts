export type ListingSortOrder = "folders-first" | "mixed";

export const LISTING_SORT_ORDER_STORAGE_KEY = "zfiles-listing-sort-order";

export const DEFAULT_LISTING_SORT_ORDER: ListingSortOrder = "folders-first";

export function parseListingSortOrder(value: string | null): ListingSortOrder {
  if (value === "mixed") {
    return "mixed";
  }
  return DEFAULT_LISTING_SORT_ORDER;
}

export function readStoredListingSortOrder(): ListingSortOrder {
  if (typeof window === "undefined") {
    return DEFAULT_LISTING_SORT_ORDER;
  }
  return parseListingSortOrder(
    window.localStorage.getItem(LISTING_SORT_ORDER_STORAGE_KEY),
  );
}

export function storeListingSortOrder(order: ListingSortOrder): void {
  window.localStorage.setItem(LISTING_SORT_ORDER_STORAGE_KEY, order);
}

export function foldersFirstEnabled(order: ListingSortOrder): boolean {
  return order === "folders-first";
}
