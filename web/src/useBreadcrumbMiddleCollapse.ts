import { useLayoutEffect, useRef, useState, type RefObject } from "react";

function lastSegmentTruncated(lastSegment: HTMLElement | null): boolean {
  if (!lastSegment) {
    return false;
  }
  return lastSegment.scrollWidth > lastSegment.clientWidth + 1;
}

export function useBreadcrumbMiddleCollapse(
  partCount: number,
  pathKey: string,
  enabled: boolean,
  lastSegmentRef: RefObject<HTMLElement | null>,
) {
  const listRef = useRef<HTMLOListElement>(null);
  const [hiddenMiddleCount, setHiddenMiddleCount] = useState(0);
  const containerWidthRef = useRef(0);

  useLayoutEffect(() => {
    setHiddenMiddleCount(0);
    containerWidthRef.current = 0;
  }, [pathKey]);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    const list = listRef.current;
    if (!list) {
      return;
    }

    const maxHidden = Math.max(0, partCount - 2);

    const adjust = () => {
      if (partCount <= 2) {
        setHiddenMiddleCount((current) => (current === 0 ? current : 0));
        return;
      }

      const width = list.clientWidth;
      const overflowing = list.scrollWidth > list.clientWidth + 1;
      const lastTruncated = lastSegmentTruncated(lastSegmentRef.current);
      const needsCollapse = overflowing || lastTruncated;
      const previousWidth = containerWidthRef.current;
      containerWidthRef.current = width;

      setHiddenMiddleCount((current) => {
        if (needsCollapse) {
          return current < maxHidden ? current + 1 : current;
        }
        if (current > 0 && width > previousWidth) {
          return current - 1;
        }
        return current;
      });
    };

    adjust();

    const observer = new ResizeObserver(adjust);
    observer.observe(list);
    const container = list.parentElement;
    if (container) {
      observer.observe(container);
    }

    return () => observer.disconnect();
  }, [enabled, hiddenMiddleCount, lastSegmentRef, partCount, pathKey]);

  return { listRef, hiddenMiddleCount };
}
