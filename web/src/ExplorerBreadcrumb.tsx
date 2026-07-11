import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Home, ListFilter, X } from "lucide-react";

import ExplorerNavButtons from "./ExplorerNavButtons";

import { QuestionMarkIcon } from "@/components/icons/QuestionMarkIcon";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { pathForBreadcrumbPartIndex } from "./breadcrumbCollapse";
import { normalizeExplorerPath } from "./explorer/path";
import {
  isValidQuickFilterRegex,
  normalizeQuickFilterQuery,
  parseQuickFilterMode,
} from "./quickFilter";
import { useBreadcrumbPathScroll } from "./useBreadcrumbPathScroll";

const breadcrumbInputGroupClassName =
  "h-7 min-w-0 rounded-lg border-0 bg-background shadow-none dark:bg-background";

const SCROLL_DRAG_THRESHOLD_PX = 4;

type ExplorerBreadcrumbProps = {
  currentPath: string;
  rootAriaLabel: string;
  ariaLabel: string;
  addressBarLabel: string;
  addressBarPlaceholder: string;
  backLabel: string;
  forwardLabel: string;
  refreshLabel: string;
  cancelLabel: string;
  listingLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onNavigate: (path: string) => void;
  quickFilterLabel: string;
  quickFilterPlaceholder: string;
  quickFilterClearLabel: string;
  quickFilterHelpText: string;
  quickFilterValue: string;
  onQuickFilterChange: (value: string) => void;
  onQuickFilterKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  quickFilterInputRef?: RefObject<HTMLInputElement | null>;
  showNavButtons?: boolean;
};

export default function ExplorerBreadcrumb({
  currentPath,
  rootAriaLabel,
  ariaLabel,
  addressBarLabel,
  addressBarPlaceholder,
  backLabel,
  forwardLabel,
  refreshLabel,
  cancelLabel,
  listingLoading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh,
  onCancel,
  onNavigate,
  quickFilterLabel,
  quickFilterPlaceholder,
  quickFilterClearLabel,
  quickFilterHelpText,
  quickFilterValue,
  onQuickFilterChange,
  onQuickFilterKeyDown,
  quickFilterInputRef,
  showNavButtons = true,
}: ExplorerBreadcrumbProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentPath);
  const [quickFilterFocused, setQuickFilterFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const didScrollDragRef = useRef(false);

  const parts = currentPath ? currentPath.split("/") : [];
  const quickFilterActive =
    normalizeQuickFilterQuery(quickFilterValue).length > 0;
  const { scrollRef, showLeftFade, onScroll } = useBreadcrumbPathScroll(
    currentPath,
    !editing,
  );

  const renderSegmentLink = (index: number) => {
    const part = parts[index];
    const path = pathForBreadcrumbPartIndex(parts, index);
    return (
      <BreadcrumbLink asChild>
        <button
          type="button"
          className="cursor-pointer bg-transparent p-0 whitespace-nowrap"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(path);
          }}
        >
          {part}
        </button>
      </BreadcrumbLink>
    );
  };

  useEffect(() => {
    if (!editing) {
      setDraft(currentPath);
    }
  }, [currentPath, editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  }, [editing]);

  const startEditing = useCallback(() => {
    setDraft(currentPath);
    setEditing(true);
  }, [currentPath]);

  const cancelEditing = useCallback(() => {
    setDraft(currentPath);
    setEditing(false);
  }, [currentPath]);

  const commitEditing = useCallback(() => {
    const nextPath = normalizeExplorerPath(draft);
    setEditing(false);
    if (nextPath !== currentPath) {
      onNavigate(nextPath);
    }
  }, [currentPath, draft, onNavigate]);

  const handleRegionClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (editing || didScrollDragRef.current) {
        return;
      }
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      startEditing();
    },
    [editing, startEditing],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
      didScrollDragRef.current = false;
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerDownRef.current;
      if (!start) {
        return;
      }
      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      if (dx > SCROLL_DRAG_THRESHOLD_PX || dy > SCROLL_DRAG_THRESHOLD_PX) {
        didScrollDragRef.current = true;
      }
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    pointerDownRef.current = null;
  }, []);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEditing();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelEditing();
      }
    },
    [cancelEditing, commitEditing],
  );

  const openQuickFilter = useCallback(() => {
    quickFilterInputRef?.current?.focus();
  }, [quickFilterInputRef]);

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-1">
      {showNavButtons ? (
        <ExplorerNavButtons
          backLabel={backLabel}
          forwardLabel={forwardLabel}
          refreshLabel={refreshLabel}
          cancelLabel={cancelLabel}
          listingLoading={listingLoading}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={onBack}
          onForward={onForward}
          onRefresh={onRefresh}
          onCancel={onCancel}
        />
      ) : null}
      <div className="relative flex min-w-0 flex-1 self-stretch items-center gap-0.5 sm:gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={rootAriaLabel}
          disabled={!currentPath}
          onClick={() => onNavigate("")}
        >
          <Home className="size-4" aria-hidden="true" />
        </Button>
        {!editing ? (
          <div
            className={cn(
              "relative h-full min-w-0 flex-1",
              quickFilterFocused && "max-sm:invisible",
            )}
          >
            {showLeftFade ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent"
              />
            ) : null}
            <div
              ref={scrollRef}
              className={cn(
                "no-scrollbar flex h-full min-w-0 items-center overflow-x-auto overflow-y-hidden",
                "cursor-text",
              )}
              onClick={handleRegionClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onScroll={onScroll}
            >
              {parts.length > 0 ? (
                <Breadcrumb aria-label={ariaLabel} className="min-w-max">
                  <BreadcrumbList className="flex-nowrap gap-1 sm:gap-2.5">
                    {parts.map((part, index) => (
                      <span key={`${part}-${index}`} className="contents">
                        <BreadcrumbSeparator className="shrink-0" />
                        <BreadcrumbItem className="shrink-0">
                          {index === parts.length - 1 ? (
                            <BreadcrumbPage className="whitespace-nowrap">
                              {part}
                            </BreadcrumbPage>
                          ) : (
                            renderSegmentLink(index)
                          )}
                        </BreadcrumbItem>
                      </span>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              ) : (
                <div className="h-full min-w-0 flex-1" aria-hidden="true" />
              )}
            </div>
          </div>
        ) : (
          <InputGroup
            className={cn(breadcrumbInputGroupClassName, "min-w-0 flex-1")}
            onClick={(event) => event.stopPropagation()}
          >
            <InputGroupInput
              ref={inputRef}
              aria-label={addressBarLabel}
              placeholder={addressBarPlaceholder}
              value={draft}
              className="px-2 text-sm"
              onBlur={cancelEditing}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleInputKeyDown}
            />
          </InputGroup>
        )}
        <InputGroup
          className={cn(
            breadcrumbInputGroupClassName,
            editing && "max-sm:hidden",
            quickFilterFocused
              ? "max-sm:absolute max-sm:inset-x-0 max-sm:top-1/2 max-sm:z-10 max-sm:flex max-sm:h-7 max-sm:min-w-0 max-sm:max-w-full max-sm:-translate-y-1/2 max-sm:has-[[data-slot=input-group-control]:focus-visible]:ring-inset"
              : "max-sm:pointer-events-none max-sm:absolute max-sm:h-0 max-sm:w-0 max-sm:overflow-hidden max-sm:opacity-0",
            quickFilterFocused ? "max-sm:pr-0" : "pr-1",
            "sm:static sm:flex sm:h-7 sm:w-52 sm:shrink-0 sm:opacity-100 sm:pointer-events-auto md:w-60",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {(() => {
            const mode = parseQuickFilterMode(quickFilterValue);
            const hasRegexError =
              mode?.kind === "regex" && !isValidQuickFilterRegex(mode.pattern);
            return (
              <InputGroupInput
                ref={quickFilterInputRef}
                type="text"
                aria-label={quickFilterLabel}
                placeholder={quickFilterPlaceholder}
                value={quickFilterValue}
                aria-invalid={hasRegexError || undefined}
                className="px-2 text-sm"
                onFocus={() => setQuickFilterFocused(true)}
                onBlur={() => setQuickFilterFocused(false)}
                onChange={(event) => onQuickFilterChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onQuickFilterChange("");
                    event.currentTarget.blur();
                    return;
                  }
                  onQuickFilterKeyDown?.(event);
                }}
              />
            );
          })()}
          <InputGroupAddon align="inline-end" className="gap-0 pr-0.5">
            <span className="inline-flex size-4 shrink-0 items-center justify-center">
              {quickFilterValue.length > 0 ? (
                <InputGroupButton
                  size="icon-xs"
                  className="size-4"
                  aria-label={quickFilterClearLabel}
                  onClick={() => {
                    onQuickFilterChange("");
                    quickFilterInputRef?.current?.focus();
                  }}
                >
                  <X className="size-3" aria-hidden="true" />
                </InputGroupButton>
              ) : null}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex size-4 shrink-0 items-center justify-center select-none"
                  aria-hidden="true"
                >
                  <QuestionMarkIcon className="pointer-events-none size-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={6}
                align="end"
                className="max-w-[22rem] whitespace-pre-line text-xs leading-tight"
              >
                {quickFilterHelpText}
              </TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {!quickFilterFocused && !editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 shrink-0 sm:hidden",
            quickFilterActive && "text-primary",
          )}
          aria-label={quickFilterLabel}
          onClick={openQuickFilter}
        >
          <ListFilter className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
