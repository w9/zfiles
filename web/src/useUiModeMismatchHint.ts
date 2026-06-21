import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/i18n";
import {
  readUiModeHintDismissed,
  storeUiModeHintDismissed,
  type ResolvedUiMode,
  type UiMode,
} from "./uiMode";

type UseUiModeMismatchHintOptions = {
  resolved: ResolvedUiMode;
  setMode: (mode: UiMode) => void;
};

export function useUiModeMismatchHint({
  resolved,
  setMode,
}: UseUiModeMismatchHintOptions): void {
  const { t } = useTranslation();
  const resolvedRef = useRef(resolved);
  const setModeRef = useRef(setMode);
  const touchToastShownRef = useRef(false);
  const mouseToastShownRef = useRef(false);

  resolvedRef.current = resolved;
  setModeRef.current = setMode;

  const showTouchHint = useCallback(() => {
    if (touchToastShownRef.current || readUiModeHintDismissed("touch")) {
      return;
    }
    touchToastShownRef.current = true;
    toast.message(t("uiMode.hint.touchOnMouse.message"), {
      duration: 10_000,
      action: {
        label: t("uiMode.hint.touchOnMouse.switch"),
        onClick: () => setModeRef.current("touch"),
      },
      cancel: {
        label: t("uiMode.hint.dismiss"),
        onClick: () => storeUiModeHintDismissed("touch"),
      },
      onDismiss: () => {
        touchToastShownRef.current = false;
      },
      onAutoClose: () => {
        touchToastShownRef.current = false;
      },
    });
  }, [t]);

  const showMouseHint = useCallback(() => {
    if (mouseToastShownRef.current || readUiModeHintDismissed("mouse")) {
      return;
    }
    mouseToastShownRef.current = true;
    toast.message(t("uiMode.hint.mouseOnTouch.message"), {
      duration: 10_000,
      action: {
        label: t("uiMode.hint.mouseOnTouch.switch"),
        onClick: () => setModeRef.current("mouse"),
      },
      cancel: {
        label: t("uiMode.hint.dismiss"),
        onClick: () => storeUiModeHintDismissed("mouse"),
      },
      onDismiss: () => {
        mouseToastShownRef.current = false;
      },
      onAutoClose: () => {
        mouseToastShownRef.current = false;
      },
    });
  }, [t]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" && resolvedRef.current === "mouse") {
        showTouchHint();
        return;
      }
      if (event.pointerType === "mouse" && resolvedRef.current === "touch") {
        showMouseHint();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [showMouseHint, showTouchHint]);
}
