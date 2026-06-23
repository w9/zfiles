import * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { LISTING_HEADER_TEXT_CLASS } from "@/listing-styles";
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

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div
        role="columnheader"
        className={cn(LISTING_COLUMN_HEADER_SHELL_CLASS, LISTING_HEADER_TEXT_CLASS, className)}
      >
        <span className="truncate">{title}</span>
      </div>
    );
  }

  const isSorted = column.getIsSorted();

  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={columnHeaderAriaSort(isSorted)}
      className={cn(
        LISTING_SORTABLE_COLUMN_HEADER_CLASS,
        LISTING_HEADER_TEXT_CLASS,
        className,
      )}
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      <span className="truncate">{title}</span>
      {isSorted === "desc" ? (
        <ChevronDown className="size-4 shrink-0" />
      ) : isSorted === "asc" ? (
        <ChevronUp className="size-4 shrink-0" />
      ) : (
        <ChevronsUpDown className="size-4 shrink-0" />
      )}
    </button>
  );
}
