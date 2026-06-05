export type RunActionParams = {
  actionId: string;
  paths: string[];
  destDir?: string;
  newName?: string;
  overwrite?: boolean;
};
