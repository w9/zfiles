import { useEffect, useState } from "react";

import {
  compactTouchChromeMediaQuery,
  isCompactTouchChromeLayout,
} from "./compactTouchChrome";

export function useCompactTouchChrome(touchUi: boolean): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return isCompactTouchChromeLayout(touchUi, window.innerWidth);
  });

  useEffect(() => {
    const media = window.matchMedia(compactTouchChromeMediaQuery());
    const update = () => {
      setCompact(isCompactTouchChromeLayout(touchUi, window.innerWidth));
    };
    update();
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [touchUi]);

  return compact;
}
