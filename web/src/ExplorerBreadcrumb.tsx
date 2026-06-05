import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CaseSensitive,
  Home,
  RefreshCw,
  Regex,
  WholeWord,
  X,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { normalizeExplorerPath } from "./explorer/path";
import type { QuickFilterOptions } from "./quickFilter";

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
  quickFilterCaseSensitiveLabel: string;
  quickFilterWholeWordLabel: string;
  quickFilterRegexLabel: string;
  quickFilterClearLabel: string;
  quickFilterValue: string;
  quickFilterOptions: QuickFilterOptions;
  onQuickFilterChange: (value: string) => void;
  onQuickFilterOptionsChange: (options: QuickFilterOptions) => void;
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
  quickFilterCaseSensitiveLabel,
  quickFilterWholeWordLabel,
  quickFilterRegexLabel,
  quickFilterClearLabel,
  quickFilterValue,
  quickFilterOptions,
  onQuickFilterChange,
  onQuickFilterOptionsChange,
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

  const toggleOption = useCallback(
    (key: keyof QuickFilterOptions) => {
      onQuickFilterOptionsChange({
        ...quickFilterOptions,
        [key]: !quickFilterOptions[key],
      });
    },
    [onQuickFilterOptionsChange, quickFilterOptions],
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
        className="h-7 min-w-0 shrink-0 rounded-lg pr-1 sm:w-52 md:w-60"
        onClick={(event) => event.stopPropagation()}
      >
        <InputGroupInput
          ref={quickFilterInputRef}
          type="text"
          aria-label={quickFilterLabel}
          placeholder={quickFilterPlaceholder}
          value={quickFilterValue}
          className="px-2 text-sm"
          onChange={(event) => onQuickFilterChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onQuickFilterChange("");
              event.currentTarget.blur();
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="gap-0 pr-1">
          {quickFilterValue.length > 0 ? (
            <InputGroupButton
              size="icon-xs"
              aria-label={quickFilterClearLabel}
              onClick={() => {
                onQuickFilterChange("");
                quickFilterInputRef?.current?.focus();
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </InputGroupButton>
          ) : null}
          <InputGroupButton
            size="icon-xs"
            aria-label={quickFilterCaseSensitiveLabel}
            aria-pressed={quickFilterOptions.caseSensitive}
            className={cn(
              quickFilterOptions.caseSensitive &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => toggleOption("caseSensitive")}
          >
            <CaseSensitive className="size-3.5" aria-hidden="true" />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label={quickFilterWholeWordLabel}
            aria-pressed={quickFilterOptions.wholeWord}
            className={cn(
              quickFilterOptions.wholeWord &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => toggleOption("wholeWord")}
          >
            <WholeWord className="size-3.5" aria-hidden="true" />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label={quickFilterRegexLabel}
            aria-pressed={quickFilterOptions.useRegex}
            className={cn(
              quickFilterOptions.useRegex &&
                "bg-accent text-accent-foreground",
            )}
            onClick={() => toggleOption("useRegex")}
          >
            <Regex className="size-3.5" aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
