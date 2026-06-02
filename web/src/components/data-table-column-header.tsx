import * as React from "react";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> = React.HTMLAttributes<HTMLDivElement> & {
  column: Column<TData, TValue>;
  title: string;
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("w-full min-w-0 truncate text-[12px] leading-4", className)}>{title}</div>;
  }

  return (
    <div className={cn("flex w-full min-w-0 items-center overflow-hidden text-[12px] leading-4", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-auto max-w-full shrink-0 justify-start gap-1 overflow-hidden px-2 text-[12px] leading-4 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span className="truncate">{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : column.getIsSorted() === "asc" ? (
          <ChevronUp className="size-4 shrink-0" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0" />
        )}
      </Button>
    </div>
  );
}
