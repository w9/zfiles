import { fileMatchesTusRecord, type TusSessionRecord } from "./tusSessions";

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

export async function pickFileForTusResume(
  record: TusSessionRecord,
  onMismatch: () => void,
): Promise<File | null> {
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker({ multiple: false });
      const file = await handle.getFile();
      if (!fileMatchesTusRecord(file, record)) {
        onMismatch();
        return null;
      }
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
  if (!fileMatchesTusRecord(picked, record)) {
    onMismatch();
    return null;
  }
  return picked;
}
