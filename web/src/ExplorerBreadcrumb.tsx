import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Home, RefreshCw, X } from "lucide-react";

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
import { Input } from "@/components/ui/input";
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
import { normalizeExplorerPath } from "./explorer/path";
import {
  isValidQuickFilterRegex,
  parseQuickFilterMode,
} from "./quickFilter";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = currentPath ? ["", ...currentPath.split("/")] : [""];

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
      <div
        className={cn("min-w-0 flex-1", !editing && "cursor-text")}
        onClick={handleRegionClick}
      >
        {editing ? (
          <Input
            ref={inputRef}
            aria-label={addressBarLabel}
            placeholder={addressBarPlaceholder}
            value={draft}
            className="h-full w-full rounded-none border-0 p-0 text-sm leading-5 shadow-none focus-visible:ring-0"
            onBlur={cancelEditing}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        ) : (
          <Breadcrumb aria-label={ariaLabel} className="min-w-0 overflow-hidden">
            <BreadcrumbList className="flex-nowrap">
              {parts.map((part, index) => {
                const path = parts.slice(1, index + 1).join("/");
                const isRoot = index === 0;
                const isLast = index === parts.length - 1;
                return (
                  <span key={`${part}-${index}`} className="contents">
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem className={isRoot ? "ml-1" : undefined}>
                      {isLast ? (
                        <BreadcrumbPage>
                          {isRoot ? (
                            <Home
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                          ) : (
                            part
                          )}
                          {isRoot ? (
                            <span className="sr-only">{rootAriaLabel}</span>
                          ) : null}
                        </BreadcrumbPage>
                      ) : (
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
                            {isRoot ? (
                              <Home
                                aria-hidden="true"
                                className="size-4 shrink-0"
                              />
                            ) : (
                              part
                            )}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <InputGroup
        className="h-7 min-w-0 shrink-0 rounded-lg border-0 bg-background pr-1 shadow-none dark:bg-background sm:w-52 md:w-60"
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
  );
}
