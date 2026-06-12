import { useRef } from "react";
import { Upload } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DroppedUploadFile } from "@/useGlobalFileDrop";

type UploadButtonProps = {
  disabled?: boolean;
  onSelect: (dropped: DroppedUploadFile[]) => void;
};

export default function UploadButton({ disabled = false, onSelect }: UploadButtonProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const label = disabled ? t("upload.readOnly") : t("upload.chooseFiles");

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={label}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      {!disabled ? (
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) {
              onSelect(
                Array.from(files).map((file) => ({ file, sourceHandle: null })),
              );
            }
            event.target.value = "";
          }}
        />
      ) : null}
    </>
  );
}
