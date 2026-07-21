import { Fragment } from "react";
import { flexRender, type Row } from "@tanstack/react-table";

import EntryMediaPreview from "@/EntryMediaPreview";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";
import InlineNameInput from "@/explorer/InlineNameInput";
import {
  ExplorerDragHandle,
  ExplorerEntryDragSource,
} from "@/explorer/ExplorerEntryDnd";
import type { FileIconTheme } from "@/fileIcons";
import { formatModifiedAbsolute } from "@/listing-format";
import { shouldDimDotEntry } from "@/listingFilter";
import { LISTING_ENTRY_TEXT_CLASS } from "@/listing-styles";
import {
  listingColumnGutterGridColumn,
  listingDataCellGridColumn,
} from "@/listing-table-layout";
import type { ListingEntry, ListingColumnLabels } from "@/listing-types";
import { cn } from "@/lib/utils";
import { useGridImagePreviews } from "@/settings/GridImagePreviewsProvider";

const CELL_CLIP = "min-w-0 overflow-hidden";
const CELL_TEXT = cn("block min-w-0 truncate", LISTING_ENTRY_TEXT_CLASS);
const BODY_COLUMN_GUTTER_CLASS = "border-r border-transparent";

const LISTING_ROW_CLASS = cn(
  "absolute left-0 grid w-full cursor-default select-none",
  "hover:bg-accent/60",
  "outline-none focus:outline-none focus-visible:outline-none",
);
const LISTING_ROW_SELECTED_CLASS = "bg-primary/12 hover:bg-primary/16";
const LISTING_ROW_FOCUS_SELECTED_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)] bg-primary/12 hover:bg-primary/16";
const LISTING_ROW_PRESS_INSET_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)]";
const LISTING_ROW_LONG_PRESS_INSET_CLASS =
  "shadow-[inset_0_2px_10px_0_color-mix(in_oklab,var(--primary)_22%,transparent)]";
const LISTING_ROW_CUT_CLASS = "opacity-45";
const LISTING_ROW_DROP_TARGET_CLASS =
  "ring-2 ring-inset ring-primary/50";
const LISTING_ROW_DROP_CANDIDATE_CLASS =
  "ring-2 ring-inset ring-primary/25";

export function VirtualListingEntryRow({
  row,
  itemIndex,
  itemStart,
  itemSize,
  columnGridTemplate,
  isSelected,
  isFocused,
  isGestureHighlighted,
  isGestureInset,
  isCut,
  isDragFaded,
  dropHighlight,
  dropCandidate,
  isEditing,
  entryDragEnabled,
  renameCommittingPath,
  showRenameBusyVisual,
  onInlineCommit,
  onInlineCancel,
  onEntryPointerDown,
  shouldSkipDoubleClickActivate,
  columnLabels,
  iconTheme,
}: {
  row: Row<ListingEntry>;
  itemIndex: number;
  itemStart: number;
  itemSize: number;
  columnGridTemplate: string;
  isSelected: boolean;
  isFocused: boolean;
  isGestureHighlighted: boolean;
  isGestureInset: boolean;
  isCut: boolean;
  isDragFaded: boolean;
  dropHighlight: boolean;
  dropCandidate: boolean;
  isEditing: boolean;
  entryDragEnabled: boolean;
  renameCommittingPath?: string | null;
  showRenameBusyVisual?: boolean;
  onInlineCommit?: (path: string, name: string) => void;
  onInlineCancel?: (path: string, initialName: string) => void;
  onEntryPointerDown?: (
    event: React.PointerEvent<HTMLElement>,
    path: string,
  ) => void;
  shouldSkipDoubleClickActivate?: () => boolean;
  columnLabels: ListingColumnLabels;
  iconTheme: FileIconTheme;
}) {
  const entry = row.original;
  const { enabled: mediaPreviewsEnabled } = useGridImagePreviews();
  const dimmed = shouldDimDotEntry(entry.name, entry.key);
  const canDrag = entryDragEnabled && !isEditing;

  return (
    <ExplorerEntryDragSource
      path={entry.path}
      isDir={entry.isDir}
      isSelected={isSelected}
      enabled={canDrag}
      dropHighlight={dropHighlight}
      dropCandidate={dropCandidate}
    >
      {({ setNodeRef, isDropTarget, isDropCandidate, surfaceProps }) => (
        <div
          ref={setNodeRef}
          role="row"
          data-listing-entry
          data-listing-path={entry.path}
          data-state={isSelected ? "selected" : undefined}
          className={cn(
            LISTING_ROW_CLASS,
            dimmed && "opacity-70",
            (isCut || isDragFaded) && LISTING_ROW_CUT_CLASS,
            entry.quickFilterMatched === false && "opacity-40",
            isSelected &&
              (isFocused && !isGestureHighlighted && !isGestureInset
                ? LISTING_ROW_FOCUS_SELECTED_CLASS
                : LISTING_ROW_SELECTED_CLASS),
            isGestureHighlighted &&
              !isGestureInset &&
              LISTING_ROW_PRESS_INSET_CLASS,
            isGestureInset && LISTING_ROW_LONG_PRESS_INSET_CLASS,
            isDropTarget && LISTING_ROW_DROP_TARGET_CLASS,
            isDropCandidate && LISTING_ROW_DROP_CANDIDATE_CLASS,
          )}
          style={{
            gridTemplateColumns: columnGridTemplate,
            transform: `translateY(${itemStart}px)`,
            height: `${itemSize}px`,
          }}
          onMouseDown={(event) => {
            if (event.shiftKey) {
              event.preventDefault();
            }
          }}
          onClick={(event) => entry.onSelect(event, itemIndex)}
          onPointerDown={(event) => onEntryPointerDown?.(event, entry.path)}
          onDoubleClick={() => {
            if (shouldSkipDoubleClickActivate?.()) {
              return;
            }
            entry.onActivate();
          }}
          onContextMenu={entry.onContextMenu}
          {...surfaceProps}
        >
          <ExplorerDragHandle
            role="gridcell"
            className={cn("flex h-9 items-center justify-end", CELL_CLIP)}
            style={{ gridColumn: 1 }}
          >
            <EntryMediaPreview
              path={entry.path}
              name={entry.name}
              isDir={entry.isDir}
              isSymlink={entry.isSymlink ?? false}
              previewsEnabled={mediaPreviewsEnabled}
              iconTheme={iconTheme}
              pixelSize={16}
              surface="list"
            />
          </ExplorerDragHandle>
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
                <ExplorerDragHandle className="w-fit max-w-full min-w-0 truncate">
                  <TruncatedTextTooltip
                    text={entry.name}
                    className="min-w-0 truncate"
                  />
                </ExplorerDragHandle>
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
                    style={{
                      gridColumn: listingColumnGutterGridColumn(columnIndex),
                    }}
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
      )}
    </ExplorerEntryDragSource>
  );
}
