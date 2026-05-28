export type ListingEntry = {
  key: string;
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  modified?: unknown;
  onSelect: (event: React.MouseEvent) => void;
  onActivate: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  href?: string;
};

export type ListingColumnLabels = {
  name: string;
  type: string;
  size: string;
  modified: string;
  typeDirectory: string;
  typeFile: string;
  locale: string;
};
