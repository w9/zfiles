import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export type ListingEntry = {
  key: string;
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  extraLabel?: string;
  thumbnailUrl?: string;
  onSelect: (event: React.MouseEvent) => void;
  onActivate: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  href?: string;
};

type VirtualListingProps = {
  entries: ListingEntry[];
  selectedIndex: number;
  multiSelectedPaths?: Set<string>;
};

export default function VirtualListing({
  entries,
  selectedIndex,
  multiSelectedPaths,
}: VirtualListingProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < entries.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, entries.length, virtualizer]);

  return (
    <div ref={parentRef} className="virtual-list" aria-label="Directory listing">
      <div
        className="virtual-list-inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index];
          const selected = item.index === selectedIndex;
          const multiSelected = multiSelectedPaths?.has(entry.path) ?? false;
          const rowClass = [
            "virtual-row",
            selected ? "selected" : "",
            multiSelected ? "multi-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const content = (
            <>
              {entry.thumbnailUrl ? (
                <img
                  className="thumb"
                  src={entry.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  width={28}
                  height={28}
                />
              ) : null}
              <span className="name">
                {entry.isDir ? "📁" : "📄"} {entry.name}
                {entry.extraLabel ? (
                  <span className="extra"> {entry.extraLabel}</span>
                ) : null}
              </span>
              {!entry.isDir && entry.size != null ? (
                <span className="size">{entry.size} B</span>
              ) : null}
            </>
          );

          return (
            <div
              key={entry.key}
              className={rowClass}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {entry.href ? (
                <a
                  className="entry"
                  href={entry.href}
                  onClick={(event) => {
                    event.preventDefault();
                    entry.onSelect(event);
                  }}
                  onDoubleClick={() => {
                    window.location.href = entry.href!;
                  }}
                  onContextMenu={entry.onContextMenu}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  className="entry"
                  onClick={entry.onSelect}
                  onDoubleClick={entry.onActivate}
                  onContextMenu={entry.onContextMenu}
                >
                  {content}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
