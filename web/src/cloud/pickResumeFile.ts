import {
  getStoredFileHandle,
  storeFileHandle,
} from "./multipartFileHandles";
import {
  fileMatchesMultipartRecord,
  fileMatchesMultipartRecordByHandle,
  type MultipartSessionRecord,
} from "./multipartSessions";

function fileInputPick(acceptName: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.setAttribute("aria-label", acceptName);
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickFileForMultipartResume(
  scopeId: string,
  record: MultipartSessionRecord,
  onMismatch: () => void,
): Promise<File | null> {
  const storedHandle = await getStoredFileHandle(scopeId, record.uploadId);
  if (storedHandle) {
    try {
      if ("queryPermission" in storedHandle && "requestPermission" in storedHandle) {
        const permission = await storedHandle.queryPermission({ mode: "read" });
        if (permission !== "granted") {
          const requested = await storedHandle.requestPermission({ mode: "read" });
          if (requested !== "granted") {
            throw new DOMException("File handle permission denied", "NotAllowedError");
          }
        }
      }
      const file = await storedHandle.getFile();
      if (fileMatchesMultipartRecordByHandle(file, record)) {
        return file;
      }
    } catch {
      // Fall through to file picker.
    }
  }

  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      if (!fileMatchesMultipartRecord(file, record)) {
        onMismatch();
        return null;
      }
      await storeFileHandle(scopeId, record.uploadId, handle);
      return file;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }
      if (err instanceof Error && err.name === "AbortError") {
        return null;
      }
    }
  }

  const picked = await fileInputPick(record.fileName);
  if (!picked) {
    return null;
  }
  if (!fileMatchesMultipartRecord(picked, record)) {
    onMismatch();
    return null;
  }
  return picked;
}
