import ChordKbd from "@/actions/ChordKbd";
import {
  groupShortcutDialogRows,
  shortcutDialogRows,
} from "@/actions/shortcutDialogRows";
import type { ActionDefinition, KeybindingDefinition } from "@/actions/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";

type KeyboardShortcutsDialogProps = {
  open: boolean;
  actions: ActionDefinition[];
  keybindings: KeybindingDefinition[];
  labelForKey: (key: string) => string;
  onOpenChange: (open: boolean) => void;
};

export default function KeyboardShortcutsDialog({
  open,
  actions,
  keybindings,
  labelForKey,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation();
  const groups = groupShortcutDialogRows(
    shortcutDialogRows(actions, keybindings, labelForKey),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(32rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{t("shortcuts.dialog.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("shortcuts.dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-4">
            {groups.map((group) => (
              <section key={group.categoryKey} className="space-y-2">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {labelForKey(group.categoryKey)}
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {group.rows.map((row, index) => (
                    <li
                      key={`${row.chord}-${row.actionLabel}-${index}`}
                      className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 text-foreground">{row.actionLabel}</span>
                      <ChordKbd chord={row.chord} className="shrink-0" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
