import PreviewPane from "./PreviewPane";
import { useTranslation } from "@/i18n";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { PREVIEW_PANEL_WIDTH_PX } from "./previewLayout";

type PreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null;
  onSymlinkTargetClick: (resolvedPath: string) => void;
};

export default function PreviewSheet({
  open,
  onOpenChange,
  path,
  onSymlinkTargetClick,
}: PreviewSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0"
        style={{ width: PREVIEW_PANEL_WIDTH_PX, maxWidth: "100vw" }}
      >
        <SheetTitle className="sr-only">{t("preview.label")}</SheetTitle>
        <PreviewPane
          path={path}
          onSymlinkTargetClick={onSymlinkTargetClick}
          className="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-transparent shadow-none"
        />
      </SheetContent>
    </Sheet>
  );
}
