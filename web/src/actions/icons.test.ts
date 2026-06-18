import assert from "node:assert/strict";
import test from "node:test";

import { createBuiltinActions } from "./builtins";
import { createHelpActions } from "./helpActions";
import { createPreviewViewerActions } from "./previewViewerActions";
import { createPreviewActions } from "./previewActions";
import { actionIcon } from "./icons";

const noop = async () => {};

function allRegisteredActionIds(): string[] {
  const ids = [
    ...createBuiltinActions(() => ({
      openCommandPalette: () => {},
      getListingLength: () => 0,
      getListingViewMode: () => "table" as const,
      getGridColumnCount: () => 1,
      getSelectedIndex: () => 0,
      getSelectedPaths: () => [],
      getCurrentPath: () => "/",
      setSelectedIndex: () => {},
      activateSelected: () => {},
      navigateTo: () => {},
      toggleMultiSelect: () => {},
      clearSelection: () => {},
      runBulkAction: noop,
      getDownloadablePaths: () => [],
      downloadPaths: noop,
      confirmAction: async () => true,
      getListingPathAt: () => null,
      getOperationTargets: () => [],
      getPrimaryPath: () => null,
      copySelection: noop,
      cutSelection: noop,
      pasteFromClipboard: noop,
      createNewFolder: noop,
      startRename: noop,
      selectAllVisible: noop,
      openSettings: () => {},
      toggleShowDotEntries: () => {},
      toggleListingViewMode: () => {},
      applyGlobalListingSettings: () => {},
    })),
    ...createHelpActions(() => ({
      openAbout: () => {},
      openKeyboardShortcuts: () => {},
    })),
    ...createPreviewViewerActions(() => ({
      getPreviewPaths: () => [],
      getCurrentPreviewPath: () => null,
      openPreview: () => {},
    })),
    ...createPreviewActions(() => ({
      toggleInfoDialog: () => {},
    })),
  ].map((action) => action.id);
  return [...new Set(ids)].sort();
}

test("every registered action has a mapped icon", () => {
  const missing = allRegisteredActionIds().filter((id) => actionIcon(id) == null);
  assert.deepEqual(missing, []);
});
