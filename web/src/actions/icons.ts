import {
  ClipboardPaste,
  Command,
  Copy,
  Eye,
  FolderOpen,
  FolderPlus,
  ListFilter,
  Pencil,
  Scissors,
  Settings,
  Terminal,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "view.open-command-palette": Command,
  "view.toggle-dot-entries": Eye,
  "navigation.go-to-path": FolderOpen,
  "navigation.open-settings": Settings,
  "selection.copy-paths": ListFilter,
  "selection.clear": Trash2,
  "file.new-folder": FolderPlus,
  "file.rename": Pencil,
  "file.copy": Copy,
  "file.cut": Scissors,
  "file.paste": ClipboardPaste,
  "file.delete": Trash2,
};

export function actionIcon(id: string): LucideIcon {
  return ICONS[id] ?? Terminal;
}
