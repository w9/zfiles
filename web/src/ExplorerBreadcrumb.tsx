import { useCallback, useEffect, useRef, useState } from "react";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeExplorerPath } from "./explorer/path";

type ExplorerBreadcrumbProps = {
  currentPath: string;
  rootAriaLabel: string;
  ariaLabel: string;
  addressBarLabel: string;
  onNavigate: (path: string) => void;
};

export default function ExplorerBreadcrumb({
  currentPath,
  rootAriaLabel,
  ariaLabel,
  addressBarLabel,
  onNavigate,
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
    <div
      className={cn("shrink-0 px-3 py-2", !editing && "cursor-text")}
      onClick={handleRegionClick}
    >
      {editing ? (
        <Input
          ref={inputRef}
          aria-label={addressBarLabel}
          value={draft}
          className="h-8"
          onBlur={cancelEditing}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      ) : (
        <Breadcrumb aria-label={ariaLabel}>
          <BreadcrumbList>
            {parts.map((part, index) => {
              const path = parts.slice(1, index + 1).join("/");
              const isRoot = index === 0;
              const isLast = index === parts.length - 1;
              return (
                <span key={`${part}-${index}`} className="contents">
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
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
  );
}
