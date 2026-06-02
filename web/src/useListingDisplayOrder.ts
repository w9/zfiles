import { useMemo } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

import { createListingColumns } from "@/listing-columns";
import type { ListingColumnLabels, ListingEntry } from "@/listing-types";

export function useListingDisplayOrder(
  entries: ListingEntry[],
  columnLabels: ListingColumnLabels,
  sorting: SortingState,
): ListingEntry[] {
  const columns = useMemo(() => createListingColumns(columnLabels), [columnLabels]);
  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return useMemo(
    () => table.getRowModel().rows.map((row) => row.original),
    [table, entries, sorting],
  );
}
