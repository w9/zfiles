import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import GridCardPreview from "@/GridCardPreview";
import InlineNameInput from "@/explorer/InlineNameInput";
import {
  buildGridVirtualRows,
  estimateGridVirtualRowSize,
  GRID_SECTION_HEADER_TOP_GAP_PX,
  resolveGridSectionFolderCount,
  virtualRowIndexForEntryIndex,
} from "@/explorer/gridListingLayout";
import {
  collectGridEntryRects,
  findGridPathAtClientPoint,
  hitTestGridPathsWithContentMarquee,
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
import type { ListingSortOrder } from "@/settings/listingSortOrder";

type GridListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  focusedPath?: string | null;
  multiSelectedPaths?: Set<string>;
  cutPaths?: string[];
  inlineEditPath?: string | null;
  renameCommittingPath?: string | null;
  showRenameBusyVisual?: boolean;
  onInlineCommit?: (path: string, name: string) => void;
  onInlineCancel?: (path: string, initialName: string) => void;
  ariaLabel: string;
  listingSortOrder: ListingSortOrder;
  iconTheme?: FileIconTheme;
  className?: string;
  listingViewportRef?: React.RefObject<HTMLDivElement | null>;
  marqueeLayoutRef?: React.RefObject<ListingMarqueeLayoutResolver | null>;
  onViewportPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  marqueeActive?: boolean;
  shouldSkipDoubleClickActivate?: () => boolean;
  onResizeActiveChange?: (active: boolean) => void;
  onCardSizeChange?: (size: GridCardSize) => void;
};

const GRID_ITEM_SELECTED_CLASS =
  "shadow-[0_0_0_2px_var(--primary)] bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_FOCUS_SELECTED_CLASS =
  "shadow-[0_0_0_2px_var(--primary)] bg-primary/20 hover:bg-primary/24";
const GRID_ITEM_RESIZING_CLASS =
  "shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent)]";
const GRID_ITEM_CUT_CLASS = "opacity-45";

const VIEWPORT_PADDING_PX = 12;
const GRID_VIRTUAL_OVERSCAN_ROWS = 8;

export default function GridListing({
  entries,
  selectedIndex,
  focusedPath,
  multiSelectedPaths,
  cutPaths = [],
  inlineEditPath,
  renameCommittingPath,
  showRenameBusyVisual = false,
  onInlineCommit,
  onInlineCancel,
  ariaLabel,
  listingSortOrder,
  iconTheme = "dark",
  className,
  listingViewportRef,
  marqueeLayoutRef,
  onViewportPointerDown,
  marqueeActive = false,
  shouldSkipDoubleClickActivate,
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

  const sectionFolderCount = useMemo(
    () => resolveGridSectionFolderCount(entries, listingSortOrder),
    [entries, listingSortOrder],
  );

  const virtualRows = useMemo(
    () => buildGridVirtualRows(entries.length, columnCount, sectionFolderCount),
    [columnCount, entries.length, sectionFolderCount],
  );

  const listingPaths = useMemo(
    () => entries.map((entry) => entry.path),
    [entries],
  );
  const iconPixelSize = gridIconPixelSize(cardSize.width, cardSize.height);

  const gridMarqueeOptions = useMemo(
    () => ({
      columnCount,
      cardWidth: cardSize.width,
      cardHeight: cardSize.height,
      gap: GRID_GAP_PX,
      padding: VIEWPORT_PADDING_PX,
      virtualRows,
    }),
    [cardSize.height, cardSize.width, columnCount, virtualRows],
  );

  const { onHandlePointerDown, onHandleDoubleClick, resizingPath } = useGridCardResize({
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
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      estimateGridVirtualRowSize(virtualRows[index]!, cardSize.height),
    gap: GRID_GAP_PX,
    overscan: GRID_VIRTUAL_OVERSCAN_ROWS,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [cardSize.height, virtualRows, virtualizer]);

  useEffect(() => {
    const row = virtualRowIndexForEntryIndex(virtualRows, selectedIndex);
    if (row >= 0 && row < virtualRows.length) {
      virtualizer.scrollToIndex(row, { align: "auto" });
    }
  }, [selectedIndex, virtualRows, virtualizer]);

  useEffect(() => {
    if (!marqueeLayoutRef) {
      return;
    }
    marqueeLayoutRef.current = {
      entryCount: listingPaths.length,
      getEntryRects: (scrollElement) =>
        collectGridEntryRects(scrollElement, listingPaths, gridMarqueeOptions),
      hitTestContentMarquee: (scrollElement, bounds) =>
        hitTestGridPathsWithContentMarquee(
          scrollElement,
          listingPaths,
          bounds,
          gridMarqueeOptions,
        ),
      findPathAtClientPoint: (scrollElement, clientX, clientY) =>
        findGridPathAtClientPoint(
          scrollElement,
          listingPaths,
          clientX,
          clientY,
          gridMarqueeOptions,
        ),
    };
    return () => {
      marqueeLayoutRef.current = null;
    };
  }, [gridMarqueeOptions, listingPaths, marqueeLayoutRef]);

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
        data-listing-viewport=""
        className={cn("min-h-0 flex-1 overflow-auto p-3", marqueeActive && "select-none")}
        onPointerDown={onViewportPointerDown}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = virtualRows[virtualItem.index]!;
            if (row.kind === "header") {
              return (
                <div
                  key={virtualItem.key}
                  className="absolute left-0 flex w-full items-end"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                    paddingTop:
                      row.section === "files" ? GRID_SECTION_HEADER_TOP_GAP_PX : 0,
                  }}
                >
                  <p className="text-sm font-bold text-muted-foreground/60">
                    {row.section === "folders"
                      ? t("listing.grid.sectionFolders")
                      : t("listing.grid.sectionFiles")}
                  </p>
                </div>
              );
            }

            const rowEntries = entries.slice(
              row.entryStartIndex,
              row.entryStartIndex + row.entryCount,
            );
            return (
              <div
                key={virtualItem.key}
                className="absolute left-0 grid justify-start gap-3"
                style={{
                  gridTemplateColumns,
                  transform: `translateY(${virtualItem.start}px)`,
                  height: `${virtualItem.size}px`,
                }}
              >
                {rowEntries.map((entry, columnIndex) => {
                  const index = row.entryStartIndex + columnIndex;
                  const isSelected = multiSelectedPaths?.has(entry.path) ?? false;
                  const isFocused = focusedPath != null && entry.path === focusedPath;
                  const dimmed = shouldDimDotEntry(entry.name, entry.key);
                  const isCut = cutPathSet.has(entry.path);
                  const isEditing = inlineEditPath === entry.path;
                  const isResizing = resizingPath === entry.path;
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
                          "absolute inset-0 flex select-none flex-col overflow-hidden hover:bg-accent/40 outline-none focus:outline-none focus-visible:outline-none",
                          dimmed && "opacity-70",
                          isCut && GRID_ITEM_CUT_CLASS,
                          entry.quickFilterMatched === false && "opacity-40",
                          isResizing && GRID_ITEM_RESIZING_CLASS,
                          isSelected &&
                            !isResizing &&
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
                          if (shouldSkipDoubleClickActivate?.()) {
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
                        <div className="shrink-0 px-2 py-1.5 text-center text-base">
                          {isEditing && onInlineCommit && onInlineCancel ? (
                            <InlineNameInput
                              initialName={entry.name}
                              className="w-full text-left"
                              busy={renameCommittingPath === entry.path}
                              showBusyVisual={showRenameBusyVisual}
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
                          "absolute bottom-0 right-0 z-10 flex h-5 w-5 translate-x-0.5 translate-y-0.5 cursor-nwse-resize items-end justify-end p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                        )}
                        onPointerDown={onHandlePointerDown(entry.path)}
                        onDoubleClick={onHandleDoubleClick}
                      >
                        <span
                          aria-hidden
                          className="h-3 w-3 border-r-2 border-b-2 border-muted-foreground/70"
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
