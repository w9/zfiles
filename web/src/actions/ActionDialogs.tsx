import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import LocaleSelect from "@/LocaleSelect";
import { isLocaleArgAction } from "@/i18n/localeLabels";
import { resolveLocale, type Locale } from "@/i18n";
import type { ActionDefinition } from "./types";
import type { ArgSchema } from "./types";

type ConfirmDialogProps = {
  action: ActionDefinition | null;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  workingLabel: string;
  message: string;
  executing?: boolean;
  showExecutingVisual?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ActionConfirmDialog({
  action,
  title,
  cancelLabel,
  confirmLabel,
  workingLabel,
  message,
  executing = false,
  showExecutingVisual = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const showWorkingVisual = executing && showExecutingVisual;

  return (
    <Dialog
      open={action != null}
      onOpenChange={(open) => {
        if (!open && !executing) {
          onCancel();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={executing}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="default"
            className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={executing}
            aria-busy={executing}
          >
            {showWorkingVisual ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {showWorkingVisual ? workingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ArgPromptDialogProps = {
  action: ActionDefinition | null;
  schema: ArgSchema | null;
  title: string;
  placeholder: string;
  cancelLabel: string;
  continueLabel: string;
  labelForKey: (key: string) => string;
  currentLocale: Locale;
  value: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ActionArgPromptDialog({
  action,
  schema,
  title,
  placeholder,
  cancelLabel,
  continueLabel,
  labelForKey,
  currentLocale,
  value,
  onValueChange,
  onCancel,
  onSubmit,
}: ArgPromptDialogProps) {
  const localePrompt = action != null && isLocaleArgAction(action.id);
  const dialogTitle = localePrompt ? labelForKey(action.nameKey) : title;
  const selectedLocale = resolveLocale(value || currentLocale);

  return (
    <Dialog open={action != null && schema != null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        {localePrompt ? (
          <LocaleSelect
            value={selectedLocale}
            onValueChange={(locale) => onValueChange(locale)}
            labelForKey={labelForKey}
          />
        ) : (
          <Input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onSubmit}>
            {continueLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
