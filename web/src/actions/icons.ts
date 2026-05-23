import {
  Command,
  FolderOpen,
  ListFilter,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "view.open-command-palette": Command,
  "navigation.focus-search": Search,
  "navigation.go-to-path": FolderOpen,
  "selection.copy-paths": ListFilter,
  "selection.clear": Trash2,
  "file.delete": Trash2,
};

export function actionIcon(id: string): LucideIcon {
  return ICONS[id] ?? Terminal;
}
