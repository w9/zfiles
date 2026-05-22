import { apiFetch } from "./api";

const CHUNK_SIZE = 256 * 1024;

export type UploadProgress = {
  id: string;
  offset: number;
  length?: number;
};

function encodeMetadata(filename: string): string {
  return `filename ${btoa(filename)}`;
}

async function headOffset(location: string): Promise<number> {
  const response = await apiFetch(location, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`upload head failed: HTTP ${response.status}`);
  }
  return Number(response.headers.get("Upload-Offset") ?? "0");
}

export async function uploadFileResumable(
  file: File,
  targetPath: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<void> {
  const create = await apiFetch("/api/upload", {
    method: "POST",
    headers: {
      "Upload-Length": String(file.size),
      "Upload-Metadata": encodeMetadata(targetPath),
    },
  });

  if (!create.ok) {
    throw new Error(`upload create failed: HTTP ${create.status}`);
  }

  const location = create.headers.get("location");
  if (!location) {
    throw new Error("upload create missing location header");
  }

  const uploadId = location.split("/").pop() ?? location;
  let offset = await headOffset(location);

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const patch = await apiFetch(location, {
      method: "PATCH",
      headers: {
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: chunk,
    });

    if (!patch.ok) {
      offset = await headOffset(location);
      if (offset >= file.size) {
        break;
      }
      continue;
    }

    offset = Number(patch.headers.get("Upload-Offset") ?? String(offset + chunk.size));
    onProgress?.({ id: uploadId, offset, length: file.size });
  }
}
