import { useCallback, useState, type ReactNode } from "react";

import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

type MetadataValueRowProps = {
  rowKey: string;
  label: string;
  copyText?: string | null;
  children: ReactNode;
  valueClassName?: string;
};

export default function MetadataValueRow({
  rowKey,
  label,
  copyText,
  children,
  valueClassName,
}: MetadataValueRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canCopy = copyText != null && copyText.length > 0;

  const onCopy = useCallback(async () => {
    if (!canCopy) {
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }, [canCopy, copyText]);

  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1">
        {canCopy ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            aria-label={t("preview.copyValue", { label })}
            onClick={() => void onCopy()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        ) : null}
        <div className={cn("min-w-0 flex-1", valueClassName)}>{children}</div>
      </dd>
    </div>
  );
}
