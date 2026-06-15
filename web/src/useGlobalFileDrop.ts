import { useEffect, useRef, useState } from "react";

export function dragEventHasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

export type DroppedUploadFile = {
  file: File;
  sourceHandle: FileSystemFileHandle | null;
};

/** Extract files (and handles when the browser provides them) from a drop event. */
export async function extractDroppedUploadFiles(
  dataTransfer: DataTransfer,
): Promise<DroppedUploadFile[]> {
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    // Read every File synchronously before any await — DataTransfer is cleared
    // once the drop handler yields (e.g. during getAsFileSystemHandle).
    const syncEntries: { item: DataTransferItem; file: File }[] = [];
    for (const item of items) {
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      syncEntries.push({ item, file });
    }
    if (syncEntries.length > 0) {
      const dropped: DroppedUploadFile[] = [];
      for (const { item, file } of syncEntries) {
        let sourceHandle: FileSystemFileHandle | null = null;
        if ("getAsFileSystemHandle" in item) {
          try {
            const handle = await item.getAsFileSystemHandle();
            if (handle.kind === "file") {
              sourceHandle = handle as FileSystemFileHandle;
            }
          } catch {
            // Fall back to File-only resume (picker on first resume).
          }
        }
        dropped.push({ file, sourceHandle });
      }
      return dropped;
    }
  }

  return Array.from(dataTransfer.files).map((file) => ({
    file,
    sourceHandle: null,
  }));
}

type UseGlobalFileDropOptions = {
  enabled: boolean;
  onDrop: (dropped: DroppedUploadFile[]) => void;
};

export function useGlobalFileDrop({ enabled, onDrop }: UseGlobalFileDropOptions) {
  const [dragging, setDragging] = useState(false);
  const depthRef = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    if (!enabled) {
      depthRef.current = 0;
      setDragging(false);
      return;
    }

    const onDragEnter = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current += 1;
      setDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setDragging(false);
      }
    };

    const onDropHandler = (event: DragEvent) => {
      if (!dragEventHasFiles(event)) {
        return;
      }
      event.preventDefault();
      depthRef.current = 0;
      setDragging(false);
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      void extractDroppedUploadFiles(dataTransfer).then((dropped) => {
        if (dropped.length > 0) {
          onDropRef.current(dropped);
        }
      });
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDropHandler);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDropHandler);
    };
  }, [enabled]);

  return { dragging };
}
