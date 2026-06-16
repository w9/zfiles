import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import GridCardPreview from "@/GridCardPreview";
import InlineNameInput from "@/explorer/InlineNameInput";
import {
  collectGridEntryRects,
  type ListingMarqueeLayoutResolver,
} from "@/explorer/listingMarqueeSelect";
import { useGridCardResize } from "@/explorer/useGridCardResize";
import type { FileIconTheme } from "@/fileIcons";
import { useTranslation } from "@/i18n";
import { shouldDimDotEntry } from "@/listingFilter";
import type { ListingEntry } from "@/listing-types";
import { cn } from "@/lib/utils";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";
import {
  GRID_GAP_PX,
  computeGridColumnCount,
  gridIconPixelSize,
  type GridCardSize,
} from "@/settings/gridCardSize";
import { useGridCardSize } from "@/settings/GridCardSizeProvider";
import { useGridImagePreviews } from "@/settings/GridImagePreviewsProvider";

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
  listingViewportRef?: React.RefObject<HTMLDivElement | null>;
  marqueeLayoutRef?: React.RefObject<ListingMarqueeLayoutResolver | null>;
  onViewportPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  marqueeActive?: boolean;
  onResizeActiveChange?: (active: boolean) => void;
  onCardSizeChange?: (size: GridCardSize) => void;
};

const GRID_ITEM_SELECTED_CLASS =
  "shadow-[0_0_0_2px_var(--primary)] bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_FOCUS_SELECTED_CLASS =
  "shadow-[0_0_0_2px_var(--primary)] bg-primary/20 hover:bg-primary/24";
const GRID_ITEM_CUT_CLASS = "opacity-45";

const VIEWPORT_PADDING_PX = 12;

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
  listingViewportRef,
  marqueeLayoutRef,
  onViewportPointerDown,
  marqueeActive = false,
  onResizeActiveChange,
  onCardSizeChange,
}: GridListingProps) {
  const { t } = useTranslation();
  const { cardSize, setCardSize: setCardSizeFromProvider, resetToDefault } = useGridCardSize();
  const setCardSize = onCardSizeChange ?? setCardSizeFromProvider;
  const { enabled: gridImagePreviewsEnabled } = useGridImagePreviews();
  const cutPathSet = new Set(cutPaths);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const columnCount = useMemo(
    () => computeGridColumnCount(viewportWidth, cardSize.width, GRID_GAP_PX),
    [cardSize.width, viewportWidth],
  );

  const rowCount = Math.ceil(entries.length / columnCount);
  const iconPixelSize = gridIconPixelSize(cardSize.width, cardSize.height);

  const { onHandlePointerDown, onHandleDoubleClick } = useGridCardResize({
    cardSize,
    onSizeChange: setCardSize,
    onReset: resetToDefault,
    onActiveChange: onResizeActiveChange,
  });

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      if (listingViewportRef) {
        listingViewportRef.current = node;
      }
    },
    [listingViewportRef],
  );

  useEffect(() => {
    const node = parentRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setViewportWidth(Math.max(0, node.clientWidth - VIEWPORT_PADDING_PX * 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cardSize.height,
    gap: GRID_GAP_PX,
    overscan: 4,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [cardSize.height, virtualizer]);

  useEffect(() => {
    const row = Math.floor(selectedIndex / columnCount);
    if (row >= 0 && row < rowCount) {
      virtualizer.scrollToIndex(row, { align: "auto" });
    }
  }, [columnCount, rowCount, selectedIndex, virtualizer]);

  useEffect(() => {
    if (!marqueeLayoutRef) {
      return;
    }
    marqueeLayoutRef.current = {
      getEntryRects: (scrollElement) =>
        collectGridEntryRects(
          scrollElement,
          entries.map((entry) => entry.path),
          {
            columnCount,
            cardWidth: cardSize.width,
            cardHeight: cardSize.height,
            gap: GRID_GAP_PX,
            padding: VIEWPORT_PADDING_PX,
          },
        ),
    };
    return () => {
      marqueeLayoutRef.current = null;
    };
  }, [cardSize.height, cardSize.width, columnCount, entries, marqueeLayoutRef]);

  const gridTemplateColumns = `repeat(${columnCount}, ${cardSize.width}px)`;

  return (
    <div
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
      aria-label={ariaLabel}
    >
      <div
        ref={setViewportRef}
        className={cn("min-h-0 flex-1 overflow-auto p-3", marqueeActive && "select-none")}
        onPointerDown={onViewportPointerDown}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columnCount;
            const rowEntries = entries.slice(startIndex, startIndex + columnCount);
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 grid justify-start gap-3"
                style={{
                  gridTemplateColumns,
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
                    <div
                      key={entry.key}
                      className="group relative"
                      style={{
                        width: cardSize.width,
                        height: cardSize.height,
                      }}
                    >
                      <button
                        type="button"
                        data-listing-entry
                        data-listing-path={entry.path}
                        className={cn(
                          "absolute inset-0 flex select-none flex-col overflow-hidden rounded-lg border bg-background text-left hover:bg-accent/40 outline-none focus:outline-none focus-visible:outline-none",
                          dimmed && "opacity-70",
                          isCut && GRID_ITEM_CUT_CLASS,
                          entry.quickFilterMatched === false && "opacity-40",
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
                        onDoubleClick={() => {
                          if (entry.href) {
                            window.location.href = entry.href;
                            return;
                          }
                          entry.onActivate();
                        }}
                        onContextMenu={entry.onContextMenu}
                      >
                        <GridCardPreview
                          path={entry.path}
                          name={entry.name}
                          isDir={entry.isDir}
                          isSymlink={entry.isSymlink ?? false}
                          previewsEnabled={gridImagePreviewsEnabled}
                          iconTheme={iconTheme}
                          pixelSize={iconPixelSize}
                        />
                        <div className="shrink-0 border-t px-2 py-1.5 text-sm">
                          {isEditing && onInlineCommit && onInlineCancel ? (
                            <InlineNameInput
                              initialName={entry.name}
                              onCommit={(name) => onInlineCommit(entry.path, name)}
                              onCancel={() => onInlineCancel(entry.path, entry.name)}
                            />
                          ) : (
                            <TruncatedTextTooltip
                              text={entry.name}
                              className="block truncate"
                            />
                          )}
                        </div>
                      </button>
                      <div
                        role="separator"
                        aria-label={t("listing.grid.resizeHandle")}
                        data-grid-resize-handle
                        data-prevent-marquee
                        className={cn(
                          "absolute bottom-0 right-0 z-10 flex h-4 w-4 translate-x-0.5 translate-y-0.5 cursor-nwse-resize items-end justify-end p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                        )}
                        onPointerDown={onHandlePointerDown}
                        onDoubleClick={onHandleDoubleClick}
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 border-r-2 border-b-2 border-muted-foreground/70"
                        />
                      </div>
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
