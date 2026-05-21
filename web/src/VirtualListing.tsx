import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export type ListingEntry = {
  key: string;
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  extraLabel?: string;
  onActivate: () => void;
  href?: string;
};

type VirtualListingProps = {
  entries: ListingEntry[];
};

export default function VirtualListing({ entries }: VirtualListingProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  return (
    <div ref={parentRef} className="virtual-list" aria-label="Directory listing">
      <div
        className="virtual-list-inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const entry = entries[item.index];
          const content = (
            <>
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
              className="virtual-row"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {entry.href ? (
                <a className="entry" href={entry.href}>
                  {content}
                </a>
              ) : (
                <button type="button" className="entry" onClick={entry.onActivate}>
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
