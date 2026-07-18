import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  buildGridVirtualRows,
  estimateGridVirtualRowSize,
  GRID_SECTION_HEADER_TOP_GAP_PX,
  gridEntryHitExpand,
  resolveGridSectionFolderCount,
  virtualRowIndexForEntryIndex,
} from "@/explorer/gridListingLayout";
import {
  collectGridEntryRects,
  findGridPathAtClientPoint,
  hitTestGridPathsWithContentMarquee,
  type ListingMarqueeLayoutResolver,
} from "@/explorer/listingMarqueeSelect";
import { useExplorerDndUi } from "@/explorer/ExplorerDndProvider";
import { GridListingEntryCard } from "@/explorer/GridListingEntryCard";
import { useGridCardResize } from "@/explorer/useGridCardResize";
import type { FileIconTheme } from "@/fileIcons";
import { useTranslation } from "@/i18n";
import { LISTING_HEADER_TEXT_CLASS } from "@/listing-styles";
import type { ListingEntry } from "@/listing-types";
import { cn } from "@/lib/utils";
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
  gestureHighlightPath?: string | null;
  gestureInsetPath?: string | null;
  /** When false, skip scrolling the selected row into view (touch multi-select). */
  scrollSelectedIntoView?: boolean;
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
  onEntryPointerDown?: (
    event: React.PointerEvent<HTMLElement>,
    path: string,
  ) => void;
  entryDragEnabled?: boolean;
  marqueeActive?: boolean;
  shouldSkipDoubleClickActivate?: () => boolean;
  onResizeActiveChange?: (active: boolean) => void;
  onCardSizeChange?: (size: GridCardSize) => void;
  onResetCardSize?: () => void;
};

const VIEWPORT_PADDING_PX = 12;
const GRID_VIRTUAL_OVERSCAN_ROWS = 8;

export default function GridListing({
  entries,
  selectedIndex,
  focusedPath,
  gestureHighlightPath,
  gestureInsetPath,
  scrollSelectedIntoView = true,
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
  onEntryPointerDown,
  entryDragEnabled = false,
  marqueeActive = false,
  shouldSkipDoubleClickActivate,
  onResizeActiveChange,
  onCardSizeChange,
  onResetCardSize,
}: GridListingProps) {
  const { dropHighlightPath, dragFadePathSet } = useExplorerDndUi();
  const { t } = useTranslation();
  const { cardSize, setCardSize: setCardSizeFromProvider, resetToDefault } = useGridCardSize();
  const setCardSize = onCardSizeChange ?? setCardSizeFromProvider;
  const resetCardSize = onResetCardSize ?? resetToDefault;
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
    onReset: resetCardSize,
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
    if (!scrollSelectedIntoView) {
      return;
    }
    const row = virtualRowIndexForEntryIndex(virtualRows, selectedIndex);
    if (row >= 0 && row < virtualRows.length) {
      virtualizer.scrollToIndex(row, { align: "auto" });
    }
  }, [selectedIndex, virtualRows, virtualizer, scrollSelectedIntoView]);

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
        className={cn(
          "min-h-0 flex-1 overflow-auto overscroll-contain p-3",
          marqueeActive && "select-none",
        )}
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
                  <p className={LISTING_HEADER_TEXT_CLASS}>
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
                  const hitExpand = gridEntryHitExpand(index, gridMarqueeOptions) ?? {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  };
                  const isSelected = multiSelectedPaths?.has(entry.path) ?? false;
                  return (
                    <GridListingEntryCard
                      key={entry.key}
                      entry={entry}
                      index={index}
                      cardWidth={cardSize.width}
                      cardHeight={cardSize.height}
                      hitExpand={hitExpand}
                      isSelected={isSelected}
                      isFocused={focusedPath != null && entry.path === focusedPath}
                      isGestureHighlighted={
                        gestureHighlightPath != null &&
                        entry.path === gestureHighlightPath
                      }
                      isGestureInset={
                        gestureInsetPath != null && entry.path === gestureInsetPath
                      }
                      isCut={cutPathSet.has(entry.path)}
                      isDragFaded={dragFadePathSet.has(entry.path)}
                      isEditing={inlineEditPath === entry.path}
                      isResizing={resizingPath === entry.path}
                      dropHighlight={
                        entry.isDir &&
                        dropHighlightPath != null &&
                        dropHighlightPath === entry.path
                      }
                      entryDragEnabled={entryDragEnabled}
                      renameCommittingPath={renameCommittingPath}
                      showRenameBusyVisual={showRenameBusyVisual}
                      onInlineCommit={onInlineCommit}
                      onInlineCancel={onInlineCancel}
                      onEntryPointerDown={onEntryPointerDown}
                      shouldSkipDoubleClickActivate={shouldSkipDoubleClickActivate}
                      previewsEnabled={gridImagePreviewsEnabled}
                      iconTheme={iconTheme}
                      iconPixelSize={iconPixelSize}
                      resizeHandleLabel={t("listing.grid.resizeHandle")}
                      onResizePointerDown={onHandlePointerDown(entry.path)}
                      onResizeDoubleClick={onHandleDoubleClick}
                    />
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
