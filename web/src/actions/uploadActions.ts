import type { ActionDefinition } from "./types";

export type UploadActionDeps = {
  openUploadPanel: () => void;
  chooseUploadFiles: () => void;
};

export function createUploadActions(getDeps: () => UploadActionDeps): ActionDefinition[] {
  return [
    {
      id: "file.upload-open-panel",
      nameKey: "actions.file.uploadOpenPanel.name",
      categoryKey: "actions.file.category",
      when: "server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      icon: "file.upload-open-panel",
      handler: async () => {
        getDeps().openUploadPanel();
      },
    },
    {
      id: "file.upload-choose-files",
      nameKey: "actions.file.uploadChooseFiles.name",
      categoryKey: "actions.file.category",
      when: "server.read-only == false",
      whenFailureMessageKey: "actions.whenFailure.readOnly",
      icon: "file.upload-choose-files",
      handler: async () => {
        getDeps().chooseUploadFiles();
      },
    },
  ];
}
