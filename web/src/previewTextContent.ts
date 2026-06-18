/** Soft cap: content beyond this is truncated for display. */
export const PREVIEW_TEXT_MAX_BYTES = 512 * 1024;

/** Hard cap: refuse fetch when Content-Length exceeds this (avoids huge downloads). */
export const PREVIEW_TEXT_HARD_MAX_BYTES = 5 * 1024 * 1024;

export type PreviewTextSuccess = {
  ok: true;
  text: string;
  truncated: boolean;
};

export type PreviewTextFailure = {
  ok: false;
  error: "fetch_failed" | "too_large";
};

export type PreviewTextResult = PreviewTextSuccess | PreviewTextFailure;

export function decodePreviewTextBytes(
  bytes: Uint8Array,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const truncated = bytes.length > maxBytes;
  const slice = truncated ? bytes.subarray(0, maxBytes) : bytes;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  return { text, truncated };
}

export async function fetchPreviewText(
  url: string,
  maxBytes: number = PREVIEW_TEXT_MAX_BYTES,
): Promise<PreviewTextResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: "fetch_failed" };
    }
    const contentLength = response.headers.get("content-length");
    if (
      contentLength != null &&
      Number(contentLength) > PREVIEW_TEXT_HARD_MAX_BYTES
    ) {
      return { ok: false, error: "too_large" };
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length > PREVIEW_TEXT_HARD_MAX_BYTES) {
      return { ok: false, error: "too_large" };
    }
    const { text, truncated } = decodePreviewTextBytes(bytes, maxBytes);
    return { ok: true, text, truncated };
  } catch {
    return { ok: false, error: "fetch_failed" };
  }
}
