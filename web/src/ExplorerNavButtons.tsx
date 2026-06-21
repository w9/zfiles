import { ArrowLeft, ArrowRight, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExplorerNavButtonsProps = {
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
  className?: string;
};

export default function ExplorerNavButtons({
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
  className,
}: ExplorerNavButtonsProps) {
  return (
    <div className={className ?? "flex shrink-0 items-center gap-0.5"}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 touch-ui:h-11 touch-ui:w-11"
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
        className="size-7 shrink-0 touch-ui:h-11 touch-ui:w-11"
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
        className="size-7 shrink-0 touch-ui:h-11 touch-ui:w-11"
        aria-label={listingLoading ? cancelLabel : refreshLabel}
        onClick={listingLoading ? onCancel : onRefresh}
      >
        {listingLoading ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
