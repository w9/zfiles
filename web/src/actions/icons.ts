import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Command,
  Copy,
  Download,
  Eye,
  FolderOpen,
  FolderPlus,
  ListFilter,
  PanelRightOpen,
  Pencil,
  Play,
  Scissors,
  Settings,
  Square,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "view.open-command-palette": Command,
  "view.toggle-dot-entries": Eye,
  "navigation.open": ArrowRight,
  "navigation.up": ArrowUpToLine,
  "navigation.open-settings": Settings,
  "navigation.go-to-path": FolderOpen,
  "selection.move-down": ArrowDown,
  "selection.move-up": ArrowUp,
  "selection.move-left": ArrowLeft,
  "selection.move-right": ArrowRight,
  "selection.toggle": Square,
  "selection.select-all": CheckCheck,
  "selection.clear": X,
  "selection.copy-paths": ListFilter,
  "selection.download": Download,
  "file.new-folder": FolderPlus,
  "file.rename": Pencil,
  "file.copy": Copy,
  "file.cut": Scissors,
  "file.paste": ClipboardPaste,
  "file.delete": Trash2,
  "preview.open-sheet": PanelRightOpen,
  "viewer.slideshow": Play,
  "viewer.next-image": ChevronRight,
  "viewer.prev-image": ChevronLeft,
};

export function actionIcon(id: string): LucideIcon | null {
  return ICONS[id] ?? null;
}

export function actionIconWithFallback(id: string): LucideIcon {
  return ICONS[id] ?? Terminal;
}
