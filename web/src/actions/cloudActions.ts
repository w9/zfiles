import type { ActionDefinition } from "./types";

export type CloudActionDeps = {
  shareUrl: () => void | Promise<void>;
  disconnect: () => void;
};

export function createCloudActions(getDeps: () => CloudActionDeps): ActionDefinition[] {
  return [
    {
      id: "cloud.share-url",
      nameKey: "actions.cloud.shareUrl.name",
      categoryKey: "actions.cloud.category",
      when: "cloud.connected == true",
      icon: "cloud.share-url",
      handler: async () => {
        await getDeps().shareUrl();
      },
    },
    {
      id: "cloud.disconnect",
      nameKey: "actions.cloud.disconnect.name",
      categoryKey: "actions.cloud.category",
      when: "cloud.connected == true",
      icon: "cloud.disconnect",
      handler: async () => {
        getDeps().disconnect();
      },
    },
  ];
}
