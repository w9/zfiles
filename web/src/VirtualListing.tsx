import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createListingColumns } from "@/listing-columns";
import { listingIconPrefix } from "@/listing-format";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";
import { cn } from "@/lib/utils";

export type { ListingEntry } from "@/listing-types";

type VirtualListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  multiSelectedPaths?: Set<string>;
  ariaLabel: string;
  columnLabels: ListingColumnLabels;
  className?: string;
};

const LISTING_GRID =
  "grid w-full grid-cols-[minmax(0,2fr)_6rem_6rem_9rem]";

const CELL_CLIP = "min-w-0 overflow-hidden";
const CELL_TEXT = "block min-w-0 truncate";

export default function VirtualListing({
  entries,
  selectedIndex,
  multiSelectedPaths,
  ariaLabel,
  columnLabels,
  className,
}: VirtualListingProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(() => createListingColumns(columnLabels), [columnLabels]);
  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < rows.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, rows.length, virtualizer]);

  return (
    <div
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      aria-label={ariaLabel}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={cn(LISTING_GRID, "hover:bg-transparent")}>
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    CELL_CLIP,
                    index === 2 && "text-right",
                  )}
                >
                  <span className={CELL_TEXT}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      </Table>
      <div ref={parentRef} className="h-[440px] overflow-auto border-t">
        <Table>
          <TableBody
            className="relative block"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              const entry = row.original;
              const selected = item.index === selectedIndex;
              const multiSelected = multiSelectedPaths?.has(entry.path) ?? false;

              return (
                <TableRow
                  key={entry.key}
                  data-state={selected ? "selected" : undefined}
                  className={cn(
                    LISTING_GRID,
                    "absolute left-0 border-b",
                    selected && "bg-accent",
                    multiSelected && "ring-1 ring-inset ring-primary/40",
                  )}
                  style={{
                    transform: `translateY(${item.start}px)`,
                    height: `${item.size}px`,
                  }}
                >
                  {row.getVisibleCells().map((cell, columnIndex) => {
                    const isName = columnIndex === 0;
                    const content = isName ? (
                      <>
                        {entry.thumbnailUrl ? (
                          <img
                            className="h-7 w-7 shrink-0 rounded object-cover"
                            src={entry.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            width={28}
                            height={28}
                          />
                        ) : null}
                        <span className="min-w-0 truncate">
                          {listingIconPrefix(entry.isDir, entry.thumbnailUrl)}
                          {entry.name}
                        </span>
                      </>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    );

                    const interactive = isName ? (
                      entry.href ? (
                        <a
                          className="flex h-11 w-full min-w-0 items-center gap-3 overflow-hidden px-2 hover:bg-accent/60"
                          href={entry.href}
                          onClick={(event) => {
                            event.preventDefault();
                            entry.onSelect(event);
                          }}
                          onDoubleClick={() => {
                            window.location.href = entry.href!;
                          }}
                          onContextMenu={entry.onContextMenu}
                        >
                          {content}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="flex h-11 w-full min-w-0 items-center gap-3 overflow-hidden px-2 text-left hover:bg-accent/60"
                          onClick={entry.onSelect}
                          onDoubleClick={entry.onActivate}
                          onContextMenu={entry.onContextMenu}
                        >
                          {content}
                        </button>
                      )
                    ) : (
                      <div
                        className={cn(
                          "flex h-11 items-center overflow-hidden px-2 text-sm",
                          columnIndex === 2 && "justify-end text-right",
                        )}
                      >
                        <span className={CELL_TEXT}>{content}</span>
                      </div>
                    );

                    return (
                      <TableCell key={cell.id} className={cn("p-0", CELL_CLIP)}>
                        {interactive}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
