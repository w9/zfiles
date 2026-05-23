import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionDefinition } from "./types";
import type { ArgSchema } from "./types";

type ConfirmDialogProps = {
  action: ActionDefinition | null;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ActionConfirmDialog({
  action,
  title,
  cancelLabel,
  confirmLabel,
  message,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={action != null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="default" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            {confirmLabel}
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
  value,
  onValueChange,
  onCancel,
  onSubmit,
}: ArgPromptDialogProps) {
  return (
    <Dialog open={action != null && schema != null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
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
