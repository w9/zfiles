import { useSyncExternalStore } from "react";

import {
  listingPathIsSelected,
  subscribeListingPathSelected,
} from "@/explorer/listingSelectionStore";

/** Subscribe to selection membership for one path (re-renders only on change). */
export function useListingPathSelected(path: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeListingPathSelected(path, onChange),
    () => listingPathIsSelected(path),
    () => false,
  );
}
