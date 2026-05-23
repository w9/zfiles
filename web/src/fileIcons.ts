import manifest from "@/generated/file-icons-manifest.json";

export type FileIconTheme = "light" | "dark";

export type ResolveFileIconOptions = {
  name: string;
  isDir: boolean;
  theme?: FileIconTheme;
  atListingRoot?: boolean;
  expanded?: boolean;
};

type LightOverrides = {
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  rootFolderNames?: Record<string, string>;
  rootFolderNamesExpanded?: Record<string, string>;
};

type FileIconsManifest = {
  file: string;
  folder: string;
  folderExpanded: string;
  rootFolder?: string;
  rootFolderExpanded?: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  rootFolderNames: Record<string, string>;
  rootFolderNamesExpanded: Record<string, string>;
  light?: LightOverrides;
  iconFiles: Record<string, string>;
};

const ICONS = manifest as FileIconsManifest;
const ICON_BASE = "/file-icons";

function normalizeName(name: string): string {
  return name.toLowerCase();
}

function extensionCandidates(name: string): string[] {
  const parts = name.split(".");
  if (parts.length <= 1) {
    return [];
  }

  const candidates: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    candidates.push(parts.slice(index).join("."));
  }
  return candidates.sort((left, right) => right.length - left.length);
}

function pickLightOverride(
  theme: FileIconTheme,
  map: Record<string, string> | undefined,
  key: string,
  fallback: string | undefined,
): string | undefined {
  if (theme !== "light" || !map) {
    return fallback;
  }
  return map[key] ?? fallback;
}

function resolveIconKey(options: ResolveFileIconOptions): string {
  const { name, isDir, theme = "dark", atListingRoot = false, expanded = false } = options;
  const normalized = normalizeName(name);

  if (isDir) {
    if (atListingRoot) {
      const rootExpandedMap = ICONS.rootFolderNamesExpanded;
      const rootMap = ICONS.rootFolderNames;
      if (expanded) {
        const expandedKey = pickLightOverride(
          theme,
          ICONS.light?.rootFolderNamesExpanded,
          normalized,
          rootExpandedMap[normalized],
        );
        if (expandedKey) {
          return expandedKey;
        }
      }
      const rootKey = pickLightOverride(
        theme,
        ICONS.light?.rootFolderNames,
        normalized,
        rootMap[normalized],
      );
      if (rootKey) {
        return rootKey;
      }
    }

    const folderExpandedMap = ICONS.folderNamesExpanded;
    const folderMap = ICONS.folderNames;
    if (expanded) {
      const expandedKey = pickLightOverride(
        theme,
        ICONS.light?.folderNamesExpanded,
        normalized,
        folderExpandedMap[normalized],
      );
      if (expandedKey) {
        return expandedKey;
      }
      if (atListingRoot && ICONS.rootFolderExpanded) {
        return ICONS.rootFolderExpanded;
      }
      return ICONS.folderExpanded;
    }

    const folderKey = pickLightOverride(
      theme,
      ICONS.light?.folderNames,
      normalized,
      folderMap[normalized],
    );
    if (folderKey) {
      return folderKey;
    }
    if (atListingRoot && ICONS.rootFolder) {
      return ICONS.rootFolder;
    }
    return ICONS.folder;
  }

  const fileNameKey = pickLightOverride(
    theme,
    ICONS.light?.fileNames,
    normalized,
    ICONS.fileNames[normalized],
  );
  if (fileNameKey) {
    return fileNameKey;
  }

  for (const extension of extensionCandidates(name)) {
    const normalizedExtension = normalizeName(extension);
    const extensionKey = pickLightOverride(
      theme,
      ICONS.light?.fileExtensions,
      normalizedExtension,
      ICONS.fileExtensions[normalizedExtension],
    );
    if (extensionKey) {
      return extensionKey;
    }
  }

  return ICONS.file;
}

export function resolveFileIconUrl(options: ResolveFileIconOptions): string {
  const iconKey = resolveIconKey(options);
  const fileName = ICONS.iconFiles[iconKey];
  if (!fileName) {
    const fallback = ICONS.iconFiles[ICONS.file];
    return `${ICON_BASE}/${fallback ?? "file.svg"}`;
  }
  return `${ICON_BASE}/${fileName}`;
}
