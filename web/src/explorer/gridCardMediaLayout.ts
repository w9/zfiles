/** Layout classes for the grid card media area (icon / image / video poster). */

/** Flex slot above the filename that fills remaining card height. */
export const GRID_CARD_MEDIA_SLOT_CLASS =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

/** Centered media shell that fills the slot without growing past it. */
export const GRID_CARD_MEDIA_SHELL_CLASS =
  "relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-2";

/** Image/video: fill the shell box; content letterboxed and centered. */
export const GRID_CARD_MEDIA_OBJECT_CLASS = "h-full w-full object-contain";
