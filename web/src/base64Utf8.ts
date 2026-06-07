/** Base64-encode UTF-8 text (btoa alone only supports Latin1). */
export function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return base64EncodeBytes(bytes);
}

/** Base64-encode raw bytes. */
export function base64EncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
