import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { FileIcon } from "@/FileIcon";
import InlineNameInput from "@/explorer/InlineNameInput";
import type { FileIconTheme } from "@/fileIcons";
import { shouldDimDotEntry } from "@/listingFilter";
import type { ListingEntry } from "@/listing-types";
import { cn } from "@/lib/utils";

type GridListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  focusedPath?: string | null;
  multiSelectedPaths?: Set<string>;
  cutPaths?: string[];
  inlineEditPath?: string | null;
  onInlineCommit?: (path: string, name: string) => void;
  onInlineCancel?: (path: string, initialName: string) => void;
  ariaLabel: string;
  iconTheme?: FileIconTheme;
  className?: string;
};

const GRID_COLUMNS = 4;
const ROW_HEIGHT = 168;

const GRID_ITEM_SELECTED_CLASS = "bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_FOCUS_SELECTED_CLASS = "bg-primary/20 hover:bg-primary/24";
const GRID_ITEM_CUT_CLASS = "opacity-45";

export default function GridListing({
  entries,
  selectedIndex,
  focusedPath,
  multiSelectedPaths,
  cutPaths = [],
  inlineEditPath,
  onInlineCommit,
  onInlineCancel,
  ariaLabel,
  iconTheme = "dark",
  className,
}: GridListingProps) {
  const cutPathSet = new Set(cutPaths);
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
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
      aria-label={ariaLabel}
    >
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto p-3">
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
                  const isSelected = multiSelectedPaths?.has(entry.path) ?? false;
                  const isFocused = focusedPath != null && entry.path === focusedPath;
                  const dimmed = shouldDimDotEntry(entry.name, entry.key);
                  const isCut = cutPathSet.has(entry.path);
                  const isEditing = inlineEditPath === entry.path;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      data-listing-entry
                      className={cn(
                        "flex h-full select-none flex-col overflow-hidden rounded-lg border bg-background text-left hover:bg-accent/40 outline-none focus:outline-none focus-visible:outline-none",
                        dimmed && "opacity-70",
                        isCut && GRID_ITEM_CUT_CLASS,
                        isSelected &&
                          (isFocused
                            ? GRID_ITEM_FOCUS_SELECTED_CLASS
                            : GRID_ITEM_SELECTED_CLASS),
                      )}
                      onMouseDown={(event) => {
                        if (event.shiftKey) {
                          event.preventDefault();
                        }
                      }}
                      onClick={(event) => entry.onSelect(event, index)}
                      onDoubleClick={entry.onActivate}
                      onContextMenu={entry.onContextMenu}
                    >
                      <div className="flex flex-1 items-center justify-center bg-muted/30 p-2">
                        <FileIcon
                          name={entry.name}
                          isDir={entry.isDir}
                          isSymlink={entry.isSymlink}
                          theme={iconTheme}
                          size="lg"
                        />
                      </div>
                      <div className="border-t px-2 py-1.5 text-sm">
                        {isEditing && onInlineCommit && onInlineCancel ? (
                          <InlineNameInput
                            initialName={entry.name}
                            onCommit={(name) => onInlineCommit(entry.path, name)}
                            onCancel={() => onInlineCancel(entry.path, entry.name)}
                          />
                        ) : (
                          <span className="block truncate">{entry.name}</span>
                        )}
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
