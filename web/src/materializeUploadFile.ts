/** iOS/iPadOS WebKit mishandles repeated reads from picker-sourced File blobs. */
export function needsUploadFileMaterialization(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Read the file into memory once so hash/chunk reads do not hang on iOS. */
export async function materializeUploadFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  return new File([buffer], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export async function prepareUploadFile(file: File): Promise<File> {
  if (!needsUploadFileMaterialization()) {
    return file;
  }
  return materializeUploadFile(file);
}
