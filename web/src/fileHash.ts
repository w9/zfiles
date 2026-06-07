import { sha256 } from "@noble/hashes/sha256";

import { base64EncodeBytes } from "./base64Utf8";

const DEFAULT_CHUNK_SIZE = 256 * 1024;

/** Incrementally SHA-256 a blob without loading it entirely into memory. */
export async function sha256Base64(
  blob: Blob,
  chunkSize = DEFAULT_CHUNK_SIZE,
  signal?: AbortSignal,
): Promise<string> {
  const hash = sha256.create();
  let offset = 0;
  while (offset < blob.size) {
    if (signal?.aborted) {
      throw new DOMException("Upload aborted", "AbortError");
    }
    const chunk = blob.slice(offset, offset + chunkSize);
    const bytes = new Uint8Array(await chunk.arrayBuffer());
    hash.update(bytes);
    offset += chunkSize;
  }
  return base64EncodeBytes(hash.digest());
}

export async function sha256Base64Matches(
  blob: Blob,
  expectedBase64: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  signal?: AbortSignal,
): Promise<boolean> {
  const actual = await sha256Base64(blob, chunkSize, signal);
  return actual === expectedBase64;
}
