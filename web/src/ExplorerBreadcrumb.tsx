import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  ListFilter,
  RefreshCw,
  X,
} from "lucide-react";

import { QuestionMarkIcon } from "@/components/icons/QuestionMarkIcon";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  collapsedBreadcrumbMiddle,
  pathForBreadcrumbPartIndex,
} from "./breadcrumbCollapse";
import { normalizeExplorerPath } from "./explorer/path";
import {
  isValidQuickFilterRegex,
  normalizeQuickFilterQuery,
  parseQuickFilterMode,
} from "./quickFilter";
import { useBreadcrumbMiddleCollapse } from "./useBreadcrumbMiddleCollapse";

const breadcrumbInputGroupClassName =
  "h-7 min-w-0 rounded-lg border-0 bg-background shadow-none dark:bg-background";

type ExplorerBreadcrumbProps = {
  currentPath: string;
  rootAriaLabel: string;
  ariaLabel: string;
  addressBarLabel: string;
  addressBarPlaceholder: string;
  backLabel: string;
  forwardLabel: string;
  refreshLabel: string;
  refreshing: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  hiddenSegmentsMenuLabel: string;
  quickFilterLabel: string;
  quickFilterPlaceholder: string;
  quickFilterClearLabel: string;
  quickFilterHelpText: string;
  quickFilterValue: string;
  onQuickFilterChange: (value: string) => void;
  onQuickFilterKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  quickFilterInputRef?: RefObject<HTMLInputElement | null>;
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
  refreshing,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh,
  onNavigate,
  hiddenSegmentsMenuLabel,
  quickFilterLabel,
  quickFilterPlaceholder,
  quickFilterClearLabel,
  quickFilterHelpText,
  quickFilterValue,
  onQuickFilterChange,
  onQuickFilterKeyDown,
  quickFilterInputRef,
}: ExplorerBreadcrumbProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentPath);
  const [quickFilterFocused, setQuickFilterFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSegmentRef = useRef<HTMLSpanElement>(null);

  const parts = currentPath ? ["", ...currentPath.split("/")] : [""];
  const maxHiddenMiddle = Math.max(0, parts.length - 2);
  const quickFilterActive =
    normalizeQuickFilterQuery(quickFilterValue).length > 0;
  const { listRef, hiddenMiddleCount } = useBreadcrumbMiddleCollapse(
    parts.length,
    currentPath,
    !editing,
    lastSegmentRef,
  );
  const collapsedMiddle = collapsedBreadcrumbMiddle(
    parts.length,
    hiddenMiddleCount,
  );

  const renderRootIcon = () => (
    <Home aria-hidden="true" className="size-4 shrink-0" />
  );

  const renderSegmentLink = (index: number) => {
    const part = parts[index];
    const path = pathForBreadcrumbPartIndex(parts, index);
    const isRoot = index === 0;
    return (
      <BreadcrumbLink asChild>
        <button
          type="button"
          className="cursor-pointer bg-transparent p-0"
          aria-label={isRoot ? rootAriaLabel : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(path);
          }}
        >
          {isRoot ? renderRootIcon() : part}
        </button>
      </BreadcrumbLink>
    );
  };

  const renderCurrentSegment = (index: number) => {
    const part = parts[index];
    const isRoot = index === 0;
    const atMaxCollapse = hiddenMiddleCount >= maxHiddenMiddle;
    return (
      <BreadcrumbPage
        ref={lastSegmentRef}
        className={cn(
          "block whitespace-nowrap",
          atMaxCollapse ? "min-w-0 max-w-full truncate" : "shrink-0",
        )}
      >
        {isRoot ? renderRootIcon() : part}
        {isRoot ? <span className="sr-only">{rootAriaLabel}</span> : null}
      </BreadcrumbPage>
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
      if (editing) {
        return;
      }
      if ((event.target as HTMLElement).closest("button")) {
        return;
      }
      startEditing();
    },
    [editing, startEditing],
  );

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
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={backLabel}
          disabled={!canGoBack}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={forwardLabel}
          disabled={!canGoForward}
          onClick={onForward}
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={refreshLabel}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={cn("size-4", refreshing && "animate-spin")}
            aria-hidden="true"
          />
        </Button>
      </div>
      <div className="relative flex min-w-0 flex-1 self-stretch items-center">
        <div
          className={cn(
            "flex h-full min-w-0 flex-1 items-center overflow-hidden",
            !editing && "cursor-text",
            quickFilterFocused && "max-sm:invisible",
          )}
          onClick={handleRegionClick}
        >
          {editing ? (
            <InputGroup
              className={cn(breadcrumbInputGroupClassName, "w-full flex-1")}
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
          ) : (
            <Breadcrumb aria-label={ariaLabel} className="min-w-0 overflow-hidden">
              <BreadcrumbList
                ref={listRef}
                className="min-w-0 flex-nowrap gap-1 sm:gap-2.5"
              >
                <BreadcrumbItem className="ml-1 shrink-0">
                  {parts.length === 1
                    ? renderCurrentSegment(0)
                    : renderSegmentLink(0)}
                </BreadcrumbItem>
                {collapsedMiddle.showEllipsis ? (
                  <>
                    <BreadcrumbSeparator className="shrink-0" />
                    <BreadcrumbItem className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={hiddenSegmentsMenuLabel}
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <BreadcrumbEllipsis className="size-7" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {collapsedMiddle.hiddenMiddleIndices.map((index) => {
                            const part = parts[index];
                            const path = pathForBreadcrumbPartIndex(parts, index);
                            return (
                              <DropdownMenuItem
                                key={`${part}-${index}`}
                                onClick={() => onNavigate(path)}
                              >
                                {part}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                  </>
                ) : null}
                {collapsedMiddle.visibleMiddleIndices.map((index) => (
                  <span key={`${parts[index]}-${index}`} className="contents">
                    <BreadcrumbSeparator className="shrink-0" />
                    <BreadcrumbItem className="shrink-0">
                      {renderSegmentLink(index)}
                    </BreadcrumbItem>
                  </span>
                ))}
                {parts.length > 1 ? (
                  <>
                    <BreadcrumbSeparator className="shrink-0" />
                    <BreadcrumbItem className="shrink-0">
                      {renderCurrentSegment(parts.length - 1)}
                    </BreadcrumbItem>
                  </>
                ) : null}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>
        <InputGroup
          className={cn(
            breadcrumbInputGroupClassName,
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
                className="max-w-[22rem] whitespace-pre-line text-[11px] leading-tight"
              >
                {quickFilterHelpText}
              </TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {!quickFilterFocused ? (
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
