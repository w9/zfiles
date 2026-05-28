import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dist = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : new URL("../dist", import.meta.url).pathname;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (path.endsWith(".gz") || path.endsWith(".br")) {
      continue;
    }
    const data = readFileSync(path);
    writeFileSync(`${path}.gz`, gzipSync(data));
    writeFileSync(
      `${path}.br`,
      brotliCompressSync(data, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
      }),
    );
  }
}

walk(dist);
