import { Check, Cloud, HardDrive, MoreVertical, Plus, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatSize } from "@/listing-format";
import { connectionSubtitle } from "./connectionSubtitle";
import type { ConnectionRecord } from "./types";

type ConnectionDialogProps = {
  open: boolean;
  connections: ConnectionRecord[];
  activeId: string;
  manageable: boolean;
  busy: boolean;
  /** Bytes this origin is using, shown against Browser storage. */
  browserUsageBytes?: number | null;
  hasStoredCredentials: (id: string) => boolean;
  onActivate: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onForgetKeys: (id: string) => void;
  onRemove: (id: string) => void;
  onSaveEphemeral: () => void;
  onClose: () => void;
};

const KIND_ICONS = {
  browser: HardDrive,
  s3: Cloud,
  kernel: Server,
} as const;

const KIND_NAME_KEYS: Record<ConnectionRecord["kind"], MessageKey | null> = {
  browser: "backend.browserStorage",
  kernel: "backend.connectedBackend.zfilesServer",
  s3: null,
};

const KIND_SUBTITLE_KEYS: Record<ConnectionRecord["kind"], MessageKey | null> = {
  browser: "connections.browserSubtitle",
  kernel: "connections.kernelSubtitle",
  s3: null,
};

export function connectionDisplayName(
  record: ConnectionRecord,
  t: (key: MessageKey, params?: Record<string, string>) => string,
): string {
  const key = KIND_NAME_KEYS[record.kind];
  return key ? t(key) : record.name;
}

export default function ConnectionDialog({
  open,
  connections,
  activeId,
  manageable,
  busy,
  browserUsageBytes = null,
  hasStoredCredentials,
  onActivate,
  onCreate,
  onEdit,
  onDuplicate,
  onForgetKeys,
  onRemove,
  onSaveEphemeral,
  onClose,
}: ConnectionDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("connections.title")}</DialogTitle>
          <DialogDescription>{t("connections.description")}</DialogDescription>
        </DialogHeader>

        <ul className="flex min-w-0 flex-col gap-1">
          {connections.map((record) => {
            const Icon = KIND_ICONS[record.kind];
            const active = record.id === activeId;
            const subtitleKey = KIND_SUBTITLE_KEYS[record.kind];
            let subtitle = subtitleKey ? t(subtitleKey) : connectionSubtitle(record);
            if (record.kind === "browser" && browserUsageBytes != null) {
              subtitle = `${subtitle} · ${formatSize(browserUsageBytes, false)}`;
            }
            return (
              <li key={record.id} className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-md px-3 py-2 text-left transition-colors",
                    "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active && "bg-accent/60",
                  )}
                  disabled={busy}
                  aria-current={active}
                  onClick={() => onActivate(record.id)}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <span className="truncate text-sm font-medium">
                      {connectionDisplayName(record, t)}
                    </span>
                    {subtitle ? (
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={subtitle}
                      >
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-success" aria-hidden />
                  ) : null}
                  <span className="sr-only">
                    {active ? t("connections.active") : t("connections.activate")}
                  </span>
                </button>
                {manageable && record.kind === "s3" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={t("connections.rowActions")}
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {record.ephemeral ? (
                        <DropdownMenuItem onSelect={onSaveEphemeral}>
                          {t("connections.saveConnection")}
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => onEdit(record.id)}>
                            {t("connections.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onDuplicate(record.id)}>
                            {t("connections.duplicate")}
                          </DropdownMenuItem>
                          {hasStoredCredentials(record.id) ? (
                            <DropdownMenuItem onSelect={() => onForgetKeys(record.id)}>
                              {t("connections.forgetKeys")}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => onRemove(record.id)}
                          >
                            {t("connections.delete")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            );
          })}
        </ul>

        <DialogFooter className="sm:justify-between">
          {manageable ? (
            <Button type="button" variant="outline" onClick={onCreate} disabled={busy}>
              <Plus className="size-4" />
              {t("connections.create")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("connect.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
