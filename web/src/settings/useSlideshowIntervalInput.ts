import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import {
  SLIDESHOW_INTERVAL_MAX,
  SLIDESHOW_INTERVAL_MIN,
  commitSlideshowIntervalDraft,
} from "./slideshowSettings";

type UseSlideshowIntervalInputOptions = {
  onDraftChange?: () => void;
  confirmOnEnter?: boolean;
  cancelOnEscape?: boolean;
};

export function useSlideshowIntervalInput(
  intervalSeconds: number,
  setIntervalSeconds: (value: number) => void,
  options: UseSlideshowIntervalInputOptions = {},
) {
  const [draft, setDraft] = useState<string | null>(null);
  const skipBlurCommitRef = useRef(false);

  const commitDraft = useCallback(
    (raw: string) => {
      setIntervalSeconds(commitSlideshowIntervalDraft(raw, intervalSeconds));
      setDraft(null);
    },
    [intervalSeconds, setIntervalSeconds],
  );

  const onFocus = useCallback(() => {
    setDraft(String(intervalSeconds));
  }, [intervalSeconds]);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      options.onDraftChange?.();
      setDraft(event.target.value);
    },
    [options.onDraftChange],
  );

  const onBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        setDraft(null);
        return;
      }
      commitDraft(event.target.value);
    },
    [commitDraft],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && options.confirmOnEnter) {
        event.preventDefault();
        commitDraft(event.currentTarget.value);
        event.currentTarget.blur();
        return;
      }
      if (event.key === "Escape" && options.cancelOnEscape) {
        event.preventDefault();
        skipBlurCommitRef.current = true;
        setDraft(null);
        event.currentTarget.blur();
      }
    },
    [commitDraft, options.cancelOnEscape, options.confirmOnEnter],
  );

  return {
    value: draft ?? String(intervalSeconds),
    onFocus,
    onChange,
    onBlur,
    onKeyDown,
    min: SLIDESHOW_INTERVAL_MIN,
    max: SLIDESHOW_INTERVAL_MAX,
    step: "any" as const,
  };
}
