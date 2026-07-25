import type { ActionDefinition } from "./types";

export type ConnectionActionDeps = {
  shareUrl: () => void | Promise<void>;
  openConnections: () => void;
  openNewConnection: () => void;
};

export function createConnectionActions(
  getDeps: () => ConnectionActionDeps,
): ActionDefinition[] {
  return [
    {
      id: "connection.switch",
      nameKey: "actions.connection.switch.name",
      categoryKey: "actions.connection.category",
      icon: "connection.switch",
      handler: async () => {
        getDeps().openConnections();
      },
    },
    {
      id: "connection.create",
      nameKey: "actions.connection.create.name",
      categoryKey: "actions.connection.category",
      when: "connection.manageable == true",
      icon: "connection.create",
      handler: async () => {
        getDeps().openNewConnection();
      },
    },
    {
      id: "connection.share-url",
      nameKey: "actions.connection.shareUrl.name",
      categoryKey: "actions.connection.category",
      when: "connection.kind == 's3'",
      icon: "connection.share-url",
      handler: async () => {
        await getDeps().shareUrl();
      },
    },
  ];
}
