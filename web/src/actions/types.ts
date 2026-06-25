import type { ContextKeys } from "./contextKeys";
import type { ListingViewMode } from "../listingView";

export type ArgDefault =
  | { from: "selection" }
  | { from: "selection.first" }
  | { from: "current-path" }
  | { from: "context-key"; key: string }
  | { from: "value"; value: unknown };

export type ArgSchema = {
  name: string;
  type: "string" | "file-path" | "file-paths" | "directory-path";
  default?: ArgDefault;
};

export type ActionHandler = (
  context: ContextKeys,
  args?: Record<string, unknown>,
) => void | Promise<void>;

export type ActionDefinition = {
  id: string;
  nameKey: string;
  descriptionKey?: string;
  categoryKey: string;
  aliasKeys?: string[];
  icon?: string;
  when?: string;
  paletteWhen?: string;
  contexts?: string[];
  defaultKeybinding?: string;
  destructive?: boolean;
  confirmMessageKey?: string;
  whenFailureMessageKey?: string;
  args?: ArgSchema[];
  handler: ActionHandler;
};

export type KeybindingDefinition = {
  key: string;
  command: string;
  when?: string;
  args?: Record<string, unknown>;
};

export type BuiltinActionDeps = {
  getListingLength: () => number;
  getListingViewMode: () => ListingViewMode;
  getGridColumnCount: () => number;
  getGridSectionFolderCount: () => number;
  getSelectedIndex: () => number;
  getSelectedPaths: () => string[];
  getCurrentPath: () => string;
  setSelectedIndex: (
    updater: (index: number) => number,
    options?: { extendRange?: boolean },
  ) => void;
  activateSelected: () => void;
  navigateTo: (path: string) => void;
  toggleMultiSelect: (path: string) => void;
  clearSelection: () => void;
  openCommandPalette: () => void;
  openSettings: () => void;
  toggleShowDotEntries: () => void;
  runBulkAction: (actionId: string, paths: string[]) => Promise<void>;
  getDownloadablePaths: () => string[];
  downloadPaths: (paths: string[]) => Promise<void>;
  confirmAction: (
    messageKey: string,
    params?: Record<string, string>,
  ) => Promise<boolean>;
  getListingPathAt: (index: number) => string | null;
  getOperationTargets: () => string[];
  getPrimaryPath: () => string | null;
  copySelection: () => void;
  cutSelection: () => void;
  pasteFromClipboard: () => Promise<void>;
  createNewFolder: () => Promise<void>;
  startRename: () => void;
  runWithPending: (actionId: string, fn: () => Promise<void>) => Promise<void>;
  selectAllVisible: () => void;
  toggleListingViewMode: (options?: { global?: boolean }) => void;
  applyGlobalListingSettings: () => void;
  resetGridCardSize: () => void;
  toggleSelectionMode: () => void;
};
