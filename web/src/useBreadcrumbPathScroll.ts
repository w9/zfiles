import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  breadcrumbPathScrollLeftMax,
  breadcrumbPathShowsLeftFade,
} from "./breadcrumbCollapse";

export function useBreadcrumbPathScroll(pathKey: string, enabled: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);

  const syncFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setShowLeftFade(breadcrumbPathShowsLeftFade(el.scrollLeft));
  }, []);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollLeft = breadcrumbPathScrollLeftMax(el.scrollWidth, el.clientWidth);
    setShowLeftFade(breadcrumbPathShowsLeftFade(el.scrollLeft));
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      setShowLeftFade(false);
      return;
    }

    scrollToEnd();

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const observer = new ResizeObserver(() => {
      scrollToEnd();
    });
    observer.observe(el);
    const content = el.firstElementChild;
    if (content) {
      observer.observe(content);
    }

    return () => observer.disconnect();
  }, [enabled, pathKey, scrollToEnd]);

  return { scrollRef, showLeftFade, onScroll: syncFade };
}
