export type PasteDestinationWhenFolderSelected =
  | "ask"
  | "into_selected_folder"
  | "into_current_directory";

export const PASTE_DESTINATION_STORAGE_KEY = "zfiles-paste-destination-when-folder-selected";

export const DEFAULT_PASTE_DESTINATION: PasteDestinationWhenFolderSelected = "ask";

export function parsePasteDestination(
  value: string | null,
): PasteDestinationWhenFolderSelected {
  if (value === "into_selected_folder" || value === "into_current_directory") {
    return value;
  }
  return DEFAULT_PASTE_DESTINATION;
}

export function readStoredPasteDestination(): PasteDestinationWhenFolderSelected {
  if (typeof window === "undefined") {
    return DEFAULT_PASTE_DESTINATION;
  }
  return parsePasteDestination(
    window.localStorage.getItem(PASTE_DESTINATION_STORAGE_KEY),
  );
}

export function storePasteDestination(value: PasteDestinationWhenFolderSelected): void {
  window.localStorage.setItem(PASTE_DESTINATION_STORAGE_KEY, value);
}
