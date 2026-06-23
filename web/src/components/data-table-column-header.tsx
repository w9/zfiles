import * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { LISTING_HEADER_TEXT_CLASS } from "@/listing-styles";
import type { ListingColumnHeaderAlign } from "@/listing-types";
import { cn } from "@/lib/utils";

const LISTING_COLUMN_HEADER_SHELL_CLASS =
  "flex h-full w-full min-h-0 min-w-0 items-center overflow-hidden px-2";

const LISTING_SORTABLE_COLUMN_HEADER_CLASS = cn(
  LISTING_COLUMN_HEADER_SHELL_CLASS,
  "gap-1 rounded-none border-0 bg-transparent transition-colors",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
);

export function columnHeaderAriaSort(
  isSorted: false | "asc" | "desc",
): "none" | "ascending" | "descending" {
  if (isSorted === "asc") return "ascending";
  if (isSorted === "desc") return "descending";
  return "none";
}

export function listingColumnHeaderAlignClass(
  headerAlign: ListingColumnHeaderAlign = "start",
): string | undefined {
  return headerAlign === "end" ? "justify-end" : undefined;
}

export function listingColumnHeaderSortIconFirst(
  headerAlign: ListingColumnHeaderAlign = "start",
): boolean {
  return headerAlign === "end";
}

export function readListingColumnHeaderAlign<TData, TValue>(
  column: Column<TData, TValue>,
): ListingColumnHeaderAlign {
  return column.columnDef.meta?.headerAlign === "end" ? "end" : "start";
}

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "desc") {
    return <ChevronDown className="size-4 shrink-0" />;
  }
  if (isSorted === "asc") {
    return <ChevronUp className="size-4 shrink-0" />;
  }
  return <ChevronsUpDown className="size-4 shrink-0" />;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const headerAlign = readListingColumnHeaderAlign(column);
  const alignClass = listingColumnHeaderAlignClass(headerAlign);
  const sortIconFirst = listingColumnHeaderSortIconFirst(headerAlign);

  if (!column.getCanSort()) {
    return (
      <div
        role="columnheader"
        className={cn(
          LISTING_COLUMN_HEADER_SHELL_CLASS,
          LISTING_HEADER_TEXT_CLASS,
          alignClass,
          className,
        )}
      >
        <span className="truncate">{title}</span>
      </div>
    );
  }

  const isSorted = column.getIsSorted();
  const sortIcon = <SortIcon isSorted={isSorted} />;

  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={columnHeaderAriaSort(isSorted)}
      className={cn(
        LISTING_SORTABLE_COLUMN_HEADER_CLASS,
        LISTING_HEADER_TEXT_CLASS,
        alignClass,
        className,
      )}
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      {sortIconFirst ? sortIcon : null}
      <span className="truncate">{title}</span>
      {sortIconFirst ? null : sortIcon}
    </button>
  );
}
