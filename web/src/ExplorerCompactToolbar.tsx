import type { ReactNode } from "react";

import ExplorerNavButtons from "./ExplorerNavButtons";

type ExplorerCompactToolbarProps = {
  backLabel: string;
  forwardLabel: string;
  refreshLabel: string;
  cancelLabel: string;
  listingLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  ariaLabel: string;
  trailingActions: ReactNode;
};

export default function ExplorerCompactToolbar({
  backLabel,
  forwardLabel,
  refreshLabel,
  cancelLabel,
  listingLoading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh,
  onCancel,
  ariaLabel,
  trailingActions,
}: ExplorerCompactToolbarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between gap-2 px-1"
      role="toolbar"
      aria-label={ariaLabel}
    >
      <ExplorerNavButtons
        backLabel={backLabel}
        forwardLabel={forwardLabel}
        refreshLabel={refreshLabel}
        cancelLabel={cancelLabel}
        listingLoading={listingLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={onBack}
        onForward={onForward}
        onRefresh={onRefresh}
        onCancel={onCancel}
      />
      <div className="flex min-w-0 items-center justify-end gap-0.5">{trailingActions}</div>
    </div>
  );
}
