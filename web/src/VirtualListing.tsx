import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Layout } from "react-resizable-panels";

import { FileIcon } from "@/FileIcon";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { createListingColumns } from "@/listing-columns";
import { formatModifiedAbsolute } from "@/listing-format";
import { shouldDimDotEntry } from "@/listingFilter";
import type { FileIconTheme } from "@/fileIcons";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";
import { cn } from "@/lib/utils";

export type { ListingEntry } from "@/listing-types";

type VirtualListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  multiSelectedPaths?: Set<string>;
  ariaLabel: string;
  columnLabels: ListingColumnLabels;
  iconTheme?: FileIconTheme;
  className?: string;
};

const DEFAULT_COLUMN_LAYOUT: Layout = {
  name: 55,
  size: 18,
  modified: 27,
};

const LISTING_COLUMN_IDS = ["name", "size", "modified"] as const;
const RESIZE_HANDLE_COUNT = LISTING_COLUMN_IDS.length - 1;
const RESIZE_HANDLE_WIDTH_PX = 1;

const CELL_CLIP = "min-w-0 overflow-hidden";
const CELL_TEXT = "block min-w-0 truncate";

const BODY_COLUMN_DIVIDER_CLASS = "border-r border-transparent transition-colors";

const BODY_SCROLL_PEER_HOVER_CLASS =
  "peer-hover/listing-header:[&_[role=gridcell]]:border-border";

const COLUMN_RESIZE_HANDLE_CLASS = cn(
  "z-10 bg-transparent opacity-0 transition-opacity",
  "group-hover/listing-header:bg-border group-hover/listing-header:opacity-100",
  "[&>div]:border-transparent [&>div]:bg-transparent [&>div]:opacity-0",
  "group-hover/listing-header:[&>div]:border-border group-hover/listing-header:[&>div]:bg-border group-hover/listing-header:[&>div]:opacity-100",
);

function layoutToGridTemplateColumns(layout: Layout, containerWidth: number): string {
  const available =
    containerWidth - RESIZE_HANDLE_COUNT * RESIZE_HANDLE_WIDTH_PX;
  if (available <= 0) {
    return "minmax(0, 2fr) 6rem 9rem";
  }

  const widths = LISTING_COLUMN_IDS.map((id) => ((layout[id] ?? 0) / 100) * available);
  return widths.map((px) => `${px}px`).join(" ");
}

export default function VirtualListing({
  entries,
  selectedIndex,
  multiSelectedPaths,
  ariaLabel,
  columnLabels,
  iconTheme = "dark",
  className,
}: VirtualListingProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnLayout, setColumnLayout] = useState<Layout>(DEFAULT_COLUMN_LAYOUT);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);

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

  const syncHeaderWidth = useCallback(() => {
    const width = headerRef.current?.clientWidth ?? 0;
    setHeaderWidth(width);
  }, []);

  useEffect(() => {
    syncHeaderWidth();
    const element = headerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncHeaderWidth();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [syncHeaderWidth]);

  const columnGridTemplate = useMemo(
    () => layoutToGridTemplateColumns(columnLayout, headerWidth),
    [columnLayout, headerWidth],
  );

  const handleColumnLayoutChange = useCallback((layout: Layout) => {
    setColumnLayout(layout);
    syncHeaderWidth();
  }, [syncHeaderWidth]);

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < rows.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, rows.length, virtualizer]);

  const headerGroup = table.getHeaderGroups()[0];

  return (
    <div
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
      role="grid"
      aria-label={ariaLabel}
    >
      <div
        ref={headerRef}
        className="group/listing-header peer/listing-header shrink-0 border-b"
        role="row"
      >
        {headerGroup ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-10 w-full"
            defaultLayout={DEFAULT_COLUMN_LAYOUT}
            onLayoutChange={handleColumnLayoutChange}
          >
            {headerGroup.headers.map((header, index) => (
              <ListingHeaderColumn
                key={header.id}
                header={header}
                index={index}
                isLast={index === headerGroup.headers.length - 1}
              />
            ))}
          </ResizablePanelGroup>
        ) : null}
      </div>

      <div
        ref={parentRef}
        className={cn("min-h-0 flex-1 overflow-auto", BODY_SCROLL_PEER_HOVER_CLASS)}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          role="rowgroup"
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            const entry = row.original;
            const selected = item.index === selectedIndex;
            const multiSelected = multiSelectedPaths?.has(entry.path) ?? false;
            const dimmed = shouldDimDotEntry(entry.name, entry.key);

            return (
              <div
                key={entry.key}
                role="row"
                data-state={selected ? "selected" : undefined}
                className={cn(
                  "absolute left-0 grid w-full border-b",
                  dimmed && "opacity-70",
                  selected && "bg-accent",
                  multiSelected && "ring-1 ring-inset ring-primary/40",
                )}
                style={{
                  gridTemplateColumns: columnGridTemplate,
                  transform: `translateY(${item.start}px)`,
                  height: `${item.size}px`,
                }}
              >
                {row.getVisibleCells().map((cell, columnIndex, cells) => {
                  const isName = columnIndex === 0;
                  const showColumnDivider = columnIndex < cells.length - 1;
                  const modifiedTitle =
                    cell.column.id === "modified" &&
                    columnLabels.modifiedTimeFormat === "relative"
                      ? formatModifiedAbsolute(entry.modified, columnLabels.locale) ??
                        undefined
                      : undefined;
                  const content = isName ? (
                    <>
                      <FileIcon
                        name={entry.name}
                        isDir={entry.isDir}
                        isSymlink={entry.isSymlink}
                        theme={iconTheme}
                      />
                      <span className="min-w-0 truncate">{entry.name}</span>
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
                        columnIndex === 1 && "justify-end text-right",
                      )}
                    >
                      <span className={CELL_TEXT} title={modifiedTitle}>
                        {content}
                      </span>
                    </div>
                  );

                  return (
                    <div
                      key={cell.id}
                      role="gridcell"
                      className={cn(
                        "p-0",
                        CELL_CLIP,
                        showColumnDivider && BODY_COLUMN_DIVIDER_CLASS,
                      )}
                    >
                      {interactive}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ListingHeaderColumnProps = {
  header: Header<ListingEntry, unknown>;
  index: number;
  isLast: boolean;
};

function ListingHeaderColumn({ header, index, isLast }: ListingHeaderColumnProps) {
  const alignEnd = index === 1;

  return (
    <>
      <ResizablePanel
        id={header.column.id}
        defaultSize={`${DEFAULT_COLUMN_LAYOUT[header.column.id]}%`}
        minSize={index === 0 ? 20 : 10}
        className="min-w-0"
      >
        <div
          role="columnheader"
          className={cn(
            "flex h-10 min-w-0 items-center px-2 text-sm font-medium",
            CELL_CLIP,
            alignEnd && "justify-end",
          )}
        >
          <span className={CELL_TEXT}>
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        </div>
      </ResizablePanel>
      {!isLast ? <ResizableHandle withHandle className={COLUMN_RESIZE_HANDLE_CLASS} /> : null}
    </>
  );
}
