import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export function readZfilesVersion(): string {
  const cargoToml = fs.readFileSync(path.resolve(rootDir, "../Cargo.toml"), "utf8");
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? "0.0.0";
}
