import assert from "node:assert/strict";
import test from "node:test";

import { createBuiltinActions } from "./builtins";
import { createAppearanceActions } from "./appearanceActions";
import { createCloudActions } from "./cloudActions";
import { createHelpActions } from "./helpActions";
import { createNavigationActions } from "./navigationActions";
import { createPreviewViewerActions } from "./previewViewerActions";
import { createPreviewActions } from "./previewActions";
import { createUploadActions } from "./uploadActions";
import { actionIcon } from "./icons";

const noop = async () => {};

function allRegisteredActionIds(): string[] {
  const ids = [
    ...createBuiltinActions(() => ({
      openCommandPalette: () => {},
      getListingLength: () => 0,
      getListingViewMode: () => "table" as const,
      getGridColumnCount: () => 1,
      getGridSectionFolderCount: () => 0,
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
      runWithPending: async (_actionId, fn) => fn(),
      selectAllVisible: noop,
      openSettings: () => {},
      toggleShowDotEntries: () => {},
      toggleListingViewMode: () => {},
      applyGlobalListingSettings: () => {},
      resetGridCardSize: () => {},
      toggleSelectionMode: () => {},
    })),
    ...createAppearanceActions(() => ({
      getThemeMode: () => "auto",
      setThemeMode: () => {},
      getUiMode: () => "auto",
      setUiMode: () => {},
      getLocale: () => "en",
      setLocale: () => {},
    })),
    ...createNavigationActions(() => ({
      goBack: () => {},
      goForward: () => {},
      refreshListing: () => {},
      cancelListingLoad: () => {},
      focusQuickFilter: () => {},
    })),
    ...createUploadActions(() => ({
      openUploadPanel: () => {},
      chooseUploadFiles: () => {},
    })),
    ...createCloudActions(() => ({
      shareUrl: () => {},
      disconnect: () => {},
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
