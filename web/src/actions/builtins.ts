import type { ActionDefinition, BuiltinActionDeps } from "./types";

export type { BuiltinActionDeps };

export function createBuiltinActions(getDeps: () => BuiltinActionDeps): ActionDefinition[] {
  return [
    {
      id: "view.open-command-palette",
      nameKey: "actions.view.openCommandPalette.name",
      descriptionKey: "actions.view.openCommandPalette.description",
      categoryKey: "actions.view.category",
      defaultKeybinding: "Mod+P",
      handler: async () => {
        getDeps().openCommandPalette();
      },
    },
    {
      id: "view.toggle-dot-entries",
      nameKey: "actions.view.toggleDotEntries.name",
      descriptionKey: "actions.view.toggleDotEntries.description",
      categoryKey: "actions.view.category",
      icon: "view.toggle-dot-entries",
      handler: async () => {
        getDeps().toggleShowDotEntries();
      },
    },
    {
      id: "selection.move-down",
      nameKey: "actions.selection.moveDown.name",
      categoryKey: "actions.selection.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "J",
      contexts: ["file-list"],
      handler: async (_context, args) => {
        const deps = getDeps();
        const extendRange = args?.extendRange === true;
        deps.setSelectedIndex(
          (index) => Math.min(index + 1, Math.max(deps.getListingLength() - 1, 0)),
          { extendRange },
        );
      },
    },
    {
      id: "selection.move-up",
      nameKey: "actions.selection.moveUp.name",
      categoryKey: "actions.selection.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "K",
      contexts: ["file-list"],
      handler: async (_context, args) => {
        const extendRange = args?.extendRange === true;
        getDeps().setSelectedIndex((index) => Math.max(index - 1, 0), { extendRange });
      },
    },
    {
      id: "navigation.open",
      nameKey: "actions.navigation.open.name",
      categoryKey: "actions.navigation.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "Enter",
      contexts: ["file-list"],
      handler: async () => {
        getDeps().activateSelected();
      },
    },
    {
      id: "navigation.up",
      nameKey: "actions.navigation.up.name",
      categoryKey: "actions.navigation.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "Backspace",
      contexts: ["file-list"],
      icon: "navigation.up",
      handler: async () => {
        const deps = getDeps();
        const currentPath = deps.getCurrentPath();
        if (currentPath) {
          const parent = currentPath.split("/").slice(0, -1).join("/");
          deps.navigateTo(parent);
        }
      },
    },
    {
      id: "navigation.open-settings",
      nameKey: "actions.navigation.openSettings.name",
      categoryKey: "actions.navigation.category",
      icon: "navigation.open-settings",
      handler: async () => {
        getDeps().openSettings();
      },
    },
    {
      id: "navigation.go-to-path",
      nameKey: "actions.navigation.goToPath.name",
      descriptionKey: "actions.navigation.goToPath.description",
      categoryKey: "actions.navigation.category",
      icon: "navigation.go-to-path",
      args: [{ name: "path", type: "directory-path" }],
      handler: async (_context, args) => {
        const path = String(args?.path ?? "").trim();
        if (path) {
          getDeps().navigateTo(path);
        }
      },
    },
    {
      id: "selection.toggle",
      nameKey: "actions.selection.toggle.name",
      categoryKey: "actions.selection.category",
      when: "focus.pane == 'file-list'",
      defaultKeybinding: "Space",
      contexts: ["file-list"],
      handler: async () => {
        const deps = getDeps();
        const path = deps.getListingPathAt(deps.getSelectedIndex());
        if (path) {
          deps.toggleMultiSelect(path);
        }
      },
    },
    {
      id: "selection.select-all",
      nameKey: "actions.selection.selectAll.name",
      descriptionKey: "actions.selection.selectAll.description",
      categoryKey: "actions.selection.category",
      when:
        "focus.pane == 'file-list' && listing.loaded == true && listing.visible-count > 0",
      paletteWhen: "focus.pane == 'file-list' && listing.loaded == true",
      defaultKeybinding: "Mod+A",
      contexts: ["file-list"],
      handler: async () => {
        getDeps().selectAllVisible();
      },
    },
    {
      id: "selection.clear",
      nameKey: "actions.selection.clear.name",
      categoryKey: "actions.selection.category",
      when: "selection.count > 0",
      whenFailureMessageKey: "actions.whenFailure.selectionRequired",
      contexts: ["file-list"],
      defaultKeybinding: "Escape",
      icon: "selection.clear",
      handler: async () => {
        getDeps().clearSelection();
      },
    },
    {
      id: "selection.copy-paths",
      nameKey: "actions.selection.copyPaths.name",
      categoryKey: "actions.selection.category",
      when: "selection.count > 0",
      whenFailureMessageKey: "actions.whenFailure.selectionRequired",
      contexts: ["file-list"],
      handler: async () => {
        const deps = getDeps();
        const paths = deps.getOperationTargets();
        if (paths.length > 0) {
          await deps.runBulkAction("copy-path", paths);
        }
      },
    },
    {
      id: "file.new-folder",
      nameKey: "actions.file.newFolder.name",
      categoryKey: "actions.file.category",
      when: "focus.pane == 'file-list' && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      icon: "file.new-folder",
      handler: async () => {
        await getDeps().createNewFolder();
      },
    },
    {
      id: "file.rename",
      nameKey: "actions.file.rename.name",
      categoryKey: "actions.file.category",
      when: "focus.pane == 'file-list' && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      defaultKeybinding: "F2",
      icon: "file.rename",
      handler: async () => {
        getDeps().startRename();
      },
    },
    {
      id: "file.copy",
      nameKey: "actions.file.copy.name",
      categoryKey: "actions.file.category",
      when: "(focus.pane == 'file-list' || selection.count > 0) && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      defaultKeybinding: "Mod+C",
      icon: "file.copy",
      handler: async () => {
        getDeps().copySelection();
      },
    },
    {
      id: "file.cut",
      nameKey: "actions.file.cut.name",
      categoryKey: "actions.file.category",
      when: "(focus.pane == 'file-list' || selection.count > 0) && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      defaultKeybinding: "Mod+X",
      icon: "file.cut",
      handler: async () => {
        getDeps().cutSelection();
      },
    },
    {
      id: "file.paste",
      nameKey: "actions.file.paste.name",
      categoryKey: "actions.file.category",
      when: "clipboard.count > 0 && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      defaultKeybinding: "Mod+V",
      icon: "file.paste",
      handler: async () => {
        await getDeps().pasteFromClipboard();
      },
    },
    {
      id: "file.delete",
      nameKey: "actions.file.delete.name",
      categoryKey: "actions.file.category",
      when: "(focus.pane == 'file-list' || selection.count > 0) && server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      contexts: ["file-list", "context-menu"],
      destructive: true,
      confirmMessageKey: "actions.file.delete.confirm",
      defaultKeybinding: "Delete",
      icon: "file.delete",
      handler: async () => {
        const deps = getDeps();
        const paths = deps.getOperationTargets();
        if (paths.length === 0) {
          return;
        }
        await deps.runBulkAction("file.delete", paths);
      },
    },
  ];
}
