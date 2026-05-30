import { useEffect, useRef, useState } from "react";

export function dragEventHasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

type UseGlobalFileDropOptions = {
  enabled: boolean;
  onDrop: (files: FileList) => void;
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
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        onDropRef.current(files);
      }
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
