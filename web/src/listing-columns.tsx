import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { formatModified, formatSize, parseModifiedMs } from "@/listing-format";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";

export function createListingColumns(labels: ListingColumnLabels): ColumnDef<ListingEntry>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.name} />
      ),
      cell: ({ row }) => row.original.name,
      sortingFn: "alphanumeric",
    },
    {
      id: "type",
      accessorFn: (row) => (row.isDir ? labels.typeDirectory : labels.typeFile),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.type} />
      ),
      sortingFn: (a, b) => Number(a.original.isDir) - Number(b.original.isDir),
    },
    {
      id: "size",
      accessorFn: (row) => (row.isDir ? -1 : (row.size ?? -1)),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.size} className="justify-end" />
      ),
      cell: ({ row }) => formatSize(row.original.size, row.original.isDir),
      sortingFn: "basic",
    },
    {
      id: "modified",
      accessorFn: (row) => parseModifiedMs(row.modified) ?? -1,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labels.modified} />
      ),
      cell: ({ row }) => formatModified(row.original.modified, labels.locale),
      sortingFn: "basic",
    },
  ];
}
