import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { FileIcon } from "@/FileIcon";
import type { FileIconTheme } from "@/fileIcons";
import type { ListingEntry } from "@/listing-types";
import { cn } from "@/lib/utils";

type GridListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  multiSelectedPaths?: Set<string>;
  ariaLabel: string;
  iconTheme?: FileIconTheme;
  listingAtRoot?: boolean;
  className?: string;
};

const GRID_COLUMNS = 4;
const ROW_HEIGHT = 168;

export default function GridListing({
  entries,
  selectedIndex,
  multiSelectedPaths,
  ariaLabel,
  iconTheme = "dark",
  listingAtRoot = false,
  className,
}: GridListingProps) {
  const rowCount = Math.ceil(entries.length / GRID_COLUMNS);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 4,
  });

  useEffect(() => {
    const row = Math.floor(selectedIndex / GRID_COLUMNS);
    if (row >= 0 && row < rowCount) {
      virtualizer.scrollToIndex(row, { align: "auto" });
    }
  }, [selectedIndex, rowCount, virtualizer]);

  return (
    <div
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
      aria-label={ariaLabel}
    >
      <div ref={parentRef} className="h-[440px] overflow-auto p-3">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * GRID_COLUMNS;
            const rowEntries = entries.slice(startIndex, startIndex + GRID_COLUMNS);
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {rowEntries.map((entry, columnIndex) => {
                  const index = startIndex + columnIndex;
                  const selected = index === selectedIndex;
                  const multiSelected = multiSelectedPaths?.has(entry.path) ?? false;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={cn(
                        "flex h-full flex-col overflow-hidden rounded-lg border bg-background text-left hover:bg-accent/40",
                        selected && "border-primary bg-accent",
                        multiSelected && "ring-2 ring-primary/40",
                      )}
                      onClick={(event) => entry.onSelect(event)}
                      onDoubleClick={entry.onActivate}
                      onContextMenu={entry.onContextMenu}
                    >
                      <div className="flex flex-1 items-center justify-center bg-muted/30 p-2">
                        <FileIcon
                          name={entry.name}
                          isDir={entry.isDir}
                          thumbnailUrl={entry.thumbnailUrl}
                          theme={iconTheme}
                          atListingRoot={listingAtRoot}
                          size="lg"
                          className={entry.thumbnailUrl ? "max-h-24 max-w-full object-contain" : undefined}
                        />
                      </div>
                      <div className="truncate border-t px-2 py-1.5 text-sm">
                        {entry.name}
                      </div>
                    </button>
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
