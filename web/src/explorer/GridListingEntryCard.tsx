import GridCardPreview from "@/GridCardPreview";
import InlineNameInput from "@/explorer/InlineNameInput";
import {
  ExplorerDragHandle,
  ExplorerEntryDragSource,
} from "@/explorer/ExplorerEntryDnd";
import type { FileIconTheme } from "@/fileIcons";
import { shouldDimDotEntry } from "@/listingFilter";
import { LISTING_ENTRY_TEXT_CLASS } from "@/listing-styles";
import type { ListingEntry } from "@/listing-types";
import { cn } from "@/lib/utils";
import { TruncatedTextTooltip } from "@/components/truncated-text-tooltip";

const GRID_ITEM_SELECTED_CLASS = "bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_FOCUS_SELECTED_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)] bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_PRESS_INSET_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)]";
const GRID_ITEM_SELECTED_PRESS_INSET_CLASS =
  "shadow-[inset_0_1px_6px_0_color-mix(in_oklab,var(--primary)_12%,transparent)] bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_LONG_PRESS_INSET_CLASS =
  "shadow-[inset_0_2px_10px_0_color-mix(in_oklab,var(--primary)_22%,transparent)]";
const GRID_ITEM_SELECTED_LONG_PRESS_INSET_CLASS =
  "shadow-[inset_0_2px_10px_0_color-mix(in_oklab,var(--primary)_22%,transparent)] bg-primary/12 hover:bg-primary/16";
const GRID_ITEM_RESIZING_CLASS =
  "shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_55%,transparent)]";
const GRID_ITEM_CUT_CLASS = "opacity-45";
const GRID_ITEM_DROP_TARGET_CLASS =
  "bg-primary/20 ring-2 ring-inset ring-primary/50";

export function GridListingEntryCard({
  entry,
  index,
  cardWidth,
  cardHeight,
  hitExpand,
  isSelected,
  isFocused,
  isGestureHighlighted,
  isGestureInset,
  isCut,
  isDragFaded,
  isEditing,
  isResizing,
  dropHighlight,
  entryDragEnabled,
  renameCommittingPath,
  showRenameBusyVisual,
  onInlineCommit,
  onInlineCancel,
  onEntryPointerDown,
  shouldSkipDoubleClickActivate,
  previewsEnabled,
  iconTheme,
  iconPixelSize,
  resizeHandleLabel,
  onResizePointerDown,
  onResizeDoubleClick,
}: {
  entry: ListingEntry;
  index: number;
  cardWidth: number;
  cardHeight: number;
  hitExpand: { top: number; right: number; bottom: number; left: number };
  isSelected: boolean;
  isFocused: boolean;
  isGestureHighlighted: boolean;
  isGestureInset: boolean;
  isCut: boolean;
  isDragFaded: boolean;
  isEditing: boolean;
  isResizing: boolean;
  dropHighlight: boolean;
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
  previewsEnabled: boolean;
  iconTheme: FileIconTheme;
  iconPixelSize: number;
  resizeHandleLabel: string;
  onResizePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeDoubleClick: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const dimmed = shouldDimDotEntry(entry.name, entry.key);
  const canDrag = entryDragEnabled && !isEditing;

  return (
    <div
      className="group relative"
      style={{
        width: cardWidth,
        height: cardHeight,
      }}
    >
      <ExplorerEntryDragSource
        path={entry.path}
        isDir={entry.isDir}
        isSelected={isSelected}
        enabled={canDrag}
        dropHighlight={dropHighlight}
      >
        {({ setNodeRef, isDropTarget, surfaceProps }) => (
          <button
            ref={setNodeRef}
            type="button"
            data-listing-entry
            data-listing-path={entry.path}
            className="absolute select-none outline-none focus:outline-none focus-visible:outline-none"
            style={{
              top: -hitExpand.top,
              right: -hitExpand.right,
              bottom: -hitExpand.bottom,
              left: -hitExpand.left,
            }}
            onMouseDown={(event) => {
              if (event.shiftKey) {
                event.preventDefault();
              }
            }}
            onClick={(event) => entry.onSelect(event, index)}
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
            <div
              className={cn(
                "absolute flex flex-col overflow-hidden hover:bg-accent/40",
                dimmed && "opacity-70",
                (isCut || isDragFaded) && GRID_ITEM_CUT_CLASS,
                entry.quickFilterMatched === false && "opacity-40",
                isResizing && GRID_ITEM_RESIZING_CLASS,
                isSelected &&
                  !isResizing &&
                  !isGestureHighlighted &&
                  !isGestureInset &&
                  (isFocused
                    ? GRID_ITEM_FOCUS_SELECTED_CLASS
                    : GRID_ITEM_SELECTED_CLASS),
                isSelected &&
                  !isResizing &&
                  isGestureHighlighted &&
                  !isGestureInset &&
                  GRID_ITEM_SELECTED_PRESS_INSET_CLASS,
                isSelected &&
                  !isResizing &&
                  isGestureInset &&
                  GRID_ITEM_SELECTED_LONG_PRESS_INSET_CLASS,
                !isSelected &&
                  isGestureHighlighted &&
                  !isGestureInset &&
                  !isResizing &&
                  GRID_ITEM_PRESS_INSET_CLASS,
                !isSelected &&
                  isGestureInset &&
                  !isResizing &&
                  GRID_ITEM_LONG_PRESS_INSET_CLASS,
                isDropTarget && GRID_ITEM_DROP_TARGET_CLASS,
              )}
              style={{
                top: hitExpand.top,
                left: hitExpand.left,
                width: cardWidth,
                height: cardHeight,
              }}
            >
              <ExplorerDragHandle className="min-h-0 min-w-0 flex-1">
                <GridCardPreview
                  path={entry.path}
                  name={entry.name}
                  isDir={entry.isDir}
                  isSymlink={entry.isSymlink ?? false}
                  previewsEnabled={previewsEnabled}
                  iconTheme={iconTheme}
                  pixelSize={iconPixelSize}
                />
              </ExplorerDragHandle>
              <div
                className={cn(
                  "shrink-0 px-2 py-1.5 text-center",
                  LISTING_ENTRY_TEXT_CLASS,
                )}
              >
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
                  <ExplorerDragHandle className="mx-auto w-fit max-w-full">
                    <TruncatedTextTooltip
                      text={entry.name}
                      className="block truncate"
                    />
                  </ExplorerDragHandle>
                )}
              </div>
            </div>
          </button>
        )}
      </ExplorerEntryDragSource>
      <div
        role="separator"
        aria-label={resizeHandleLabel}
        data-grid-resize-handle
        data-prevent-marquee
        className={cn(
          "absolute bottom-0 right-0 z-10 flex h-4 w-4 translate-x-0.5 translate-y-0.5 cursor-nwse-resize items-end justify-end p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        )}
        onPointerDown={onResizePointerDown}
        onDoubleClick={onResizeDoubleClick}
      >
        <span
          aria-hidden
          className="h-2.5 w-2.5 border-r-2 border-b-2 border-muted-foreground/70"
        />
      </div>
    </div>
  );
}
