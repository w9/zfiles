export type FileClipboardOperation = "copy" | "cut";

export type FileClipboard = {
  operation: FileClipboardOperation;
  paths: string[];
};
