import type { ModifiedTimeFormat } from "@/settings/modifiedTimeFormat";
import type { ListingSortOrder } from "@/settings/listingSortOrder";

export type ListingEntry = {
  key: string;
  name: string;
  path: string;
  isDir: boolean;
  isSymlink?: boolean;
  quickFilterMatched?: boolean;
  size?: number;
  modified?: unknown;
  onSelect: (event: React.MouseEvent, displayIndex: number) => void;
  onActivate: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
};

export type ListingColumnLabels = {
  name: string;
  size: string;
  modified: string;
  locale: string;
  modifiedTimeFormat: ModifiedTimeFormat;
  listingSortOrder: ListingSortOrder;
};

export type ListingColumnHeaderAlign = "start" | "end";
