import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Header,
  type OnChangeFn,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";
import InlineNameInput from "@/explorer/InlineNameInput";
import {
  collectTableEntryRects,
  findTablePathAtClientPoint,
  hitTestTablePathsWithContentMarquee,
  LISTING_TABLE_ROW_HEIGHT_PX,
  type ListingMarqueeLayoutResolver,
} from "@/explorer/listingMarqueeSelect";
import { createListingColumns } from "@/listing-columns";
import { formatModifiedAbsolute } from "@/listing-format";
import { shouldDimDotEntry } from "@/listingFilter";
import {
  LISTING_ENTRY_TEXT_CLASS,
  LISTING_ICON_COLUMN_WIDTH_PX,
} from "@/listing-styles";
import {
  layoutToListingRowGridTemplate,
  listingColumnGutterGridColumn,
  listingDataCellGridColumn,
  prependIconColumnToMeasuredGridTemplate,
} from "@/listing-table-layout";
import type { FileIconTheme } from "@/fileIcons";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";
import { cn } from "@/lib/utils";

export type { ListingEntry } from "@/listing-types";

type VirtualListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  focusedPath?: string | null;
  gestureHighlightPath?: string | null;
  multiSelectedPaths?: Set<string>;
  cutPaths?: string[];
  inlineEditPath?: string | null;
  renameCommittingPath?: string | null;
  showRenameBusyVisual?: boolean;
  onInlineCommit?: (path: string, name: string) => void;
  onInlineCancel?: (path: string, initialName: string) => void;
  ariaLabel: string;
  columnLabels: ListingColumnLabels;
  iconTheme?: FileIconTheme;
  className?: string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  listingViewportRef?: React.RefObject<HTMLDivElement | null>;
  marqueeLayoutRef?: React.RefObject<ListingMarqueeLayoutResolver | null>;
  onViewportPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onEntryPointerDown?: (
    event: React.PointerEvent<HTMLElement>,
    path: string,
  ) => void;
  marqueeActive?: boolean;
  shouldSkipDoubleClickActivate?: () => boolean;
};

const DEFAULT_COLUMN_LAYOUT: Layout = {
  name: 55,
  size: 18,
  modified: 27,
};

const CELL_CLIP = "min-w-0 overflow-hidden";
const CELL_TEXT = cn("block min-w-0 truncate", LISTING_ENTRY_TEXT_CLASS);

const BODY_COLUMN_GUTTER_CLASS = "border-r border-transparent";

const BODY_SCROLL_PEER_HOVER_CLASS =
  "peer-hover/listing-header:[&_[data-listing-gutter]]:border-border";

const LISTING_ROW_CLASS = cn(
  "absolute left-0 grid w-full cursor-default select-none",
  "hover:bg-accent/60",
  "outline-none focus:outline-none focus-visible:outline-none",
);

const LISTING_ROW_SELECTED_CLASS = "bg-primary/12 hover:bg-primary/16";
const LISTING_ROW_FOCUS_SELECTED_CLASS = "bg-primary/20 hover:bg-primary/24";
const LISTING_ROW_CUT_CLASS = "opacity-45";

const LISTING_HEADER_ROW_CLASS = "h-10 max-h-10 overflow-hidden";

const LISTING_PANEL_GROUP_CLASS = "h-10 max-h-10 min-h-0 w-full overflow-hidden";

const LISTING_PANEL_CLASS = "!h-10 !max-h-10 min-h-0 min-w-0 overflow-hidden";

const LISTING_VIRTUAL_OVERSCAN_ROWS = 32;

const COLUMN_RESIZE_HANDLE_CLASS = cn(
  "h-10 max-h-10 min-h-0 shrink-0 self-center",
  "z-10 bg-transparent opacity-0 transition-opacity",
  "group-hover/listing-header:bg-border group-hover/listing-header:opacity-100",
  "[&>div]:border-transparent [&>div]:bg-transparent [&>div]:opacity-0",
  "group-hover/listing-header:[&>div]:border-border group-hover/listing-header:[&>div]:bg-border group-hover/listing-header:[&>div]:opacity-100",
);

function measureHeaderGridTemplate(header: HTMLElement): string | null {
  const panels = Array.from(header.querySelectorAll<HTMLElement>("[data-panel]"));
  const separators = Array.from(header.querySelectorAll<HTMLElement>("[data-separator]"));
  if (panels.length === 0) {
    return null;
  }

  const tracks: string[] = [];
  panels.forEach((panel, index) => {
    tracks.push(`${panel.getBoundingClientRect().width}px`);
    const separator = separators[index];
    if (separator) {
      tracks.push(`${separator.getBoundingClientRect().width}px`);
    }
  });
  return tracks.join(" ");
}

export default function VirtualListing({
  entries,
  selectedIndex,
  focusedPath,
  gestureHighlightPath,
  multiSelectedPaths,
  cutPaths = [],
  inlineEditPath,
  renameCommittingPath,
  showRenameBusyVisual = false,
  onInlineCommit,
  onInlineCancel,
  ariaLabel,
  columnLabels,
  iconTheme = "dark",
  className,
  sorting: sortingProp,
  onSortingChange,
  listingViewportRef,
  marqueeLayoutRef,
  onViewportPointerDown,
  onEntryPointerDown,
  marqueeActive = false,
  shouldSkipDoubleClickActivate,
}: VirtualListingProps) {
  const cutPathSet = useMemo(() => new Set(cutPaths), [cutPaths]);
  const [internalSorting, setInternalSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const sorting = sortingProp ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;
  const [columnLayout, setColumnLayout] = useState<Layout>(DEFAULT_COLUMN_LAYOUT);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [columnGridTemplate, setColumnGridTemplate] = useState(() =>
    layoutToListingRowGridTemplate(DEFAULT_COLUMN_LAYOUT, 0),
  );

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
  const listingPaths = useMemo(
    () => rows.map((row) => row.original.path),
    [rows],
  );
  const parentRef = useRef<HTMLDivElement | null>(null);
  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      if (listingViewportRef) {
        listingViewportRef.current = node;
      }
    },
    [listingViewportRef],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LISTING_TABLE_ROW_HEIGHT_PX,
    overscan: LISTING_VIRTUAL_OVERSCAN_ROWS,
  });

  const measureColumnGrid = useCallback(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const measured = measureHeaderGridTemplate(header);
    if (measured) {
      setColumnGridTemplate(prependIconColumnToMeasuredGridTemplate(measured));
      return;
    }

    const width = header.clientWidth;
    if (width > 0) {
      setColumnGridTemplate(layoutToListingRowGridTemplate(columnLayout, width));
    }
  }, [columnLayout]);

  useEffect(() => {
    const element = headerRef.current;
    if (!element) {
      return;
    }

    const scheduleMeasure = () => {
      requestAnimationFrame(measureColumnGrid);
    };

    scheduleMeasure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureColumnGrid]);

  const handleColumnLayoutChange = useCallback(
    (layout: Layout) => {
      setColumnLayout(layout);
      requestAnimationFrame(measureColumnGrid);
    },
    [measureColumnGrid],
  );

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < rows.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, rows.length, virtualizer]);

  useEffect(() => {
    if (!marqueeLayoutRef) {
      return;
    }
    marqueeLayoutRef.current = {
      entryCount: listingPaths.length,
      getEntryRects: (scrollElement) =>
        collectTableEntryRects(scrollElement, listingPaths),
      hitTestContentMarquee: (scrollElement, bounds) =>
        hitTestTablePathsWithContentMarquee(
          scrollElement,
          listingPaths,
          bounds,
        ),
      findPathAtClientPoint: (scrollElement, clientX, clientY) =>
        findTablePathAtClientPoint(
          scrollElement,
          listingPaths,
          clientX,
          clientY,
        ),
    };
    return () => {
      marqueeLayoutRef.current = null;
    };
  }, [listingPaths, marqueeLayoutRef]);

  const headerGroup = table.getHeaderGroups()[0];

  return (
    <div
      className={cn(
        "flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card",
        LISTING_ENTRY_TEXT_CLASS,
        className,
      )}
      role="grid"
      aria-label={ariaLabel}
    >
      <div
        ref={headerRef}
        className={cn(
          "group/listing-header peer/listing-header shrink-0 border-b-[0.5px]",
          LISTING_HEADER_ROW_CLASS,
        )}
        role="row"
      >
        {headerGroup ? (
          <div className="flex h-full w-full min-h-0 min-w-0">
            <div
              aria-hidden
              className="shrink-0"
              style={{ width: LISTING_ICON_COLUMN_WIDTH_PX }}
            />
            <ResizablePanelGroup
              orientation="horizontal"
              className={cn(LISTING_PANEL_GROUP_CLASS, "min-w-0 flex-1")}
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
          </div>
        ) : null}
      </div>

      <ScrollArea
        viewportRef={setViewportRef}
        listingViewport
        onViewportPointerDown={onViewportPointerDown}
        className={cn("min-h-0 flex-1", BODY_SCROLL_PEER_HOVER_CLASS)}
        viewportClassName={cn(
          "[&>div]:!block overscroll-contain",
          marqueeActive && "select-none",
        )}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          role="rowgroup"
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            const entry = row.original;
            const isSelected = multiSelectedPaths?.has(entry.path) ?? false;
            const isFocused = focusedPath != null && entry.path === focusedPath;
            const isGestureHighlighted =
              gestureHighlightPath != null && entry.path === gestureHighlightPath;
            const dimmed = shouldDimDotEntry(entry.name, entry.key);
            const isCut = cutPathSet.has(entry.path);
            const isEditing = inlineEditPath === entry.path;

            return (
              <div
                key={entry.key}
                role="row"
                data-listing-entry
                data-listing-path={entry.path}
                data-state={isSelected ? "selected" : undefined}
                className={cn(
                  LISTING_ROW_CLASS,
                  dimmed && "opacity-70",
                  isCut && LISTING_ROW_CUT_CLASS,
                  entry.quickFilterMatched === false && "opacity-40",
                  isSelected &&
                    (isFocused
                      ? LISTING_ROW_FOCUS_SELECTED_CLASS
                      : LISTING_ROW_SELECTED_CLASS),
                  isGestureHighlighted && LISTING_ROW_FOCUS_SELECTED_CLASS,
                )}
                style={{
                  gridTemplateColumns: columnGridTemplate,
                  transform: `translateY(${item.start}px)`,
                  height: `${item.size}px`,
                }}
                onMouseDown={(event) => {
                  if (event.shiftKey) {
                    event.preventDefault();
                  }
                }}
                onClick={(event) => entry.onSelect(event, item.index)}
                onPointerDown={(event) => onEntryPointerDown?.(event, entry.path)}
                onDoubleClick={() => {
                  if (shouldSkipDoubleClickActivate?.()) {
                    return;
                  }
                  entry.onActivate();
                }}
                onContextMenu={entry.onContextMenu}
              >
                <div
                  role="gridcell"
                  className={cn("flex h-9 items-center justify-end", CELL_CLIP)}
                  style={{ gridColumn: 1 }}
                >
                  <FileIcon
                    name={entry.name}
                    isDir={entry.isDir}
                    isSymlink={entry.isSymlink}
                    theme={iconTheme}
                    size="xs"
                  />
                </div>
                {row.getVisibleCells().map((cell, columnIndex) => {
                  const gridColumn = listingDataCellGridColumn(columnIndex);
                  const modifiedTitle =
                    cell.column.id === "modified" &&
                    columnLabels.modifiedTimeFormat === "relative"
                      ? formatModifiedAbsolute(entry.modified, columnLabels.locale) ??
                        undefined
                      : undefined;
                  const isName = columnIndex === 0;
                  const content = isName ? (
                    isEditing && onInlineCommit && onInlineCancel ? (
                      <InlineNameInput
                        initialName={entry.name}
                        busy={renameCommittingPath === entry.path}
                        showBusyVisual={showRenameBusyVisual}
                        onCommit={(name) => onInlineCommit(entry.path, name)}
                        onCancel={() => onInlineCancel(entry.path, entry.name)}
                      />
                    ) : (
                      <TruncatedTextTooltip
                        text={entry.name}
                        className="min-w-0 truncate"
                      />
                    )
                  ) : (
                    flexRender(cell.column.columnDef.cell, cell.getContext())
                  );

                  return (
                    <Fragment key={cell.id}>
                      {columnIndex > 0 ? (
                        <div
                          data-listing-gutter
                          aria-hidden
                          className={BODY_COLUMN_GUTTER_CLASS}
                          style={{ gridColumn: listingColumnGutterGridColumn(columnIndex) }}
                        />
                      ) : null}
                      <div
                        role="gridcell"
                        className={cn("p-0", CELL_CLIP)}
                        style={{ gridColumn }}
                      >
                        <div
                          className={cn(
                            "flex h-9 min-w-0 items-center overflow-hidden px-2",
                            LISTING_ENTRY_TEXT_CLASS,
                            isName && "w-full",
                            columnIndex === 1 && "justify-end text-right",
                          )}
                        >
                          {isName ? (
                            content
                          ) : modifiedTitle ? (
                            <TruncatedTextTooltip text={modifiedTitle} className={CELL_TEXT}>
                              {content}
                            </TruncatedTextTooltip>
                          ) : (
                            <span className={CELL_TEXT}>{content}</span>
                          )}
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

type ListingHeaderColumnProps = {
  header: Header<ListingEntry, unknown>;
  index: number;
  isLast: boolean;
};

function ListingHeaderColumn({ header, index, isLast }: ListingHeaderColumnProps) {
  return (
    <>
      <ResizablePanel
        id={header.column.id}
        defaultSize={`${DEFAULT_COLUMN_LAYOUT[header.column.id]}%`}
        minSize={index === 0 ? 20 : 10}
        className={LISTING_PANEL_CLASS}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </ResizablePanel>
      {!isLast ? <ResizableHandle withHandle className={COLUMN_RESIZE_HANDLE_CLASS} /> : null}
    </>
  );
}
