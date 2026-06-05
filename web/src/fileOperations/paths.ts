export function joinExplorerPath(parent: string, childName: string): string {
  const base = parent.replace(/^\/+|\/+$/g, "");
  const name = childName.replace(/^\/+|\/+$/g, "");
  if (!base) {
    return name;
  }
  if (!name) {
    return base;
  }
  return `${base}/${name}`;
}

export function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function parentExplorerPath(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

export function uniqueSiblingName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : "";
  let index = 1;
  while (existingNames.has(`${stem} (${index})${ext}`)) {
    index += 1;
  }
  return `${stem} (${index})${ext}`;
}

export function isDescendantPath(child: string, ancestor: string): boolean {
  const c = child.replace(/^\/+|\/+$/g, "");
  const a = ancestor.replace(/^\/+|\/+$/g, "");
  if (!a) {
    return false;
  }
  return c === a || c.startsWith(`${a}/`);
}
