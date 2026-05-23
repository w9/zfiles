import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateManifest, type Manifest } from "material-icon-theme";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsSrc = join(webRoot, "node_modules/material-icon-theme/icons");
const iconsDest = join(webRoot, "public/file-icons");
const manifestDest = join(webRoot, "src/generated/file-icons-manifest.json");

type LightOverrides = {
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  rootFolderNames?: Record<string, string>;
  rootFolderNamesExpanded?: Record<string, string>;
};

type SlimManifest = {
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

function collectIconKeys(manifest: Manifest): Set<string> {
  const keys = new Set<string>();
  const addFrom = (map?: Record<string, string>) => {
    if (!map) {
      return;
    }
    for (const value of Object.values(map)) {
      keys.add(value);
    }
  };

  addFrom(manifest.fileExtensions);
  addFrom(manifest.fileNames);
  addFrom(manifest.languageIds);
  addFrom(manifest.folderNames);
  addFrom(manifest.folderNamesExpanded);
  addFrom(manifest.rootFolderNames);
  addFrom(manifest.rootFolderNamesExpanded);

  for (const key of [
    manifest.file,
    manifest.folder,
    manifest.folderExpanded,
    manifest.rootFolder,
    manifest.rootFolderExpanded,
  ]) {
    if (key) {
      keys.add(key);
    }
  }

  if (manifest.light) {
    addFrom(manifest.light.fileExtensions);
    addFrom(manifest.light.fileNames);
    addFrom(manifest.light.folderNames);
    addFrom(manifest.light.folderNamesExpanded);
    addFrom(manifest.light.rootFolderNames);
    addFrom(manifest.light.rootFolderNamesExpanded);
  }

  return keys;
}

function slimLightOverrides(manifest: Manifest): LightOverrides | undefined {
  const light = manifest.light;
  if (!light) {
    return undefined;
  }

  return {
    fileExtensions: light.fileExtensions,
    fileNames: light.fileNames,
    folderNames: light.folderNames,
    folderNamesExpanded: light.folderNamesExpanded,
    rootFolderNames: light.rootFolderNames,
    rootFolderNamesExpanded: light.rootFolderNamesExpanded,
  };
}

function main() {
  if (!existsSync(iconsSrc)) {
    throw new Error(`material-icon-theme icons not found at ${iconsSrc}`);
  }

  const manifest = generateManifest({});
  const iconKeys = collectIconKeys(manifest);
  const iconFiles: Record<string, string> = {};

  rmSync(iconsDest, { recursive: true, force: true });
  mkdirSync(iconsDest, { recursive: true });

  for (const key of iconKeys) {
    const iconPath = manifest.iconDefinitions?.[key]?.iconPath;
    if (!iconPath) {
      throw new Error(`Missing icon definition for ${key}`);
    }
    const fileName = iconPath.split("/").pop();
    if (!fileName) {
      throw new Error(`Invalid icon path for ${key}: ${iconPath}`);
    }
    iconFiles[key] = fileName;
    cpSync(join(iconsSrc, fileName), join(iconsDest, fileName));
  }

  const slim: SlimManifest = {
    file: manifest.file ?? "file",
    folder: manifest.folder ?? "folder",
    folderExpanded: manifest.folderExpanded ?? manifest.folder ?? "folder-open",
    rootFolder: manifest.rootFolder,
    rootFolderExpanded: manifest.rootFolderExpanded,
    fileExtensions: manifest.fileExtensions ?? {},
    fileNames: manifest.fileNames ?? {},
    folderNames: manifest.folderNames ?? {},
    folderNamesExpanded: manifest.folderNamesExpanded ?? {},
    rootFolderNames: manifest.rootFolderNames ?? {},
    rootFolderNamesExpanded: manifest.rootFolderNamesExpanded ?? {},
    light: slimLightOverrides(manifest),
    iconFiles,
  };

  mkdirSync(dirname(manifestDest), { recursive: true });
  writeFileSync(manifestDest, `${JSON.stringify(slim)}\n`);
  console.log(`Generated ${Object.keys(iconFiles).length} file icons`);
}

main();
