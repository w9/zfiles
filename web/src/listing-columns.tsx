import type { ColumnDef, Row, SortingFn } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { formatListingModifiedDisplay, formatSize, parseModifiedMs } from "@/listing-format";
import { compareListingEntries, compareNames } from "@/listingSort";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerAlign?: "start" | "end";
  }
}

function withListingSortOrder(
  order: ListingColumnLabels["listingSortOrder"],
  tieBreaker: (left: ListingEntry, right: ListingEntry) => number,
): SortingFn<ListingEntry> {
  return (rowA: Row<ListingEntry>, rowB: Row<ListingEntry>) =>
    compareListingEntries(rowA.original, rowB.original, order, tieBreaker);
}

export function createListingColumns(labels: ListingColumnLabels): ColumnDef<ListingEntry>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.name} />
      ),
      cell: ({ row }) => row.original.name,
      sortingFn: withListingSortOrder(labels.listingSortOrder, (left, right) =>
        compareNames(left.name, right.name),
      ),
    },
    {
      id: "size",
      accessorFn: (row) => (row.isDir ? -1 : (row.size ?? -1)),
      meta: { headerAlign: "end" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.size} />
      ),
      cell: ({ row }) => formatSize(row.original.size, row.original.isDir),
      sortingFn: withListingSortOrder(labels.listingSortOrder, (left, right) => {
        const leftSize = left.isDir ? -1 : (left.size ?? -1);
        const rightSize = right.isDir ? -1 : (right.size ?? -1);
        return leftSize - rightSize;
      }),
    },
    {
      id: "modified",
      accessorFn: (row) => parseModifiedMs(row.modified) ?? -1,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.modified} />
      ),
      cell: ({ row }) =>
        formatListingModifiedDisplay(
          row.original.modified,
          labels.locale,
          labels.modifiedTimeFormat,
        ),
      sortingFn: withListingSortOrder(labels.listingSortOrder, (left, right) => {
        const leftMs = parseModifiedMs(left.modified) ?? -1;
        const rightMs = parseModifiedMs(right.modified) ?? -1;
        return leftMs - rightMs;
      }),
    },
  ];
}
